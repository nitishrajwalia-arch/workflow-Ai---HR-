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
  asPayPolicy,
  computeLine,
  imeiCheck,
  emailCheck,
  payableDays,
  phoneCheck,
  readReductions,
  schemas,
  type DeductionHead,
  type PayStructure,
} from '@marbella/shared';
import type { Prisma } from '@prisma/client';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { nowStamp } from '../lib/dates.js';
import { notFound, unprocessable } from '../lib/errors.js';
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

      const gross = saved.basic + saved.hra + saved.special;
      return { ...saved, gross, net: gross - saved.pf - saved.pt };
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
      const { month, company, monthDays, attendanceMonth } = req.body;

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

      const people = await db.person.findMany({
        where: { employerId: company, status: 'active' },
        include: { salary: true },
        orderBy: { name: 'asc' },
      });

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
        await tx.payRunLine.deleteMany({ where: { runId: r.id } });

        for (const p of people) {
          if (!p.salary || p.salary.gross <= 0) continue; // nobody without a salary on file
          const d = payableDays({
            monthDays,
            onMachine: onMachine.has(p.id),
            absentDates: absent.get(p.id) ?? [],
            holidayDates,
          });
          const line = computeLine(
            policy,
            structureOf(p.salary),
            {
              days: d.days,
              monthDays,
            },
            heads,
          );
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
              net: line.net,
              remark: d.lost ? d.why : '',
            },
          });
        }

        await appendInTx(tx, {
          kind: 'payroll',
          subject: `${company} ${month}`,
          detail: `Pay run drafted for ${people.length} people.`,
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
            extraDays: g.extraDays,
            extraAmount: g.extraAmount,
            arrear: g.arrear,
            net: g.net,
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
