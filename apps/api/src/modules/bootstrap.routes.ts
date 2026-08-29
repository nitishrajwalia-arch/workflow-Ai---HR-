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
import { qty, toRupees } from '../lib/money.js';
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

      // ---- the procurement half of MarbellaProcurementOS.jsx -----------------
      // Money-bearing collections are gated the same way salaries are: a desk
      // that may not see the numbers is not sent them.
      const [
        firms, vendors, pos, prs, reqs, invItems, invHolds, moves, caps,
        gatepasses, gateLog, subs, invoices, expenses, sales, reminders,
        banks, creditCards, masters, catalog, siteReports, events, packages,
        attRows, hrTasks, hrAnn, connections, drafts, accessGrants,
      ] = await Promise.all([
        db.firm.findMany({ orderBy: { name: 'asc' } }),
        db.vendor.findMany({ orderBy: { name: 'asc' } }),
        db.purchaseOrder.findMany({ orderBy: { createdAt: 'desc' } }),
        db.purchaseRequest.findMany({ where: { state: 'open' }, orderBy: { createdAt: 'desc' } }),
        db.requisition.findMany({ where: { state: 'open' }, orderBy: { createdAt: 'desc' } }),
        db.inventoryItem.findMany({ orderBy: { item: 'asc' } }),
        db.hold.findMany({ orderBy: { createdAt: 'desc' } }),
        db.stockMove.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }),
        db.storageCap.findMany(),
        db.gatePass.findMany({ orderBy: { createdAt: 'desc' } }),
        db.gateEvent.findMany({ orderBy: { at: 'desc' }, take: 300 }),
        db.submittal.findMany({ include: { versions: { orderBy: { v: 'asc' } } }, orderBy: { updatedAt: 'desc' } }),
        canSeeMoney ? db.vendorInvoice.findMany({ orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
        canSeeMoney ? db.expense.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }) : Promise.resolve([]),
        canSeeMoney ? db.sale.findMany({ orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
        canSeeMoney ? db.paymentReminder.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) : Promise.resolve([]),
        canSeeMoney ? db.bankAccount.findMany({ orderBy: { bank: 'asc' } }) : Promise.resolve([]),
        canSeeMoney ? db.creditCard.findMany({ orderBy: { bank: 'asc' } }) : Promise.resolve([]),
        canSeeMoney ? db.masterCompany.findMany({ orderBy: { name: 'asc' } }) : Promise.resolve([]),
        db.catalogItem.findMany({ orderBy: { name: 'asc' } }),
        db.siteReport.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
        db.calendarEvent.findMany({ orderBy: { date: 'asc' } }),
        db.incentivePackage.findMany({ orderBy: { createdAt: 'desc' } }),
        canSeeMoney ? db.attendanceDay.findMany() : Promise.resolve([]),
        canSeeMoney ? db.hrTask.findMany({ orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
        db.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
        db.connection.findMany(),
        db.draft.findMany({ where: { userId: me.sub } }),
        me.role === 'ADMIN' ? db.accessGrant.findMany() : Promise.resolve([]),
      ]);

      const heldByItem = new Map<string, number>();
      for (const h of invHolds) heldByItem.set(h.itemName, (heldByItem.get(h.itemName) ?? 0) + h.qty);

      const att: Record<string, Array<{ date: string; in: string | null; out: string | null }>> = {};
      for (const r of attRows) (att[r.personId] ??= []).push({ date: r.date, in: r.inAt, out: r.outAt });

      const grants: Record<string, Record<string, Record<string, boolean>>> = {};
      for (const g of accessGrants) ((grants[g.userKey] ??= {})[g.area] ??= {})[g.power] = g.granted;

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

      return {
        ...payload,

        // ---- procurement -----------------------------------------------------
        firms: firms.map((f) => ({ id: f.id, short: f.short, name: f.name, firm: f.firm, gstin: f.gstin, rera: f.rera, stage: f.stage, addr: f.addr })),
        vendors: vendors.map((v) => ({
          code: v.code, name: v.name, cat: v.cat, terms: v.terms, phone: v.phone,
          whatsapp: v.whatsapp, email: v.email, contact: v.contact, gst: v.gst,
          pan: v.pan, status: v.status, vcode: v.vcode, city: v.city, credit: v.credit,
        })),
        pos: pos.map((p) => ({ id: p.id, vendor: p.vendorName, item: p.item, amt: toRupees(p.amt), status: p.status, del: p.del })),
        prs: prs.map((p) => ({ id: p.id, item: p.item, qty: p.qty, when: p.when, proj: p.proj, by: p.by })),
        reqs: reqs.map((r) => ({ id: r.id, dept: r.dept, item: r.item, qty: r.qty })),
        inv: invItems.map((i) => ({
          item: i.item, unit: i.unit, qty: qty(i.qty), reorder: i.reorder, loc: i.loc, proj: i.proj,
          // Availability is computed here, not in the browser: held stock is on
          // the shelf but is not available, and a screen must not issue it.
          held: qty(heldByItem.get(i.item) ?? 0),
          available: qty(Math.max(0, i.qty - (heldByItem.get(i.item) ?? 0))),
        })),
        holds: invHolds.map((h) => ({ id: h.id, item: h.itemName, qty: qty(h.qty), unit: h.unit, days: h.days, by: h.by, why: h.why, at: h.createdAt.getTime() })),
        moves: moves.map((m) => ({ id: m.id, at: m.createdAt.getTime(), dir: m.dir, item: m.item, qty: qty(m.qty), unit: m.unit, ref: m.ref, bill: m.bill, who: m.who, note: m.note })),
        caps: caps.map((c) => ({ item: c.item, proj: c.proj, max: c.max, unit: c.unit, why: c.why })),

        // ---- gate ------------------------------------------------------------
        gatepasses: gatepasses.map((g) => ({ id: g.id, po: g.poId, vendor: g.vendor, items: g.items, total: toRupees(g.total), by: g.by, status: g.status, at: g.createdAt.getTime() })),
        gateLog: gateLog.map((e) => ({ id: e.id, at: e.at.getTime(), outcome: e.outcome, label: e.label, plate: e.plate, guard: e.guard, guardId: e.guardId, post: e.post, who: e.who, note: e.note, evidence: e.evidence })),
        subs: subs.map((s2) => ({
          id: s2.id, title: s2.title, fromName: s2.fromName, fromDept: s2.fromDept, to: s2.to, status: s2.status,
          versions: s2.versions.map((v) => ({ v: v.v, fileName: v.fileName, by: v.by, note: v.note, at: v.at.getTime() })),
        })),

        // ---- money -----------------------------------------------------------
        invoices: invoices.map((v) => ({ id: v.id, from: v.from, vendor: v.vendor, subj: v.subj, amt: toRupees(v.amt), po: v.po, gstin: v.gstin, age: v.age, state: v.state })),
        expenses: expenses.map((e) => ({ id: e.id, cat: e.cat, dept: e.dept, amt: toRupees(e.amt), party: e.party, date: e.date, src: e.src, how: e.how, ok: e.ok })),
        sales: sales.map((s2) => ({ id: s2.id, unit: s2.unit, tower: s2.tower, proj: s2.proj, firm: s2.firm, plan: s2.plan, price: toRupees(s2.price), booked: s2.booked, buyer: s2.buyer, phone: s2.phone, email: s2.email, received: s2.received })),
        reminders: reminders.map((r) => ({ id: r.id, saleId: r.saleId, buyer: r.buyer, channel: r.channel, subject: r.subject, body: r.body, approved: r.approved })),
        banks: banks.map((b) => ({ id: b.id, bank: b.bank, acc: b.acc, type: b.type, firm: b.firm, till: b.till, gaps: b.gaps, bal: toRupees(b.bal) })),
        creditCards: creditCards.map((c) => ({ id: c.id, bank: c.bank, last: c.last, holder: c.holder, limit: toRupees(c.limit), used: toRupees(c.used), cycle: c.cycle, due: c.due, firm: c.firm })),
        masters: masters.map((m) => ({ id: m.id, name: m.name, kind: m.kind, gstin: m.gstin, pan: m.pan, city: m.city })),

        // ---- platform --------------------------------------------------------
        catalog: catalog.map((c) => ({ name: c.name, unit: c.unit, rate: toRupees(c.rate), vendor: c.vendor })),
        reports: siteReports.map((r) => ({ id: r.id, cat: r.cat, by: r.by, proj: r.proj, text: r.text, sev: r.severity, media: r.media, when: r.createdAt.toISOString() })),
        events: events.map((e) => ({ id: e.id, title: e.title, date: e.date, time: e.time, kind: e.kind, priority: e.priority, audience: e.audience, by: e.by, note: e.note })),
        packages: packages.map((p) => ({ id: p.id, name: p.name, amount: toRupees(p.amount), threshold: p.threshold, scale: p.scale, dept: p.dept, period: p.period, how: p.how, status: p.status, issuedTo: p.issuedTo })),
        att,
        hrTasks: hrTasks.map((t) => ({ id: t.id, text: t.text, who: t.who, due: t.due, done: t.done })),
        hrAnn: hrAnn.map((a) => ({ id: a.id, text: a.text, by: a.by, when: a.createdAt.toISOString() })),
        conns: Object.fromEntries(connections.map((c) => [c.key, c.connected])),
        drafts: drafts.map((d) => ({ type: d.type, label: d.label, data: d.data, when: d.updatedAt.toISOString() })),
        grants,
      };
    },
  );
};
