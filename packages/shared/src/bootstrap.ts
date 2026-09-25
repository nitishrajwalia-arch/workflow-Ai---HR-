/**
 * The bootstrap payload.
 *
 * The existing 7,300-line UI reads its whole world out of one context object and
 * expects every collection to be there, synchronously, on first render. Rather
 * than rewrite 40 screens into 40 loading states, the API hands the browser that
 * whole world in ONE request, and every mutation afterwards is an individual call
 * that patches the local copy.
 *
 * This is a deliberate trade, and it is the right one at this size: 200 people and
 * a few hundred log rows is well under 500 KB of JSON, gzipped to a fraction of
 * that. See docs/FRONTEND-INTEGRATION.md for the point at which it stops being the
 * right trade and what to do then.
 *
 * The keys below are exactly the keys `ProcCtx` already provides. That is not a
 * coincidence: it is the contract that lets MarbellaHR.jsx run unmodified.
 */

import type { SealedEntry } from './ledger.js';

export interface BootstrapPerson {
  id: string;
  name: string;
  designation: string;
  dept: string;
  type: string;
  phone: string;
  email: string;
  joined: string;
  dob: string | null;
  /** Age in completed years, computed by the server. Null when no usable dob. */
  age: number | null;
  /** Null means nobody has asked yet; 'undisclosed' means they were asked. */
  gender: string | null;
  status: string;
  exitedOn: string | null;
  perf: number;
  growth: string;
  notes: Array<{ when: string; text: string }>;
  office: string;
  employer: string;
  reportsTo: string | null;
  /**
   * Who they answer to when that is not an employee — twenty-three people report
   * to a Managing Director, and the directors are not on the payroll register.
   * Set only when `reportsTo` is null.
   */
  reportsToNote: string;
  photo: string | null;
  shift: { in: string; out: string; hours: number };
  imported: boolean;
}

export interface BootstrapCard {
  id: string;
  pid: string;
  name: string;
  ver: number;
  reason: string;
  at: string;
  by: string;
  recv: string;
  note: string;
  killed: string | null;
  zonesKilled: boolean;
}

export interface BootstrapCompany {
  id: string;
  name: string;
  gstin: string;
  pan: string;
  kind: string;
  addr: string;
}

export interface BootstrapProject {
  id: string;
  name: string;
  short: string;
  company: string;
  reraStatus: string;
  rera: string;
  stage: string;
  addr: string;
  tint: string;
}

export interface BootstrapExit {
  id: string;
  pid: string;
  stage: string;
  record: Record<string, unknown>;
  opened: string;
  reason: string;
  closedAt: string | null;
}

export interface BootstrapDevice {
  id: string;
  pid: string;
  type: string;
  model: string;
  imei: string;
  sim: string;
  issued: string;
}

export interface BootstrapSalary {
  basic: number;
  hra: number;
  special: number;
  pf: number;
  pt: number;
  note: string;
}

export interface BootstrapContact {
  phone: string;
  email: string;
  vPhone: boolean;
  vEmail: boolean;
}

export interface BootstrapDeptRule {
  in: string;
  out: string;
  hours: number;
  days: string;
  grace: number;
  setBy: string;
  /** Blank means nobody has agreed this — it is still the commonest shift. */
  setOn: string;
  note: string;
}

export interface BootstrapLeavePolicy {
  casual: number;
  sick: number;
  earned: number;
  halfDay: string;
  lateAfter: number;
  /** How many late marks cost a day's pay. 0 means not decided. */
  lateStrikes: number;
  carryForward: boolean;
  encashable: boolean;
  /** Free text: the answer is a sentence, e.g. "1 day per month". */
  probation: string;
  maternityWeeks: number;
  paternityDays: number;
  notice: string;
  setBy: string;
  setOn: string;
}

export interface BootstrapJd {
  purpose: string;
  duties: string[];
  needs: string[];
}

export interface BootstrapHoliday {
  id: string;
  name: string;
  /** Display form, "26 Jan 2027". */
  on: string;
  /** False when some sites stay open. */
  allSites: boolean;
  /** What HR wrote in the closure column, verbatim. Often a sentence. */
  closure: string;
  note: string;
}

export interface BootstrapPayLine {
  id: string;
  /** Null for somebody on the company's salary book who is not on the register. */
  pid: string | null;
  name: string;
  designation: string;
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
  erOther: number;
  /**
   * Every reduction on this line, one by one, with the rule behind each. The
   * totals above are what the salary sheet has always shown; this is what the
   * person is owed an explanation of.
   */
  reductions: Array<{
    code: string;
    label: string;
    amount: number;
    employer: number;
    why: string;
    statutory: boolean;
  }>;
  extraDays: number;
  extraAmount: number;
  arrear: number;
  /** Earned, less deductions, plus arrear — what the salary sheet calls Net Payable. */
  net: number;
  /** Net plus days beyond the month. What actually goes out. */
  payable: number;
  remark: string;
}

