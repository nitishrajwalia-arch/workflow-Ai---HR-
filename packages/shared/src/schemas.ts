/**
 * The API contract, written once.
 *
 * The Fastify server validates every request body against these schemas AND
 * generates its OpenAPI document from them. The browser imports the inferred
 * types from the same file. There is therefore no way for the front end and the
 * back end to disagree about a shape without the TypeScript build failing.
 *
 * Rule: a schema describes what is ACCEPTED. Business rules that need to look at
 * the database (does this employee exist? is this stage next?) belong in the
 * service layer, not here.
 */

import { z } from 'zod';
import {
  DEPARTMENTS,
  EMPLOYEE_TYPES,
  EXIT_REASONS,
  EXIT_STAGE_KEYS,
  GENDERS,
  LEDGER_KINDS,
  PERSON_STATUSES,
  PROJECT_STAGES,
  RERA_STATUSES,
  REISSUE_KEYS,
  ROLE_KEYS,
} from './constants.js';
import { EMPLOYEE_ID_SHAPE } from './validation.js';

/* --------------------------------------------------------------- primitives */

export const employeeId = z
  .string()
  .trim()
  .toUpperCase()
  .regex(EMPLOYEE_ID_SHAPE, 'An employee ID looks like MB-PUR-0012.');

/** A short human-authored slug, e.g. a company or project id. */
export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(32)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Lower-case letters, digits and hyphens.');

export const displayDate = z
  .string()
  .trim()
  .regex(/^\d{2} [A-Z][a-z]{2} \d{4}$/, 'A date looks like 05 Jun 2020.');

export const department = z.enum(DEPARTMENTS as [string, ...string[]]);
export const employeeType = z.enum(EMPLOYEE_TYPES);
export const personStatus = z.enum(PERSON_STATUSES);
export const gender = z.enum(GENDERS);
export const role = z.enum(ROLE_KEYS as [string, ...string[]]);
export const reissueReason = z.enum(REISSUE_KEYS as [string, ...string[]]);
export const exitStage = z.enum(EXIT_STAGE_KEYS as [string, ...string[]]);
export const ledgerKind = z.enum(LEDGER_KINDS);
export const reraStatus = z.enum(RERA_STATUSES);
export const projectStage = z.enum(PROJECT_STAGES);

export const shift = z.object({
  in: z.string().regex(/^\d{2}:\d{2}$/),
  out: z.string().regex(/^\d{2}:\d{2}$/),
  hours: z.number().min(0).max(24),
});

export const note = z.object({
  when: z.string(),
  text: z.string().max(2000),
});

/* -------------------------------------------------------------------- auth */

/**
 * Sign in.
 *
 * `identifier` is the Employee ID printed on the card (MB-PUR-0012) OR an email
 * address. People know their employee number; many site staff have no company
 * email at all, so demanding one would lock them out of their own system.
 */
export const loginBody = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(200),
});

export const refreshBody = z.object({
  /** Optional: the cookie is used when this is absent. Mobile clients send it here. */
  refreshToken: z.string().min(10).optional(),
});

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12, 'Twelve characters or more. Length beats punctuation.').max(200),
});

export const createUserBody = z.object({
  email: z.string().trim().toLowerCase().min(3).max(255),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(200),
  role,
  personId: employeeId.optional(),
  /** The Employee ID they will sign in with. */
  loginId: employeeId.optional(),
  userKey: z.string().trim().min(2).max(20).optional(),
});

export const sessionUser = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role,
  personId: z.string().nullable(),
  employeeId: z.string().nullable(),
  /**
   * Which desk this account sees: admin | purchase | store | maintenance |
   * accounts | hr | purchaseAsst | storeAsst | security.
   *
   * The left-hand nav is built from this. It comes from the database on every
   * request, so a browser cannot promote itself by asking for a different one.
   */
  userKey: z.string(),
  mustChangePassword: z.boolean(),
});

export const authTokens = z.object({
  accessToken: z.string(),
  /** Seconds. The client refreshes a little before this. */
  expiresIn: z.number(),
  user: sessionUser,
});

