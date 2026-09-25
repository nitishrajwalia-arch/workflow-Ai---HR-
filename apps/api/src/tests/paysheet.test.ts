/**
 * The sheet Accounts receives.
 *
 * The screen is checked by eye; the file is checked here, because nobody reads
 * a CSV closely enough to notice that one column shifted. The sheet is built
 * from a real August book, parsed back out of the text, and every figure on
 * every row is compared to the run it was built from — including the totals
 * row, which is the line Accounts actually reconciles against.
 */

import { computeLine, rollOutSheet, type PayPolicy, type SheetLine } from '@marbella/shared';
import { describe, expect, it } from 'vitest';
import { PAY_AUGUST, PAY_POLICIES } from '../../prisma/real-pay.js';

/** Enough of a CSV reader to check our own writer. Handles quotes and CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\r') {
      /* part of CRLF */
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const policy = (c: string): PayPolicy =>
  PAY_POLICIES[c as keyof typeof PAY_POLICIES] as unknown as PayPolicy;

/** The Grand book, recomputed by the engine, in the shape the sheet takes. */
function august(book: string): { run: Parameters<typeof rollOutSheet>[0]; lines: SheetLine[] } {
  const lines: SheetLine[] = PAY_AUGUST.filter((l) => l.book === book).map((l) => {
    const g = computeLine(
      policy(l.company),
      {
        gross: l.gross,
        basic: l.basic,
        hra: l.hra,
        travel: l.travel,
        medical: l.medical,
        special: l.special,
        esiOn: l.dEsi > 0 || l.erEsi > 0,
        pfOn: l.dPf > 0,
        pfWages: l.pfWages,
      },
      {
        days: l.days,
        monthDays: 31,
        extraDays: l.extraDays,
        tds: l.dTds,
        advance: l.dAdvance,
        other: l.dOther,
        arrear: l.arrear,
      },
    );
    return {
      pid: l.personId ?? null,
      name: l.name,
      designation: l.designation,
      ...g,
      remark: '',
    };
  });
  return {
    lines,
    run: {
      month: 'Aug 2026',
      company: 'srg',
      monthDays: 31,
      status: 'released',
      source: 'imported',
      createdBy: 'HR',
      releasedBy: 'Pooja Dahiya',
      releasedAt: '2026-09-01T00:00:00.000Z',
      lines,
    },
  };
}

const AT = new Date('2026-09-25T00:00:00.000Z');

