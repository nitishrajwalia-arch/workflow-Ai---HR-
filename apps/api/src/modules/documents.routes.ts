/**
 * Letters and job descriptions.
 *
 * BE HONEST ON THE SCREEN WHERE YOU PRESS SEND.
 *
 * `via: "email"` records that a letter was MEANT to go by email. It does not
 * send it — there is no mail gateway wired in. The response says so explicitly
 * in `delivered`, and the UI must show that rather than implying a send. When a
 * gateway is added, this is the one function that changes: see the note below.
 */

import { schemas } from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { nowStamp } from '../lib/dates.js';
import { notFound } from '../lib/errors.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

export const documentsRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  app.get(
    '/documents',
    {
      preHandler: app.requireRole('HR'),
      schema: { tags: ['documents'], summary: 'Letters issued', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.docLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: { by: { select: { name: true } } },
      });
      return rows.map((d) => ({
        id: d.id,
        at: d.at,
        tpl: d.tpl,
        pid: d.personId,
        company: d.companyId,
        via: d.via,
        subject: d.subject,
        by: d.by?.name ?? '',
      }));
    },
  );

  app.post(
    '/documents',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['documents'],
        summary: 'Record that a letter was issued',
        description:
          'Records the merge, the letterhead and the fact it went out. It does NOT send email: ' +
          'that needs a mail gateway. `delivered` in the response tells you which happened.',
        body: schemas.logDocBody,
        response: { 201: z.any(), 404: schemas.errorBody },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;

      const person = await db.person.findUnique({
        where: { id: b.pid },
        include: { employer: true },
      });
      if (!person) throw notFound(`Employee ${b.pid}`);

      const company = await db.company.findUnique({ where: { id: b.company } });
      if (!company) throw notFound(`Company ${b.company}`);

      // Not a refusal: HR may have a good reason to issue on another entity.
      // But it is the mistake that makes a letter worthless, so it is said out
      // loud and it goes into the permanent record.
      const wrongLetterhead =
        b.company !== person.employerId
          ? `Issued on ${company.name} letterhead, but ${person.name} is employed by ` +
            `${person.employer.name}. If that is deliberate, ignore this. If it is not, the letter is worthless.`
          : null;

      const created = await db.$transaction(async (tx) => {
        const at = nowStamp();
        const row = await tx.docLog.create({
          data: {
            at,
            tpl: b.tpl,
            personId: b.pid,
            companyId: b.company,
            via: b.via,
            subject: b.subject,
            body: b.body,
            byId: me.sub,
          },
        });
        await appendInTx(tx, {
          kind: 'doc',
          subject: b.pid,
          detail:
            `${b.tpl} issued for ${person.name} on ${company.name} letterhead (${b.via})` +
            (wrongLetterhead ? ' — letterhead differs from employer.' : '.'),
          who: me.name,
          at,
        });
        await tx.usageCounter.upsert({
          where: { key: `doc:${b.via}` },
          create: { key: `doc:${b.via}`, count: 1 },
          update: { count: { increment: 1 } },
        });
        return row;
      });

      return reply.status(201).send({
        id: created.id,
        at: created.at,
        tpl: created.tpl,
        pid: created.personId,
        company: created.companyId,
        via: created.via,
        subject: created.subject,
        // TO WIRE UP EMAIL: send here, and set `delivered` from the result. Do
        // not set it true until something actually accepted the message.
        delivered: false,
        deliveryNote:
          b.via === 'email'
            ? 'Recorded, not sent. No mail gateway is configured — see docs/DEPLOYMENT.md.'
            : 'Recorded.',
        warning: wrongLetterhead,
      });
    },
  );

  app.get(
    '/job-descriptions',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['documents'],
        summary: 'Saved job descriptions',
        response: { 200: z.any() },
      },
    },
    async () => {
      const rows = await db.jobDescription.findMany();
      return Object.fromEntries(rows.map((j) => [j.role, j.jd]));
    },
  );

  app.put(
    '/job-descriptions',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['documents'],
        summary: 'Save a job description',
        body: schemas.saveJdBody,
        response: { 200: schemas.okBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { role, jd } = req.body;
      await db.jobDescription.upsert({
        where: { role },
        create: { role, jd, updatedBy: me.name },
        update: { jd, updatedBy: me.name },
      });
      return { ok: true as const };
    },
  );
};