/* ------------------------------------------------------------------ people */

export const personCore = z.object({
  id: employeeId,
  name: z.string().trim().min(2).max(120),
  designation: z.string().trim().min(2).max(120),
  dept: department,
  type: employeeType,
  joined: displayDate,
  dob: displayDate.optional().nullable(),
  /** Null means nobody has asked yet. 'undisclosed' means they were asked. */
  gender: gender.optional().nullable(),
  status: personStatus.default('active'),
  exitedOn: displayDate.optional().nullable(),
  /** The project they are POSTED AT. Not who pays them. */
  office: slug,
  /** The legal entity that PAYS THEM. Gets this wrong and the letterhead is wrong. */
  employer: slug,
  reportsTo: employeeId.nullable(),
  /**
   * Who they answer to when that is not an employee. Twenty-three people report
   * to a Managing Director and the directors are not on the payroll register, so
   * an org chart that only understands employee IDs leaves them reporting to
   * nobody.
   */
  reportsToNote: z.string().trim().max(200).default(''),
  perf: z.number().int().min(0).max(100).default(75),
  growth: z.string().max(2000).default(''),
  notes: z.array(note).default([]),
  photo: z.string().url().nullable().default(null),
  shift: shift.optional(),
});

/**
 * The salary HR agrees with somebody when she creates their employee ID.
 *
 * ONE FIGURE. She types the monthly gross and the company's policy splits it —
 * asking a new HR manager to type a Basic, an HRA and a Travelling Allowance
 * that add up to the gross is asking her to do arithmetic the software already
 * knows how to do, and to get it wrong on somebody's first payslip.
 *
 * Medical is separate because it is flat and varies per person, and the two
 * switches are separate because whether somebody is covered by ESI and PF is a
 * fact about them, not about their salary.
 */
export const salaryAtJoining = z.object({
  gross: z.number().int().min(0).max(100_000_000),
  medical: z.number().int().min(0).max(1_000_000).default(0),
  esiOn: z.boolean().default(false),
  pfOn: z.boolean().default(false),
  /** The wage PF is worked out on, when it is not the policy's. */
  pfWages: z.number().int().min(0).max(100_000_000).default(0),
  note: z.string().trim().max(500).default(''),
});

/**
 * Adding somebody.
 *
 * `reportsTo` is optional as well as nullable: most new people report to
 * somebody, some report to a director who is not on the register, and the form
 * used to omit the key entirely — which the server refused, so every enrolment
 * failed. It takes a salary too, because the moment HR knows the employee ID is
 * the moment she knows what they are being paid.
 */
export const createPersonBody = personCore
  .partial({ id: true, status: true, perf: true, reportsTo: true })
  .extend({ salary: salaryAtJoining.optional() });

/**
 * Everything a person record can be patched with. Identity is never patched
 * here, and neither is STATUS.
 *
 * Status is omitted for two reasons. The first is design: leaving, and being
 * confirmed as staff, each have their own route because each has to record who
 * decided and on what basis — a silent field on a general-purpose edit cannot.
 *
 * The second is that Zod's `.partial()` does NOT strip a `.default()`. While
 * `status` was in here carrying `.default('active')`, every PATCH that never
 * mentioned status still parsed to `status: 'active'` — so correcting the
 * spelling of a former employee's designation quietly brought them back onto
 * the payroll. Dropping the field removes the trap along with the feature.
 */
