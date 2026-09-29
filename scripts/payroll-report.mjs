/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * The month's payroll report as a workbook, from the command line.
 *
 *   node scripts/payroll-report.mjs "Aug 2026"
 *
 * The same report the app shows at the end of a run — every company in the
 * group on one sheet, with a company column — built by the SAME code the screen
 * uses (payrollReport + toXlsx in @marbella/shared), so the file and the screen
 * cannot disagree. For the months where somebody wants the workbook without
 * opening the app.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'node:fs';
import process from 'node:process';
import { payrollReport, toXlsx } from '../packages/shared/dist/index.js';

const MONTH = process.argv[2] || 'Aug 2026';
const url = fs.readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8').match(/DATABASE_URL="([^"]+)"/)[1];
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const runs = await db.payRun.findMany({ where: { month: MONTH }, include: { lines: true } });
const companies = await db.company.findMany({ select: { id: true, name: true } });
const people = await db.person.findMany({ select: { id: true, dept: true, joined: true, status: true } });
const coName = new Map(companies.map((c) => [c.id, c.name]));

const reports = runs
  .map((r) => ({
    co: coName.get(r.companyId) ?? r.companyId,
    rep: payrollReport(
      {
        month: r.month, monthDays: r.monthDays, company: r.companyId, status: r.status,
        source: r.source, createdBy: r.createdBy, releasedBy: r.releasedBy,
        releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
        lines: r.lines.map((l) => ({
          pid: l.personId, name: l.name, designation: l.designation, days: l.days,
          gross: l.gross, eGross: l.eGross, dEsi: l.dEsi, dPf: l.dPf, dTds: l.dTds,
          dAdvance: l.dAdvance, dOther: l.dOther, dTotal: l.dTotal, erEsi: l.erEsi, erPf: l.erPf,
          extraDays: l.extraDays, extraAmount: l.extraAmount, arrear: l.arrear,
          /* The database keeps `net`; what somebody is paid is that plus any
             extra days, which is how every other screen derives it. */
          payable: l.net + (l.extraAmount || 0), remark: l.remark,
        })),
      },
      { companyName: coName.get(r.companyId), people },
    ),
  }))
  .filter((x) => x.rep.rows.length)
  .sort((a, b) => b.rep.totals.payable - a.rep.totals.payable);

const M = (v, bold = false) => ({ v, look: bold ? 'boldMoney' : 'money' });
const B = (v) => ({ v, look: 'bold' });
const H = (v) => ({ v, look: 'head' });

const T = (pick) => reports.reduce((a, x) => a + x.rep.rows.reduce((b, r) => b + pick(r), 0), 0);
const people_ = reports.reduce((a, x) => a + x.rep.rows.length, 0);

const rows = [
  [B('MARBELLA GROUP — PAYROLL REPORT')],
  [B('Month'), MONTH],
  [B('Companies on this report'), reports.map((x) => x.co).join(', ')],
  [B('Payslips'), people_],
  [B('Net paid to employees'), M(T((r) => r.payable), true)],
  [B('Held back in total'), M(T((r) => r.deductions), true)],
  [B('Of which tax (TDS)'), M(T((r) => r.tds), true)],
  [B('Report made on'), reports[0]?.rep.generatedOn ?? ''],
  [],
  ['Employee ID', 'Name', 'Department', 'Designation', 'Company', 'Days paid', 'Days in month',
   'With us', 'Joined', 'Salary a month', 'Earned this month', 'E.S.I.', 'P.F.', 'TDS', 'Advance',
   'Other deductions', 'Total deductions', 'Added back', 'Net payable', 'Status', 'Remarks'].map(H),
];

for (const { co, rep } of reports) {
  for (const r of rep.rows) {
    rows.push([
      r.id, r.name, r.dept, r.designation, co, r.days, r.monthDays, r.withUs, r.joined,
      M(r.salary), M(r.earned), M(r.esi), M(r.pf), M(r.tds), M(r.advance), M(r.otherOff),
      M(r.deductions), M(r.added), M(r.payable, true),
      rep.released ? (rep.fromBook ? "company's own book" : 'released') : 'DRAFT — not released',
      r.remark,
    ]);
  }
}
rows.push([
  B(`${people_} payslips`), null, null, null, null, null, null, null, null,
  M(T((r) => r.salary), true), M(T((r) => r.earned), true), M(T((r) => r.esi), true),
  M(T((r) => r.pf), true), M(T((r) => r.tds), true), M(T((r) => r.advance), true),
  M(T((r) => r.otherOff), true), M(T((r) => r.deductions), true), M(T((r) => r.added), true),
  M(T((r) => r.payable), true), null, null,
]);

const bytes = toXlsx({
  name: `${MONTH} payroll`,
  rows,
  widths: [14, 26, 15, 24, 32, 10, 13, 16, 13, 15, 17, 10, 10, 10, 11, 16, 16, 12, 14, 20, 34],
  freezeRows: 10,
});
const name = `Marbella-payroll-report-${MONTH.replace(' ', '-')}.xlsx`;
fs.writeFileSync(name, bytes);
console.log(name, (bytes.length / 1024).toFixed(1) + ' KB', '·', people_, 'payslips across', reports.length, 'companies');
console.log('net paid', T((r) => r.payable).toLocaleString('en-IN'), '· held back', T((r) => r.deductions).toLocaleString('en-IN'), '· TDS', T((r) => r.tds).toLocaleString('en-IN'));
await db.$disconnect();
