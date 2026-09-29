/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * Payroll arithmetic.
 *
 * Taken from Marbella's own four August 2026 salary books, not designed here.
 * Every rule below was checked against all 132 lines on those books before it
 * was written down, and the check is a test: `pay.test.ts` recomputes August
 * from the structures and compares it to what the company actually paid.
 *
 * TWO POLICIES, NOT ONE. The three SRG books split a monthly gross — Basic is
 * 70% of it, HRA is 30% of Basic, Travelling is 10% of Basic, Medical is a flat
 * figure that varies per person, and Special is whatever is left over. New
 * Marbella splits nothing: its Basic, HRA and Special are figures somebody chose
 * for each person, and the gross is their sum. Forcing either into the other's
 * shape would invent numbers, so `kind` says which one a company is on.
 *
 * WHOLE RUPEES. Every figure on those books is a whole rupee — an earned Basic
 * of 28,767.74 is written 28,768, and that is what is paid. Rounding is to the
 * nearest rupee at each component, not at the end: doing it at the end gives a
 * gross a rupee or two away from the one Accounts has, every month, for ever.
 */

import { parseDisplayDate } from './validation.js';

export type PayPolicyKind = 'percent' | 'stated';

export interface PayPolicy {
  kind: PayPolicyKind;
  /** Only read when kind is 'percent'. */
  basicPct: number;
  hraPctOfBasic: number;
  travelPctOfBasic: number;
  esiEmployeePct: number;
  esiEmployerPct: number;
  /**
   * Above this monthly gross, ESI does not apply. ZERO MEANS NO CEILING, and
   * that is what Marbella is set to, because it is what Marbella does: the
   * August books deduct ESI from people on 22,500, 23,000, 24,000, 25,000 and
   * 29,000 a month. The statutory ceiling is 21,000. The software pays what the
   * company pays and says the statutory figure separately — quietly applying a
   * ceiling here would change six people's take-home without anybody deciding.
   */
  esiCeiling: number;
  pfPct: number;
  /**
   * The default wage PF is worked out on, for somebody with no figure of their
   * own. Most people sit exactly here; some are below it and one is on his full
   * salary, so it is a default and not a cap.
   */
  pfWageCap: number;
  /** A day beyond the month is paid at gross / this. The company uses 30. */
  extraDayDivisor: number;
}

export interface PayStructure {
  /** The monthly gross. On a 'stated' policy it is the sum of the parts. */
  gross: number;
  /** Read on a 'stated' policy; derived on a 'percent' one. */
  basic: number;
  hra: number;
  special: number;
  /** Flat, and it varies per person. Read on both policies. */
  medical: number;
  travel: number;
  esiOn: boolean;
  pfOn: boolean;
  /**
   * The FULL-MONTH wage PF is worked out on for this person. 0 means use the
   * policy default. It is pro-rated for the days worked, the same as pay: the
   * books show 1,742 for somebody on 30 of 31 days, which is 12% of 15,000
   * scaled down, not 12% of 15,000.
   */
  pfWages: number;
}

export interface PayInputs {
  /** Days paid for. A half day is real — the books carry 24.5. */
  days: number;
  monthDays: number;
  extraDays?: number;
  tds?: number;
  advance?: number;
  other?: number;
  /**
   * Reductions HR names herself — a canteen bill, a loan instalment, a tool she
   * is recovering for. Each one carries what it is FOR, because "Other: 4,000"
   * on a payslip is the line people come to HR about.
   */
  others?: ReadonlyArray<{ label: string; amount: number }>;
  arrear?: number;
}

export interface PayLine {
  days: number;
  gross: number;
  basic: number;
  hra: number;
  travel: number;
  medical: number;
  special: number;
  eBasic: number;
  eHra: number;
  eTravel: number;
  eMedical: number;
  eSpecial: number;
  eGross: number;
  dEsi: number;
  dPf: number;
  dTds: number;
  dAdvance: number;
  dOther: number;
  dTotal: number;
  erEsi: number;
  erPf: number;
  /** The company's share of anything that is neither ESI nor PF. */
  erOther: number;
  /** Every reduction, one by one, with the rule behind it. */
  reductions: Reduction[];
  extraDays: number;
  extraAmount: number;
  arrear: number;
  /** What the salary sheet calls Net Payable: earned, less deductions, plus arrear. */
  net: number;
  /** Net plus anything earned for days beyond the month. What actually goes out. */
  payable: number;
}

const r = (n: number): number => Math.round(n);

/**
 * The monthly parts of a gross.
 *
 * On a percentage policy Special is the BALANCING figure, not a percentage:
 * whatever is left after Basic, HRA, Travelling and Medical. That is what makes
 * the parts add to the gross exactly, every time, with no rounding drift.
 */
