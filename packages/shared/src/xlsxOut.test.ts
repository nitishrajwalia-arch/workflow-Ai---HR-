/**
 * The workbook writer, checked by the reader that sits next to it.
 *
 * Nothing is asserted about the bytes. The file is written, handed to
 * xlsxToSheet — the same code that reads the sheets HR uploads — and the cells
 * that come back are compared with the cells that went in. If either half
 * drifts, this fails.
 */

import { describe, expect, it } from 'vitest';
import { payrollReport, reportToXlsx, tenureWords, type ReportLine, type ReportRun } from './payreport.js';
import { toXlsx } from './xlsxOut.js';
import { readXlsx } from './xlsx.js';

/** Rows straight off the sheet, as the intake screen reads them. */
const read = async (bytes: Uint8Array): Promise<{ headers: string[]; rows: string[][] }> => {
  const rows = await readXlsx(bytes);
  return { headers: rows[0] ?? [], rows: rows.slice(1) };
};

describe('writing a workbook', () => {
  it('reads back what was written', async () => {
    const bytes = toXlsx({
      name: 'Sep 2026 payroll',
      rows: [
        [{ v: 'Employee ID', look: 'head' }, { v: 'Name', look: 'head' }, { v: 'Net', look: 'head' }],
        ['MB-PRJ-0014', 'Ajay Goel', { v: 185_000, look: 'money' }],
        ['MB-PRJ-0023', 'Avtar Singh', { v: 31_000, look: 'money' }],
      ],
      widths: [14, 26, 12],
      freezeRows: 1,
    });
    const sheet = await read(bytes);
    expect(sheet.headers).toEqual(['Employee ID', 'Name', 'Net']);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0]).toEqual(['MB-PRJ-0014', 'Ajay Goel', '185000']);
    expect(sheet.rows[1]?.[1]).toBe('Avtar Singh');
  });

  it('survives an ampersand, a quote and a name in Devanagari', async () => {
    const bytes = toXlsx({
      name: 'odd',
      rows: [
        [{ v: 'A', look: 'head' }, { v: 'B', look: 'head' }],
        ['SRG Developers & Promoters', 'O"Brien'],
        ['सुनील कुमार', 'ok'],
      ],
    });
    const sheet = await read(bytes);
    expect(sheet.rows[0]?.[0]).toBe('SRG Developers & Promoters');
    expect(sheet.rows[0]?.[1]).toBe('O"Brien');
    expect(sheet.rows[1]?.[0]).toBe('सुनील कुमार');
  });

  it('writes a file a spreadsheet will recognise', () => {
    const bytes = toXlsx({ name: 'x', rows: [['a']] });
    // PK\u0003\u0004 — a ZIP, which is what an .xlsx is.
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(bytes.length).toBeGreaterThan(500);
  });
});

/* ------------------------------------------------------------------ report */

const line = (over: Partial<ReportLine> & Pick<ReportLine, 'pid' | 'name'>): ReportLine => ({
  designation: 'Site Engineer',
  days: 30,
  gross: 40_000,
  eGross: 40_000,
  dEsi: 0,
  dPf: 1_800,
  dTds: 2_000,
  dAdvance: 0,
  dOther: 0,
  dTotal: 3_800,
  erEsi: 0,
  erPf: 1_800,
  extraDays: 0,
  extraAmount: 0,
  arrear: 0,
  payable: 36_200,
  remark: '',
  ...over,
});

const RUN: ReportRun = {
  month: 'Sep 2026',
  monthDays: 30,
  company: 'srg',
  status: 'released',
  releasedBy: 'Pooja Dahiya',
  lines: [
    line({ pid: 'MB-PRJ-0014', name: 'Ajay Goel', gross: 185_000, eGross: 185_000, payable: 181_200 }),
    line({ pid: 'MB-PRJ-0023', name: 'Avtar Singh', days: 24, gross: 31_000, eGross: 24_800, payable: 21_000, remark: '6 days absent.' }),
    line({ pid: null, name: 'Somebody Else', dTotal: 0, payable: 40_000 }),
  ],
};

describe('the month’s report', () => {
  const rep = payrollReport(RUN, {
    companyName: 'SRG Developers & Promoters',
    at: new Date('2026-09-29T00:00:00Z'),
    people: [
      { id: 'MB-PRJ-0014', dept: 'Project', joined: '28 Feb 2020' },
      { id: 'MB-PRJ-0023', dept: 'Project', joined: '16 Mar 2024' },
    ],
  });

  it('carries the columns the management asked for', () => {
    const r = rep.rows[1]!;
    expect(r.id).toBe('MB-PRJ-0023');
    expect(r.name).toBe('Avtar Singh');
    expect(r.dept).toBe('Project');
    expect(r.days).toBe(24);
    expect(r.withUs).toBe('2 years 6 months');
    expect(r.salary).toBe(31_000);
    expect(r.tds).toBe(2_000);
    expect(r.deductions).toBe(3_800);
    expect(r.remark).toBe('6 days absent.');
  });

  it('says plainly when nobody on the register answers to a line', () => {
    const stranger = rep.rows[2]!;
    expect(stranger.stranger).toBe(true);
    expect(stranger.id).toBe('—');
    expect(stranger.dept).toBe('—');
    expect(stranger.remark).toContain('NOT ON THE EMPLOYEE REGISTER');
  });

  it('totals what it lists', () => {
    expect(rep.totals.people).toBe(3);
    expect(rep.totals.payable).toBe(181_200 + 21_000 + 40_000);
    expect(rep.totals.tds).toBe(6_000);
    expect(rep.totals.deductions).toBe(3_800 + 3_800);
  });

  it('never reports a negative length of service', () => {
    expect(tenureWords('01 Jan 2030', new Date('2026-09-29T00:00:00Z'))).toBe('not started yet');
    expect(tenureWords('', new Date())).toBe('—');
    expect(tenureWords('20 Sep 2026', new Date('2026-09-29T00:00:00Z'))).toBe('less than a month');
  });

  it('becomes a workbook that reads back with every person on it', async () => {
    const { name, bytes } = reportToXlsx(rep);
    expect(name).toMatch(/^Marbella-payroll-Sep-2026-SRG/);
    expect(name.endsWith('.xlsx')).toBe(true);
    const sheet = await read(bytes);
    // The heading block comes first, so the reader's "headers" is its first row.
    expect(sheet.headers[0]).toBe('MARBELLA GROUP — PAYROLL REPORT');
    const flat = sheet.rows.map((r) => r.join('|')).join('\n');
    expect(flat).toContain('Ajay Goel');
    expect(flat).toContain('Avtar Singh');
    expect(flat).toContain('NOT ON THE EMPLOYEE REGISTER');
    expect(flat).toContain('Employee ID');
    expect(flat).toContain('2 years 6 months');
  });
});
