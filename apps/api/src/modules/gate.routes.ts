/**
 * The gate.
 *
 * This is the one screen where the person using it is standing outside in the
 * sun with a truck waiting, and the decision they make is the difference
 * between material entering the site and not. Three things follow from that:
 *
 *  1. A gate decision is NEVER edited. `GateEvent` rows are written once. If a
 *     guard got it wrong, the correction is another row.
 *  2. The vehicle number is checked against the shape of an Indian plate, but a
 *     failed check WARNS and does not block. A guard who cannot record a real
 *     truck because the app dislikes its plate will write it on paper instead,
 *     and then there is no record at all.
 *  3. Permitting against a gate pass marks that pass arrived, in the same
 *     transaction. A pass that says "expected" for a truck that came in three
 *     hours ago is worse than no pass at all.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { notFound } from '../lib/errors.js';
import { toPaise, toRupees } from '../lib/money.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

/** PB 65 AB 1189 and friends. Warned on, never enforced. */
const PLATE_RE = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{4}$/;
const normPlate = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const gateRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  app.get(
    '/gate-passes',
    {
      preHandler: app.authenticate,
      schema: { tags: ['gate'], summary: 'Gate passes', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.gatePass.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((g) => ({
        id: g.id,
        po: g.poId,
        vendor: g.vendor,
        items: g.items,
        total: toRupees(g.total),
        by: g.by,
        status: g.status,
        at: g.createdAt.getTime(),
      }));
    },
  );

  app.post(
    '/gate-passes',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['gate'],
        summary: 'Issue a gate pass',
        body: z.object({
          id: z.string().trim().max(40).optional(),
          po: z.string().trim().max(40).optional(),
          vendor: z.string().trim().min(2).max(200),
          items: z.string().trim().min(2).max(500),
          total: z.number().min(0).max(1e12).default(0),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;
      const id = b.id ?? `GP-${(b.po ?? '').replace(/\D/g, '') || Date.now().toString().slice(-4)}`;

      const row = await db.$transaction(async (tx) => {
        const g = await tx.gatePass.upsert({
          where: { id },
          create: {
            id,
            poId: b.po ?? null,
            vendor: b.vendor,
            items: b.items,
            total: toPaise(b.total),
            by: me.name,
            status: 'expected',
          },
          update: { vendor: b.vendor, items: b.items, total: toPaise(b.total), status: 'expected' },
        });
        await appendInTx(tx, {
          kind: 'doc',
          subject: g.id,
          detail: `Gate pass ${g.id} issued for ${b.vendor} — ${b.items}.`,
          who: me.name,
        });
        return g;
      });

      return reply
        .status(201)
        .send({ ...row, total: toRupees(row.total), at: row.createdAt.getTime() });
    },
  );

  app.get(
    '/gate-events',
    {
      preHandler: app.authenticate,
      schema: { tags: ['gate'], summary: 'What the gate decided', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.gateEvent.findMany({ orderBy: { at: 'desc' }, take: 300 });
      return rows.map((e) => ({
        id: e.id,
        outcome: e.outcome,
        label: e.label,
        plate: e.plate,
        guard: e.guard,
        guardId: e.guardId,
        post: e.post,
        who: e.who,
        note: e.note,
        evidence: e.evidence,
        at: e.at.getTime(),
      }));
    },
  );

  /**
   * Record a gate decision.
   *
   * Deliberately open to any signed-in user, because the person at the gate is
   * a guard on the lowest tier and must never be unable to record what happened.
   */
  app.post(
    '/gate-events',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['gate'],
        summary: 'Record a permit or a refusal at the gate',
        description:
          'Written once and never edited. A wrong entry is corrected by recording another one.',
        body: z.object({
          outcome: z.enum(['permit', 'deny']),
          label: z.string().trim().min(2).max(300),
          plate: z.string().trim().max(20).default(''),
          post: z.string().trim().max(120).default(''),
          who: z.string().trim().max(200).default(''),
          note: z.string().trim().max(2000).default(''),
          /** Photographs taken at the gate. */
          evidence: z.array(z.record(z.string(), z.unknown())).default([]),
          /** The pass this arrival is against, if there is one. */
          passId: z.string().trim().max(40).optional(),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;

      const plate = b.plate ? normPlate(b.plate) : '';
      // A warning, never a refusal: a guard who cannot log a real truck will
      // write it on paper, and then there is no record at all.
      const plateOdd = Boolean(b.plate) && !PLATE_RE.test(b.plate.toUpperCase());

      const event = await db.$transaction(async (tx) => {
        const e = await tx.gateEvent.create({
          data: {
            outcome: b.outcome,
            label: b.label,
            plate,
            guard: me.name,
            guardId: me.personId ?? '',
            post: b.post,
            who: b.who,
            note: b.note,
            evidence: b.evidence as never,
          },
        });

        // A pass that still says "expected" for a truck that came in hours ago
        // is worse than no pass. Mark it in the same transaction.
        if (b.passId && b.outcome === 'permit') {
          await tx.gatePass
            .update({ where: { id: b.passId }, data: { status: 'arrived' } })
            .catch(() => undefined);
        }

        // A refusal is a decision someone may be asked about later.
        if (b.outcome === 'deny') {
          await appendInTx(tx, {
            kind: 'policy',
            subject: plate || b.label.slice(0, 40),
            detail: `Turned away at ${b.post || 'the gate'}: ${b.label}. ${b.note}`.trim(),
            who: me.name,
          });
        }

        await tx.usageCounter.upsert({
          where: { key: `gate:${b.outcome}` },
          create: { key: `gate:${b.outcome}`, count: 1 },
          update: { count: { increment: 1 } },
        });
        return e;
      });

      return reply.status(201).send({
        ...event,
        at: event.at.getTime(),
        plateWarning: plateOdd
          ? `"${b.plate}" does not look like a normal plate. Recorded as written — check it against the vehicle.`
          : null,
      });
    },
  );

  app.patch(
    '/gate-passes/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['gate'],
        summary: 'Move a pass along',
        params: z.object({ id: z.string() }),
        body: z.object({
          status: z.enum(['expected', 'arrived', 'unloaded', 'closed', 'cancelled']),
        }),
        response: { 200: z.any(), 404: z.any() },
      },
    },
    async (req) => {
      const pass = await db.gatePass.findUnique({ where: { id: req.params.id } });
      if (!pass) throw notFound(`Gate pass ${req.params.id}`);
      const row = await db.gatePass.update({
        where: { id: pass.id },
        data: { status: req.body.status },
      });
      return { ...row, total: toRupees(row.total), at: row.createdAt.getTime() };
    },
  );

  /* ------------------------------------------------------------ submittals */

  app.get(
    '/submittals',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['gate'],
        summary: 'Documents sent between departments',
        response: { 200: z.any() },
      },
    },
    async () => {
      const rows = await db.submittal.findMany({
        include: { versions: { orderBy: { v: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
      });
      return rows.map((s) => ({
        id: s.id,
        title: s.title,
        fromName: s.fromName,
        fromDept: s.fromDept,
        to: s.to,
        status: s.status,
        versions: s.versions.map((v) => ({
          v: v.v,
          fileName: v.fileName,
          by: v.by,
          note: v.note,
          at: v.at.getTime(),
        })),
      }));
    },
  );

  app.post(
    '/submittals',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['gate'],
        summary: 'Send a document to another department',
        body: z.object({
          title: z.string().trim().min(2).max(300),
          to: z.string().trim().min(2).max(60),
          fileName: z.string().trim().min(1).max(200),
          note: z.string().trim().max(1000).default(''),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;
      const count = await db.submittal.count();
      const id = `SUB-${2087 + count + 1}`;

      const row = await db.submittal.create({
        data: {
          id,
          title: b.title,
          fromName: me.name,
          fromDept: me.userKey,
          to: b.to,
          status: 'sent',
          versions: { create: { v: 1, fileName: b.fileName, by: me.name, note: b.note } },
        },
        include: { versions: true },
      });
      return reply.status(201).send({
        ...row,
        versions: row.versions.map((v) => ({ ...v, at: v.at.getTime() })),
      });
    },
  );

  /**
   * Revise a submittal.
   *
   * Adds a version; it never replaces one. The point of this screen is that
   * you can see the wrong version that went out and the corrected one that
   * followed, and who sent each.
   */
  app.post(
    '/submittals/:id/revise',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['gate'],
        summary: 'Send a corrected version',
        params: z.object({ id: z.string() }),
        body: z.object({
          fileName: z.string().trim().min(1).max(200),
          note: z.string().trim().max(1000).default(''),
        }),
        response: { 200: z.any(), 404: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const sub = await db.submittal.findUnique({
        where: { id: req.params.id },
        include: { versions: true },
      });
      if (!sub) throw notFound(`Submittal ${req.params.id}`);

      const row = await db.submittal.update({
        where: { id: sub.id },
        data: {
          status: 'revised',
          versions: {
            create: {
              v: sub.versions.length + 1,
              fileName: req.body.fileName,
              by: me.name,
              note: req.body.note,
            },
          },
        },
        include: { versions: { orderBy: { v: 'asc' } } },
      });
      return { ...row, versions: row.versions.map((v) => ({ ...v, at: v.at.getTime() })) };
    },
  );
};