export function breakUp(
  policy: PayPolicy,
  s: PayStructure,
): {
  gross: number;
  basic: number;
  hra: number;
  travel: number;
  medical: number;
  special: number;
} {
  // A person's RECORDED parts win over the formula, always. The formula says
  // what a new structure should look like; the record says what this person is
  // actually on, and four people on the August books are on something the
  // formula does not produce — a Travelling Allowance typed as 2,900 where 10%
  // of Basic is 2,940, and three whose parts fall 40 or 70 rupees short of
  // their own gross. Recomputing those would quietly change what they are paid.
  if (s.basic > 0 || policy.kind === 'stated') {
    const gross = s.gross || s.basic + s.hra + s.special + s.medical + s.travel;
    return {
      gross,
      basic: s.basic,
      hra: s.hra,
      travel: s.travel,
      medical: s.medical,
      special: s.special,
    };
  }
  return proposeBreakUp(policy, s.gross, s.medical);
}

/**
 * What a NEW person's parts should be, from their gross alone.
 *
 * This is the formula — the thing HR sees proposed when they set somebody's
 * salary, and can then adjust. Special is the BALANCING figure, not a
 * percentage: whatever is left after Basic, HRA, Travelling and Medical, which
 * is what makes the parts add to the gross exactly with no rounding drift.
 */
export function proposeBreakUp(
  policy: PayPolicy,
  gross: number,
  medical = 0,
): {
  gross: number;
  basic: number;
  hra: number;
  travel: number;
  medical: number;
  special: number;
} {
  if (policy.kind === 'stated') {
    return { gross, basic: gross - medical, hra: 0, travel: 0, medical, special: 0 };
  }
  const basic = r((gross * policy.basicPct) / 100);
  const hra = r((basic * policy.hraPctOfBasic) / 100);
  const travel = r((basic * policy.travelPctOfBasic) / 100);
  // What is left after Basic, HRA and Travelling — two per cent of the gross on
  // Marbella's rule. Medical comes out of THAT, and cannot exceed it: 70% + 30%
  // of it + 10% of it is already 98% of the gross, so a flat 500 against a
  // salary of 21,500 leaves Special at minus 70. The company's own books never
  // do this — their low earners carry a medical of 440, 400 or nothing, which is
  // exactly the room available. So the figure is capped rather than allowed to
  // go negative, and the caller can see it was capped by comparing what it asked
  // for with what came back.
  const room = Math.max(0, gross - basic - hra - travel);
  const med = Math.min(Math.max(0, medical), room);
  return { gross, basic, hra, travel, medical: med, special: room - med };
}

/**
 * One person's line for one month.
 *
 * `heads` is the company's list of what comes off a payslip and under which
 * rule. Give it, and every reduction on the line is itemised and traceable to a
 * rule somebody wrote down. Leave it out and ESI and PF fall back to the two
 * rates on the policy, which is how the August books were read in before there
 * were heads — the arithmetic is the same either way, and a test holds the two
 * paths to the same 132 figures.
 */
export function computeLine(
  policy: PayPolicy,
  s: PayStructure,
  i: PayInputs,
  heads?: readonly DeductionHead[],
): PayLine {
  const m = breakUp(policy, s);
  // Never more than the month: a person cannot earn 32/31 of their salary by
  // being present every day. Days beyond the month are extra days, priced
  // separately and on a different divisor.
  const days = Math.max(0, Math.min(i.days, i.monthDays));
  const f = i.monthDays > 0 ? days / i.monthDays : 0;

  const eBasic = r(m.basic * f);
  const eHra = r(m.hra * f);
  const eTravel = r(m.travel * f);
  const eMedical = r(m.medical * f);
  const eSpecial = r(m.special * f);
  const eGross = eBasic + eHra + eTravel + eMedical + eSpecial;

  const dTds = r(i.tds ?? 0);
  const dAdvance = r(i.advance ?? 0);

  const reductions: Reduction[] = heads?.length
    ? reductionsFor(heads, s, {
        gross: m.gross,
        eGross,
        days,
        monthDays: i.monthDays,
        entered: { tds: dTds, advance: dAdvance },
        others: i.others,
      })
    : builtIn(policy, s, m.gross, eGross, f, dTds, dAdvance, r(i.other ?? 0), i.others);

  const of = (code: string, pick: (x: Reduction) => number): number =>
    reductions.filter((x) => x.code === code).reduce((a, x) => a + pick(x), 0);
  const dEsi = of('esi', (x) => x.amount);
  const dPf = of('pf', (x) => x.amount);
  const erEsi = of('esi', (x) => x.employer);
  const erPf = of('pf', (x) => x.employer);
  // Everything that is not one of the four the salary sheet has a column for.
  const dOther = reductions
    .filter((x) => !['esi', 'pf', 'tds', 'advance'].includes(x.code))
    .reduce((a, x) => a + x.amount, 0);
  const erOther = reductions
    .filter((x) => !['esi', 'pf'].includes(x.code))
    .reduce((a, x) => a + x.employer, 0);
  const dTotal = reductions.reduce((a, x) => a + x.amount, 0);

  const extraDays = i.extraDays ?? 0;
  const extraAmount = extraDays ? r((m.gross / (policy.extraDayDivisor || 30)) * extraDays) : 0;
  const arrear = r(i.arrear ?? 0);
  const net = eGross - dTotal + arrear;

  return {
    days,
    ...m,
    eBasic,
    eHra,
    eTravel,
    eMedical,
    eSpecial,
    eGross,
    dEsi,
    dPf,
    dTds,
    dAdvance,
    dOther,
    dTotal,
    erEsi,
    erPf,
    erOther,
    reductions,
    extraDays,
    extraAmount,
    arrear,
    net,
    payable: net + extraAmount,
  };
}

