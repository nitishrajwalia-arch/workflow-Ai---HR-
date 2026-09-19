/**
 * Working hours and leave, per department.
 *
 * Each department keeps its own clock, set by its own manager. Horticulture
 * starts at 08:30 because the gardens are worked before the heat; Accounts opens
 * at 10:30. A single company-wide office-hours setting would be wrong for every
 * department except one, so there isn't one.
 *
 * Leave is stored per department too, even though HR answered that the rules do
 * not currently differ: the day one department gets something different, there
 * is a row to put it in rather than a schema change.
 */

import { schemas } from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { toDisplayDate } from '../lib/dates.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

export const policiesRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  app.get(
    '/dept-rules',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['policies'],
        summary: 'Working hours by department',
        response: { 200: z.any() },
      },
    },
    async () => {
      const rows = await db.deptRule.findMany();
      return Object.fromEntries(
        rows.map((r) => [
          r.dept,
          {
            in: r.in,
            out: r.out,
            hours: r.hours,
            days: r.days,
            grace: r.grace,
            setBy: r.setBy,
            setOn: r.setOn,
            note: r.note,
          },
        ]),
      );
    },
  );

  app.put(
    '/dept-rules/:dept',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['policies'],
        summary: 'Set a department clock',
        params: z.object({ dept: z.string().min(2).max(60) }),
        body: schemas.deptRuleBody,
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { dept } = req.params;
      const b = req.body;

      return db.$transaction(async (tx) => {
        // Stamped here, not taken from the client: the field exists to say when
        // somebody decided this.
        const stamped = { ...b, setOn: toDisplayDate(new Date()) };
        const row = await tx.deptRule.upsert({
          where: { dept },
          create: { dept, ...stamped },
          update: stamped,
        });
        await appendInTx(tx, {
          kind: 'policy',
          subject: dept,
          detail: `Working hours set ${b.in}-${b.out} by ${b.setBy}.`,
          who: me.name,
        });
        return row;
      });
    },
  );

  app.get(
    '/leave-policy',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['policies'],
        summary: 'Leave entitlement by department',
        response: { 200: z.any() },
      },
    },
    async () => {
      const rows = await db.leavePolicy.findMany();
      return Object.fromEntries(
        rows.map((r) => [
          r.dept,
          {
            casual: r.casual,
            sick: r.sick,
            earned: r.earned,
            halfDay: r.halfDay,
            lateAfter: r.lateAfter,
            lateStrikes: r.lateStrikes,
            carryForward: r.carryForward,
            encashable: r.encashable,
            probation: r.probation,
            maternityWeeks: r.maternityWeeks,
            paternityDays: r.paternityDays,
            notice: r.notice,
            setBy: r.setBy,
            setOn: r.setOn,
          },
        ]),
      );
    },
  );

  app.put(
    '/leave-policy/:dept',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['policies'],
        summary: 'Set leave entitlement',
        params: z.object({ dept: z.string().min(2).max(60) }),
        body: schemas.leavePolicyBody,
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { dept } = req.params;
      const b = req.body;

      return db.$transaction(async (tx) => {
        // Who decided it and when, from the session and the server's clock —
        // never from the client. A leave entitlement with nobody's name against
        // it is indistinguishable from one somebody made up.
        const stamped = { ...b, setBy: me.name, setOn: toDisplayDate(new Date()) };
        const row = await tx.leavePolicy.upsert({
          where: { dept },
          create: { dept, ...stamped },
          update: stamped,
        });
        await appendInTx(tx, {
          kind: 'policy',
          subject: dept,
          detail: `Leave set: ${b.casual} casual, ${b.sick} sick, ${b.earned} earned.`,
          who: me.name,
        });
        return row;
      });
    },
  );
};
