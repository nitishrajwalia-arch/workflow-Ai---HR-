/**
 * Reading and verifying the ledger.
 *
 * There is no endpoint that writes one directly, and that is not an oversight.
 * Entries are only ever appended by the operation they describe, inside its
 * transaction — see services/ledger.ts. An endpoint that let a client write an
 * arbitrary entry would make the whole record worth exactly nothing.
 *
 * There is also no endpoint that edits or deletes one. The database would refuse
 * it anyway; see the ledger_append_only migration.
 */

import { schemas } from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { verifyStoredChain } from '../services/ledger.js';

export const ledgerRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  app.get(
    '/ledger',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['ledger'],
        summary: 'The ledger, newest first',
        querystring: schemas.ledgerQuery,
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const { kind, subject, page, pageSize } = req.query;
      const where = { ...(kind ? { kind } : {}), ...(subject ? { subject } : {}) };
      const [rows, total] = await Promise.all([
        db.ledgerEntry.findMany({
          where,
          orderBy: { seq: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.ledgerEntry.count({ where }),
      ]);
      return { items: rows, page, pageSize, total };
    },
  );

  app.get(
    '/ledger/verify',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['ledger'],
        summary: 'Re-check every seal in the chain',
        description:
          'Walks the whole chain server-side and recomputes each seal. The browser runs the ' +
          'same check on what it was given, so a lying server is caught too.',
        response: { 200: schemas.ledgerVerification },
      },
    },
    async () => {
      const r = await verifyStoredChain(db);
      return r.ok
        ? { ok: true, count: r.count, head: r.head }
        : { ok: false, count: r.index, brokenAt: r.index, reason: r.reason, message: r.message };
    },
  );
};