/**
 * ESI and PF worked out from the two rates on the policy, in the shape the
 * head-driven path produces.
 *
 * This is what a company that has not set its heads up gets, and it is how the
 * August books were read in. It is kept deliberately: dropping it would mean a
 * company with no heads silently deducts nothing, and paying somebody too much
 * is as wrong as paying them too little.
 */
function builtIn(
  policy: PayPolicy,
  s: PayStructure,
  gross: number,
  eGross: number,
  f: number,
  tds: number,
  advance: number,
  other: number,
  others?: ReadonlyArray<{ label: string; amount: number }>,
): Reduction[] {
  const esiApplies = s.esiOn && (policy.esiCeiling === 0 || gross <= policy.esiCeiling);
  // PF is on a capped wage, pro-rated for days, which is why somebody on 40,000
  // and somebody on 15,000 both have 1,800 taken in a full month.
  const pfBase = (s.pfWages || policy.pfWageCap) * f;
  const out: Reduction[] = [];
  if (esiApplies) {
    out.push({
      code: 'esi',
      label: 'E.S.I.',
      amount: r((eGross * policy.esiEmployeePct) / 100),
      employer: r((eGross * policy.esiEmployerPct) / 100),
      why: `${policy.esiEmployeePct}% of ${rupees(eGross)} earned`,
      statutory: true,
    });
  }
  if (s.pfOn) {
    const amount = r((pfBase * policy.pfPct) / 100);
    out.push({
      code: 'pf',
      label: 'P.F.',
      amount,
      employer: amount,
      why: `${policy.pfPct}% of ${rupees(s.pfWages || policy.pfWageCap)} wage`,
      statutory: true,
    });
  }
  if (tds) {
    out.push({
      code: 'tds',
      label: 'T.D.S.',
      amount: tds,
      employer: 0,
      why: 'Entered by HR for this month',
      statutory: false,
    });
  }
  if (advance) {
    out.push({
      code: 'advance',
      label: 'Advance recovered',
      amount: advance,
      employer: 0,
      why: 'Entered by HR for this month',
      statutory: false,
    });
  }
  if (other) {
    out.push({
      code: 'other',
      label: 'Other deduction',
      amount: other,
      employer: 0,
      why: 'Entered by HR for this month',
      statutory: false,
    });
  }
  for (const o of others ?? []) {
    if (!r(o.amount)) continue;
    out.push({
      code: 'other',
      label: o.label || 'Other deduction',
      amount: r(o.amount),
      employer: 0,
      why: 'Entered by HR for this month',
      statutory: false,
    });
  }
  return out;
}

/**
 * Days to pay for, from a month's attendance.
 *
 * The company's books start from the whole month and take days OFF: almost
 * everybody is on 31 of 31, and the one person on 26 was absent five days. So
 * that is what this does. A day is only lost when the machine recorded an
 * absence AND it was not a holiday the company closed for.
 *
 * `onMachine` is false for somebody the attendance export does not cover, and
 * they get the full month — which is what happens today, and is honest about
 * it rather than paying nobody. The caller shows that as "no attendance".
 */
/** Sunday first, the way `Date.getUTCDay()` counts. */
const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/**
 * Is that date the person's own weekly off?
 *
 * Only for a named day. "Rotational" and "None — site roster" mean the day
 * moves, and nothing on the record says where it moved to that week, so they
 * are not guessed at — see the note in `payableDays`.
 */
