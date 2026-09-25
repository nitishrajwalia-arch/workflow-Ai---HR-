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
 * Reductions as they come back out of a JSON column.
 *
 * A JSON column is whatever was put in it, which the type system cannot know
 * and a five-year-old row will not honour. Everything is read defensively and
 * anything that is not a reduction is dropped, so a line saved by an older
 * version renders instead of taking a payroll screen down.
 */
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
