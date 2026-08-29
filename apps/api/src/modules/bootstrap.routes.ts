/**
 * One request that hands the browser its whole world.
 *
 * WHY THIS EXISTS
 * ---------------
 * The existing UI reads everything out of one context object and expects each
 * collection to be present, synchronously, on first render. Forty screens, no
 * loading states. Rewriting all of them into per-screen queries would be weeks
 * of work and would break behaviour that is already correct and already tested
 * against a real client.
 *
 * So the API hands over the whole world once, and every mutation afterwards is
 * an individual, properly-scoped call. The browser patches its local copy.
 *
 * WHEN THIS STOPS BEING THE RIGHT TRADE
 * -------------------------------------
 * At 200 people this is a few hundred kilobytes, gzipped to far less, and it is
 * comfortably the cheapest correct thing. Watch for these and read
 * docs/FRONTEND-INTEGRATION.md when one arrives:
 *
 *   - the payload passes ~2 MB uncompressed (roughly 2,000 people), or
 *   - first paint on a site-office phone is visibly waiting on it, or
 *   - two people editing at once start overwriting each other.
 *
 * The migration is per-screen: swap one view to its own endpoint (they all
 * exist already), leave the rest on the bootstrap. Nothing has to happen at once.
 *
 * SALARY IS NOT IN HERE FOR EVERYONE. A VIEWER or MANAGER gets an empty map.
 * Role checks that live only in the browser are decoration.
 */

import { BOOTSTRAP_VERSION, roleAtLeast, type BootstrapPayload, type Role } from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '../plugins/auth.js';
import { ledgerHealth } from '../services/ledger.js';
import { personInclude, serialisePerson } from './serialisers.js';

export const bootstrapRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  app.get(
    '/bootstrap',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['bootstrap'],
        summary: 'Everything the UI needs, in one call',
        description:
          'Returns exactly the keys the existing ProcCtx provider supplies, so the front end ' +
          'can be pointed at a live server without rewriting its screens.',
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const canSeeMoney = roleAtLeast(me.role as Role, 'HR');

      const [
        people,
        cards,
        ledgerRows,
        salaries,
        devices,
        contacts,
        leave,
        deptRules,
        companies,
        projects,
        exits,
        usage,
        docs,
        jds,
        offices,
        hrLog,
        health,
        meUser,
      ] = await Promise.all([
        db.person.findMany({ include: personInclude, orderBy: [{ dept: 'asc' }, { name: 'asc' }] }),
        db.card.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
        db.ledgerEntry.findMany({ orderBy: { seq: 'desc' }, take: 1000 }),
        canSeeMoney ? db.salary.findMany() : Promise.resolve([]),
        canSeeMoney ? db.device.findMany({ orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
        canSeeMoney ? db.contact.findMany() : Promise.resolve([]),
        db.leavePolicy.findMany(),
        db.deptRule.findMany(),
        db.company.findMany({ orderBy: { name: 'asc' } }),
        db.project.findMany({ orderBy: { name: 'asc' } }),
        canSeeMoney
          ? db.exit.findMany({ include: { steps: true }, orderBy: { createdAt: 'desc' } })
          : Promise.resolve([]),
        db.usageCounter.findMany(),
        canSeeMoney
          ? db.docLog.findMany({
              orderBy: { createdAt: 'desc' },
              take: 500,
              include: { by: { select: { name: true } } },
            })
          : Promise.resolve([]),
        db.jobDescription.findMany(),
        db.office.findMany({ orderBy: { id: 'asc' } }),
        db.hrLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
        ledgerHealth(db),
        db.user.findUniqueOrThrow({
          where: { id: me.sub },
          include: { person: { select: { designation: true } } },
        }),
      ]);

      const payload: BootstrapPayload = {
        people: people.map(serialisePerson),
        cardLog: cards.map((c) => ({
          id: c.id,
          pid: c.personId,
          name: c.name,
          ver: c.ver,
          reason: c.reason,
          at: c.at,
          by: c.by,
          recv: c.recv,
          note: c.note,
          killed: c.killed,
          zonesKilled: c.zonesKilled,
        })),
        ledger: ledgerRows.map((l) => ({
          id: l.id,
          seq: l.seq,
          at: l.at,
          who: l.who,
          kind: l.kind,
          subject: l.subject,
          detail: l.detail,
          prev: l.prev,
          seal: l.seal,
        })),
        salaries: Object.fromEntries(
          salaries.map((s) => [
            s.personId,
            { basic: s.basic, hra: s.hra, special: s.special, pf: s.pf, pt: s.pt, note: s.note },
          ]),
        ),
        devices: devices.map((d) => ({
          id: d.id,
          pid: d.personId,
          type: d.type,
          model: d.model,
          imei: d.imei,
          sim: d.sim,
          issued: d.issued,
        })),
        contacts: Object.fromEntries(
          contacts.map((c) => [
            c.personId,
            { phone: c.phone, email: c.email, vPhone: c.vPhone, vEmail: c.vEmail },
          ]),
        ),
        leavePolicy: Object.fromEntries(
          leave.map((l) => [
            l.dept,
            {
              casual: l.casual,
              sick: l.sick,
              earned: l.earned,
              halfDay: l.halfDay,
              lateAfter: l.lateAfter,
            },
          ]),
        ),
        deptRules: Object.fromEntries(
          deptRules.map((r) => [
            r.dept,
            {
              in: r.in,
              out: r.out,
              hours: r.hours,
              days: r.days,
              grace: r.grace,
              setBy: r.setBy,
              note: r.note,
            },
          ]),
        ),
        companies: companies.map((c) => ({
          id: c.id,
          name: c.name,
          gstin: c.gstin,
          pan: c.pan,
          kind: c.kind,
          addr: c.addr,
        })),
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          short: p.short,
          company: p.companyId,
          reraStatus: p.reraStatus,
          rera: p.rera,
          stage: p.stage,
          addr: p.addr,
          tint: '#224A85',
        })),
        exits: exits.map((e) => ({
          id: e.id,
          pid: e.personId,
          stage: e.stage,
          reason: e.reason,
          opened: e.opened,
          closedAt: e.closedAt,
          record: Object.fromEntries(e.steps.map((s) => [s.stage, s.payload as unknown])),
        })),
        usage: Object.fromEntries(usage.map((u) => [u.key, u.count])),
        docLog: docs.map((d) => ({
          id: d.id,
          at: d.at,
          tpl: d.tpl,
          pid: d.personId,
          company: d.companyId,
          via: d.via,
          subject: d.subject,
          by: d.by?.name ?? '',
        })),
        jds: Object.fromEntries(jds.map((j) => [j.role, j.jd])),
        offices: offices.map((o) => ({ id: o.id, name: o.name, short: o.short, tint: o.tint })),
        hrLog: hrLog.map((h) => ({ at: h.at, who: h.who, what: h.what })),
        ledgerHealth: health,
        me: {
          id: meUser.id,
          name: meUser.name,
          email: meUser.email,
          role: meUser.role,
          personId: meUser.personId,
          title: meUser.person?.designation ?? meUser.role,
        },
        version: BOOTSTRAP_VERSION,
        generatedAt: new Date().toISOString(),
      };

      return payload;
    },
  );
};