function isWeeklyOff(date: string, offDay: string | undefined): boolean {
  const want = WEEKDAYS.indexOf(String(offDay ?? '').trim().toLowerCase() as (typeof WEEKDAYS)[number]);
  if (want < 0) return false;
  const d = parseDisplayDate(date);
  return d !== null && d.getUTCDay() === want;
}

/**
 * A date the weekly-off check could not read.
 *
 * `parseDisplayDate` wants "06 Sep 2026" and returns null for anything else —
 * including "06 Sep", which is what a hand-written import is most likely to
 * give. Null means the day cannot be shown to be a Sunday, so it is treated as
 * an absence and docked. That is the right arithmetic on the information
 * available and the wrong answer, and it happens without a word.
 *
 * So it is counted and said out loud on the line instead.
 */
const unreadable = (date: string, offDay: string | undefined): boolean =>
  Boolean(String(offDay ?? '').trim()) && parseDisplayDate(date) === null;

/**
 * The days a pay line was worked out from, AND THE REASONS FOR THEM.
 *
 * `days` is the answer and `lost` is what it cost. The rest is why — and it is
 * here because it used to be computed and thrown away, leaving Accounts and the
 * person holding the payslip with a number and no means of checking it. Every
 * query about a short month came back to HR to re-derive by hand.
 *
 * -1 on any count means NOT RECORDED, which is not zero. Somebody who is not on
 * the attendance machine is paid the full month and has no present count; a
 * zero would be read as a man who never came in.
 */
export interface PayableDays {
  days: number;
  lost: number;
  why: string;
  /** False when nobody counted this person's days. */
  counted: boolean;
  present: number;
  /** Absences nothing covered — the days that actually cost pay. */
  absent: number;
  /** Their own weekly off. Paid, and not an absence. */
  weekOff: number;
  /** Days the company was closed. Paid. */
  holiday: number;
  /** Absences HR covered with paid leave. */
  leave: number;
}

/* ------------------------------------------------- the part of a month */

/**
 * HOW MUCH OF THE MONTH SOMEBODY WAS ACTUALLY EMPLOYED FOR.
 *
 * A month has thirty days; a person who started on the 16th was there for
 * fifteen of them, and a person whose last day was the 12th was there for
 * twelve. Neither fact is in the attendance file. The machine has no rows at
 * all for somebody before they are enrolled on it, and no rows for them after
 * they go — and "no rows" is read, correctly, as "not on the machine", which
 * pays the WHOLE MONTH.
 *
 * So a man who joined on the 20th was paid for thirty days, and a man who left
 * on the 12th was paid for thirty or for none at all depending on whether his
 * record had been marked exited yet. Both are money, and neither shows up on
 * any screen as odd.
 *
 * This is the window, worked out from the dates on the register, and the days
 * a run pays for are capped by it.
 */
export interface MonthWindow {
  /** First day of the month they were employed on, 1-based. */
  readonly from: number;
  /** Last day of the month they were employed on, 1-based. */
  readonly to: number;
  /** Days of the month they were employed for at all. */
  readonly days: number;
  /** True when they were there for the whole month. */
  readonly whole: boolean;
  /** Why it is short, in words, or '' when it is not. */
  readonly why: string;
}

/**
 * @param month   the month being run, as the sheet heads it — "Jun 2026"
 * @param joined  the joining date on the register, "16 Jun 2026"
 * @param exited  the last day, where there is one
 */
export function monthWindow(args: {
  month: string;
  monthDays: number;
  joined?: string | null;
  exited?: string | null;
}): MonthWindow {
  const { monthDays } = args;
  const start = parseDisplayDate(`01 ${args.month}`);
  const whole: MonthWindow = { from: 1, to: monthDays, days: monthDays, whole: true, why: '' };
  /* A month heading this function cannot read is not a reason to dock anybody.
     The whole month is the answer that pays what the run would have paid
     before this existed, and it is the safe way round. */
  if (!start) return whole;

  const monthOf = (d: Date): boolean =>
    d.getUTCFullYear() === start.getUTCFullYear() && d.getUTCMonth() === start.getUTCMonth();
  const before = (d: Date): boolean =>
    d.getTime() < start.getTime();

  const j = parseDisplayDate(args.joined ?? '');
  const x = parseDisplayDate(args.exited ?? '');

  let from = 1;
  let to = monthDays;
  const why: string[] = [];

  if (j && monthOf(j)) {
    from = Math.min(Math.max(1, j.getUTCDate()), monthDays);
    why.push(`joined on the ${from}`);
  } else if (j && !before(j) && j.getTime() > start.getTime()) {
    // They start after this month is over — nothing of it is theirs.
    return { from: 1, to: 0, days: 0, whole: false, why: 'had not joined yet' };
  }

  if (x && monthOf(x)) {
    to = Math.min(Math.max(0, x.getUTCDate()), monthDays);
    why.push(`last day was the ${to}`);
  } else if (x && before(x)) {
    // They were gone before this month began.
    return { from: 1, to: 0, days: 0, whole: false, why: 'had already left' };
  }

  const days = Math.max(0, to - from + 1);
  return {
    from,
    to,
    days,
    whole: days >= monthDays,
    why: days >= monthDays ? '' : why.join(' and '),
  };
}

