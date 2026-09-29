/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * Salary, personal contacts, issued devices — and the monthly pay run.
 *
 * A PAY RUN is the thing HR hands to Accounts. It is worked out here, from the
 * person's structure and the company's policy, and never typed: a screen where
 * somebody can type over an earned gross is a screen where the figure Accounts
 * pays has no rule behind it. What HR sets is the days, the money the company is
 * taking back or adding, and the reason.
 *
 * Once RELEASED a run is frozen. The figures Accounts pays from and the figures
 * on the screen have to be the same figures, and "somebody changed it
 * afterwards" is the failure this exists to prevent. Correcting a released run
 * means a new one.
 *
 * Salary is gated to HR and above — the one place in this API where the role
 * check is about privacy rather than authority. The original build was honest
 * that salary sat in the file in plain text; here it sits in a table only two
 * roles can read, and it never appears in the bootstrap payload for anyone else.
 */

import {
  allowanceTotals,
  allowancesFor,
  asPayPolicy,
  computeLine,
  imeiCheck,
  emailCheck,
  monthWindow,
  payableDays,
  phoneCheck,
  readAdditions,
  readReductions,
  schemas,
  type AllowanceHead,
  type DeductionHead,
  type PayStructure,
} from '@marbella/shared';
import type { Prisma } from '@prisma/client';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { nowStamp, parseDisplayDate } from '../lib/dates.js';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { nextEmployeeId } from '../lib/ids.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** "Sep 2026" -> the first of that month, for sorting. */
function monthStart(month: string): Date {
  const [m, y] = month.split(' ');
  return new Date(Date.UTC(Number(y), Math.max(0, MONTHS.indexOf(m ?? '')), 1));
}

