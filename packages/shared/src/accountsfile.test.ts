/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * THE FILE HR SENDS TO ACCOUNTS, CHECKED BY READING IT BACK.
 *
 * Nothing is asserted about the bytes. The workbook is written, handed to the
 * same reader that reads the sheets HR uploads, and every tab is compared with
 * the run that went in. If either half drifts, this fails.
 *
 * Accounts pay people from this file. Every test here is a way it could be
 * wrong that nobody would notice until somebody's pay was short.
 */

import { describe, expect, it } from 'vitest';
import { accountsFile, payableLine } from './accountsfile.js';
import type { SheetLine, SheetRun } from './paysheet.js';
import { readXlsx } from './xlsx.js';

const line = (over: Partial<SheetLine> & Pick<SheetLine, 'pid' | 'name'>): SheetLine => ({
  designation: 'Site Engineer',
  days: 30,
  gross: 40_000,
  basic: 28_000,
  hra: 8_400,
  travel: 2_800,
  medical: 500,
  special: 300,
  eBasic: 28_000,
  eHra: 8_400,
  eTravel: 2_800,
  eMedical: 500,
  eSpecial: 300,
  eGross: 40_000,
  dEsi: 0,
  dPf: 1_800,
  dTds: 2_000,
  dAdvance: 0,
  dOther: 0,
  dTotal: 3_800,
  erEsi: 0,
  erPf: 1_800,
  erOther: 0,
  extraDays: 0,
  extraAmount: 0,
  arrear: 0,
  net: 36_200,
  payable: 36_200,
  remark: '',
  ...over,
});

const AVTAR = line({
  pid: 'MB-PRJ-0023',
  name: 'Avtar Singh',
  days: 24,
  eGross: 32_000,
  payable: 29_800,
  remark: '2 days absent, 4 their weekly off.',
  dPresent: 24,
  dAbsent: 2,
  dWeekOff: 4,
  dHoliday: 0,
  dLeave: 0,
  dLost: 2,
  eAllow: 1_600,
  additions: [
    {
      code: 'site',
      label: 'Site allowance',
      amount: 1_600,
      taxable: true,
      why: '₹2,000 a month, 24 of 30 days',
      policy: true,
    },
  ],
  reductions: [
    { code: 'pf', label: 'P.F.', amount: 1_800, employer: 1_800, why: '12% of ₹15,000 wage', statutory: true },
    { code: 'tds', label: 'T.D.S.', amount: 2_000, employer: 0, why: 'Entered by HR', statutory: false },
  ],
});

/* Nobody counted his days: he is not on the attendance machine. */
const AJAY = line({
  pid: 'MB-PRJ-0014',
  name: 'Ajay Goel',
  gross: 185_000,
  eGross: 185_000,
  payable: 181_200,
  eAllow: 0,
});

/* On the company's sheet, on nobody's register. */
const STRANGER = line({ pid: null, name: 'Somebody Else', dTotal: 0, payable: 40_000 });

const RUN: SheetRun = {
  month: 'Sep 2026',
  company: 'newmarb',
  monthDays: 30,
  status: 'released',
  source: 'computed',
  createdBy: 'Pooja Dahiya',
  releasedBy: 'Pooja Dahiya',
  releasedAt: '2026-09-29T00:00:00.000Z',
  lines: [AVTAR, AJAY, STRANGER],
};

const OPTS = {
  companyName: 'New Marbella Developers And Promoters LLP',
  joined: { 'MB-PRJ-0023': '16 Mar 2024', 'MB-PRJ-0014': '28 Feb 2020' },
  dept: { 'MB-PRJ-0023': 'Project', 'MB-PRJ-0014': 'Project' },
  preparedBy: 'Pooja Dahiya',
  at: new Date('2026-09-29T00:00:00Z'),
};

const tab = async (bytes: Uint8Array, name?: string): Promise<string[][]> =>
  readXlsx(bytes, name);

