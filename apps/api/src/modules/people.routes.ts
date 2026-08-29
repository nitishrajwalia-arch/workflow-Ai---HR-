/**
 * People.
 *
 * The one rule that governs this file: `office` (posted at) and `employer`
 * (paid by) are separate fields and neither is derived from the other. Marbella
 * Grand and Twin Towers are both Delhi Punjab Real Estates LLP; Security and
 * Labour sit on SRG. Getting this wrong sends the relieving letter out on the
 * wrong letterhead and names the wrong company on the PF challan.
 *
 * Changing someone's employer therefore requires a written reason and is sealed
 * into the ledger. Changing their office is an ordinary edit.
 */

import { schemas } from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { bothForms, nowStamp } from '../lib/dates.js';
import { badRequest, notFound } from '../lib/errors.js';
import { nextEmployeeId } from '../lib/ids.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';
import { serialisePerson, personInclude } from './serialisers.js';

export const peopleRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  app.get(
    '/people',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['people'],
        summary: 'List people',
        querystring: schemas.peopleQuery,
        response: {
          200: z.object({
            items: z.array(z.any()),
            page: z.number(),
            pageSize: z.number(),
            total: z.number(),
          }),
        },
      },
    },
    async (req) => {
      const { q, dept, office, employer, status, page, pageSize } = req.query;
      const where = {
        ...(dept ? { dept } : {}),
        ...(office ? { officeId: office } : {}),
        ...(employer ? { employerId: employer } : {}),
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { id: { contains: q.toUpperCase() } },
                { name: { contains: q, mode: 'insensitive' as const } },
                { designation: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        db.person.findMany({
          where,
          include: personInclude,
          orderBy: [{ dept: 'asc' }, { name: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.person.count({ where }),
      ]);

      return { items: rows.map(serialisePerson), page, pageSize, total };
    },
  );

  app.get(
    '/people/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['people'],
        summary: 'One person',
        params: z.object({ id: schemas.employeeId }),
        response: { 200: z.any(), 404: schemas.errorBody },
      },
    },
    async (req) => {
      const person = await db.person.findUnique({
        where: { id: req.params.id },
        include: personInclude,
      });
      if (!person) throw notFound(`Employee ${req.params.id}`);
      return serialisePerson(person);
    },
  );

  app.post(
    '/people',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['people'],
        summary: 'Add a person',
        body: schemas.createPersonBody,
        response: { 201: z.any(), 409: schemas.errorBody },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;

      const created = await db.$transaction(async (tx) => {
        const joined = bothForms(b.joined);
        const dob = b.dob ? bothForms(b.dob) : null;
        const id = b.id ?? (await nextEmployeeId(tx, b.dept));

        const person = await tx.person.create({
          data: {
            id,
            name: b.name,
            designation: b.designation,
            dept: b.dept,
            type: b.type,
            joined: joined.display,
            joinedOn: joined.on,
            dob: dob?.display ?? null,
            dobOn: dob?.on ?? null,
            status: b.status ?? 'active',
            perf: b.perf ?? 75,
            growth: b.growth ?? '',
            photo: b.photo ?? null,
            officeId: b.office,
            employerId: b.employer,
            reportsToId: b.reportsTo ?? null,
            ...(b.shift
              ? { shiftIn: b.shift.in, shiftOut: b.shift.out, shiftHours: b.shift.hours }
              : {}),
          },
          include: personInclude,
        });

        await appendInTx(tx, {
          kind: 'join',
          subject: person.id,
          detail: `${person.name} joined as ${person.designation}, employed by ${person.employer.name}.`,
          who: me.name,
        });
        return person;
      });

      return reply.status(201).send(serialisePerson(created));
    },
  );

  app.patch(
    '/people/:id',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['people'],
        summary: 'Edit a person',
        params: z.object({ id: schemas.employeeId }),
        body: schemas.updatePersonBody,
        response: { 200: z.any(), 404: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { id } = req.params;
      const b = req.body;

      // The employer is not editable here, on purpose: it needs a reason, and a
      // reason belongs in a request that is explicitly about changing it.
      if ('employer' in b && b.employer !== undefined) {
        throw badRequest(
          'Use POST /people/:id/employer to change who employs someone. ' +
            'It needs a written reason, because it decides which letterhead their papers go out on.',
        );
      }

      const existing = await db.person.findUnique({ where: { id } });
      if (!existing) throw notFound(`Employee ${id}`);

      const joined = b.joined ? bothForms(b.joined) : null;
      const dob = b.dob ? bothForms(b.dob) : null;

      const updated = await db.$transaction(async (tx) => {
        const person = await tx.person.update({
          where: { id },
          data: {
            ...(b.name !== undefined ? { name: b.name } : {}),
            ...(b.designation !== undefined ? { designation: b.designation } : {}),
            ...(b.dept !== undefined ? { dept: b.dept } : {}),
            ...(b.type !== undefined ? { type: b.type } : {}),
            ...(joined ? { joined: joined.display, joinedOn: joined.on } : {}),
            ...(dob ? { dob: dob.display, dobOn: dob.on } : {}),
            ...(b.status !== undefined ? { status: b.status } : {}),
            ...(b.exitedOn !== undefined ? { exitedOn: b.exitedOn } : {}),
            ...(b.perf !== undefined ? { perf: b.perf } : {}),
            ...(b.growth !== undefined ? { growth: b.growth } : {}),
            ...(b.photo !== undefined ? { photo: b.photo } : {}),
            ...(b.office !== undefined ? { officeId: b.office } : {}),
            ...(b.reportsTo !== undefined ? { reportsToId: b.reportsTo } : {}),
            ...(b.shift
              ? { shiftIn: b.shift.in, shiftOut: b.shift.out, shiftHours: b.shift.hours }
              : {}),
          },
          include: personInclude,
        });

        if (b.notes) {
          await tx.personNote.deleteMany({ where: { personId: id } });
          if (b.notes.length) {
            await tx.personNote.createMany({
              data: b.notes.map((n) => ({ personId: id, when: n.when, text: n.text })),
            });
          }
        }

        // Only the changes worth a permanent record go into the ledger. A
        // performance number moving from 74 to 76 is not one of them.
        const notable = [
          b.designation && b.designation !== existing.designation
            ? `designation ${existing.designation} to ${b.designation}`
            : null,
          b.dept && b.dept !== existing.dept ? `department ${existing.dept} to ${b.dept}` : null,
          b.office && b.office !== existing.officeId
            ? `posting ${existing.officeId} to ${b.office}`
            : null,
          b.status && b.status !== existing.status
            ? `status ${existing.status} to ${b.status}`
            : null,
        ].filter(Boolean);

        if (notable.length) {
          await appendInTx(tx, {
            kind: 'person',
            subject: id,
            detail: `${person.name}: ${notable.join('; ')}.`,
            who: me.name,
          });
        }
        return person;
      });

      return serialisePerson(updated);
    },
  );

  app.post(
    '/people/:id/employer',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['people'],
        summary: 'Change who employs someone',
        description:
          'A project is not an employer. This changes the legal entity that pays them, ' +
          'which decides the letterhead on every letter they are ever issued. It needs a reason ' +
          'and it is sealed into the ledger.',
        params: z.object({ id: schemas.employeeId }),
        body: schemas.setEmployerBody,
        response: { 200: z.any(), 404: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { id } = req.params;
      const { employer, reason } = req.body;

      const person = await db.person.findUnique({
        where: { id },
        include: { employer: true },
      });
      if (!person) throw notFound(`Employee ${id}`);

      const to = await db.company.findUnique({ where: { id: employer } });
      if (!to) throw notFound(`Company ${employer}`);

      const updated = await db.$transaction(async (tx) => {
        const p = await tx.person.update({
          where: { id },
          data: { employerId: employer },
          include: personInclude,
        });
        await appendInTx(tx, {
          kind: 'person',
          subject: id,
          detail:
            `${p.name} moved from ${person.employer.name} to ${to.name} on the payroll. ` +
            `Reason: ${reason}`,
          who: me.name,
          at: nowStamp(),
        });
        return p;
      });

      return serialisePerson(updated);
    },
  );

  app.get(
    '/people/:id/org',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['people'],
        summary: 'A person, their manager chain and their direct reports',
        description:
          'The chain is computed here rather than in the browser so the org board can open ' +
          'on one person without loading the whole roster first.',
        params: z.object({ id: schemas.employeeId }),
        response: { 200: z.any(), 404: schemas.errorBody },
      },
    },
    async (req) => {
      const { id } = req.params;
      const person = await db.person.findUnique({ where: { id }, include: personInclude });
      if (!person) throw notFound(`Employee ${id}`);

      // Walk up. Bounded, and guarded against a cycle: a broken reportsTo must
      // not spin the server.
      const chain: Array<{ id: string; name: string; designation: string }> = [];
      const seen = new Set<string>([id]);
      let cursor = person.reportsToId;
      while (cursor && chain.length < 20) {
        if (seen.has(cursor)) {
          req.log.error({ personId: id, cursor }, 'cycle in the reporting line');
          break;
        }
        seen.add(cursor);
        const boss = await db.person.findUnique({
          where: { id: cursor },
          select: { id: true, name: true, designation: true, reportsToId: true },
        });
        if (!boss) break;
        chain.push({ id: boss.id, name: boss.name, designation: boss.designation });
        cursor = boss.reportsToId;
      }

      const reports = await db.person.findMany({
        where: { reportsToId: id },
        include: personInclude,
        orderBy: { name: 'asc' },
      });

      return {
        person: serialisePerson(person),
        chain,
        reports: reports.map(serialisePerson),
        headcount: reports.length,
      };
    },
  );
};
