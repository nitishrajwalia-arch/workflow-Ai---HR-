/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * Allowances — money that goes ON a payslip because a company policy says so.
 *
 * The questions these answer are the ones asked of a payslip a year later: who
 * was this paid to, why that figure, and was it taxed. Every one of them has a
 * wrong answer that looks plausible, which is why they are all here.
 */

import { describe, expect, it } from 'vitest';
import {
  allowanceApplies,
  allowanceTotals,
  allowancesFor,
  payableDays,
  readAdditions,
  type AllowanceHead,
} from './pay.js';

const head = (over: Partial<AllowanceHead> & Pick<AllowanceHead, 'code' | 'label'>): AllowanceHead => ({
  basis: 'flat',
  rate: 0,
  wage: 0,
  ceiling: 0,
  floor: 0,
  proRate: true,
  rounding: 'nearest',
  appliesTo: '',
  taxable: true,
  authority: '',
  active: true,
  ...over,
});

const SITE = head({
  code: 'site',
  label: 'Site allowance',
  wage: 2_000,
  appliesTo: 'Site',
  authority: 'Board note of 12 Mar 2026 — ₹2,000 a month to site staff.',
});

const FULL = { gross: 40_000, eGross: 40_000, days: 30, monthDays: 30 };

describe('who an allowance reaches', () => {
  it('reaches everybody when no group is named', () => {
    const got = allowancesFor([head({ code: 'x', label: 'Fuel', wage: 500 })], {
      ...FULL,
      who: { dept: 'Accounts', type: 'Staff' },
    });
    expect(got).toHaveLength(1);
    expect(got[0]!.amount).toBe(500);
  });

  it('reaches the group it names, by department, by type or by site', () => {
    expect(allowanceApplies('Maintenance', { dept: 'Maintenance' })).toBe(true);
    expect(allowanceApplies('site', { type: 'Site' })).toBe(true);
    expect(allowanceApplies('Curo One', { site: 'Curo One' })).toBe(true);
    expect(allowanceApplies('Accounts', { dept: 'Project', type: 'Staff' })).toBe(false);
  });

  it('reaches NOBODY when the group is mistyped, rather than everybody', () => {
    // The dangerous failure. A scope nobody matches is money not going out;
    // a scope treated as "no scope" is money going out to the whole payroll.
    expect(allowancesFor([head({ code: 'x', label: 'Night', wage: 900, appliesTo: 'Maintenanse' })], {
      ...FULL,
      who: { dept: 'Maintenance' },
    })).toEqual([]);
  });

  it('keeps a site allowance off a manager on a big salary', () => {
    const capped = head({ ...SITE, ceiling: 30_000 });
    expect(allowancesFor([capped], { ...FULL, who: { type: 'Site' } })).toEqual([]);
    expect(allowancesFor([capped], { ...FULL, gross: 25_000, who: { type: 'Site' } })).toHaveLength(1);
  });

  it('honours a floor as well as a ceiling', () => {
    const h = head({ code: 'car', label: 'Car allowance', wage: 8_000, floor: 80_000 });
    expect(allowancesFor([h], FULL)).toEqual([]);
    expect(allowancesFor([h], { ...FULL, gross: 95_000 })).toHaveLength(1);
  });

  it('pays nothing for a head that is switched off', () => {
    expect(allowancesFor([head({ ...SITE, active: false })], { ...FULL, who: { type: 'Site' } })).toEqual([]);
  });
});

describe('what an allowance comes to', () => {
  const who = { type: 'Site' };

  it('pro-rates a flat allowance for the days paid', () => {
    const got = allowancesFor([SITE], { ...FULL, days: 24, who });
    expect(got[0]!.amount).toBe(1_600); // 2000 × 24/30
    expect(got[0]!.why).toContain('24 of 30 days');
  });

  it('pays a flat allowance whole when the policy does not pro-rate', () => {
    const got = allowancesFor([head({ ...SITE, proRate: false })], { ...FULL, days: 24, who });
    expect(got[0]!.amount).toBe(2_000);
    expect(got[0]!.why).not.toContain('24 of 30');
  });

  it('works a percentage off what was earned', () => {
    const got = allowancesFor(
      [head({ code: 'perf', label: 'Performance', basis: 'earnedPct', rate: 10 })],
      { ...FULL, eGross: 32_000 },
    );
    expect(got[0]!.amount).toBe(3_200);
    expect(got[0]!.why).toContain('earned');
  });

  it('takes the figure HR typed when the head has no rule', () => {
    const got = allowancesFor([head({ code: 'bonus', label: 'Festival bonus', basis: 'entered' })], {
      ...FULL,
      entered: { bonus: 5_100 },
    });
    expect(got[0]!.amount).toBe(5_100);
    expect(got[0]!.policy).toBe(false);
  });

  it('leaves out a head that comes to nothing', () => {
    expect(allowancesFor([head({ code: 'b', label: 'Bonus', basis: 'entered' })], FULL)).toEqual([]);
  });

  it('carries the policy it comes from, in words, onto the line', () => {
    expect(allowancesFor([SITE], { ...FULL, who }).map((a) => a.label)).toEqual(['Site allowance']);
    // The authority rides on the head for a rule-driven one; for a typed one it
    // is the only explanation there is, so it becomes the reason.
    const typed = allowancesFor([head({ code: 't', label: 'Ex gratia', basis: 'entered', authority: 'Director approval' })], {
      ...FULL,
      entered: { t: 1_000 },
    });
    expect(typed[0]!.why).toBe('Director approval');
  });

  it('adds what HR grants by hand, and treats it as pay by default', () => {
    const got = allowancesFor([], { ...FULL, others: [{ label: 'Moved site at his own cost', amount: 1_200 }] });
    expect(got[0]!.amount).toBe(1_200);
    expect(got[0]!.taxable).toBe(true);
    expect(got[0]!.policy).toBe(false);
  });
});

