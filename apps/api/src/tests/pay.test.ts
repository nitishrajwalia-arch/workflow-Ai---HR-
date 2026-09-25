/**
 * The payroll engine, against the four books the company actually paid from.
 *
 * This is the test that matters. `packages/shared/src/pay.ts` holds rules read
 * off Marbella's own August 2026 salary sheets; this recomputes all 132 lines
 * from each person's structure and the days they were paid for, and compares
 * every figure to what the company paid. A rule that is nearly right shows up
 * here as a handful of rupees on a handful of people, which is exactly how a
 * payroll bug reaches somebody's bank account.
 */

import {
  breakUp,
  computeLine,
  payableDays,
  proposeBreakUp,
  type PayPolicy,
  type PayStructure,
} from '@marbella/shared';
import { describe, expect, it } from 'vitest';
import { PAY_AUGUST, PAY_POLICIES } from '../../prisma/real-pay.js';

const policy = (c: string): PayPolicy =>
  PAY_POLICIES[c as keyof typeof PAY_POLICIES] as unknown as PayPolicy;

/**
 * Where the company's own books do not follow the company's own rules.
 *
 * Six places out of a hundred and thirty-two lines. They are listed rather than
 * tolerated: the test asserts these are the ONLY differences, so the next
 * month's import cannot quietly add a seventh. Each one is a thing for somebody
 * at Marbella to look at, not a thing for the software to correct on its own.
 */
const BOOK_DIFFERS: Record<string, string> = {
  // The parts do not add up to the gross the same book states.
  'twin/Mandeep Singh': 'parts add to 21,960 against a stated gross of 22,000 — 40 short',
  'twin/Sharavan Kumar': 'parts add to 23,960 against a stated gross of 24,000 — 40 short',
  'grand/Rohit': 'parts add to 21,430 against a stated gross of 21,500 — 70 short',
  // The book's own rounding, one rupee, on a stated-breakup line.
  'newmarbella/Pappu Kumar Verma': 'earned gross rounds to 20,113 on the book, 20,112 here',
  // THE ONE THAT COST MONEY. A TDS of 20,000 is entered against him and the Net
  // Payable is the gross — the deduction was never taken off.
  'twin/Rajesh Verma': 'TDS of 20,000 entered but not subtracted; net payable is the gross',
};
/**
 * And one where the RECORD is internally fine but does not follow the formula:
 * a Travelling Allowance typed as 2,900 where 10% of Basic is 2,940, with the
 * 40 moved into Special so the parts still add up. That is a different kind of
 * thing — the person is on what the record says, and the record is consistent.
 * It is here so that `breakUp` preferring the record over the formula is a
 * decision the tests hold to, not an accident.
 */
const OFF_FORMULA = ['royce/Abhishek Kumar'];

const key = (l: (typeof PAY_AUGUST)[number]) => `${l.book}/${l.name}`;

const structureOf = (l: (typeof PAY_AUGUST)[number]): PayStructure => ({
  gross: l.gross,
  basic: l.basic,
  hra: l.hra,
  travel: l.travel,
  medical: l.medical,
  special: l.special,
  esiOn: l.dEsi > 0 || l.erEsi > 0,
  pfOn: l.dPf > 0,
  pfWages: l.pfWages,
});

