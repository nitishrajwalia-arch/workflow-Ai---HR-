/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * THE REPORT AT THE END OF A PAYROLL.
 *
 * What the management asked to see once a month has been worked out: who was
 * paid, from which department, for how many days, on what salary, what came off
 * it, and anything worth saying about the line.
 *
 * It is defined ONCE, here, and both the branded sheet on screen and the Excel
 * file are built from it. A report and its spreadsheet that disagree is worse
 * than either one alone, and they disagree the moment they are written twice.
 *
 * "Days worked" is read two ways and both are wanted, so both are here: the
 * days this month's pay was worked out on, and how long the person has been
 * with the company.
 */

import { toXlsx, type XlsxValue } from './xlsxOut.js';

export interface ReportLine {
  readonly pid: string | null;
  readonly name: string;
  readonly designation: string;
  readonly days: number;
  readonly gross: number;
  readonly eGross: number;
  readonly dEsi: number;
  readonly dPf: number;
  readonly dTds: number;
  readonly dAdvance: number;
  readonly dOther: number;
  readonly dTotal: number;
  readonly erEsi: number;
  readonly erPf: number;
  readonly extraDays: number;
  readonly extraAmount: number;
  readonly arrear: number;
  readonly payable: number;
  readonly remark: string;
}

export interface ReportRun {
  readonly month: string;
  readonly monthDays: number;
  readonly company: string;
  readonly status: string;
  readonly source?: string;
  readonly createdBy?: string;
  readonly releasedBy?: string;
  readonly releasedAt?: string | null;
  readonly lines: readonly ReportLine[];
}

/** What the register knows about somebody, for the columns the run does not carry. */
export interface ReportPerson {
  readonly id: string;
  readonly dept?: string;
  readonly joined?: string;
  readonly status?: string;
}

export interface ReportOptions {
  readonly companyName?: string;
  readonly people?: readonly ReportPerson[];
  readonly preparedBy?: string;
  readonly at?: Date;
}

export interface ReportRow {
  readonly id: string;
  readonly name: string;
  readonly designation: string;
  readonly dept: string;
  /** Days this month's pay was worked out on. */
  readonly days: number;
  readonly monthDays: number;
  /** How long they have been with the company, in words. */
  readonly withUs: string;
  readonly joined: string;
  /** What they are on, a month. */
  readonly salary: number;
  /** What the days came to before anything came off. */
  readonly earned: number;
  readonly esi: number;
  readonly pf: number;
  readonly tds: number;
  readonly advance: number;
  readonly otherOff: number;
  readonly deductions: number;
  readonly added: number;
  readonly payable: number;
  readonly remark: string;
  /** True when nobody on the register answers to this line. */
  readonly stranger: boolean;
}