/**
 * A list of reductions, in the shape Prisma wants for a JSON column. The cast is
 * the whole of it: the value is already plain data, and Prisma's input type
 * cannot see that an array of interfaces is one.
 */
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export const payrollRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  /* -------------------------------------------------------------- salary */

  app.get(
    '/salaries',
    {
      preHandler: app.requireRole('HR'),
      schema: { tags: ['payroll'], summary: 'All salary structures', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.salary.findMany();
      return Object.fromEntries(
        rows.map((s) => [
          s.personId,
          {
            gross: s.gross,
            basic: s.basic,
            hra: s.hra,
            travel: s.travel,
            medical: s.medical,
            special: s.special,
            esiOn: s.esiOn,
            pfOn: s.pfOn,
            pfWages: s.pfWages,
            pf: s.pf,
            pt: s.pt,
            note: s.note,
          },
        ]),
      );
    },
  );

  app.put(
    '/salaries/:pid',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Set a salary structure',
        params: z.object({ pid: schemas.employeeId }),
        body: schemas.salaryBody,
        response: { 200: z.any(), 404: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { pid } = req.params;
      const b = req.body;

      const person = await db.person.findUnique({ where: { id: pid } });
      if (!person) throw notFound(`Employee ${pid}`);

      const saved = await db.$transaction(async (tx) => {
        const row = await tx.salary.upsert({
          where: { personId: pid },
          create: { personId: pid, ...b },
          update: b,
        });
        // The ledger records THAT pay changed and who changed it, never the
        // figures. An audit trail should not become a second copy of payroll.
        await appendInTx(tx, {
          kind: 'salary',
          subject: pid,
          detail: `Salary structure for ${person.name} was set.`,
          who: me.name,
        });
        return row;
      });

      // The gross is stored, not re-derived: adding basic + hra + special leaves
      // out travelling and medical, and every person on the company's own books
      // has at least one of them.
      return { ...saved, net: saved.gross - saved.pf - saved.pt };
    },
  );

  /* ------------------------------------------------------------ contacts */

  app.get(
    '/contacts',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Personal contact details',
        response: { 200: z.any() },
      },
    },
    async () => {
      const rows = await db.contact.findMany();
      return Object.fromEntries(
        rows.map((c) => [
          c.personId,
          { phone: c.phone, email: c.email, vPhone: c.vPhone, vEmail: c.vEmail },
        ]),
      );
    },
  );

  app.put(
    '/contacts/:pid',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Set personal contact details',
        description:
          'PERSONAL address only. The company address is refused: it is closed the day they ' +
          'leave, which is exactly when these details are needed.',
        params: z.object({ pid: schemas.employeeId }),
        body: schemas.contactBody,
        response: { 200: z.any(), 422: schemas.errorBody },
      },
    },
    async (req) => {
      const { pid } = req.params;
      const b = req.body;

      const problems: Array<{ path: string; message: string }> = [];
      if (b.email) {
        const e = emailCheck(b.email, { mustBePersonal: true });
        if (e.level === 'error') problems.push({ path: 'email', message: e.msg ?? '' });
      }
      if (b.phone) {
        const p = phoneCheck(b.phone);
        if (p.level === 'error') problems.push({ path: 'phone', message: p.msg ?? '' });
      }
      if (problems.length) throw unprocessable('Those contact details cannot be saved.', problems);

      const person = await db.person.findUnique({ where: { id: pid } });
      if (!person) throw notFound(`Employee ${pid}`);

      return db.contact.upsert({
        where: { personId: pid },
        create: { personId: pid, ...b },
        update: b,
      });
    },
  );

  /* ------------------------------------------------------------- devices */

  app.get(
    '/devices',
    {
      preHandler: app.requireRole('HR'),
      schema: { tags: ['payroll'], summary: 'Issued devices', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.device.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((d) => ({
        id: d.id,
        pid: d.personId,
        type: d.type,
        model: d.model,
        imei: d.imei,
        sim: d.sim,
        issued: d.issued,
      }));
    },
  );

  app.post(
    '/devices',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Issue a device',
        body: schemas.deviceBody,
        response: { 201: z.any(), 422: schemas.errorBody },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;

      // The IMEI check digit is arithmetic, not a guess, so a failure blocks.
      // A wrong IMEI is a device you cannot prove is yours.
      const check = imeiCheck(b.imei);
      if (check.level === 'error') {
        throw unprocessable(check.msg ?? 'That IMEI is not valid.', [
          { path: 'imei', message: check.msg ?? '' },
        ]);
      }

      const person = await db.person.findUnique({ where: { id: b.pid } });
      if (!person) throw notFound(`Employee ${b.pid}`);

      const created = await db.$transaction(async (tx) => {
        const row = await tx.device.create({
          data: {
            personId: b.pid,
            type: b.type,
            model: b.model,
            imei: b.imei,
            sim: b.sim,
            issued: b.issued,
          },
        });
        await appendInTx(tx, {
          kind: 'device',
          subject: b.pid,
          detail: `${b.type} ${b.model} issued to ${person.name}.`,
          who: me.name,
        });
        return row;
      });

      return reply.status(201).send({ ...created, pid: created.personId });
    },
  );

  app.delete(
    '/devices/:id',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Take a device back',
        params: z.object({ id: z.string() }),
        response: { 200: schemas.okBody, 404: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const device = await db.device.findUnique({
        where: { id: req.params.id },
        include: { person: true },
      });
      if (!device) throw notFound('That device');

      await db.$transaction(async (tx) => {
        await tx.device.delete({ where: { id: device.id } });
        await appendInTx(tx, {
          kind: 'device',
          subject: device.personId,
          detail: `${device.type} ${device.model} returned by ${device.person.name}.`,
          who: me.name,
        });
      });

      return { ok: true as const };
    },
  );

  /* ----------------------------------------------------- reduction heads */

  app.get(
    '/deduction-heads',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'What comes off a payslip, per company',
        response: { 200: z.any() },
      },
    },
    async () => {
      const rows = await db.deductionHead.findMany({
        orderBy: [{ companyId: 'asc' }, { sort: 'asc' }, { code: 'asc' }],
      });
      const out: Record<string, unknown[]> = {};
      for (const h of rows) {
        (out[h.companyId] ??= []).push({
          code: h.code,
          label: h.label,
          basis: h.basis,
          rate: h.rate,
          employerRate: h.employerRate,
          wage: h.wage,
          personWage: h.personWage,
          ceiling: h.ceiling,
          proRate: h.proRate,
          requires: h.requires,
          rounding: h.rounding,
          authority: h.authority,
          note: h.note,
          active: h.active,
          sort: h.sort,
          setBy: h.setBy,
          setOn: h.setOn,
        });
      }
      return out;
    },
  );

  app.put(
    '/deduction-heads/:company/:code',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Set or change a reduction head',
        description:
          'A rate is not checked against the law — the law is not in here, and a ' +
          'company that is behind on a change needs to be able to say so. What is ' +
          'required is the rule it comes from, and whoever saves it is named on it. ' +
          'A head already used on a RELEASED run is not reworked: those figures are ' +
          'what Accounts paid, and they stay as they were.',
        params: z.object({ company: schemas.slug, code: z.string().trim().min(2).max(24) }),
        body: schemas.deductionHeadBody,
        response: { 200: z.any(), 404: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { company, code } = req.params;
      const bd = req.body;
      if (bd.code !== code.toLowerCase()) {
        throw unprocessable('The key in the address and the key in the body must match.', [
          { path: 'code', message: 'does not match the address' },
        ]);
      }
      const co = await db.company.findUnique({ where: { id: company } });
      if (!co) throw notFound(`Company ${company}`);

      const saved = await db.$transaction(async (tx) => {
        const row = await tx.deductionHead.upsert({
          where: { companyId_code: { companyId: company, code: bd.code } },
          create: { companyId: company, ...bd, setBy: me.name, setOn: nowStamp() },
          update: { ...bd, setBy: me.name, setOn: nowStamp() },
        });
        await appendInTx(tx, {
          kind: 'payroll',
          subject: `${company} ${bd.code}`,
          detail: `${bd.label} ${bd.active ? 'set' : 'switched off'} for ${co.name} — ${bd.authority}`,
          who: me.name,
        });
        return row;
      });
      return { ...saved, updatedAt: undefined };
    },
  );

  /* ---------------------------------------------------- allowance heads */

  app.get(
    '/allowance-heads',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'What goes on a payslip on top of the salary, per company',
        response: { 200: z.any() },
      },
    },
    async () => {
      const rows = await db.allowanceHead.findMany({
        orderBy: [{ companyId: 'asc' }, { sort: 'asc' }, { code: 'asc' }],
      });
      const out: Record<string, unknown[]> = {};
      for (const h of rows) {
        (out[h.companyId] ??= []).push({
          code: h.code,
          label: h.label,
          basis: h.basis,
          rate: h.rate,
          wage: h.wage,
          ceiling: h.ceiling,
          floor: h.floor,
          proRate: h.proRate,
          rounding: h.rounding,
          appliesTo: h.appliesTo,
          taxable: h.taxable,
          authority: h.authority,
          note: h.note,
          active: h.active,
          sort: h.sort,
          setBy: h.setBy,
          setOn: h.setOn,
        });
      }
      return out;
    },
  );

  app.put(
    '/allowance-heads/:company/:code',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Set or change an allowance',
        description:
          'The policy it comes from is required. A figure on a payslip that nobody ' +
          'can trace to a decision is a figure somebody will have to defend without ' +
          'help, and whoever saves it is named on it. An allowance already paid on a ' +
          'RELEASED run is not reworked: those figures are what Accounts paid.',
        params: z.object({ company: schemas.slug, code: z.string().trim().min(2).max(24) }),
        body: schemas.allowanceHeadBody,
        response: { 200: z.any(), 404: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { company, code } = req.params;
      const bd = req.body;
      if (bd.code !== code.toLowerCase()) {
        throw unprocessable('The key in the address and the key in the body must match.', [
          { path: 'code', message: 'does not match the address' },
        ]);
      }
      const co = await db.company.findUnique({ where: { id: company } });
      if (!co) throw notFound(`Company ${company}`);

      const saved = await db.$transaction(async (tx) => {
        const row = await tx.allowanceHead.upsert({
          where: { companyId_code: { companyId: company, code: bd.code } },
          create: { companyId: company, ...bd, setBy: me.name, setOn: nowStamp() },
          update: { ...bd, setBy: me.name, setOn: nowStamp() },
        });
        await appendInTx(tx, {
          kind: 'payroll',
          subject: `${company} ${bd.code}`,
          detail:
            `${bd.label} ${bd.active ? 'set' : 'withdrawn'} for ${co.name}` +
            `${bd.appliesTo ? ` (${bd.appliesTo} only)` : ''} — ${bd.authority}`,
          who: me.name,
        });
        return row;
      });
      return { ...saved, updatedAt: undefined };
    },
  );

  /* ------------------------------------------------------------ pay runs */

  /** The policy and structure a person is paid on, ready for the engine. */
  const structureOf = (s: {
    gross: number;
    basic: number;
    hra: number;
    travel: number;
    medical: number;
    special: number;
    esiOn: boolean;
    pfOn: boolean;
    pfWages: number;
  }): PayStructure => ({ ...s });

  /** What comes off a payslip at this company, in the order it is shown. */
  const headsOf = async (companyId: string): Promise<DeductionHead[]> => {
    const rows = await db.deductionHead.findMany({
      where: { companyId },
      orderBy: [{ sort: 'asc' }, { code: 'asc' }],
    });
    return rows.map((h) => ({
      code: h.code,
      label: h.label,
      basis: h.basis as DeductionHead['basis'],
      rate: h.rate,
      employerRate: h.employerRate,
      wage: h.wage,
      personWage: h.personWage,
      ceiling: h.ceiling,
      proRate: h.proRate,
      requires: h.requires,
      rounding: h.rounding === 'up' ? 'up' : 'nearest',
      authority: h.authority,
      active: h.active,
    }));
  };

  /** What goes on it on top of the salary, in the order it is shown. */
  const allowancesOf = async (companyId: string): Promise<AllowanceHead[]> => {
    const rows = await db.allowanceHead.findMany({
      where: { companyId },
      orderBy: [{ sort: 'asc' }, { code: 'asc' }],
    });
    return rows.map((h) => ({
      code: h.code,
      label: h.label,
      basis: h.basis as AllowanceHead['basis'],
      rate: h.rate,
      wage: h.wage,
      ceiling: h.ceiling,
      floor: h.floor,
      proRate: h.proRate,
      rounding: h.rounding === 'up' ? 'up' : 'nearest',
      appliesTo: h.appliesTo,
      taxable: h.taxable,
      authority: h.authority,
      active: h.active,
    }));
  };

  /**
   * One shape for a pay run, everywhere it leaves this API.
   *
   * Every write returns the WHOLE run rather than a summary, so the browser
   * splices in what the server actually holds instead of guessing what changed.
   * On a payroll screen a client-side guess about a figure is how somebody ends
   * up reading a number the server never agreed to.
   */
  const fullRun = async (id: string) => {
    const r = await db.payRun.findUniqueOrThrow({
      where: { id },
      include: { lines: { orderBy: { name: 'asc' } } },
    });
    return {
      id: r.id,
      month: r.month,
      company: r.companyId,
      monthDays: r.monthDays,
      status: r.status,
      source: r.source,
      note: r.note,
      createdBy: r.createdBy,
      releasedBy: r.releasedBy,
      releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
      lines: r.lines.map((l) => ({
        id: l.id,
        pid: l.personId,
        name: l.name,
        designation: l.designation,
        days: l.days,
        gross: l.gross,
        basic: l.basic,
        hra: l.hra,
        travel: l.travel,
        medical: l.medical,
        special: l.special,
        eBasic: l.eBasic,
        eHra: l.eHra,
        eTravel: l.eTravel,
        eMedical: l.eMedical,
        eSpecial: l.eSpecial,
        eGross: l.eGross,
        dEsi: l.dEsi,
        dPf: l.dPf,
        dTds: l.dTds,
        dAdvance: l.dAdvance,
        dOther: l.dOther,
        dTotal: l.dTotal,
        erEsi: l.erEsi,
        erPf: l.erPf,
        erOther: l.erOther,
        reductions: readReductions(l.reductions),
        additions: readAdditions(l.additions),
        eAllow: l.eAllow,
        /* The attendance this line was worked out from. It goes to the client
           because it goes on the file Accounts pays from, and a payslip query
           that has to come back to HR to be re-derived is the thing this
           replaces. -1 means not recorded, and stays -1 all the way through. */
        dPresent: l.dPresent,
        dAbsent: l.dAbsent,
        dWeekOff: l.dWeekOff,
        dHoliday: l.dHoliday,
        dLeave: l.dLeave,
        dLost: l.dLost,
        extraDays: l.extraDays,
        extraAmount: l.extraAmount,
        arrear: l.arrear,
        net: l.net,
        payable: l.net + l.extraAmount,
        remark: l.remark,
      })),
    };
  };

  app.get(
    '/pay-runs',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Every pay run, newest month first',
        response: { 200: z.any() },
      },
    },
    async () => {
      const ids = await db.payRun.findMany({
        orderBy: [{ monthOn: 'desc' }, { companyId: 'asc' }],
        select: { id: true },
      });
      return Promise.all(ids.map((r) => fullRun(r.id)));
    },
  );

  app.post(
    '/pay-runs',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Work out a month for a company',
        description:
          "Takes everyone the company employs, their structure, and the month's " +
          'attendance, and drafts a line each. Nothing is paid and nothing is sent: ' +
          'it is a draft until somebody releases it.',
        body: schemas.payRunBody,
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { month, company, monthDays, attendanceMonth, only } = req.body;

      const existing = await db.payRun.findUnique({
        where: { companyId_month: { companyId: company, month } },
      });
      if (existing?.status !== 'draft' && existing) {
        throw unprocessable(
          `${month} has already been released for this company. A released run is not ` +
            'reworked — it is what Accounts paid from. Correcting it means a new run.',
          [{ path: 'month', message: 'already released' }],
        );
      }

      const policyRow = await db.salaryPolicy.findUnique({ where: { companyId: company } });
      if (!policyRow) {
        throw unprocessable(
          'That company has no salary policy, so there is no rule to work a payslip out with.',
          [{ path: 'company', message: 'no salary policy' }],
        );
      }
      const policy = asPayPolicy(policyRow);
      const heads = await headsOf(company);
      const allowHeads = await allowancesOf(company);

      /* WHO IS ON THIS RUN.
         Everybody the company currently employs — AND anybody who left during
         the month being worked out, because their last salary has not been
         paid yet. Deboarding marks somebody exited when their assets come
         back, which is BEFORE the full-and-final stage; a run that asked only
         for `active` people dropped them at exactly that point and paid them
         nothing for the days they had worked. Somebody who left in an earlier
         month is filtered out below, by the window. */
      const people = await db.person.findMany({
        where: {
          employerId: company,
          OR: [{ status: 'active' }, { exitedOn: { not: null } }],
          // Empty list means everybody, which is the ordinary run.
          ...(only.length ? { id: { in: only } } : {}),
        },
        include: { salary: true },
        orderBy: { name: 'asc' },
      });
      if (only.length && !people.length) {
        throw unprocessable(
          'None of the people chosen are active employees of that company, so there ' +
            'is nothing to work out.',
          [{ path: 'only', message: 'nobody to run' }],
        );
      }

      // The month's attendance, if there is any. A person the machine does not
      // cover gets the full month, and the line says so — which is what happens
      // today, and is better than paying nobody.
      const att = attendanceMonth
        ? await db.attendanceDay.findMany({ where: { date: { endsWith: attendanceMonth } } })
        : [];
      const absent = new Map<string, string[]>();
      const onMachine = new Set<string>();
      for (const a of att) {
        onMachine.add(a.personId);
        // No punch either way is an absence. One punch is a day worked with a
        // missing swipe, which is a thing to chase, not a day to dock.
        if (!a.inAt && !a.outAt) {
          const days = absent.get(a.personId) ?? [];
          days.push(a.date);
          absent.set(a.personId, days);
        }
      }
      const holidays = await db.holiday.findMany({ where: { allSites: true } });
      const holidayDates = holidays.map((h) => h.on);

      /* An allowance can be granted to one site. The person carries an office
         id; the policy is written with the site's short name on it, because
         that is what somebody says out loud. This is the join between them. */
      const siteOf = new Map(
        (await db.office.findMany({ select: { id: true, short: true } })).map((o) => [o.id, o.short]),
      );

      const run = await db.$transaction(async (tx) => {
        const r = existing
          ? await tx.payRun.update({ where: { id: existing.id }, data: { monthDays } })
          : await tx.payRun.create({
              data: {
                month,
                companyId: company,
                monthDays,
                monthOn: monthStart(month),
                status: 'draft',
                source: 'computed',
                createdBy: me.name,
              },
            });
        /* Working out a chosen few must not wipe the rest of the draft.
           Re-running the whole company replaces every line, which is what
           "work it out again" means; re-running three people replaces those
           three and leaves the other hundred exactly as they were, including
           any days, advances and remarks HR had already set on them. */
        await tx.payRunLine.deleteMany({
          where: only.length ? { runId: r.id, personId: { in: only } } : { runId: r.id },
        });

        for (const p of people) {
          if (!p.salary || p.salary.gross <= 0) continue; // nobody without a salary on file
          /* The part of the month that was theirs. Somebody who joined on the
             20th was there for eleven days of a thirty-day month, and somebody
             whose last day was the 12th for twelve — neither fact is in the
             attendance file, because the machine has no rows for a person
             before they are enrolled or after they go. */
          const win = monthWindow({
            month,
            monthDays,
            joined: p.joined,
            exited: p.status === 'active' ? null : p.exitedOn,
          });
          if (win.days <= 0) continue; // left before this month, or not started
          const d = payableDays({
            monthDays,
            onMachine: onMachine.has(p.id),
            absentDates: absent.get(p.id) ?? [],
            holidayDates,
            /* Their own day off. The import writes a row for every calendar
               day, so without this a Sunday with no punch looked exactly like
               an absence and was docked — four or five days a month off
               somebody who had worked every day they were rostered. */
            offDay: p.offDay,
          });
          /* Capped by the window. A short month for a leaver is short because
             they left, not because the machine has nothing for them. */
          const days = Math.min(d.days, win.days);
          const line = computeLine(
            policy,
            structureOf(p.salary),
            {
              days,
              monthDays,
            },
            heads,
          );
          /* Allowances granted by the company's policy, worked out from the
             same days the salary was. `who` is how a policy reaches a group
             somebody chose — the labour on one site, the whole of Maintenance
             — so it is the PERSON that is matched, not the payslip. */
          const adds = allowancesFor(allowHeads, {
            gross: line.gross,
            eGross: line.eGross,
            days: line.days,
            monthDays,
            who: { dept: p.dept, type: p.type, site: siteOf.get(p.officeId ?? '') },
          });
          const allow = allowanceTotals(adds);
          await tx.payRunLine.create({
            data: {
              runId: r.id,
              personId: p.id,
              name: p.name,
              designation: p.designation,
              days: line.days,
              gross: line.gross,
              basic: line.basic,
              hra: line.hra,
              travel: line.travel,
              medical: line.medical,
              special: line.special,
              eBasic: line.eBasic,
              eHra: line.eHra,
              eTravel: line.eTravel,
              eMedical: line.eMedical,
              eSpecial: line.eSpecial,
              eGross: line.eGross,
              dEsi: line.dEsi,
              dPf: line.dPf,
              dOther: line.dOther,
              dTotal: line.dTotal,
              erEsi: line.erEsi,
              erPf: line.erPf,
              erOther: line.erOther,
              reductions: asJson(line.reductions),
              additions: asJson(adds),
              eAllow: allow.total,
              /* The days the line was worked out from, kept rather than
                 discarded. -1 is "not recorded" and is not the same as 0. */
              dPresent: d.present,
              dAbsent: d.absent,
              dWeekOff: d.weekOff,
              dHoliday: d.holiday,
              dLeave: d.leave,
              dLost: d.counted ? d.lost : -1,
              /* THE ALLOWANCE IS PART OF WHAT THEY ARE PAID.
                 `net` is what goes to Accounts, so the allowance belongs in it.
                 Left out, the file would list a ₹2,000 site allowance in one
                 column and pay ₹2,000 less than it says in the next — and it
                 would add up on every screen, because every screen shows the
                 stored figure. The allowance has its own column beside it, so
                 the arithmetic stays visible: earned, plus allowances, less
                 deductions, plus arrear. */
              net: line.net + allow.total,
              /* The reason for a short month is worth saying whether or not it
                 cost anything — a month that was short and covered by leave is
                 exactly the one somebody queries. And a date the attendance
                 file wrote without a year says CHECK BEFORE PAYING, which must
                 reach the sheet even when no day was docked. */
              remark: [
                /* Why they are on a part month, said first, because it is the
                   line Accounts will be asked about. */
                win.whole
                  ? ''
                  : p.status === 'active'
                    ? `Part month — ${win.why}.`
                    : `LAST SALARY — ${win.why}. Their employment ended on ${p.exitedOn}.`,
                d.lost || /CHECK BEFORE PAYING/.test(d.why) ? d.why : '',
              ]
                .filter(Boolean)
                .join(' '),
            },
          });
        }

        await appendInTx(tx, {
          kind: 'payroll',
          subject: `${company} ${month}`,
          detail:
            `Pay run drafted for ${people.length} people` +
            (only.length ? ' (a chosen few, not the whole company).' : '.'),
          who: me.name,
        });
        return r;
      });

      const withoutSalary = people.filter((p) => !p.salary || p.salary.gross <= 0);
      return {
        run: await fullRun(run.id),
        drafted: people.length - withoutSalary.length,
        withoutSalary: withoutSalary.map((p) => ({ id: p.id, name: p.name })),
        attendanceCovered: people.filter((p) => onMachine.has(p.id)).length,
      };
    },
  );

  app.patch(
    '/pay-runs/:id/lines/:lineId',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: "Change a person's days, adjustments or remark",
        params: z.object({ id: z.string().min(1), lineId: z.string().min(1) }),
        body: schemas.payLineBody,
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { id, lineId } = req.params;
      const b = req.body;

      const line = await db.payRunLine.findUnique({
        where: { id: lineId },
        include: { run: true, person: { include: { salary: true } } },
      });
      if (!line || line.runId !== id) throw notFound('That line is not on that pay run.');
      if (line.run.status !== 'draft') {
        throw unprocessable(
          'That run has been released. Accounts is paying from these figures, so they do ' +
            'not move. Correcting it means a new run.',
          [{ path: 'id', message: 'released' }],
        );
      }

      const policyRow = await db.salaryPolicy.findUniqueOrThrow({
        where: { companyId: line.run.companyId },
      });
      const heads = await headsOf(line.run.companyId);
      // Recomputed from the structure every time, never patched in place: an
      // earned gross that was arrived at by adding a delta to an old one is a
      // figure nobody can check.
      const s = line.person?.salary
        ? structureOf(line.person.salary)
        : {
            gross: line.gross,
            basic: line.basic,
            hra: line.hra,
            travel: line.travel,
            medical: line.medical,
            special: line.special,
            esiOn: line.dEsi > 0,
            pfOn: line.dPf > 0,
            pfWages: 0,
          };
      // The one-off reductions HR named are re-sent whole rather than patched:
      // a list edited by deltas is a list nobody can reconstruct six months on.
      const storedOthers = (Array.isArray(line.reductions) ? line.reductions : [])
        .filter((x) => (x as { code?: string }).code === 'other')
        .map((x) => ({
          label: String((x as { label?: string }).label ?? 'Other deduction'),
          amount: Number((x as { amount?: number }).amount ?? 0),
        }));
      const others =
        b.others ??
        (b.other === undefined ? storedOthers : [{ label: 'Other deduction', amount: b.other }]);

      const g = computeLine(
        asPayPolicy(policyRow),
        s,
        {
          days: b.days ?? line.days,
          monthDays: line.run.monthDays,
          extraDays: b.extraDays ?? line.extraDays,
          tds: b.tds ?? line.dTds,
          advance: b.advance ?? line.dAdvance,
          others,
          arrear: b.arrear ?? line.arrear,
        },
        heads,
      );

      /* THE ALLOWANCES HAVE TO BE RE-WORKED TOO.
         A site allowance is pro-rated for the days, so changing the days and
         leaving the allowance at what it was worth under the old ones leaves a
         net that does not add up — and it adds up on screen, because the screen
         shows the stored figure. Recomputed from the same days as the salary,
         off the same heads, every time. */
      const allowHeads = await allowancesOf(line.run.companyId);
      const office = line.person?.officeId
        ? await db.office.findUnique({
            where: { id: line.person.officeId },
            select: { short: true },
          })
        : null;
      const adds = allowancesFor(allowHeads, {
        gross: g.gross,
        eGross: g.eGross,
        days: g.days,
        monthDays: line.run.monthDays,
        who: {
          dept: line.person?.dept,
          type: line.person?.type,
          site: office?.short,
        },
        /* The one-off allowances HR named are re-sent whole rather than patched,
           for the same reason the one-off reductions are: a list edited by
           deltas is a list nobody can reconstruct six months on. */
        others: b.allowances ?? readAdditions(line.additions).filter((a) => a.code === 'other'),
      });
      const allow = allowanceTotals(adds);

      const row = await db.$transaction(async (tx) => {
        const updated = await tx.payRunLine.update({
          where: { id: lineId },
          data: {
            days: g.days,
            eBasic: g.eBasic,
            eHra: g.eHra,
            eTravel: g.eTravel,
            eMedical: g.eMedical,
            eSpecial: g.eSpecial,
            eGross: g.eGross,
            dEsi: g.dEsi,
            dPf: g.dPf,
            dTds: g.dTds,
            dAdvance: g.dAdvance,
            dOther: g.dOther,
            dTotal: g.dTotal,
            erEsi: g.erEsi,
            erPf: g.erPf,
            erOther: g.erOther,
            reductions: asJson(g.reductions),
            additions: asJson(adds),
            eAllow: allow.total,
            extraDays: g.extraDays,
            extraAmount: g.extraAmount,
            arrear: g.arrear,
            // As above: what the person is paid, allowance included.
            net: g.net + allow.total,
            ...(b.remark === undefined ? {} : { remark: b.remark }),
          },
        });
        await appendInTx(tx, {
          kind: 'payroll',
          subject: line.personId ?? line.name,
          detail:
            `${line.run.month}: ${g.days} days, net ${g.net}` +
            (b.remark ? ` \u2014 ${b.remark}` : ''),
          who: me.name,
        });
        return updated;
      });
      return { run: await fullRun(row.runId) };
    },
  );

  /* -------------------------------- a name on a book with nobody behind it */

  app.post(
    '/pay-runs/:id/lines/:lineId/identify',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Say who a payslip with nobody on the register behind it belongs to',
        description:
          'Thirteen people were paid in August whom the register has never heard of. Each one ' +
          'is either somebody already on the rolls under a different spelling, or somebody who ' +
          'worked here and was never enrolled — and some of those have since left. ' +
          'This is ALLOWED ON A RELEASED RUN, deliberately: it changes no figure. It says who ' +
          'the person was, which is the one thing a released sheet is missing.',
        params: z.object({ id: z.string().min(1), lineId: z.string().min(1) }),
        body: schemas.identifyPayLineBody,
        response: { 200: z.any(), 404: schemas.errorBody, 409: schemas.errorBody, 422: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { id, lineId } = req.params;
      const b = req.body;

      const line = await db.payRunLine.findUnique({
        where: { id: lineId },
        include: { run: { include: { company: true } } },
      });
      if (!line || line.runId !== id) throw notFound('That line is not on that pay run.');
      if (line.personId) {
        throw unprocessable(
          `That payslip is already ${line.name}'s. Nothing to identify.`,
          [{ path: 'lineId', message: 'already identified' }],
        );
      }

      if (b.kind === 'known') {
        const person = await db.person.findUnique({ where: { id: b.pid } });
        if (!person) throw notFound(`Employee ${b.pid}`);
        /* The one thing that must not happen here is two payslips for the same
           person in the same month, which is what the three duplicate records
           on the register would produce if somebody attached both. */
        const clash = await db.payRunLine.findFirst({
          where: { runId: id, personId: b.pid, NOT: { id: lineId } },
        });
        if (clash) {
          throw conflict(
            `${person.name} is already on this sheet as "${clash.name}". Two payslips for one ` +
              'person in one month is what this is meant to catch, not to record — look at ' +
              'both lines before attaching this one.',
          );
        }
        const saved = await db.$transaction(async (tx) => {
          const row = await tx.payRunLine.update({
            where: { id: lineId },
            data: { personId: b.pid },
          });
          await appendInTx(tx, {
            kind: 'payroll',
            subject: b.pid,
            detail:
              `${line.run.month}: the payslip for "${line.name}" at ${line.run.company.name} ` +
              `is ${person.name} (${b.pid}).`,
            who: me.name,
          });
          return row;
        });
        return { line: saved, person: { id: person.id, name: person.name } };
      }

      /* Somebody who worked here and was never enrolled. A record is made from
         what the salary book carries and what HR can establish, and NOTHING
         ELSE — no joining date unless it is known, no date of birth, no salary
         structure. The blanks stay blank and the note says why. */
      const created = await db.$transaction(async (tx) => {
        const pid = await nextEmployeeId(tx, b.dept);
        const person = await tx.person.create({
          data: {
            id: pid,
            name: line.name,
            designation: line.designation || 'Not recorded',
            dept: b.dept,
            type: b.type,
            joined: b.joined,
            joinedOn: b.joined ? parseDisplayDate(b.joined) : null,
            officeId: b.office,
            employerId: line.run.companyId,
            status: 'exited',
            exitedOn: b.lastDay,
          },
        });
        await tx.personNote.create({
          data: {
            personId: pid,
            when: nowStamp(),
            text:
              `Reconstructed from the ${line.run.month} salary book of ${line.run.company.name}, ` +
              `where they were paid as "${line.name}" and no employee record existed. ` +
              `Recorded as having left on ${b.lastDay} — ${b.reason}. ${b.note}` +
              (b.joined ? '' : ' Their joining date is not known and has been left blank.') +
              ` — ${me.name}`,
          },
        });
        await tx.payRunLine.update({ where: { id: lineId }, data: { personId: pid } });
        await appendInTx(tx, {
          kind: 'payroll',
          subject: pid,
          detail:
            `"${line.name}" on the ${line.run.month} book of ${line.run.company.name} was an ` +
            `employee nobody had enrolled. Recorded as ${pid}, left ${b.lastDay} — ${b.reason}.`,
          who: me.name,
        });
        return person;
      });
      return { person: { id: created.id, name: created.name, status: created.status } };
    },
  );

  app.post(
    '/pay-runs/:id/release',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['payroll'],
        summary: 'Hand the run to Accounts',
        description:
          'Freezes it. The figures on the screen and the figures Accounts pays from are ' +
          'then the same figures, for good.',
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const run = await db.payRun.findUnique({
        where: { id: req.params.id },
        include: { lines: true },
      });
      if (!run) throw notFound('No such pay run.');
      if (run.status !== 'draft') {
        throw unprocessable('That run has already been released.', [
          { path: 'id', message: 'already released' },
        ]);
      }
      if (run.lines.length === 0) {
        throw unprocessable('There is nothing on that run to release. Work the month out first.', [
          { path: 'id', message: 'no lines' },
        ]);
      }
      return db
        .$transaction(async (tx) => {
          const r = await tx.payRun.update({
            where: { id: run.id },
            data: { status: 'released', releasedAt: new Date(), releasedBy: me.name },
          });
          const net = run.lines.reduce((a, l) => a + l.net + l.extraAmount, 0);
          await appendInTx(tx, {
            kind: 'payroll',
            subject: `${run.companyId} ${run.month}`,
            detail: `Released to Accounts: ${run.lines.length} people, ${net} payable.`,
            who: me.name,
          });
          return { id: r.id, status: r.status, lines: run.lines.length, payable: net };
        })
        .then(async (r) => ({ ...r, run: await fullRun(run.id) }));
    },
  );
};
