/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * THE ONE FILE HR SENDS TO ACCOUNTS.
 *
 * Payroll ends here. HR uploads the attendance, picks the companies, picks the
 * people, works the month out, checks that nobody on it has left, releases it —
 * and then downloads THIS, one file, and sends it to Accounts, who pay from it.
 *
 * One file, not several. A month that goes across as a sheet of salaries plus a
 * sheet of attendance plus a note about an allowance is a month where the three
 * disagree by the time somebody queries it, and the disagreement is discovered
 * by the person whose pay is short.
 *
 * So everything that decides what a person is paid is on it:
 *
 *   WHO        employee id, name, department, designation, when they joined
 *   ATTENDANCE present, absent, their weekly off, company holidays, leave, and
 *              the days actually paid for — the reasons, not just the answer
 *   SALARY     what they are on, and what the days came to
 *   ALLOWANCES what the company's policy adds on top, head by head
 *   TAX        TDS, and the statutory heads with the company's own share beside
 *   DEDUCTIONS everything that comes off, and what each one is
 *   NET        what to pay them
 *
 * Four sheets: the payroll itself, the allowances spelled out head by head, the
 * deductions likewise, and the attendance. One workbook.
 *
 * Built HERE, in shared code, from the run the screen is already showing — so
 * the file and the screen cannot drift, a test can check the file against the
 * engine, and it needs no server: the browser writes it from what it has.
 */

import type { SheetLine, SheetOptions, SheetRun } from './paysheet.js';
import { toXlsx, type XlsxValue } from './xlsxOut.js';

const M = (v: number, bold = false): XlsxValue => ({ v, look: bold ? 'boldMoney' : 'money' });
const H = (v: string): XlsxValue => ({ v, look: 'head' });
const B = (v: string): XlsxValue => ({ v, look: 'bold' });

/**
 * A day count as it should be READ.
 *
 * -1, or nothing at all, means nobody counted this person's days. It prints as
 * a dash, because a zero in a "days present" column is a sentence about a man
 * who never came to work, and it would be the wrong sentence.
 */
const days = (v: number | undefined): XlsxValue => (v === undefined || v < 0 ? '—' : v);

const sum = (lines: readonly SheetLine[], pick: (l: SheetLine) => number): number =>
  lines.reduce((a, l) => a + pick(l), 0);

