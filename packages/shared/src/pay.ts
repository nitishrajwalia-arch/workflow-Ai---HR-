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
export function breakUp(policy: PayPolicy, s: PayStructure): {
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
export function proposeBreakUp(policy: PayPolicy, gross: number, medical = 0): {
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
  return { gross, basic, hra, travel, medical, special: gross - basic - hra - travel - medical };
}

/** One person's line for one month. */
export function computeLine(policy: PayPolicy, s: PayStructure, i: PayInputs): PayLine {
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

  // Statutory. ESI is on what was EARNED; PF is on a capped wage, which is why
  // somebody on 40,000 and somebody on 15,000 both have 1,800 deducted.
  const esiApplies = s.esiOn && (policy.esiCeiling === 0 || m.gross <= policy.esiCeiling);
  const dEsi = esiApplies ? r((eGross * policy.esiEmployeePct) / 100) : 0;
  const erEsi = esiApplies ? r((eGross * policy.esiEmployerPct) / 100) : 0;
  // Pro-rated for the days, like everything else: 12% of 15,000 for a full
  // month, and 12% of 15,000 x 30/31 for somebody who worked thirty days.
  const pfBase = (s.pfWages || policy.pfWageCap) * f;
  const dPf = s.pfOn ? r((pfBase * policy.pfPct) / 100) : 0;
  const erPf = dPf;

  const dTds = r(i.tds ?? 0);
  const dAdvance = r(i.advance ?? 0);
  const dOther = r(i.other ?? 0);
  const dTotal = dEsi + dPf + dTds + dAdvance + dOther;

  const extraDays = i.extraDays ?? 0;
  const extraAmount = extraDays
    ? r((m.gross / (policy.extraDayDivisor || 30)) * extraDays)
    : 0;
  const arrear = r(i.arrear ?? 0);
  const net = eGross - dTotal + arrear;

  return {
    days, ...m,
    eBasic, eHra, eTravel, eMedical, eSpecial, eGross,
    dEsi, dPf, dTds, dAdvance, dOther, dTotal,
    erEsi, erPf, extraDays, extraAmount, arrear,
    net, payable: net + extraAmount,
  };
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
export function payableDays(args: {
  monthDays: number;
  onMachine: boolean;
  /** Dates the machine recorded no punch at all. */
  absentDates: readonly string[];
  /** Dates the company was closed. An absence on one of these is not a loss. */
  holidayDates: readonly string[];
  /** Days HR has granted as paid leave. */
  paidLeave?: number;
}): { days: number; lost: number; why: string } {
  if (!args.onMachine) {
    return {
      days: args.monthDays,
      lost: 0,
      why: 'Not on the attendance machine, so the full month is assumed.',
    };
  }
  const holiday = new Set(args.holidayDates);
  const unpaid = args.absentDates.filter((d) => !holiday.has(d));
  const covered = Math.min(args.paidLeave ?? 0, unpaid.length);
  const lost = unpaid.length - covered;
  const parts = [`${unpaid.length} day${unpaid.length === 1 ? '' : 's'} absent`];
  if (covered) parts.push(`${covered} covered by leave`);
  return {
    days: Math.max(0, args.monthDays - lost),
    lost,
    why: parts.join(', ') + '.',
  };
}