describe('the monthly breakup', () => {
  it('takes the record over the formula where the two differ', () => {
    // Every SRG line reproduces exactly, because the record is what is paid.
    const off: string[] = [];
    for (const l of PAY_AUGUST) {
      const m = breakUp(policy(l.company), structureOf(l));
      if (m.basic !== l.basic || m.hra !== l.hra || m.travel !== l.travel || m.special !== l.special) {
        off.push(key(l));
      }
    }
    expect(off, off.join(' | ')).toHaveLength(0);
  });

  it('knows which records do not follow the formula, and it is one', () => {
    const off: string[] = [];
    for (const l of PAY_AUGUST) {
      const p = policy(l.company);
      if (p.kind !== 'percent') continue;
      const f = proposeBreakUp(p, l.gross, l.medical);
      if (f.basic !== l.basic || f.hra !== l.hra || f.travel !== l.travel) off.push(key(l));
    }
    expect(off.sort()).toEqual(OFF_FORMULA);
  });

  it('adds up to the gross exactly, apart from the three the book gets wrong', () => {
    const off: string[] = [];
    for (const l of PAY_AUGUST) {
      const m = breakUp(policy(l.company), structureOf(l));
      const sum = m.basic + m.hra + m.travel + m.medical + m.special;
      if (sum !== m.gross && !BOOK_DIFFERS[key(l)]) off.push(`${key(l)}: ${sum} vs ${m.gross}`);
    }
    expect(off, off.join(' | ')).toHaveLength(0);
  });

  it('proposes a split for a new person that adds up exactly', () => {
    for (const gross of [18_000, 22_000, 29_500, 47_000, 185_000]) {
      const m = proposeBreakUp(policy('srg'), gross, 500);
      expect(m.basic).toBe(Math.round(gross * 0.7));
      expect(m.hra).toBe(Math.round(m.basic * 0.3));
      expect(m.travel).toBe(Math.round(m.basic * 0.1));
      expect(m.basic + m.hra + m.travel + m.medical + m.special).toBe(gross);
    }
  });
});

describe('a month, recomputed', () => {
  it('matches the earned gross on all 132 lines', () => {
    const off: string[] = [];
    for (const l of PAY_AUGUST) {
      const got = computeLine(policy(l.company), structureOf(l), { days: l.days, monthDays: 31 });
      if (got.eGross !== l.eGross && !BOOK_DIFFERS[key(l)]) {
        off.push(`${key(l)} days ${l.days}: computed ${got.eGross}, book says ${l.eGross}`);
      }
    }
    expect(off, off.slice(0, 6).join(' | ')).toHaveLength(0);
  });

  it('matches every earned component, not just the total', () => {
    const off: string[] = [];
    for (const l of PAY_AUGUST) {
      const g = computeLine(policy(l.company), structureOf(l), { days: l.days, monthDays: 31 });
      for (const [k, mine, theirs] of [
        ['basic', g.eBasic, l.eBasic], ['hra', g.eHra, l.eHra],
        ['travel', g.eTravel, l.eTravel], ['medical', g.eMedical, l.eMedical],
        ['special', g.eSpecial, l.eSpecial],
      ] as const) {
        if (mine !== theirs) off.push(`${l.name} ${k}: ${mine} vs ${theirs}`);
      }
    }
    expect(off, off.slice(0, 8).join(' | ')).toHaveLength(0);
  });

  it('matches the net payable once the book’s own deductions are fed in', () => {
    const off: string[] = [];
    for (const l of PAY_AUGUST) {
      const g = computeLine(policy(l.company), structureOf(l), {
        days: l.days, monthDays: 31,
        tds: l.dTds, advance: l.dAdvance, other: l.dOther, arrear: l.arrear,
      });
      // ESI and PF are recomputed, not fed in — they are the rules being tested.
      const mine = g.eGross - (g.dEsi + g.dPf + l.dTds + l.dAdvance + l.dOther) + l.arrear;
      if (Math.abs(mine - l.net) > 1 && !BOOK_DIFFERS[key(l)]) {
        off.push(`${key(l)}: ${mine} vs ${l.net}`);
      }
    }
    expect(off, off.slice(0, 8).join(' | ')).toHaveLength(0);
  });

  it('prices a day beyond the month the way the Extra sheets do', () => {
    const withExtra = PAY_AUGUST.filter((l) => l.extraDays > 0);
    expect(withExtra.length).toBeGreaterThan(50);
    const off: string[] = [];
    for (const l of withExtra) {
      const g = computeLine(policy(l.company), structureOf(l), {
        days: l.days, monthDays: 31, extraDays: l.extraDays,
      });
      // The books use a 30-day divisor even in a 31-day month. That is theirs.
      if (Math.abs(g.extraAmount - l.extraAmount) > 1) {
        off.push(`${l.name}: ${l.extraDays}d -> ${g.extraAmount} vs ${l.extraAmount}`);
      }
    }
    expect(off, off.slice(0, 6).join(' | ')).toHaveLength(0);
  });
});