export const updatePersonBody = personCore
  .omit({ id: true, status: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change.');

export const setEmployerBody = z.object({
  employer: slug,
  /** Why the paying entity changed. Goes into the ledger verbatim. */
  reason: z.string().trim().min(4).max(500),
});

export const peopleQuery = z.object({
  q: z.string().trim().max(120).optional(),
  dept: department.optional(),
  office: slug.optional(),
  employer: slug.optional(),
  status: personStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

/* --------------------------------------------------- companies and projects */

export const companyBody = z.object({
  id: slug,
  name: z.string().trim().min(2).max(200),
  kind: z.string().trim().max(60).default(''),
  /** Shape-checked, never rejected on the check character. See validation.ts. */
  gstin: z.string().trim().toUpperCase().max(15).default(''),
  pan: z.string().trim().toUpperCase().max(10).default(''),
  addr: z.string().trim().max(500).default(''),
});

export const projectBody = z.object({
  id: slug,
  name: z.string().trim().min(2).max(200),
  short: z.string().trim().min(1).max(60),
  company: slug,
  reraStatus: reraStatus.default('notyet'),
  rera: z.string().trim().max(60).default(''),
  stage: projectStage.default('pre'),
  addr: z.string().trim().max(500).default(''),
  tint: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#224A85'),
});

/* ------------------------------------------------------------------- cards */

/**
 * Issuing a card.
 *
 * The server re-derives `ver` and refuses a client-supplied one: two people on two
 * screens must not both be handed "version 3".
 *
 * When the reason is one the old card did not come back from (lost, stolen, not
 * returned), the long form is mandatory and the server enforces it — the browser
 * being persuaded to skip a step must not be enough.
 */
export const issueCardBody = z
  .object({
    pid: employeeId,
    reason: reissueReason,
    /** Who physically took the old card back. Required on a fast path. */
    recv: z.string().trim().max(120).optional(),
    /** Confirmation the old card was destroyed in front of the holder. */
    killed: z.boolean().default(false),
    note: z.string().trim().max(4000).default(''),
    /** The holder's own words. 25-character floor: "lost it" will not pass. */
    circumstances: z.string().trim().max(4000).optional(),
    lastHeld: z.string().trim().max(120).optional(),
    toldWho: z.string().trim().max(200).optional(),
    firNumber: z.string().trim().max(60).optional(),
    /** Each of the five undertakings ticked individually. */
    undertakings: z.array(z.boolean()).default([]),
  })
  .strict();

export const cardsQuery = z.object({
  pid: employeeId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

/* ------------------------------------------------------------------ ledger */

export const ledgerQuery = z.object({
  kind: ledgerKind.optional(),
  subject: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

export const ledgerEntry = z.object({
  id: z.string(),
  at: z.string(),
  who: z.string(),
  kind: z.string(),
  subject: z.string(),
  detail: z.string(),
  prev: z.string(),
  seal: z.string(),
  seq: z.number().int(),
});

export const ledgerVerification = z.object({
  ok: z.boolean(),
  count: z.number().int(),
  head: z.string().optional(),
  brokenAt: z.number().int().optional(),
  reason: z.string().optional(),
  message: z.string().optional(),
});

/* ------------------------------------------------------------------- exits */

export const openExitBody = z.object({
  pid: employeeId,
  reason: z.enum(EXIT_REASONS),
});

export const advanceExitBody = z.object({
  /** Must equal the exit's current stage. Optimistic-concurrency guard: two
   *  people cannot each advance the same exit one step and skip a stage. */
  fromStage: exitStage,
  payload: z.record(z.string(), z.unknown()).default({}),
  /** One sentence for the ledger, written by the person doing it. */
  summary: z.string().trim().min(4).max(1000),
});

/* --------------------------------------------------------- payroll, devices */

export const salaryBody = z.object({
  basic: z.number().int().min(0).max(100_000_000).default(0),
  hra: z.number().int().min(0).max(100_000_000).default(0),
  special: z.number().int().min(0).max(100_000_000).default(0),
  pf: z.number().int().min(0).max(1_000_000).default(0),
  pt: z.number().int().min(0).max(1_000_000).default(0),
  note: z.string().trim().max(500).default(''),
});

/* ------------------------------------------------------------------ payroll */

/** Asking for a month's payroll to be worked out. */
export const payRunBody = z.object({
  /** Display form, "Sep 2026". */
  month: z
    .string()
    .trim()
    .regex(/^[A-Z][a-z]{2} \d{4}$/, 'Use a month like "Sep 2026".'),
  company: slug,
  monthDays: z.number().int().min(28).max(31),
  /**
   * Which month's attendance to take the days from. Usually the same month, and
   * separate because it is not always loaded — there is one month of it so far,
   * and a run for a month with none gives everybody the full month and says so
   * rather than paying nobody.
   */
  attendanceMonth: z.string().trim().max(20).default(''),
});

/**
 * What HR can change on a line once it is drafted.
 *
 * Nothing that is COMPUTED is in here — not the basic, not the earned gross,
 * not ESI or PF. Those come from the person's structure and the company's
 * policy, and a screen that lets somebody type over them is a screen where the
 * number Accounts pays has no rule behind it. What HR sets is the days, the
 * money the company is taking back or adding, and why.
 */
export const payLineBody = z.object({
  days: z.number().min(0).max(31).optional(),
  extraDays: z.number().min(0).max(31).optional(),
  tds: z.number().int().min(0).max(10_000_000).optional(),
  advance: z.number().int().min(0).max(10_000_000).optional(),
  other: z.number().int().min(0).max(10_000_000).optional(),
  /**
   * Anything else coming off this month, each with what it is FOR. "Other:
   * 4,000" with no reason on it is the line people come to HR about, and the
   * reason is the part that stops it being asked twice.
   */
  others: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(80),
        amount: z.number().int().min(0).max(10_000_000),
      }),
    )
    .max(20)
    .optional(),
  arrear: z.number().int().min(-10_000_000).max(10_000_000).optional(),
  remark: z.string().trim().max(500).optional(),
});

/**
 * A reduction head — what comes off a payslip, and under which rule.
 *
 * The rate is not validated against the law, because the law is not in here and
 * a company that is behind on a rate change needs to be able to say so. What is
 * required is the AUTHORITY: a rate with nothing behind it is a number somebody
 * typed.
 */
export const deductionHeadBody = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9-]{1,23}$/, 'A short key like "pf", "esi" or "canteen".'),
  label: z.string().trim().min(2).max(60),
  basis: z.enum(['earnedPct', 'wagePct', 'flat', 'entered']),
  rate: z.number().min(0).max(100).default(0),
  employerRate: z.number().min(0).max(100).default(0),
  wage: z.number().int().min(0).max(100_000_000).default(0),
  personWage: z.boolean().default(false),
  ceiling: z.number().int().min(0).max(100_000_000).default(0),
  proRate: z.boolean().default(true),
  requires: z.enum(['', 'esiOn', 'pfOn']).default(''),
  /** 'up' is what the ESI regulation says; 'nearest' is what most of the books do. */
  rounding: z.enum(['nearest', 'up']).default('nearest'),
  authority: z.string().trim().min(4).max(400),
  note: z.string().trim().max(400).default(''),
  active: z.boolean().default(true),
  sort: z.number().int().min(0).max(999).default(0),
});

export const deviceBody = z.object({
  pid: employeeId,
  type: z.string().trim().min(2).max(60),
  model: z.string().trim().max(120).default(''),
  /** Luhn-checked when it is not the em-dash placeholder. */
  imei: z.string().trim().max(20).default(''),
  sim: z.string().trim().max(40).default(''),
  issued: displayDate,
});

export const contactBody = z.object({
  /** Personal number only. */
  phone: z.string().trim().max(20).default(''),
  /** Personal address only: the company one dies with the account. */
  email: z.string().trim().max(255).default(''),
  vPhone: z.boolean().default(false),
  vEmail: z.boolean().default(false),
});

/* ---------------------------------------------------------------- policies */

export const deptRuleBody = z.object({
  in: z.string().regex(/^\d{2}:\d{2}$/),
  out: z.string().regex(/^\d{2}:\d{2}$/),
  hours: z.number().min(0).max(24),
  days: z.string().trim().max(40),
  grace: z.number().int().min(0).max(120),
  setBy: z.string().trim().max(120),
  note: z.string().trim().max(500).default(''),
  // `setOn` is NOT here. The server stamps it from its own clock, because the
  // point of the field is to say when somebody decided this, and a client that
  // can write it can say the decision was made last year.
});

export const leavePolicyBody = z.object({
  casual: z.number().int().min(0).max(365),
  sick: z.number().int().min(0).max(365),
  earned: z.number().int().min(0).max(365),
  halfDay: z.string().trim().max(200).default(''),
  lateAfter: z.number().int().min(0).max(31),
  /**
   * The rest of the entitlement. The written policy quantified casual leave and
   * deferred everything else to "the company's approved HR policy", which did
   * not exist; HR answered these on the data-gap workbook. Optional so an older
   * client that only knows the first five fields does not blank them.
   */
  lateStrikes: z.number().int().min(0).max(31).optional(),
  carryForward: z.boolean().optional(),
  encashable: z.boolean().optional(),
  probation: z.string().trim().max(200).optional(),
  maternityWeeks: z.number().int().min(0).max(104).optional(),
  paternityDays: z.number().int().min(0).max(365).optional(),
  notice: z.string().trim().max(200).optional(),
  // setBy and setOn are the server's: see the note on deptRuleBody.
});

/* ------------------------------------------------------- documents and JDs */

export const logDocBody = z.object({
  tpl: z.string().trim().min(1).max(80),
  pid: employeeId,
  company: slug,
  /** print | email | file — how it left the building. */
  via: z.enum(['print', 'email', 'file']),
  subject: z.string().trim().max(300).default(''),
  body: z.string().max(50_000).default(''),
});

export const saveJdBody = z.object({
  /**
   * Department as well as title. "Assistant Manager" is three different jobs at
   * Marbella — Accounts, Purchase and Sales each wrote their own — and keying on
   * the title alone meant whoever saved last replaced the other two.
   */
  dept: z.string().trim().min(2).max(60),
  role: z.string().trim().min(2).max(120),
  /**
   * The three fields the Roles screen edits. This used to be a bare string,
   * which the screen never sent — it has always posted this object — so every
   * "Save this description" was answered with a 400.
   */
  jd: z.object({
    purpose: z.string().trim().max(8_000),
    duties: z.array(z.string().trim().max(2_000)).max(60),
    needs: z.array(z.string().trim().max(2_000)).max(60),
  }),
});

/* ------------------------------------------------------------ bulk import */

export const importRow = z.object({
  name: z.string().trim().min(2).max(120),
  id: z.string().trim().max(20).optional(),
  desig: z.string().trim().min(2).max(120),
  dept: z.string().trim().min(2).max(60),
  office: z.string().trim().max(80).optional(),
  joined: z.string().trim().min(4).max(40),
  dob: z.string().trim().max(40).optional(),
  /** Free text off the sheet ("F", "Female", "महिला"). Normalised server-side. */
  gender: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().max(255).optional(),
  imei: z.string().trim().max(20).optional(),
  sim: z.string().trim().max(40).optional(),
  basic: z.union([z.string(), z.number()]).optional(),
  hra: z.union([z.string(), z.number()]).optional(),
  special: z.union([z.string(), z.number()]).optional(),
});

/**
 * A row of a sheet that UPDATES somebody already on the roster.
 *
 * The employee ID is the only required field: it is what the row is matched on,
 * and a row that cannot be matched is held back rather than creating a new
 * person under a slightly different spelling of the same name.
 *
 * Everything else is optional, and a BLANK CELL MEANS "leave it alone" — not
 * "clear it". Somebody filling in the gender column for forty people should not
 * wipe the phone numbers of the other eighty-six by leaving those cells empty.
 */
export const importUpdateRow = z.object({
  id: employeeId,
  dob: z.string().trim().max(40).optional(),
  gender: z.string().trim().max(40).optional(),
  reportsTo: z.string().trim().max(20).optional(),
  /**
   * Generous on length on purpose. Real sheets carry "9876543210/9812345678"
   * in one cell, and a tight limit here rejects the WHOLE upload at the schema
   * boundary with no row named — the one failure mode this importer exists to
   * avoid. Let the row through and let phoneCheck reject it by itself, with a
   * reason attached to the person it belongs to.
   */
  phone: z.string().trim().max(60).optional(),
  email: z.string().trim().max(255).optional(),
  imei: z.string().trim().max(20).optional(),
  sim: z.string().trim().max(40).optional(),
  basic: z.union([z.string(), z.number()]).optional(),
  hra: z.union([z.string(), z.number()]).optional(),
  special: z.union([z.string(), z.number()]).optional(),
});

export const bulkUpdateBody = z.object({
  rows: z.array(importUpdateRow).min(1).max(2000),
  /** false = validate only and report, change nothing. */
  commit: z.boolean().default(false),
});

export const bulkImportBody = z.object({
  rows: z.array(importRow).min(1).max(2000),
  /** false = validate only and report, change nothing. The UI previews first. */
  commit: z.boolean().default(false),
});

export const bulkImportResult = z.object({
  accepted: z.array(z.object({ row: z.number().int(), id: z.string(), name: z.string() })),
  rejected: z.array(
    z.object({ row: z.number().int(), name: z.string(), reason: z.string(), field: z.string() }),
  ),
  committed: z.boolean(),
});

/* ------------------------------------------------------------------ usage */

export const trackBody = z.object({
  key: z.string().trim().min(1).max(80),
  count: z.number().int().min(1).max(1000).default(1),
});

/* -------------------------------------------------------------- envelopes */

export const errorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Field-level detail, when the failure was a validation failure. */
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    requestId: z.string().optional(),
  }),
});