export interface PayReport {
  readonly company: string;
  readonly month: string;
  readonly monthDays: number;
  readonly status: string;
  readonly released: boolean;
  /** Loaded from the company's own salary book rather than worked out here. */
  readonly fromBook: boolean;
  readonly preparedBy: string;
  readonly releasedBy: string;
  readonly generatedOn: string;
  readonly rows: readonly ReportRow[];
  readonly totals: {
    readonly people: number;
    readonly salary: number;
    readonly earned: number;
    readonly esi: number;
    readonly pf: number;
    readonly tds: number;
    readonly advance: number;
    readonly otherOff: number;
    readonly deductions: number;
    readonly added: number;
    readonly payable: number;
    readonly employer: number;
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parse = (display: string | undefined): Date | null => {
  if (!display || !display.trim()) return null;
  const d = new Date(`${display.trim()} 00:00:00 GMT`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "6 years 2 months", "less than a month", or "—" when nothing is on file. */
export function tenureWords(joined: string | undefined, on: Date): string {
  const d = parse(joined);
  if (!d) return '—';
  if (d.getTime() > on.getTime()) return 'not started yet';
  let y = on.getUTCFullYear() - d.getUTCFullYear();
  let m = on.getUTCMonth() - d.getUTCMonth();
  if (on.getUTCDate() < d.getUTCDate()) m -= 1;
  if (m < 0) {
    y -= 1;
    m += 12;
  }
  const bits: string[] = [];
  if (y) bits.push(`${y} year${y === 1 ? '' : 's'}`);
  if (m) bits.push(`${m} month${m === 1 ? '' : 's'}`);
  return bits.join(' ') || 'less than a month';
}

const stamp = (on: Date): string =>
  `${String(on.getDate()).padStart(2, '0')} ${MONTHS[on.getMonth()]} ${on.getFullYear()}`;

/** Build the report from a pay run and the register. */
export function payrollReport(run: ReportRun, opts: ReportOptions = {}): PayReport {
  const on = opts.at ?? new Date();
  const by = new Map((opts.people ?? []).map((p) => [p.id, p]));
  const rows: ReportRow[] = run.lines.map((l) => {
    const p = l.pid ? by.get(l.pid) : undefined;
    return {
      id: l.pid ?? '—',
      name: l.name,
      designation: l.designation || '—',
      dept: p?.dept ?? '—',
      days: l.days,
      monthDays: run.monthDays,
      withUs: tenureWords(p?.joined, on),
      joined: p?.joined ?? '—',
      salary: l.gross,
      earned: l.eGross,
      esi: l.dEsi,
      pf: l.dPf,
      tds: l.dTds,
      advance: l.dAdvance,
      otherOff: l.dOther,
      deductions: l.dTotal,
      added: (l.extraAmount || 0) + (l.arrear || 0),
      payable: l.payable,
      /* A line with nothing on the register behind it is the single most
         important remark on the sheet — it is somebody being paid whom nobody
         can name. It goes first, before whatever else the line said. */
      remark: [l.pid ? '' : 'NOT ON THE EMPLOYEE REGISTER', l.remark || '']
        .filter(Boolean)
        .join(' · '),
      stranger: !l.pid,
    };
  });

  const add = (pick: (r: ReportRow) => number): number => rows.reduce((a, r) => a + pick(r), 0);

  return {
    company: opts.companyName || run.company,
    month: run.month,
    monthDays: run.monthDays,
    status: run.status,
    released: run.status === 'released',
    fromBook: run.source === 'imported',
    preparedBy: run.source === 'imported' ? '' : run.createdBy || '',
    releasedBy: run.releasedBy || '',
    generatedOn: stamp(on),
    rows,
    totals: {
      people: rows.length,
      salary: add((r) => r.salary),
      earned: add((r) => r.earned),
      esi: add((r) => r.esi),
      pf: add((r) => r.pf),
      tds: add((r) => r.tds),
      advance: add((r) => r.advance),
      otherOff: add((r) => r.otherOff),
      deductions: add((r) => r.deductions),
      added: add((r) => r.added),
      payable: add((r) => r.payable),
      employer: run.lines.reduce((a, l) => a + (l.erEsi || 0) + (l.erPf || 0), 0),
    },
  };
}

/** The columns, in the order the management asked for them. */
export const REPORT_COLUMNS = [
  'Employee ID',
  'Name',
  'Department',
  'Designation',
  'Days paid',
  'Days in month',
  'With us',
  'Joined',
  'Salary a month',
  'Earned this month',
  'E.S.I.',
  'P.F.',
  'TDS',
  'Advance',
  'Other deductions',
  'Total deductions',
  'Added back',
  'Net payable',
  'Remarks',
] as const;

const M = (v: number, bold = false): XlsxValue => ({ v, look: bold ? 'boldMoney' : 'money' });

/**
 * The same report as a workbook.
 *
 * A heading block first — company, month, status, who prepared it — then the
 * table, then a totals row. The heading is why: a sheet of figures with no
 * month and no company on it is a sheet somebody will pay from twice.
 */
export function reportToXlsx(report: PayReport): { name: string; bytes: Uint8Array } {
  const head: XlsxValue[][] = [
    [{ v: 'MARBELLA GROUP — PAYROLL REPORT', look: 'bold' }],
    [{ v: 'Company', look: 'bold' }, report.company],
    [{ v: 'Month', look: 'bold' }, `${report.month} · ${report.monthDays} days`],
    [
      { v: 'Status', look: 'bold' },
      !report.released
        ? 'DRAFT — not released. Do not pay from this sheet.'
        : report.fromBook
          ? "From the company's own salary book — these figures do not change"
          : `Released to Accounts${report.releasedBy ? ` by ${report.releasedBy}` : ''} — these figures do not change`,
    ],
    [{ v: 'People on this sheet', look: 'bold' }, report.totals.people],
    [{ v: 'Net paid to employees', look: 'bold' }, M(report.totals.payable, true)],
    [{ v: 'Held back in total', look: 'bold' }, M(report.totals.deductions, true)],
    [{ v: 'Report made on', look: 'bold' }, report.generatedOn],
    [],
  ];

  const table: XlsxValue[][] = [
    REPORT_COLUMNS.map((c) => ({ v: c, look: 'head' as const })),
    ...report.rows.map((r) => [
      r.id,
      r.name,
      r.dept,
      r.designation,
      r.days,
      r.monthDays,
      r.withUs,
      r.joined,
      M(r.salary),
      M(r.earned),
      M(r.esi),
      M(r.pf),
      M(r.tds),
      M(r.advance),
      M(r.otherOff),
      M(r.deductions),
      M(r.added),
      M(r.payable, true),
      r.remark,
    ]),
    [
      { v: `${report.totals.people} people`, look: 'bold' },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      M(report.totals.salary, true),
      M(report.totals.earned, true),
      M(report.totals.esi, true),
      M(report.totals.pf, true),
      M(report.totals.tds, true),
      M(report.totals.advance, true),
      M(report.totals.otherOff, true),
      M(report.totals.deductions, true),
      M(report.totals.added, true),
      M(report.totals.payable, true),
      { v: `Company's own share on top: ${report.totals.employer}`, look: 'bold' },
    ],
  ];

  const bytes = toXlsx({
    name: `${report.month} payroll`,
    rows: [...head, ...table],
    widths: [14, 26, 15, 22, 10, 13, 16, 13, 15, 17, 10, 10, 10, 11, 16, 16, 12, 14, 40],
    freezeRows: head.length + 1,
  });

  const safe = (s: string): string => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { name: `Marbella-payroll-${safe(report.month)}-${safe(report.company)}.xlsx`, bytes };
}