export function payableDays(args: {
  monthDays: number;
  onMachine: boolean;
  /** Dates the machine recorded no punch at all. */
  absentDates: readonly string[];
  /** Dates the company was closed. An absence on one of these is not a loss. */
  holidayDates: readonly string[];
  /** Days HR has granted as paid leave. */
  paidLeave?: number;
  /**
   * The person's weekly off — "Sunday", "Saturday", "Rotational", or nothing.
   *
   * The attendance import writes a row for EVERY calendar day, so a person's
   * own day off arrives here looking exactly like an absence: no punch in, no
   * punch out. Without this, somebody who worked every day they were rostered
   * lost four or five days' pay a month — about 2,700 rupees on a gross of
   * 20,000 — for the offence of taking their Sunday.
   */
  offDay?: string;
}): PayableDays {
  if (!args.onMachine) {
    return {
      days: args.monthDays,
      lost: 0,
      why: 'Not on the attendance machine, so the full month is assumed.',
      /* NOT ZERO. Nobody counted this person's days, and a zero here would be
         read off the sheet as somebody who never came in. -1 says "not
         recorded", and the sheet prints it as a dash. */
      counted: false,
      present: -1,
      absent: -1,
      weekOff: -1,
      holiday: -1,
      leave: -1,
    };
  }
  const holiday = new Set(args.holidayDates);
  const offs = args.absentDates.filter((d) => isWeeklyOff(d, args.offDay));
  const holidays = args.absentDates.filter(
    (d) => holiday.has(d) && !isWeeklyOff(d, args.offDay),
  );
  const unpaid = args.absentDates.filter(
    (d) => !holiday.has(d) && !isWeeklyOff(d, args.offDay),
  );
  const covered = Math.min(args.paidLeave ?? 0, unpaid.length);
  const lost = unpaid.length - covered;
  const unread = args.absentDates.filter((d) => unreadable(d, args.offDay)).length;
  const parts = [`${unpaid.length} day${unpaid.length === 1 ? '' : 's'} absent`];
  if (unread) {
    parts.push(
      `${unread} date${unread === 1 ? '' : 's'} the attendance file wrote without a year, so ` +
        `their weekly off could not be told from an absence — CHECK BEFORE PAYING`,
    );
  }
  if (offs.length) parts.push(`${offs.length} their weekly off`);
  if (covered) parts.push(`${covered} covered by leave`);
  /* A roster that moves cannot be checked against a weekday, so those days are
     still counted — and the reason says so, rather than letting somebody
     believe their off days were allowed for when they were not. */
  const rota = /rotational|roster/i.test(String(args.offDay ?? ''));
  if (rota && args.absentDates.length) {
    parts.push('weekly off is on a roster, so it cannot be told from an absence here');
  }
  return {
    days: Math.max(0, args.monthDays - lost),
    lost,
    why: parts.join(', ') + '.',
    counted: true,
    /* Everything the machine did not record an absence for. A day with one
       punch instead of two is a day worked with a missing swipe, and it is
       counted present here for the same reason it is not docked above. */
    present: Math.max(0, args.monthDays - args.absentDates.length),
    absent: unpaid.length,
    weekOff: offs.length,
    holiday: holidays.length,
    leave: covered,
  };
}

/* ----------------------------------------------------------- reductions */

/**
 * WHAT COMES OFF A PAYSLIP, AND UNDER WHICH RULE.
 *
 * Provident Fund is 12% of wages up to ₹15,000 a month. ESI is 0.75% from the
 * person and 3.25% from the company, on gross up to ₹21,000. Punjab charges a
 * State Development Tax of ₹200 a month. Every one of those numbers has been
 * changed by a government at some point and every one of them will be changed
 * again — so none of them is written in this file. They are rows a company
 * holds, with the rule they come from and the name of whoever set them, and a
 * change in the law is an edit somebody makes and signs, not a release.
 *
 * What is written here is only the ARITHMETIC each kind of rule uses.
 */
export type DeductionBasis =
  /** A percentage of what the person earned this month. ESI works this way. */
  | 'earnedPct'
  /** A percentage of a fixed monthly wage, pro-rated for days. PF works this way. */
  | 'wagePct'
  /** A flat sum each month. A professional tax works this way. */
  | 'flat'
  /** No rule — HR types the figure each month. TDS and an advance work this way. */
  | 'entered';