const allow = (l: SheetLine): number => l.eAllow ?? 0;
const employer = (l: SheetLine): number => l.erEsi + l.erPf + (l.erOther ?? 0);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const stamp = (d: Date): string =>
  `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

const safe = (s: string): string => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** What the heading block says about whether this may be paid from. */
export function payableLine(run: SheetRun): string {
  if (run.status !== 'released') {
    return 'DRAFT — NOT RELEASED. DO NOT PAY FROM THIS FILE.';
  }
  return run.source === 'imported'
    ? "From the company's own salary book — these figures do not change."
    : `Released to Accounts${run.releasedBy ? ` by ${run.releasedBy}` : ''} — these figures do not change.`;
}

/* --------------------------------------------------------------- columns */

export const PAYROLL_COLUMNS = [
  'Sr.',
  'Employee ID',
  'Name',
  'Department',
  'Designation',
  'Joined',
  'Days present',
  'Days absent',
  'Weekly off',
  'Company holiday',
  'Paid leave',
  'Days paid',
  'Days in month',
  'Salary a month',
  'Earned this month',
  'Allowances',
  'E.S.I. (employee)',
  'P.F. (employee)',
  'T.D.S.',
  'Advance',
  'Other deductions',
  'Total deductions',
  'Arrear',
  'Extra days',
  'Extra days amount',
  'NET PAYABLE',
  "Company's own share",
  'Remarks',
] as const;

/* ------------------------------------------------------------- the file */

export interface AccountsFileOptions extends SheetOptions {
  /** Departments keyed by employee id, which the run does not carry. */
  dept?: Record<string, string>;
}

/**
 * The workbook.
 *
 * Returns the file name as well as the bytes: the name carries the company and
 * the month, because the thing that goes wrong with these files is paying
 * August's twice.
 */
export function accountsFile(
  run: SheetRun,
  opts: AccountsFileOptions = {},
): { name: string; bytes: Uint8Array } {
  const at = opts.at ?? new Date();
  const lines = run.lines;
  const joined = opts.joined ?? {};
  const dept = opts.dept ?? {};
  const company = opts.companyName || run.company;

  /* ------------------------------------------------------ the heading */

  const head: XlsxValue[][] = [
    [B('MARBELLA GROUP — SALARY ROLL-OUT')],
    [B('Company'), company],
    [B('Month'), `${run.month} · ${run.monthDays} days`],
    [B('Status'), payableLine(run)],
    [
      B('Worked out'),
      run.source === 'imported'
        ? "Imported from the company's own salary book"
        : "From each person's salary, the month's attendance and the company's policy",
    ],
  ];
  /* A run loaded from the company's own book was not prepared by anybody here,
     and naming the importer would put a person against figures they never
     worked out. The line above says where it came from; that is the whole
     truth about it. */
  if (run.source !== 'imported') {
    if (run.createdBy) head.push([B('Prepared by'), run.createdBy]);
    if (run.releasedBy) head.push([B('Released by'), run.releasedBy]);
  }
  if (run.releasedAt) head.push([B('Released on'), run.releasedAt.slice(0, 10)]);
  head.push([B('People on this file'), lines.length]);
  head.push([B('NET TO PAY'), M(sum(lines, (l) => l.payable), true)]);
  head.push([B('Allowances included'), M(sum(lines, allow), true)]);
  head.push([B('Tax (T.D.S.) held back'), M(sum(lines, (l) => l.dTds), true)]);
  head.push([B('All deductions held back'), M(sum(lines, (l) => l.dTotal), true)]);
  head.push([B("Company's own share, on top"), M(sum(lines, employer), true)]);
  head.push([B('Downloaded by'), opts.preparedBy || '—']);
  head.push([B('Downloaded on'), stamp(at)]);
  head.push([]);

  /* -------------------------------------------------------- the payroll */

  const table: XlsxValue[][] = [
    PAYROLL_COLUMNS.map(H),
    ...lines.map((l, i) => [
      i + 1,
      l.pid ?? 'NOT ON THE REGISTER',
      l.name,
      (l.pid && dept[l.pid]) || '—',
      l.designation || '—',
      (l.pid && joined[l.pid]) || '—',
      days(l.dPresent),
      days(l.dAbsent),
      days(l.dWeekOff),
      days(l.dHoliday),
      days(l.dLeave),
      l.days,
      run.monthDays,
      M(l.gross),
      M(l.eGross),
      M(allow(l)),
      M(l.dEsi),
      M(l.dPf),
      M(l.dTds),
      M(l.dAdvance),
      M(l.dOther),
      M(l.dTotal),
      M(l.arrear),
      l.extraDays,
      M(l.extraAmount),
      M(l.payable, true),
      M(employer(l)),
      [l.pid ? '' : 'NOT ON THE EMPLOYEE REGISTER — do not pay until HR confirms', l.remark || '']
        .filter(Boolean)
        .join(' · '),
    ]),
    // The totals sit under the columns they total, so Accounts can check the
    // file against their own book by reading one line.
    [
      B(''),
      B(''),
      B(`TOTAL — ${lines.length} people`),
      B(''),
      B(''),
      B(''),
      B(''),
      B(''),
      B(''),
      B(''),
      B(''),
      B(''),
      B(''),
      M(sum(lines, (l) => l.gross), true),
      M(sum(lines, (l) => l.eGross), true),
      M(sum(lines, allow), true),
      M(sum(lines, (l) => l.dEsi), true),
      M(sum(lines, (l) => l.dPf), true),
      M(sum(lines, (l) => l.dTds), true),
      M(sum(lines, (l) => l.dAdvance), true),
      M(sum(lines, (l) => l.dOther), true),
      M(sum(lines, (l) => l.dTotal), true),
      M(sum(lines, (l) => l.arrear), true),
      sum(lines, (l) => l.extraDays),
      M(sum(lines, (l) => l.extraAmount), true),
      M(sum(lines, (l) => l.payable), true),
      M(sum(lines, employer), true),
      B(''),
    ],
  ];

  /* ----------------------------------------------------- the allowances */

  /* Head by head, one row per person per allowance, with the policy that
     granted it in words. The payroll sheet says HOW MUCH; this says WHAT IT IS
     AND UNDER WHAT RULE, which is the question Accounts is asked when somebody
     queries their payslip and the one they currently come back to HR for. */
  const allowRows: XlsxValue[][] = [
    ['Employee ID', 'Name', 'Allowance', 'Amount', 'Counts as pay?', 'How it was worked out', 'Under which policy'].map(H),
  ];
  for (const l of lines) {
    for (const a of l.additions ?? []) {
      allowRows.push([
        l.pid ?? 'NOT ON THE REGISTER',
        l.name,
        a.label,
        M(a.amount),
        a.taxable ? 'Yes — taxed' : 'No — a reimbursement',
        a.why,
        a.policy ? 'Company policy' : 'Entered by HR for this month',
      ]);
    }
  }
  if (allowRows.length === 1) {
    allowRows.push([B('No allowance was paid this month.')]);
  } else {
    allowRows.push([B(''), B(''), B('TOTAL'), M(sum(lines, allow), true), B(''), B(''), B('')]);
  }

  /* ----------------------------------------------------- the deductions */

  const cutRows: XlsxValue[][] = [
    ['Employee ID', 'Name', 'Deduction', 'From the person', 'The company on top', 'How it was worked out'].map(H),
  ];
  for (const l of lines) {
    for (const d of l.reductions ?? []) {
      cutRows.push([l.pid ?? 'NOT ON THE REGISTER', l.name, d.label, M(d.amount), M(d.employer), d.why]);
    }
  }
  if (cutRows.length === 1) cutRows.push([B('Nothing was deducted this month.')]);

  /* ------------------------------------------------------ the attendance */

  const attRows: XlsxValue[][] = [
    ['Employee ID', 'Name', 'Days in month', 'Present', 'Absent', 'Weekly off', 'Company holiday', 'Paid leave', 'Days paid', 'Days lost', 'Why'].map(H),
    ...lines.map((l) => [
      l.pid ?? 'NOT ON THE REGISTER',
      l.name,
      run.monthDays,
      days(l.dPresent),
      days(l.dAbsent),
      days(l.dWeekOff),
      days(l.dHoliday),
      days(l.dLeave),
      l.days,
      days(l.dLost),
      l.dPresent === undefined || l.dPresent < 0
        ? 'Not on the attendance machine, so the full month was paid.'
        : l.remark || 'Full month.',
    ]),
  ];

  const bytes = toXlsx([
    {
      name: `${run.month} payroll`,
      rows: [...head, ...table],
      widths: [5, 14, 24, 14, 20, 12, 9, 9, 9, 12, 9, 9, 9, 14, 15, 12, 12, 12, 11, 11, 13, 13, 10, 9, 13, 14, 15, 44],
      freezeRows: head.length + 1,
    },
    { name: 'Allowances', rows: allowRows, widths: [14, 24, 22, 12, 20, 34, 26], freezeRows: 1 },
    { name: 'Deductions', rows: cutRows, widths: [14, 24, 22, 15, 18, 36], freezeRows: 1 },
    { name: 'Attendance', rows: attRows, widths: [14, 24, 12, 9, 9, 10, 14, 10, 10, 10, 50], freezeRows: 1 },
  ]);

  return {
    name: `Marbella-salary-${safe(run.month)}-${safe(company)}.xlsx`,
    bytes,
  };
}