describe('what it refuses to do', () => {
  it('will not pay more than a full month however many days are passed in', () => {
    const l = PAY_AUGUST[0]!;
    const g = computeLine(policy(l.company), structureOf(l), { days: 45, monthDays: 31 });
    expect(g.days).toBe(31);
    expect(g.eGross).toBe(g.gross);
  });

  it('leaves ESI off above a ceiling, when a ceiling is set', () => {
    // Marbella's own policies carry no ceiling, because their books deduct ESI
    // from people on up to 29,000 a month against a statutory 21,000. The
    // software does what the company does; this proves the ceiling still works
    // for whoever sets one.
    const p = { ...policy('newmarb'), esiCeiling: 21_000 };
    const rich: PayStructure = {
      gross: 40_000, basic: 25_000, hra: 10_000, special: 5_000, medical: 0, travel: 0,
      esiOn: true, pfOn: false, pfWages: 0,
    };
    expect(computeLine(p, rich, { days: 31, monthDays: 31 }).dEsi).toBe(0);
  });

  it('caps PF at the policy wage however much somebody earns', () => {
    const p = policy('newmarb');
    const big = computeLine(p, {
      gross: 200_000, basic: 120_000, hra: 60_000, special: 20_000, medical: 0, travel: 0,
      esiOn: false, pfOn: true, pfWages: 0,
    }, { days: 31, monthDays: 31 });
    expect(big.dPf).toBe(1800);
  });
});

describe('days to pay for', () => {
  it('gives the full month to somebody the machine does not cover, and says so', () => {
    const d = payableDays({ monthDays: 31, onMachine: false, absentDates: [], holidayDates: [] });
    expect(d.days).toBe(31);
    expect(d.why).toMatch(/not on the attendance machine/i);
  });

  it('takes off the days the machine recorded nothing', () => {
    const d = payableDays({
      monthDays: 31, onMachine: true,
      absentDates: ['03 Aug 2026', '04 Aug 2026', '05 Aug 2026'], holidayDates: [],
    });
    expect(d.days).toBe(28);
    expect(d.lost).toBe(3);
  });

  it('does not dock somebody for a day the company was shut', () => {
    const d = payableDays({
      monthDays: 31, onMachine: true,
      absentDates: ['15 Aug 2026', '16 Aug 2026'], holidayDates: ['15 Aug 2026'],
    });
    expect(d.days).toBe(30);
  });

  it('lets leave cover an absence', () => {
    const d = payableDays({
      monthDays: 31, onMachine: true,
      absentDates: ['03 Aug 2026', '04 Aug 2026'], holidayDates: [], paidLeave: 2,
    });
    expect(d.days).toBe(31);
    expect(d.why).toMatch(/covered by leave/);
  });
});

describe('the six places the books disagree with themselves', () => {
  it('are all still there, and nothing else has joined them', () => {
    const found: string[] = [];
    for (const l of PAY_AUGUST) {
      const g = computeLine(policy(l.company), structureOf(l), {
        days: l.days, monthDays: 31,
        tds: l.dTds, advance: l.dAdvance, other: l.dOther, arrear: l.arrear,
      });
      const mine = g.eGross - (g.dEsi + g.dPf + l.dTds + l.dAdvance + l.dOther) + l.arrear;
      const parts = g.basic + g.hra + g.travel + g.medical + g.special;
      if (Math.abs(mine - l.net) > 1 || g.eGross !== l.eGross || parts !== g.gross) found.push(key(l));
    }
    expect(found.sort()).toEqual(Object.keys(BOOK_DIFFERS).sort());
  });

  it('still costs 20,000 on the one that matters', () => {
    const l = PAY_AUGUST.find((x) => key(x) === 'twin/Rajesh Verma')!;
    expect(l.dTds).toBe(20_000);
    // The book paid him the gross. The engine takes the TDS off.
    expect(l.net).toBe(l.eGross);
    const g = computeLine(policy(l.company), structureOf(l), {
      days: l.days, monthDays: 31, tds: l.dTds,
    });
    expect(l.net - g.net).toBe(20_000);
  });
});