export interface DeductionHead {
  /** Stable key. 'esi', 'pf', 'pt', 'tds', 'advance' — or one the company adds. */
  code: string;
  label: string;
  basis: DeductionBasis;
  /** The employee's percentage, or the flat rupees when the basis is 'flat'. */
  rate: number;
  /** What the company pays on top, on the same basis. 0 when it pays nothing. */
  employerRate: number;
  /** 'wagePct' and 'flat': the monthly wage or sum the rate applies to. */
  wage: number;
  /**
   * 'wagePct': when true, a wage recorded against the PERSON beats the figure
   * above. One man at Marbella has PF taken on his whole salary rather than on
   * the capped wage, and that is a fact about him, not about the rule.
   */
  personWage: boolean;
  /** Above this monthly gross the head does not apply. ZERO MEANS NO CEILING. */
  ceiling: number;
  /** Scale by the days paid. True for anything that is part of a month's pay. */
  proRate: boolean;
  /** Which switch on the person's record turns it on: 'esiOn', 'pfOn', or none. */
  requires: string;
  /**
   * How the paise are dealt with. 'up' is what the ESI regulation says and what
   * New Marbella's book does; 'nearest' is what the three SRG books do. It is a
   * rupee a head a month, and it is the kind of rupee an inspection asks about,
   * so it is set per head rather than assumed.
   */
  rounding: 'nearest' | 'up';
  /** The rule this comes from, in words. It goes on the sheet Accounts reads. */
  authority: string;
  active: boolean;
}

export interface Reduction {
  code: string;
  label: string;
  /** Taken off the person's pay. */
  amount: number;
  /** Paid by the company on top of it. */
  employer: number;
  /** How the figure was arrived at, in words. */
  why: string;
  /** False for anything HR typed rather than a rule produced. */
  statutory: boolean;
}

const round = (n: number, how: DeductionHead['rounding']): number =>
  how === 'up' ? Math.ceil(n - 1e-9) : r(n);

/**
 * Indian grouping, written out rather than left to `toLocaleString`.
 *
 * Node is not always built with the full locale data, and where it is not,
 * `toLocaleString('en-IN')` quietly returns 1800 where 1,80,000 was wanted.
 * These strings go on the sheet Accounts reads, so they do not depend on how
 * the runtime happened to be compiled.
 */