/** How a company turns a monthly gross into the parts of a payslip. */
export interface BootstrapSalaryPolicy {
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
  setBy: string;
  setOn: string;
}

/** One reduction head — what comes off a payslip, and under which rule. */
export interface BootstrapDeductionHead {
  code: string;
  label: string;
  basis: string;
  rate: number;
  employerRate: number;
  wage: number;
  personWage: boolean;
  ceiling: number;
  proRate: boolean;
  requires: string;
  /** 'nearest' or 'up'. The ESI regulation says up; most of the books say nearest. */
  rounding: string;
  /** The rule it comes from, in words. */
  authority: string;
  note: string;
  active: boolean;
  sort: number;
  setBy: string;
  setOn: string;
}

export interface BootstrapPayRun {
  id: string;
  /** "Aug 2026". */
  month: string;
  company: string;
  monthDays: number;
  /** draft | released | paid. A released run does not move. */
  status: string;
  /** imported — from the company's own book. computed — worked out here. */
  source: string;
  note: string;
  createdBy: string;
  releasedBy: string;
  releasedAt: string | null;
  lines: BootstrapPayLine[];
}

export interface BootstrapDoc {
  id: string;
  at: string;
  tpl: string;
  pid: string;
  company: string;
  via: string;
  subject: string;
  by: string;
}

export interface BootstrapOffice {
  id: string;
  name: string;
  short: string;
  tint: string;
  /**
   * The project this site belongs to, or null for an office that is not on one.
   * People are posted to an OFFICE; a project's headcount is everybody at any
   * office belonging to it. Without this the browser had to assume the two ids
   * were spelled the same, which is true of the four sites the company started
   * with and not of the next one.
   */
  project: string | null;
}

/** Exactly the shape `ProcCtx.Provider` is given, minus the action functions. */
export interface BootstrapPayload {
  people: BootstrapPerson[];
  /** Newest first, the order the UI displays. */
  cardLog: BootstrapCard[];
  /**
   * Newest first. Verify with verifyChainNewestFirst.
   *
   * Carries `id` and `seq` as well as the sealed fields: the UI uses `id` as a
   * React key, and a list keyed on `undefined` re-renders wrongly and warns.
   */
  ledger: Array<SealedEntry & { id: string; seq: number }>;
  salaries: Record<string, BootstrapSalary>;
  devices: BootstrapDevice[];
  contacts: Record<string, BootstrapContact>;
  leavePolicy: Record<string, BootstrapLeavePolicy>;
  deptRules: Record<string, BootstrapDeptRule>;
  companies: BootstrapCompany[];
  projects: BootstrapProject[];
  exits: BootstrapExit[];
  usage: Record<string, number>;
  docLog: BootstrapDoc[];
  /**
   * Keyed by department, then by title. One title means different jobs in
   * different departments — "Assistant Manager" is three of them here — so a
   * flat map let whichever department was saved last replace the rest.
   */
  jds: Record<string, Record<string, BootstrapJd>>;
  /** Soonest first. Attendance cannot tell a day off from an absence without these. */
  holidays: BootstrapHoliday[];
  /** Newest month first. Empty for any desk that may not see money. */
  payRuns: BootstrapPayRun[];
  /**
   * What comes off a payslip, keyed by company. Empty for any desk that may not
   * see money: what is being deducted from somebody is as private as what they
   * are paid.
   */
  deductionHeads: Record<string, BootstrapDeductionHead[]>;
  /**
   * How each company splits a gross. Empty for any desk that may not see money.
   * The browser needs it to show HR what a salary she is about to agree will
   * look like broken up, before she saves it rather than after.
   */
  salaryPolicies: Record<string, BootstrapSalaryPolicy>;
  offices: BootstrapOffice[];
  hrLog: Array<{ at: string; who: string; what: string }>;
  /** Server's verdict on the chain. The browser re-checks it independently. */
  ledgerHealth: { ok: boolean; count: number; message?: string };
  /** Who the signed-in person is, so the UI stops hard-coding Simran Kaur. */
  me: {
    id: string;
    name: string;
    email: string;
    role: string;
    personId: string | null;
    title: string;
  };
  /** Bumped whenever a migration changes the payload shape. */
  version: number;
  generatedAt: string;
}

export const BOOTSTRAP_VERSION = 1;