describe('the roll-out sheet', () => {
  const { run, lines } = august('grand');
  const { name, csv } = rollOutSheet(run, {
    companyName: 'SRG Developers & Promoters',
    joined: { 'MB-PRJ-0023': '01 Apr 2019' },
    preparedBy: 'Pooja Dahiya',
    at: AT,
  });
  const rows = parseCsv(csv);
  const head = rows.findIndex((r) => r[0] === 'Sr. No.');
  const body = rows.slice(head + 1, head + 1 + lines.length);
  const totals = rows[head + 1 + lines.length] as string[];
  const col = (label: string): number => (rows[head] as string[]).indexOf(label);

  it('names the file after the company and the month, so August is not paid twice', () => {
    expect(name).toBe('salary-SRG-Developers-Promoters-Aug-2026.csv');
  });

  it('says on the sheet itself that it is released and does not change', () => {
    const status = rows.find((r) => r[0] === 'Status');
    expect(status?.[1]).toContain('Released to Accounts');
    expect(rows.find((r) => r[0] === 'Month')?.[1]).toBe('Aug 2026');
    expect(rows.find((r) => r[0] === 'People on this sheet')?.[1]).toBe(String(lines.length));
    expect(rows.find((r) => r[0] === 'Downloaded on')?.[1]).toBe('2026-09-25');
  });

  it('carries one row per person, in order, with the joining date it was given', () => {
    expect(body).toHaveLength(lines.length);
    body.forEach((r, i) => {
      expect(r[col('Employee Name')]).toBe(lines[i]?.name);
      expect(r[0]).toBe(String(i + 1));
    });
    const avtar = body.find((r) => r[col('Employee Name')] === 'Avtar Singh');
    expect(avtar?.[col('D.O.J')]).toBe('01 Apr 2019');
  });

  it('puts every figure of the run in its own column', () => {
    body.forEach((r, i) => {
      const l = lines[i] as SheetLine;
      expect(Number(r[col('Gross Salary')])).toBe(l.gross);
      expect(Number(r[col('Gross Payable')])).toBe(l.eGross);
      expect(Number(r[col('E.S.I. (employee)')])).toBe(l.dEsi);
      expect(Number(r[col('P.F. (employee)')])).toBe(l.dPf);
      expect(Number(r[col('Total Deduction')])).toBe(l.dTotal);
      expect(Number(r[col('Total Salary Paid')])).toBe(l.net);
      expect(Number(r[col('Net Payable')])).toBe(l.payable);
      expect(Number(r[col('Total Employer Share')])).toBe(l.erEsi + l.erPf);
      // The parts have to add to the earned gross on the face of the sheet,
      // because that is the check Accounts does by hand.
      const parts = [
        'Earned Basic',
        'Earned H.R.A.',
        'Earned Travelling',
        'Earned Medical',
        'Earned Special',
      ];
      expect(parts.reduce((a, k) => a + Number(r[col(k)]), 0)).toBe(l.eGross);
    });
  });

  it('totals every money column under it', () => {
    expect(totals[col('Employee Name')]).toBe(`TOTAL — ${lines.length} people`);
    for (const k of ['Gross Salary', 'Gross Payable', 'Total Deduction', 'Net Payable']) {
      const want = lines.reduce(
        (a, l) =>
          a +
          (k === 'Gross Salary'
            ? l.gross
            : k === 'Gross Payable'
              ? l.eGross
              : k === 'Total Deduction'
                ? l.dTotal
                : l.payable),
        0,
      );
      expect(Number(totals[col(k)]), k).toBe(want);
    }
  });

  it('spells out each reduction with the rule behind it', () => {
    const one: SheetLine = {
      ...(lines[0] as SheetLine),
      reductions: [
        {
          code: 'pf',
          label: 'P.F.',
          amount: 1800,
          employer: 1800,
          statutory: true,
          why: '12% of \u20b915,000 wage',
        },
        {
          code: 'advance',
          label: 'Advance recovered',
          amount: 5000,
          employer: 0,
          statutory: false,
          why: 'Entered by HR for this month',
        },
      ],
    };
    const { csv: c } = rollOutSheet({ ...run, lines: [one] }, { at: AT });
    const r = parseCsv(c);
    const h = r.findIndex((x) => x[0] === 'Sr. No.');
    const cell = (r[h + 1] as string[])[
      (r[h] as string[]).indexOf('Salary Reductions — head by head')
    ];
    expect(cell).toContain('P.F.');
    expect(cell).toContain('12% of \u20b915,000 wage');
    expect(cell).toContain('Advance recovered');
    expect(cell).toContain('\u20b95,000');
  });

  it('leaves the column empty rather than inventing one for an older line', () => {
    const c = rollOutSheet({ ...run, lines: [{ ...(lines[0] as SheetLine) }] }, { at: AT }).csv;
    const r = parseCsv(c);
    const h = r.findIndex((x) => x[0] === 'Sr. No.');
    expect(
      (r[h + 1] as string[])[(r[h] as string[]).indexOf('Salary Reductions — head by head')],
    ).toBe('');
  });

  it('gives days beyond the month their own block, as the company book does', () => {
    const at = rows.findIndex((r) => r[0] === 'Days beyond the month — paid separately');
    expect(at).toBeGreaterThan(0);
    const extra = lines.filter((l) => l.extraDays > 0);
    const block = rows.slice(at + 2, at + 2 + extra.length);
    expect(block).toHaveLength(extra.length);
    expect(Number((rows[at + 2 + extra.length] as string[])[4])).toBe(
      extra.reduce((a, l) => a + l.extraAmount, 0),
    );
  });

  it('leaves the block out when nobody worked beyond the month', () => {
    const flat = lines.map((l) => ({ ...l, extraDays: 0, extraAmount: 0 }));
    const { csv: c } = rollOutSheet({ ...run, lines: flat }, { at: AT });
    expect(c).not.toContain('Days beyond the month');
  });

  it('says on the sheet who is being paid but is not on the register', () => {
    const orphan: SheetLine = { ...(lines[0] as SheetLine), pid: null, name: 'Sumedha' };
    const { csv: c } = rollOutSheet({ ...run, lines: [orphan] }, { at: AT });
    expect(c).toContain('1 person is on this sheet and not on the employee register');
    expect(c).toContain('NOT ON THE REGISTER');
  });

  it('does not name a preparer on a run it only imported, and does on one it worked out', () => {
    expect(csv).not.toContain('Prepared by');
    const { csv: c } = rollOutSheet({ ...run, source: 'computed' }, { at: AT });
    expect(c).toContain('Prepared by,HR');
    expect(c).toContain('Released by,Pooja Dahiya');
  });

  it('warns in the file when the run is still a draft', () => {
    const { csv: c } = rollOutSheet(
      { ...run, status: 'draft', releasedBy: '', releasedAt: null },
      { at: AT },
    );
    expect(c).toContain('DRAFT — not released. Do not pay from this sheet.');
  });

  it('survives a name with a comma and a remark with a quote', () => {
    const odd: SheetLine = {
      ...(lines[0] as SheetLine),
      name: 'Singh, Avtar',
      remark: 'He said "five days" and the machine says four',
    };
    const { csv: c } = rollOutSheet({ ...run, lines: [odd] }, { at: AT });
    const r = parseCsv(c);
    const h = r.findIndex((x) => x[0] === 'Sr. No.');
    expect((r[h + 1] as string[])[2]).toBe('Singh, Avtar');
    expect((r[h + 1] as string[])[(r[h] as string[]).indexOf('Remark')]).toBe(
      'He said "five days" and the machine says four',
    );
  });

  it('will not let a remark become a spreadsheet formula', () => {
    const odd: SheetLine = { ...(lines[0] as SheetLine), remark: '=1+1' };
    const { csv: c } = rollOutSheet({ ...run, lines: [odd] }, { at: AT });
    expect(c).toContain("'=1+1");
  });
});