export function inrWords(n: number): string {
  const v = Math.round(Math.abs(n));
  const str = String(v);
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${n < 0 ? '-' : ''}₹${grouped}`;
}

const rupees = (n: number): string => inrWords(n);

/**
 * Every reduction on one person's pay for one month, each with its own rule.
 *
 * A head that does not apply is LEFT OUT rather than listed as zero: a payslip
 * that lists ESI at ₹0 against somebody who is not covered by ESI reads as
 * though somebody forgot to deduct it.
 */
export function reductionsFor(
  heads: readonly DeductionHead[],
  s: PayStructure,
  ctx: {
    /** The person's full monthly gross — what a ceiling is tested against. */
    gross: number;
    /** What they earned this month, after days. */
    eGross: number;
    days: number;
    monthDays: number;
    /** Figures HR typed, keyed by head code. */
    entered?: Record<string, number>;
    /** One-off reductions HR named herself. */
    others?: ReadonlyArray<{ label: string; amount: number }>;
  },
): Reduction[] {
  const f = ctx.monthDays > 0 ? Math.min(ctx.days, ctx.monthDays) / ctx.monthDays : 0;
  const part = f < 1 ? `, ${ctx.days} of ${ctx.monthDays} days` : '';
  const out: Reduction[] = [];

  for (const h of heads) {
    if (!h.active) continue;
    if (h.requires === 'esiOn' && !s.esiOn) continue;
    if (h.requires === 'pfOn' && !s.pfOn) continue;
    if (h.ceiling > 0 && ctx.gross > h.ceiling) continue;

    let amount = 0;
    let employer = 0;
    let why = '';

    if (h.basis === 'earnedPct') {
      amount = round((ctx.eGross * h.rate) / 100, h.rounding);
      employer = round((ctx.eGross * h.employerRate) / 100, h.rounding);
      why = `${h.rate}% of ${rupees(ctx.eGross)} earned`;
    } else if (h.basis === 'wagePct') {
      const full = (h.personWage && s.pfWages) || h.wage;
      const base = h.proRate ? full * f : full;
      amount = round((base * h.rate) / 100, h.rounding);
      employer = round((base * h.employerRate) / 100, h.rounding);
      why = `${h.rate}% of ${rupees(full)} wage${h.proRate ? part : ''}`;
    } else if (h.basis === 'flat') {
      amount = round(h.proRate ? h.wage * f : h.wage, h.rounding);
      employer = round(
        h.proRate ? (h.wage * f * h.employerRate) / 100 : (h.wage * h.employerRate) / 100,
        h.rounding,
      );
      why = `${rupees(h.wage)} a month${h.proRate ? part : ''}`;
    } else {
      amount = r(ctx.entered?.[h.code] ?? 0);
      why = h.authority || 'Entered by HR for this month';
    }

    // Nothing taken means nothing to show, EXCEPT where the company is paying a
    // share anyway — that is money leaving the company and belongs on the sheet.
    if (amount === 0 && employer === 0) continue;
    out.push({
      code: h.code,
      label: h.label,
      amount,
      employer,
      why,
      statutory: h.basis !== 'entered',
    });
  }

  for (const o of ctx.others ?? []) {
    const amount = r(o.amount);
    if (!amount) continue;
    out.push({
      code: 'other',
      label: o.label || 'Other deduction',
      amount,
      employer: 0,
      why: 'Entered by HR for this month',
      statutory: false,
    });
  }

  return out;
}

/* ---------------------------------------------------------- allowances */

/**
 * WHAT GOES ON A PAYSLIP ON TOP OF THE SALARY.
 *
 * The mirror of a reduction, and deliberately the same arithmetic — a site
 * allowance of ₹2,000 a month pro-rated for days is the same sum as a ₹2,000
 * deduction pro-rated for days, and writing it twice is how the two drift.
 *
 * What is NOT the same is who it lands on. A deduction is governed by a switch
 * on the person's record (`esiOn`, `pfOn`) because the law says who it applies
 * to. An allowance is granted by the company to a group somebody chose — the
 * labour on one site, everybody on nights, the whole of Maintenance — so it
 * carries `appliesTo`, matched against the person rather than the payslip.
 *
 * And whether it is pay. A site allowance is pay: it is taxed and the statutory
 * heads see it. A reimbursement of money somebody already spent is not, and
 * treating the two alike is how a man is taxed on his own bus fare.
 */
export interface AllowanceHead {
  code: string;
  label: string;
  basis: DeductionBasis;
  /** The percentage, or the rupees when the basis is 'flat'. */
  rate: number;
  /** 'wagePct' and 'flat': the monthly wage or sum the rate applies to. */
  wage: number;
  /** Above this monthly gross it does not apply. ZERO MEANS NO CEILING. */
  ceiling: number;
  /** Below this monthly gross it does not apply. ZERO MEANS NO FLOOR. */
  floor: number;
  proRate: boolean;
  rounding: 'nearest' | 'up';
  /** '' for everybody, or a department, an employment type, or a site. */
  appliesTo: string;
  /** Whether it is pay — taxed, and seen by the statutory heads. */
  taxable: boolean;
  /** The policy it comes from, in words. It goes on the sheet Accounts reads. */
  authority: string;
  active: boolean;
}

export interface Addition {
  code: string;
  label: string;
  /** Paid to the person on top of what they earned. */
  amount: number;
  /** Whether it is pay for tax and for the statutory heads. */
  taxable: boolean;
  /** How the figure was arrived at, in words. */
  why: string;
  /** False for anything HR typed rather than a policy produced. */
  policy: boolean;
}

/** Who a person is, for deciding whether an allowance reaches them. */
export interface AllowanceWho {
  dept?: string;
  /** Staff, Site, Labour — whatever the register calls them. */
  type?: string;
  /** The short name of the site they are posted to. */
  site?: string;
}

/**
 * Does `appliesTo` name this person?
 *
 * Matched case-insensitively against the department, the employment type and
 * the site, in that order, because those are the three ways somebody describes
 * a group out loud. An `appliesTo` that matches none of them reaches nobody —
 * which is the safe way round. An allowance that silently reaches everybody
 * because its scope was mistyped is money going out that nobody decided on.
 */
export function allowanceApplies(to: string, who: AllowanceWho): boolean {
  const want = to.trim().toLowerCase();
  if (!want) return true;
  return [who.dept, who.type, who.site].some(
    (v) => String(v ?? '').trim().toLowerCase() === want,
  );
}

/**
 * The allowances one person is due this month.
 *
 * `entered` carries the figures HR typed for the heads that have no rule, keyed
 * by head code, and `others` the one-off payments she named herself — a
 * reward for a job done, money for a man who moved site at his own cost.
 */
export function allowancesFor(
  heads: readonly AllowanceHead[],
  ctx: {
    /** The person's full monthly gross — what a ceiling or floor is tested against. */
    gross: number;
    /** What they earned this month, after days. */
    eGross: number;
    days: number;
    monthDays: number;
    who?: AllowanceWho;
    entered?: Record<string, number>;
    others?: ReadonlyArray<{ label: string; amount: number; taxable?: boolean }>;
  },
): Addition[] {
  const f = ctx.monthDays > 0 ? Math.min(ctx.days, ctx.monthDays) / ctx.monthDays : 0;
  const part = f < 1 ? `, ${ctx.days} of ${ctx.monthDays} days` : '';
  const who = ctx.who ?? {};
  const out: Addition[] = [];

  for (const h of heads) {
    if (!h.active) continue;
    if (h.ceiling > 0 && ctx.gross > h.ceiling) continue;
    if (h.floor > 0 && ctx.gross < h.floor) continue;
    if (!allowanceApplies(h.appliesTo, who)) continue;

    let amount = 0;
    let why = '';

    if (h.basis === 'earnedPct') {
      amount = round((ctx.eGross * h.rate) / 100, h.rounding);
      why = `${h.rate}% of ${rupees(ctx.eGross)} earned`;
    } else if (h.basis === 'wagePct') {
      const base = h.proRate ? h.wage * f : h.wage;
      amount = round((base * h.rate) / 100, h.rounding);
      why = `${h.rate}% of ${rupees(h.wage)}${h.proRate ? part : ''}`;
    } else if (h.basis === 'flat') {
      amount = round(h.proRate ? h.wage * f : h.wage, h.rounding);
      why = `${rupees(h.wage)} a month${h.proRate ? part : ''}`;
    } else {
      amount = r(ctx.entered?.[h.code] ?? 0);
      why = h.authority || 'Entered by HR for this month';
    }

    if (amount === 0) continue;
    out.push({
      code: h.code,
      label: h.label,
      amount,
      taxable: h.taxable,
      why,
      policy: h.basis !== 'entered',
    });
  }

  for (const o of ctx.others ?? []) {
    const amount = r(o.amount);
    if (!amount) continue;
    out.push({
      code: 'other',
      label: o.label || 'Other allowance',
      amount,
      // Money HR grants by hand is pay unless she says otherwise. The safe
      // default is the one that gets the tax right, not the one that flatters
      // the payslip.
      taxable: o.taxable !== false,
      why: 'Entered by HR for this month',
      policy: false,
    });
  }

  return out;
}

/** What the allowances come to: everything, and the part of it that is pay. */
export function allowanceTotals(list: readonly Addition[]): { total: number; taxable: number } {
  return {
    total: list.reduce((a, x) => a + x.amount, 0),
    taxable: list.reduce((a, x) => a + (x.taxable ? x.amount : 0), 0),
  };
}

/**
 * A stored salary policy, in the shape the engine wants.
 *
 * The database holds `kind` as a string because a database column is a string;
 * the engine wants the union. One place does the narrowing, so a company whose
 * kind is something nobody expected is treated as a percentage policy here and
 * not in three different files.
 */
export function asPayPolicy(p: {
  kind: string;
  basicPct: number;
  hraPctOfBasic: number;
  travelPctOfBasic: number;
  esiEmployeePct: number;
  esiEmployerPct: number;
  esiCeiling: number;
  pfPct: number;
  pfWageCap: number;
  extraDayDivisor: number;
}): PayPolicy {
  return { ...p, kind: p.kind === 'stated' ? 'stated' : 'percent' };
}

/**
 * Allowances as they come back out of a JSON column.
 *
 * A JSON column is whatever was put in it, which the type system cannot know
 * and a five-year-old row will not honour. Everything is read defensively and
 * anything that is not an allowance is dropped, so a line saved by an older
 * version renders instead of taking a payroll screen down.
 */
export function readAdditions(v: unknown): Addition[] {
  if (!Array.isArray(v)) return [];
  const out: Addition[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.code !== 'string' || typeof o.label !== 'string') continue;
    out.push({
      code: o.code,
      label: o.label,
      amount: Number(o.amount) || 0,
      // A row written before `taxable` existed is pay, which is what every
      // allowance in the app was until a policy said otherwise.
      taxable: o.taxable === undefined ? true : Boolean(o.taxable),
      why: typeof o.why === 'string' ? o.why : '',
      policy: Boolean(o.policy),
    });
  }
  return out;
}

/** The same, for the reductions that come off. */
export function readReductions(v: unknown): Reduction[] {
  if (!Array.isArray(v)) return [];
  const out: Reduction[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.code !== 'string' || typeof o.label !== 'string') continue;
    out.push({
      code: o.code,
      label: o.label,
      amount: Number(o.amount) || 0,
      employer: Number(o.employer) || 0,
      why: typeof o.why === 'string' ? o.why : '',
      statutory: Boolean(o.statutory),
    });
  }
  return out;
}
