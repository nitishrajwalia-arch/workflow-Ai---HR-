/**
 * The rest of the system: calendar, incentives, attendance, HR tasks and
 * announcements, third-party connections, drafts — and access grants.
 *
 * ACCESS GRANTS ARE THE IMPORTANT ONE. The console used to say
 * "Access updated for {name} — they will see it the next time they sign in"
 * and then forget it the moment the screen closed. Nobody's access changed,
 * ever. It is rows now, and the announcement is true.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { toPaise, toRupees } from '../lib/money.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

export const platformRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  /* -------------------------------------------------------------- calendar */

  app.get(
    '/events',
    {
      preHandler: app.authenticate,
      schema: { tags: ['platform'], summary: 'Calendar', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.calendarEvent.findMany({ orderBy: { date: 'asc' } });
      return rows.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.time,
        kind: e.kind,
        priority: e.priority,
        audience: e.audience,
        by: e.by,
        note: e.note,
      }));
    },
  );

  app.post(
    '/events',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['platform'],
        summary: 'Put something in the calendar',
        body: z.object({
          title: z.string().trim().min(2).max(300),
          date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'A date looks like 2026-08-05.'),
          time: z.string().trim().max(10).default(''),
          kind: z.string().trim().max(20).default('task'),
          priority: z.string().trim().max(20).default('normal'),
          audience: z.record(z.string(), z.unknown()).default({ type: 'all' }),
          note: z.string().trim().max(2000).default(''),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const row = await db.calendarEvent.create({
        data: { ...req.body, audience: req.body.audience as never, by: me.name },
      });
      return reply.status(201).send(row);
    },
  );

  app.delete(
    '/events/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['platform'],
        summary: 'Remove an event',
        params: z.object({ id: z.string() }),
        response: { 200: z.any(), 403: z.any(), 404: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const ev = await db.calendarEvent.findUnique({ where: { id: req.params.id } });
      if (!ev) throw notFound('That event');
      // Your own, or you are an administrator. Otherwise people delete each
      // other's meetings and nobody knows why the room is empty.
      if (ev.by !== me.name && me.role !== 'ADMIN') {
        throw forbidden(`${ev.by} put that in the calendar. Ask them to remove it.`);
      }
      await db.calendarEvent.delete({ where: { id: ev.id } });
      return { ok: true as const };
    },
  );

  /* ------------------------------------------------------------ incentives */

  app.get(
    '/incentives',
    {
      preHandler: app.authenticate,
      schema: { tags: ['platform'], summary: 'Incentive schemes', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.incentivePackage.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((p) => ({ ...p, amount: toRupees(p.amount) }));
    },
  );

  app.post(
    '/incentives',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['platform'],
        summary: 'Propose an incentive',
        body: z.object({
          name: z.string().trim().min(2).max(200),
          amount: z.number().min(0).max(1e10),
          threshold: z.number().min(0).max(100).default(0),
          scale: z.number().min(1).max(100).default(10),
          dept: z.string().trim().max(60).default(''),
          period: z.string().trim().max(60).default(''),
          how: z.string().trim().max(2000).default(''),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const b = req.body;
      const row = await db.incentivePackage.create({
        data: { ...b, amount: toPaise(b.amount), status: 'proposed' },
      });
      return reply.status(201).send({ ...row, amount: toRupees(row.amount) });
    },
  );

  /**
   * Approve, decline or issue an incentive.
   *
   * Proposing and approving are separate acts. HR proposes; only an
   * administrator approves — this is money going to a named person, and a
   * scheme you can both write and approve is a scheme with no control on it.
   */
  app.post(
    '/incentives/:id/decide',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['platform'],
        summary: 'Approve, decline or issue an incentive',
        params: z.object({ id: z.string() }),
        body: z.object({
          action: z.enum(['approve', 'decline', 'issue']),
          who: z.string().trim().max(200).optional(),
        }),
        response: { 200: z.any(), 404: z.any(), 409: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const pkg = await db.incentivePackage.findUnique({ where: { id: req.params.id } });
      if (!pkg) throw notFound('That incentive');
      const { action, who } = req.body;

      if (action === 'issue') {
        if (pkg.status !== 'live') {
          throw conflict(
            `${pkg.name} is "${pkg.status}". An incentive has to be approved before it can be issued to anyone.`,
          );
        }
        if (!who) throw conflict('Name the person it is being issued to.');
      }

      const status = action === 'approve' ? 'live' : action === 'decline' ? 'declined' : 'issued';

      return db.$transaction(async (tx) => {
        const row = await tx.incentivePackage.update({
          where: { id: pkg.id },
          data: { status, ...(action === 'issue' ? { issuedTo: who } : {}) },
        });
        await appendInTx(tx, {
          kind: 'policy',
          subject: pkg.id,
          detail:
            action === 'issue'
              ? `Incentive "${pkg.name}" (₹${toRupees(pkg.amount).toLocaleString('en-IN')}) issued to ${who}.`
              : `Incentive "${pkg.name}" ${status}.`,
          who: me.name,
        });
        return { ...row, amount: toRupees(row.amount) };
      });
    },
  );

  /* ------------------------------------------------------------ attendance */

  app.get(
    '/attendance',
    {
      preHandler: app.requireRole('HR'),
      schema: { tags: ['platform'], summary: 'Attendance by person', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.attendanceDay.findMany({ orderBy: { date: 'asc' } });
      const out: Record<string, Array<{ date: string; in: string | null; out: string | null }>> = {};
      for (const r of rows) {
        (out[r.personId] ??= []).push({ date: r.date, in: r.inAt, out: r.outAt });
      }
      return out;
    },
  );

  app.post(
    '/attendance/import',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['platform'],
        summary: 'Import attendance from a biometric export',
        description:
          'Upserts on (person, date), so re-importing the same export changes nothing and a ' +
          'corrected export overwrites cleanly.',
        body: z.object({
          source: z.string().trim().max(60).default(''),
          rows: z
            .array(
              z.object({
                personId: z.string().trim().max(20),
                date: z.string().trim().max(20),
                in: z.string().trim().max(10).nullable().default(null),
                out: z.string().trim().max(10).nullable().default(null),
              }),
            )
            .min(1)
            .max(20_000),
        }),
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { rows, source } = req.body;

      const known = new Set((await db.person.findMany({ select: { id: true } })).map((p) => p.id));
      const accepted = rows.filter((r) => known.has(r.personId));
      const unknown = rows.length - accepted.length;

      // Chunked: a year of attendance for 200 people is 70,000 rows, and one
      // transaction that size will sit on locks for a long time.
      const CHUNK = 500;
      for (let i = 0; i < accepted.length; i += CHUNK) {
        const slice = accepted.slice(i, i + CHUNK);
        await db.$transaction(
          slice.map((r) =>
            db.attendanceDay.upsert({
              where: { personId_date: { personId: r.personId, date: r.date } },
              create: { personId: r.personId, date: r.date, inAt: r.in, outAt: r.out, source },
              update: { inAt: r.in, outAt: r.out, source },
            }),
          ),
        );
      }

      await db.hrLog.create({
        data: {
          at: new Date().toISOString(),
          who: me.name,
          what: `Imported ${accepted.length} attendance rows from ${source || 'a file'}.`,
        },
      });

      return {
        imported: accepted.length,
        // Not silent: rows for people who are not on the roster are the usual
        // sign that the wrong export was picked.
        skippedUnknownPeople: unknown,
        note: unknown
          ? `${unknown} rows were for employee IDs not on the roster and were skipped.`
          : null,
      };
    },
  );

  /* ------------------------------------------------------ tasks and notices */

  app.get(
    '/hr-tasks',
    {
      preHandler: app.requireRole('HR'),
      schema: { tags: ['platform'], summary: "HR's task list", response: { 200: z.any() } },
    },
    async () => db.hrTask.findMany({ orderBy: { createdAt: 'desc' } }),
  );

  app.post(
    '/hr-tasks',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['platform'],
        summary: 'Add a task',
        body: z.object({
          text: z.string().trim().min(2).max(500),
          who: z.string().trim().max(120).default(''),
          due: z.string().trim().max(40).default(''),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => reply.status(201).send(await db.hrTask.create({ data: req.body })),
  );

  app.post(
    '/hr-tasks/:id/toggle',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['platform'],
        summary: 'Tick a task off, or back on',
        params: z.object({ id: z.string() }),
        response: { 200: z.any(), 404: z.any() },
      },
    },
    async (req) => {
      const t = await db.hrTask.findUnique({ where: { id: req.params.id } });
      if (!t) throw notFound('That task');
      return db.hrTask.update({ where: { id: t.id }, data: { done: !t.done } });
    },
  );

  app.get(
    '/announcements',
    {
      preHandler: app.authenticate,
      schema: { tags: ['platform'], summary: 'Notices', response: { 200: z.any() } },
    },
    async () => db.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  );

  app.post(
    '/announcements',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['platform'],
        summary: 'Put out a notice',
        body: z.object({ text: z.string().trim().min(2).max(2000) }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      return reply
        .status(201)
        .send(await db.announcement.create({ data: { text: req.body.text, by: me.name } }));
    },
  );

  /* ----------------------------------------------------------- connections */

  app.get(
    '/connections',
    {
      preHandler: app.authenticate,
      schema: { tags: ['platform'], summary: 'Third-party connections', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.connection.findMany();
      return Object.fromEntries(rows.map((c) => [c.key, c.connected]));
    },
  );

  app.post(
    '/connections/:key',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['platform'],
        summary: 'Connect or disconnect a service',
        description:
          'Records that a connection exists and who made it. NO TOKEN IS STORED HERE — wiring a ' +
          'real OAuth flow means putting the token somewhere encrypted, not in this row.',
        params: z.object({ key: z.string().trim().max(40) }),
        body: z.object({ connected: z.boolean() }),
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { key } = req.params;
      const { connected } = req.body;

      return db.$transaction(async (tx) => {
        const row = await tx.connection.upsert({
          where: { key },
          create: { key, connected, connectedBy: me.sub, connectedAt: connected ? new Date() : null },
          update: { connected, connectedBy: me.sub, connectedAt: connected ? new Date() : null },
        });
        await appendInTx(tx, {
          kind: 'auth',
          subject: key,
          detail: `${key} ${connected ? 'connected' : 'disconnected'}.`,
          who: me.name,
        });
        return row;
      });
    },
  );

  /* ---------------------------------------------------------------- drafts */

  app.get(
    '/drafts',
    {
      preHandler: app.authenticate,
      schema: { tags: ['platform'], summary: 'Your unfinished forms', response: { 200: z.any() } },
    },
    async (req) => {
      const me = requireUser(req);
      // Your own only. A half-written letter is not other people's business.
      return db.draft.findMany({ where: { userId: me.sub }, orderBy: { updatedAt: 'desc' } });
    },
  );

  app.put(
    '/drafts/:type',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['platform'],
        summary: 'Save a draft',
        params: z.object({ type: z.string().trim().max(40) }),
        body: z.object({
          label: z.string().trim().max(200).default(''),
          data: z.record(z.string(), z.unknown()).default({}),
        }),
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      return db.draft.upsert({
        where: { userId_type: { userId: me.sub, type: req.params.type } },
        create: { userId: me.sub, type: req.params.type, label: req.body.label, data: req.body.data as never },
        update: { label: req.body.label, data: req.body.data as never },
      });
    },
  );

  app.delete(
    '/drafts/:type',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['platform'],
        summary: 'Throw a draft away',
        params: z.object({ type: z.string().trim().max(40) }),
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      await db.draft
        .delete({ where: { userId_type: { userId: me.sub, type: req.params.type } } })
        .catch(() => undefined);
      return { ok: true as const };
    },
  );

  /* --------------------------------------------------------- access grants */

  app.get(
    '/access',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['platform'],
        summary: 'Who can do what',
        response: { 200: z.any() },
      },
    },
    async () => {
      const rows = await db.accessGrant.findMany();
      const out: Record<string, Record<string, Record<string, boolean>>> = {};
      for (const r of rows) {
        ((out[r.userKey] ??= {})[r.area] ??= {})[r.power] = r.granted;
      }
      return out;
    },
  );

  /**
   * Change access.
   *
   * The console used to announce "Access updated for {name} — they will see it
   * the next time they sign in" and change nothing at all. These are rows now,
   * every change is sealed into the ledger against the administrator who made
   * it, and an administrator cannot quietly take their own rights away and
   * lock the system.
   */
  app.post(
    '/access',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['platform'],
        summary: 'Grant or revoke a power',
        body: z.object({
          userKey: z.string().trim().min(2).max(20),
          changes: z
            .array(
              z.object({
                area: z.string().trim().min(1).max(40),
                power: z.enum(['view', 'edit', 'approve', 'export']),
                granted: z.boolean(),
              }),
            )
            .min(1)
            .max(500),
        }),
        response: { 200: z.any(), 403: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { userKey, changes } = req.body;

      // Locking the last administrator out of the Access console is a support
      // call at best and a rebuild at worst.
      if (userKey === me.userKey) {
        const removingOwnAccess = changes.some((c) => c.area === 'access' && !c.granted);
        if (removingOwnAccess) {
          throw forbidden(
            'You cannot take your own access to this console away. Ask another administrator.',
          );
        }
      }

      await db.$transaction(async (tx) => {
        for (const c of changes) {
          await tx.accessGrant.upsert({
            where: { userKey_area_power: { userKey, area: c.area, power: c.power } },
            create: { userKey, area: c.area, power: c.power, granted: c.granted, updatedBy: me.sub },
            update: { granted: c.granted, updatedBy: me.sub },
          });
        }
        const granted = changes.filter((c) => c.granted).length;
        await appendInTx(tx, {
          kind: 'auth',
          subject: userKey,
          detail:
            `Access for the ${userKey} desk changed by ${me.name}: ` +
            `${granted} granted, ${changes.length - granted} revoked.`,
          who: me.name,
        });
      });

      const rows = await db.accessGrant.findMany({ where: { userKey } });
      const out: Record<string, Record<string, boolean>> = {};
      for (const r of rows) (out[r.area] ??= {})[r.power] = r.granted;
      return { userKey, grants: out, saved: true };
    },
  );

  /* ----------------------------------------------------------------- firms */

  app.get(
    '/firms',
    {
      preHandler: app.authenticate,
      schema: { tags: ['platform'], summary: 'Projects and the entity behind each', response: { 200: z.any() } },
    },
    async () => db.firm.findMany({ orderBy: { name: 'asc' } }),
  );
};