describe('what is pay and what is not', () => {
  it('separates a reimbursement from an allowance in the totals', () => {
    const list = allowancesFor(
      [SITE, head({ code: 'bus', label: 'Bus fare reimbursed', wage: 600, taxable: false })],
      { ...FULL, who: { type: 'Site' } },
    );
    const t = allowanceTotals(list);
    expect(t.total).toBe(2_600);
    // The 600 he already spent is not income, and taxing it would be taxing a
    // man on his own bus fare.
    expect(t.taxable).toBe(2_000);
  });
});

describe('reading a line saved earlier', () => {
  it('survives rubbish in the column', () => {
    expect(readAdditions(null)).toEqual([]);
    expect(readAdditions('nonsense')).toEqual([]);
    expect(readAdditions([{ nope: 1 }, 7, null])).toEqual([]);
  });

  it('treats a row written before taxable existed as pay', () => {
    const got = readAdditions([{ code: 'site', label: 'Site allowance', amount: 2000, why: '', policy: true }]);
    expect(got[0]!.taxable).toBe(true);
  });

  it('reads back what the engine wrote', () => {
    const made = allowancesFor([SITE], { ...FULL, who: { type: 'Site' } });
    expect(readAdditions(JSON.parse(JSON.stringify(made)))).toEqual(made);
  });
});

/* ------------------------------------------------------------- attendance */

describe('the attendance a line was worked out from', () => {
  // September 2026: the 6th, 13th, 20th and 27th are Sundays.
  const SUNDAYS = ['06 Sep 2026', '13 Sep 2026', '20 Sep 2026', '27 Sep 2026'];

  it('keeps the reasons, not just the answer', () => {
    const d = payableDays({
      monthDays: 30,
      onMachine: true,
      absentDates: [...SUNDAYS, '02 Sep 2026', '03 Sep 2026', '17 Sep 2026'],
      holidayDates: ['17 Sep 2026'],
      offDay: 'Sunday',
    });
    expect(d.counted).toBe(true);
    expect(d.weekOff).toBe(4); // his Sundays, paid
    expect(d.holiday).toBe(1); // the company was shut, paid
    expect(d.absent).toBe(2); // the 2nd and the 3rd
    expect(d.leave).toBe(0);
    expect(d.lost).toBe(2);
    expect(d.days).toBe(28);
    expect(d.present).toBe(23); // 30 less the 7 the machine has no punch for
    // The counts have to add up to the month, or the sheet cannot be checked.
    expect(d.present + d.absent + d.weekOff + d.holiday + d.leave).toBe(30);
  });

  it('counts leave as covering an absence rather than hiding it', () => {
    const d = payableDays({
      monthDays: 30,
      onMachine: true,
      absentDates: ['02 Sep 2026', '03 Sep 2026', '04 Sep 2026'],
      holidayDates: [],
      paidLeave: 2,
      offDay: 'Sunday',
    });
    expect(d.absent).toBe(3);
    expect(d.leave).toBe(2);
    expect(d.lost).toBe(1);
    expect(d.days).toBe(29);
  });

  it('says NOT RECORDED rather than zero for somebody off the machine', () => {
    const d = payableDays({ monthDays: 31, onMachine: false, absentDates: [], holidayDates: [] });
    expect(d.counted).toBe(false);
    expect(d.days).toBe(31);
    // The trap: a zero here reads off the sheet as a man who never came in.
    expect(d.present).toBe(-1);
    expect(d.absent).toBe(-1);
    expect(d.weekOff).toBe(-1);
  });
});

describe('an attendance file the weekly-off check cannot read', () => {
  it('says so on the line instead of quietly docking the day', () => {
    // "06 Sep" with no year. The parser returns null, the day cannot be shown
    // to be a Sunday, and it is docked — correct arithmetic, wrong answer.
    const d = payableDays({
      monthDays: 30,
      onMachine: true,
      absentDates: ['06 Sep', '13 Sep'],
      holidayDates: [],
      offDay: 'Sunday',
    });
    expect(d.lost).toBe(2);
    expect(d.why).toContain('without a year');
    expect(d.why).toContain('CHECK BEFORE PAYING');
  });

  it('stays quiet when every date reads', () => {
    const d = payableDays({
      monthDays: 30,
      onMachine: true,
      absentDates: ['06 Sep 2026'],
      holidayDates: [],
      offDay: 'Sunday',
    });
    expect(d.lost).toBe(0);
    expect(d.why).not.toContain('CHECK BEFORE PAYING');
  });
});