const flat = (rows: string[][]): string => rows.map((r) => r.join('|')).join('\n');

describe('the file HR sends to Accounts', () => {
  const made = accountsFile(RUN, OPTS);

  it('is one workbook with the payroll and everything behind it', async () => {
    for (const name of ['Sep 2026 payroll', 'Allowances', 'Deductions', 'Attendance']) {
      await expect(tab(made.bytes, name)).resolves.toBeInstanceOf(Array);
    }
  });

  it('is named for the company and the month, so August is not paid twice', () => {
    expect(made.name).toBe('Marbella-salary-Sep-2026-New-Marbella-Developers-And-Promoters-LLP.xlsx');
  });

  it('says on its face whether it may be paid from', async () => {
    const f = flat(await tab(made.bytes, 'Sep 2026 payroll'));
    expect(f).toContain('Released to Accounts by Pooja Dahiya');
    expect(payableLine({ ...RUN, status: 'draft' })).toContain('DO NOT PAY FROM THIS FILE');
    expect(payableLine({ ...RUN, source: 'imported' })).toContain("company's own salary book");
  });

  it('carries the attendance, not just the days paid', async () => {
    const rows = await tab(made.bytes, 'Sep 2026 payroll');
    const avtar = rows.find((r) => r.includes('Avtar Singh'))!;
    expect(avtar).toBeDefined();
    // present, absent, weekly off, holiday, leave, days paid, days in month
    expect(avtar.slice(6, 13)).toEqual(['24', '2', '4', '0', '0', '24', '30']);
  });

  it('prints a DASH, never a zero, for somebody nobody counted', async () => {
    const rows = await tab(made.bytes, 'Sep 2026 payroll');
    const ajay = rows.find((r) => r.includes('Ajay Goel'))!;
    // A zero in "days present" is a sentence about a man who never came to
    // work, and it would be the wrong sentence.
    expect(ajay.slice(6, 11)).toEqual(['—', '—', '—', '—', '—']);
    expect(ajay).toContain('30'); // still paid the whole month
  });

  it('carries the tax and every deduction', async () => {
    const rows = await tab(made.bytes, 'Sep 2026 payroll');
    const avtar = rows.find((r) => r.includes('Avtar Singh'))!;
    expect(avtar).toContain('2000'); // T.D.S.
    expect(avtar).toContain('1800'); // P.F.
    expect(avtar).toContain('3800'); // total deductions
    expect(avtar).toContain('29800'); // net payable
  });

  it('carries the allowances, with the policy behind each', async () => {
    const f = flat(await tab(made.bytes, 'Allowances'));
    expect(f).toContain('Site allowance');
    expect(f).toContain('1600');
    expect(f).toContain('Yes — taxed');
    expect(f).toContain('₹2,000 a month, 24 of 30 days');
    expect(f).toContain('Company policy');
  });

  it('tells a reimbursement apart from pay on the allowance tab', async () => {
    const withBus = accountsFile(
      {
        ...RUN,
        lines: [
          {
            ...AVTAR,
            eAllow: 2_200,
            additions: [
              { code: 'bus', label: 'Bus fare reimbursed', amount: 600, taxable: false, why: 'Actuals', policy: true },
              ...(AVTAR.additions ?? []),
            ],
          },
        ],
      },
      OPTS,
    );
    const f = flat(await tab(withBus.bytes, 'Allowances'));
    expect(f).toContain('No — a reimbursement');
  });

  it('spells out each deduction on its own tab', async () => {
    const f = flat(await tab(made.bytes, 'Deductions'));
    expect(f).toContain('P.F.|1800|1800|12% of ₹15,000 wage');
    expect(f).toContain('T.D.S.');
  });

  it('says plainly, on the file Accounts pays from, who is not an employee', async () => {
    const f = flat(await tab(made.bytes, 'Sep 2026 payroll'));
    expect(f).toContain('NOT ON THE REGISTER');
    expect(f).toContain('do not pay until HR confirms');
  });

  it('totals what it lists, so Accounts can check it in one line', async () => {
    const rows = await tab(made.bytes, 'Sep 2026 payroll');
    const total = rows.find((r) => r.some((c) => c.startsWith('TOTAL —')))!;
    expect(total).toBeDefined();
    expect(total).toContain('TOTAL — 3 people');
    expect(total).toContain(String(29_800 + 181_200 + 40_000)); // net
    expect(total).toContain(String(1_600)); // allowances
    expect(total).toContain(String(2_000 * 3)); // TDS across the three
  });

  it('puts the money that matters in the heading, where it is read first', async () => {
    const f = flat(await tab(made.bytes, 'Sep 2026 payroll'));
    expect(f).toContain('NET TO PAY|251000');
    expect(f).toContain('Allowances included|1600');
    expect(f).toContain('Tax (T.D.S.) held back|6000');
    expect(f).toContain('New Marbella Developers And Promoters LLP');
    expect(f).toContain('Downloaded by|Pooja Dahiya');
  });

  it('gives the attendance tab a reason for every line', async () => {
    const f = flat(await tab(made.bytes, 'Attendance'));
    expect(f).toContain('2 days absent, 4 their weekly off.');
    expect(f).toContain('Not on the attendance machine, so the full month was paid.');
  });

  it('is written so a spreadsheet will open it', () => {
    expect([...made.bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(made.bytes.length).toBeGreaterThan(2_000);
  });

  it('survives a company name with an ampersand in it', async () => {
    const srg = accountsFile(RUN, { ...OPTS, companyName: 'SRG Developers & Promoters' });
    const f = flat(await tab(srg.bytes, 'Sep 2026 payroll'));
    expect(f).toContain('SRG Developers & Promoters');
  });

  it('says so rather than showing an empty tab when nothing was paid on top', async () => {
    const none = accountsFile({ ...RUN, lines: [AJAY] }, OPTS);
    expect(flat(await tab(none.bytes, 'Allowances'))).toContain('No allowance was paid this month.');
    expect(flat(await tab(none.bytes, 'Deductions'))).toContain('Nothing was deducted this month.');
  });

  it('refuses to hide a draft behind a confident file name', async () => {
    const draft = accountsFile({ ...RUN, status: 'draft', releasedBy: '', releasedAt: null }, OPTS);
    const f = flat(await tab(draft.bytes, 'Sep 2026 payroll'));
    expect(f).toContain('DRAFT — NOT RELEASED. DO NOT PAY FROM THIS FILE.');
  });
});

/* Ported from the CSV sheet this workbook replaced. Each of these was a way a
   real month came out wrong once. */
describe('the awkward months', () => {
  const only = (l: SheetLine, opts = OPTS) => accountsFile({ ...RUN, lines: [l] }, opts);

  it('puts every figure of the run in its own column, not rolled together', async () => {
    const rows = await tab(only(AVTAR).bytes, 'Sep 2026 payroll');
    const head = rows.find((r) => r[0] === 'Sr.')!;
    const row = rows[rows.indexOf(head) + 1]!;
    const at = (col: string) => row[head.indexOf(col)];
    expect(at('Employee ID')).toBe('MB-PRJ-0023');
    expect(at('Department')).toBe('Project');
    expect(at('Joined')).toBe('16 Mar 2024');
    expect(at('Salary a month')).toBe('40000');
    expect(at('Earned this month')).toBe('32000');
    expect(at('Allowances')).toBe('1600');
    expect(at('P.F. (employee)')).toBe('1800');
    expect(at('T.D.S.')).toBe('2000');
    expect(at('Total deductions')).toBe('3800');
    expect(at('NET PAYABLE')).toBe('29800');
    expect(at("Company's own share")).toBe('1800');
  });

  it('leaves a tab empty rather than inventing figures for a line stored before it existed', async () => {
    // A line from an older release has no `reductions` and no `additions`. The
    // roll-up columns are all it ever had, and inventing a breakdown from them
    // would be inventing the rules that produced it.
    const old = { ...AVTAR, reductions: undefined, additions: undefined, eAllow: undefined };
    const made = only(old as SheetLine);
    expect(flat(await tab(made.bytes, 'Deductions'))).toContain('Nothing was deducted this month.');
    expect(flat(await tab(made.bytes, 'Allowances'))).toContain('No allowance was paid this month.');
    // But the roll-ups it does have are still on the payroll tab.
    expect(flat(await tab(made.bytes, 'Sep 2026 payroll'))).toContain('3800');
  });

  it('keeps days beyond the month in their own columns, on a different divisor', async () => {
    const extra = { ...AVTAR, extraDays: 3, extraAmount: 4_000, payable: 33_800 };
    const rows = await tab(only(extra as SheetLine).bytes, 'Sep 2026 payroll');
    const head = rows.find((r) => r[0] === 'Sr.')!;
    const row = rows[rows.indexOf(head) + 1]!;
    expect(row[head.indexOf('Extra days')]).toBe('3');
    expect(row[head.indexOf('Extra days amount')]).toBe('4000');
    expect(row[head.indexOf('NET PAYABLE')]).toBe('33800');
  });

  it('does not name a preparer on a month it only imported', async () => {
    const imported = accountsFile({ ...RUN, source: 'imported' }, OPTS);
    const f = flat(await tab(imported.bytes, 'Sep 2026 payroll'));
    expect(f).toContain("company's own salary book");
    // Naming the importer would put a person against figures they never worked out.
    expect(f).not.toContain('Prepared by|Pooja Dahiya');
    const worked = flat(await tab(accountsFile(RUN, OPTS).bytes, 'Sep 2026 payroll'));
    expect(worked).toContain('Prepared by|Pooja Dahiya');
  });

  it('survives a name with a comma and a remark with a quote', async () => {
    const odd = {
      ...AVTAR,
      name: 'Singh, Avtar',
      remark: 'He said "five days" and the machine says four',
    };
    const rows = await tab(only(odd as SheetLine).bytes, 'Sep 2026 payroll');
    const head = rows.find((r) => r[0] === 'Sr.')!;
    const row = rows[rows.indexOf(head) + 1]!;
    expect(row[2]).toBe('Singh, Avtar');
    expect(row[head.indexOf('Remarks')]).toBe('He said "five days" and the machine says four');
  });

  it('will not let a remark become a spreadsheet formula', async () => {
    // The CSV this replaced had to prefix a leading = with a quote. A workbook
    // cell is a formula only inside <f>, and every text cell here is written as
    // an inline string, so it cannot become one — asserted rather than assumed.
    const odd = { ...AVTAR, remark: '=1+1', name: '=cmd|calc' };
    const rows = await tab(only(odd as SheetLine).bytes, 'Sep 2026 payroll');
    const head = rows.find((r) => r[0] === 'Sr.')!;
    const row = rows[rows.indexOf(head) + 1]!;
    expect(row[2]).toBe('=cmd|calc');
    expect(row[head.indexOf('Remarks')]).toBe('=1+1');
    const xml = new TextDecoder().decode(only(odd as SheetLine).bytes);
    expect(xml).not.toContain('<f>');
  });

  it('carries every person, in the order the run holds them', async () => {
    const rows = await tab(accountsFile(RUN, OPTS).bytes, 'Sep 2026 payroll');
    const head = rows.indexOf(rows.find((r) => r[0] === 'Sr.')!);
    expect(rows.slice(head + 1, head + 4).map((r) => r[2])).toEqual([
      'Avtar Singh',
      'Ajay Goel',
      'Somebody Else',
    ]);
  });
});
