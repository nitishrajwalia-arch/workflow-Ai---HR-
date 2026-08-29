/**
 * Salary, personal contacts and issued devices.
 *
 * Salary is gated to HR and above — the one place in this API where the role
 * check is about privacy rather than authority. The original build was honest
 * that salary sat in the file in plain text; here it sits in a table only two
 * roles can read, and it never appears in the bootstrap payload for anyone else.
 */

import { imeiCheck, emailCheck, phoneCheck, schemas } from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notFound, unprocessable } from '../lib/errors.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

export const payrollRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  /* -------------------------------------------------------------- salary */

  app.get(
    '/salaries',
    {
      preHandler: app.requireRole('HR'),
      schema: { tags: ['payroll'], summary: 'All salary structures', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.salary.findMany();
      return Object.fromEntries(
        rows.map((s) => [
          s.personId,
          { basic: s.basic, hra: s.hra, special: s.special, pf: s.pf, pt: s.pt, note: s.note },
        ]),
      );
    },
  );

  app.put(
    '/salaries/:pid',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Set a salary structure',
        params: z.object({ pid: schemas.employeeId }),
        body: schemas.salaryBody,
        response: { 200: z.any(), 404: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { pid } = req.params;
      const b = req.body;

      const person = await db.person.findUnique({ where: { id: pid } });
      if (!person) throw notFound(`Employee ${pid}`);

      const saved = await db.$transaction(async (tx) => {
        const row = await tx.salary.upsert({
          where: { personId: pid },
          create: { personId: pid, ...b },
          update: b,
        });
        // The ledger records THAT pay changed and who changed it, never the
        // figures. An audit trail should not become a second copy of payroll.
        await appendInTx(tx, {
          kind: 'salary',
          subject: pid,
          detail: `Salary structure for ${person.name} was set.`,
          who: me.name,
        });
        return row;
      });

      const gross = saved.basic + saved.hra + saved.special;
      return { ...saved, gross, net: gross - saved.pf - saved.pt };
    },
  );

  /* ------------------------------------------------------------ contacts */

  app.get(
    '/contacts',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Personal contact details',
        response: { 200: z.any() },
      },
    },
    async () => {
      const rows = await db.contact.findMany();
      return Object.fromEntries(
        rows.map((c) => [
          c.personId,
          { phone: c.phone, email: c.email, vPhone: c.vPhone, vEmail: c.vEmail },
        ]),
      );
    },
  );

  app.put(
    '/contacts/:pid',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Set personal contact details',
        description:
          'PERSONAL address only. The company address is refused: it is closed the day they ' +
          'leave, which is exactly when these details are needed.',
        params: z.object({ pid: schemas.employeeId }),
        body: schemas.contactBody,
        response: { 200: z.any(), 422: schemas.errorBody },
      },
    },
    async (req) => {
      const { pid } = req.params;
      const b = req.body;

      const problems: Array<{ path: string; message: string }> = [];
      if (b.email) {
        const e = emailCheck(b.email, { mustBePersonal: true });
        if (e.level === 'error') problems.push({ path: 'email', message: e.msg ?? '' });
      }
      if (b.phone) {
        const p = phoneCheck(b.phone);
        if (p.level === 'error') problems.push({ path: 'phone', message: p.msg ?? '' });
      }
      if (problems.length) throw unprocessable('Those contact details cannot be saved.', problems);

      const person = await db.person.findUnique({ where: { id: pid } });
      if (!person) throw notFound(`Employee ${pid}`);

      return db.contact.upsert({
        where: { personId: pid },
        create: { personId: pid, ...b },
        update: b,
      });
    },
  );

  /* ------------------------------------------------------------- devices */

  app.get(
    '/devices',
    {
      preHandler: app.requireRole('HR'),
      schema: { tags: ['payroll'], summary: 'Issued devices', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.device.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((d) => ({
        id: d.id,
        pid: d.personId,
        type: d.type,
        model: d.model,
        imei: d.imei,
        sim: d.sim,
        issued: d.issued,
      }));
    },
  );

  app.post(
    '/devices',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Issue a device',
        body: schemas.deviceBody,
        response: { 201: z.any(), 422: schemas.errorBody },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;

      // The IMEI check digit is arithmetic, not a guess, so a failure blocks.
      // A wrong IMEI is a device you cannot prove is yours.
      const check = imeiCheck(b.imei);
      if (check.level === 'error') {
        throw unprocessable(check.msg ?? 'That IMEI is not valid.', [
          { path: 'imei', message: check.msg ?? '' },
        ]);
      }

      const person = await db.person.findUnique({ where: { id: b.pid } });
      if (!person) throw notFound(`Employee ${b.pid}`);

      const created = await db.$transaction(async (tx) => {
        const row = await tx.device.create({
          data: {
            personId: b.pid,
            type: b.type,
            model: b.model,
            imei: b.imei,
            sim: b.sim,
            issued: b.issued,
          },
        });
        await appendInTx(tx, {
          kind: 'device',
          subject: b.pid,
          detail: `${b.type} ${b.model} issued to ${person.name}.`,
          who: me.name,
        });
        return row;
      });

      return reply.status(201).send({ ...created, pid: created.personId });
    },
  );

  app.delete(
    '/devices/:id',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Take a device back',
        params: z.object({ id: z.string() }),
        response: { 200: schemas.okBody, 404: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const device = await db.device.findUnique({
        where: { id: req.params.id },
        include: { person: true },
      });
      if (!device) throw notFound('That device');

      await db.$transaction(async (tx) => {
        await tx.device.delete({ where: { id: device.id } });
        await appendInTx(tx, {
          kind: 'device',
          subject: device.personId,
          detail: `${device.type} ${device.model} returned by ${device.person.name}.`,
          who: me.name,
        });
      });

      return { ok: true as const };
    },
  );
};
