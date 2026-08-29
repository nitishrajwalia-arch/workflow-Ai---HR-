/**
 * Exits and full-and-final.
 *
 * Six stages, gated strictly in order. Two things the server insists on that a
 * browser flow cannot:
 *
 *  1. `fromStage` must equal the exit's current stage. Two people advancing the
 *     same exit from two screens would otherwise skip a stage between them —
 *     assets never actually collected, but recorded as collected.
 *  2. Clearing 'assets' is the point of no return: it marks the person exited
 *     and kills their card. That happens in the same transaction as the stage
 *     change, so there is no window in which one is true and the other is not.
 */

import {
  EXIT_STAGES,
  EXIT_STAGE_KEYS,
  EXIT_STAGE_THAT_DEACTIVATES,
  schemas,
} from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { nowStamp, toDisplayDate } from '../lib/dates.js';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

export const exitsRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  const serialise = (e: {
    id: string;
    personId: string;
    stage: string;
    reason: string;
    opened: string;
    closedAt: string | null;
    steps?: Array<{ stage: string; payload: unknown }>;
  }) => ({
    id: e.id,
    pid: e.personId,
    stage: e.stage,
    reason: e.reason,
    opened: e.opened,
    closedAt: e.closedAt,
    record: Object.fromEntries((e.steps ?? []).map((s) => [s.stage, s.payload])),
  });

  app.get(
    '/exits',
    {
      preHandler: app.requireRole('HR'),
      schema: { tags: ['exits'], summary: 'Open and closed exits', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.exit.findMany({
        include: { steps: true },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(serialise);
    },
  );

  app.get(
    '/exits/stages',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['exits'],
        summary: 'The six stages, in order',
        response: { 200: z.any() },
      },
    },
    async () => EXIT_STAGES,
  );

  app.post(
    '/exits',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['exits'],
        summary: 'Open a deboarding',
        body: schemas.openExitBody,
        response: { 201: z.any(), 409: schemas.errorBody },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const { pid, reason } = req.body;

      const person = await db.person.findUnique({ where: { id: pid } });
      if (!person) throw notFound(`Employee ${pid}`);

      const open = await db.exit.findFirst({
        where: { personId: pid, stage: { not: 'closed' } },
      });
      if (open) {
        throw conflict(
          `${person.name} already has a deboarding open at the "${open.stage}" stage. ` +
            'Continue that one rather than starting a second.',
        );
      }

      const created = await db.$transaction(async (tx) => {
        const exit = await tx.exit.create({
          data: { personId: pid, reason, opened: nowStamp(), stage: 'decision' },
          include: { steps: true },
        });
        await appendInTx(tx, {
          kind: 'exit',
          subject: pid,
          detail: `Deboarding opened for ${person.name}. Reason: ${reason}.`,
          who: me.name,
        });
        return exit;
      });

      return reply.status(201).send(serialise(created));
    },
  );

  app.post(
    '/exits/:id/advance',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['exits'],
        summary: 'Clear the current stage and move to the next',
        description:
          "`fromStage` must match the exit's current stage. If it does not, someone else has " +
          'already moved it and your screen is out of date.',
        params: z.object({ id: z.string() }),
        body: schemas.advanceExitBody,
        response: { 200: z.any(), 409: schemas.errorBody, 422: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { id } = req.params;
      const { fromStage, payload, summary } = req.body;

      const exit = await db.exit.findUnique({ where: { id }, include: { person: true } });
      if (!exit) throw notFound(`Exit ${id}`);

      if (exit.stage === 'closed') {
        throw unprocessable('That deboarding is already closed. Nothing further to clear.');
      }

      if (exit.stage !== fromStage) {
        throw conflict(
          `This deboarding is at the "${exit.stage}" stage, not "${fromStage}". ` +
            'Someone else has moved it since your screen loaded. Reload and look at what they recorded.',
        );
      }

      const index = EXIT_STAGE_KEYS.indexOf(exit.stage as (typeof EXIT_STAGE_KEYS)[number]);
      const next = EXIT_STAGE_KEYS[Math.min(EXIT_STAGE_KEYS.length - 1, index + 1)]!;

      const updated = await db.$transaction(async (tx) => {
        await tx.exitStep.create({
          data: {
            exitId: id,
            stage: exit.stage,
            payload: payload as never,
            summary,
            byId: me.sub,
          },
        });

        const closing = next === 'closed';
        const row = await tx.exit.update({
          where: { id },
          data: { stage: next, ...(closing ? { closedAt: nowStamp() } : {}) },
          include: { steps: true },
        });

        // Assets back and access revoked is the point at which they stop being
        // an employee. Both facts land in the same transaction or neither does.
        if (exit.stage === EXIT_STAGE_THAT_DEACTIVATES) {
          await tx.person.update({
            where: { id: exit.personId },
            data: { status: 'exited', exitedOn: toDisplayDate(new Date()) },
          });
        }

        await appendInTx(tx, {
          kind: 'exit',
          subject: exit.personId,
          detail: summary,
          who: me.name,
        });

        await tx.usageCounter.upsert({
          where: { key: 'exit:step' },
          create: { key: 'exit:step', count: 1 },
          update: { count: { increment: 1 } },
        });

        return row;
      });

      return serialise(updated);
    },
  );
};
