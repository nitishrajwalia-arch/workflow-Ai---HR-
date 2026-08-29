/**
 * Usage counters.
 *
 * Counts every action so you can see which parts get used and which are dead
 * weight. Unlike the browser-only build these survive a reload, because they are
 * rows rather than React state.
 */

import { schemas } from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

export const usageRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  app.get(
    '/usage',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['usage'],
        summary: 'Counters',
        response: { 200: z.record(z.string(), z.number()) },
      },
    },
    async () => {
      const rows = await db.usageCounter.findMany();
      return Object.fromEntries(rows.map((r) => [r.key, r.count]));
    },
  );

  app.post(
    '/usage/track',
    {
      preHandler: app.authenticate,
      // Fire-and-forget from the UI, so it gets its own generous budget rather
      // than eating the caller's ordinary one.
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
      schema: {
        tags: ['usage'],
        summary: 'Record that something was used',
        body: schemas.trackBody,
        response: { 200: schemas.okBody },
      },
    },
    async (req) => {
      const { key, count } = req.body;
      await db.usageCounter.upsert({
        where: { key },
        create: { key, count },
        update: { count: { increment: count } },
      });
      return { ok: true as const };
    },
  );
};