export const okBody = z.object({ ok: z.literal(true) });

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

/* ------------------------------------------------------------------ types */

export type LoginBody = z.infer<typeof loginBody>;
export type SessionUser = z.infer<typeof sessionUser>;
export type AuthTokens = z.infer<typeof authTokens>;
export type PersonCore = z.infer<typeof personCore>;
export type CreatePersonBody = z.infer<typeof createPersonBody>;
export type UpdatePersonBody = z.infer<typeof updatePersonBody>;
export type PeopleQuery = z.infer<typeof peopleQuery>;
export type CompanyBody = z.infer<typeof companyBody>;
export type ProjectBody = z.infer<typeof projectBody>;
export type IssueCardBody = z.infer<typeof issueCardBody>;
export type LedgerEntry = z.infer<typeof ledgerEntry>;
export type LedgerVerification = z.infer<typeof ledgerVerification>;
export type OpenExitBody = z.infer<typeof openExitBody>;
export type AdvanceExitBody = z.infer<typeof advanceExitBody>;
export type SalaryBody = z.infer<typeof salaryBody>;
export type PayRunBody = z.infer<typeof payRunBody>;
export type PayLineBody = z.infer<typeof payLineBody>;
export type DeductionHeadBody = z.infer<typeof deductionHeadBody>;
export type SalaryAtJoining = z.infer<typeof salaryAtJoining>;
export type DeviceBody = z.infer<typeof deviceBody>;
export type ContactBody = z.infer<typeof contactBody>;
export type DeptRuleBody = z.infer<typeof deptRuleBody>;
export type LeavePolicyBody = z.infer<typeof leavePolicyBody>;
export type LogDocBody = z.infer<typeof logDocBody>;
export type SaveJdBody = z.infer<typeof saveJdBody>;

/**
 * A job description out of the database, where the column is free JSON.
 *
 * Anything that does not parse comes back empty rather than throwing: a row
 * somebody hand-edited into the wrong shape should cost that one description,
 * not the whole bootstrap request.
 */
export function readJd(v: unknown): { purpose: string; duties: string[]; needs: string[] } {
  const r = saveJdBody.shape.jd.safeParse(v);
  return r.success ? r.data : { purpose: '', duties: [], needs: [] };
}
export type ImportRow = z.infer<typeof importRow>;
export type ImportUpdateRow = z.infer<typeof importUpdateRow>;
export type BulkImportBody = z.infer<typeof bulkImportBody>;
export type BulkImportResult = z.infer<typeof bulkImportResult>;
export type ErrorBody = z.infer<typeof errorBody>;
