/**
 * Domain constants shared by the API and the browser.
 *
 * These are deliberately NOT stored in the database: they are structural facts
 * about how Marbella is organised, and code branches on them. Values that a
 * user can add or edit at runtime (companies, projects, people) live in the DB.
 */

/** Department -> employee-ID infix. `MB-PUR-0012` is Purchase employee 12. */
export const DEPT_CODES = {
  Sales: 'SAL',
  CRM: 'CRM',
  Accounts: 'ACC',
  IT: 'IT',
  Admin: 'ADM',
  Pantry: 'PAN',
  HR: 'HR',
  Marketing: 'MKT',
  Project: 'PRJ',
  Purchase: 'PUR',
  Maintenance: 'MNT',
  Horticulture: 'HRT',
} as const;

export type Department = keyof typeof DEPT_CODES;

export const DEPARTMENTS = Object.keys(DEPT_CODES) as Department[];

export const EMPLOYEE_TYPES = ['Staff', 'Site', 'Security', 'Labour'] as const;
export type EmployeeType = (typeof EMPLOYEE_TYPES)[number];

export const PERSON_STATUSES = ['active', 'exited'] as const;
export type PersonStatus = (typeof PERSON_STATUSES)[number];

/**
 * Gender, as the person themselves states it.
 *
 * `undisclosed` is a real answer — somebody was asked and chose not to say, and
 * that record is complete. It is NOT the same as the field being null, which
 * means nobody has asked yet. HR needs to tell those two apart: one is a
 * finished record, the other is work outstanding. Never infer this from a name.
 */
export const GENDERS = ['female', 'male', 'other', 'undisclosed'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * The bands the workforce is reported in. Chosen to line up with how the
 * Companies Act and most HR reporting cut it, so a number here can be quoted
 * straight into a filing without recutting it.
 */
export const AGE_BANDS = [
  { key: '18-25', label: '18–25', min: 18, max: 25 },
  { key: '26-35', label: '26–35', min: 26, max: 35 },
  { key: '36-45', label: '36–45', min: 36, max: 45 },
  { key: '46-55', label: '46–55', min: 46, max: 55 },
  { key: '56+', label: '56 and over', min: 56, max: 200 },
] as const;

/**
 * Age in completed years on `on`, from a display date ("19 Jun 1997").
 *
 * Returns null rather than a number when the date is missing or unreadable, so
 * a person with no date of birth is counted as "not recorded" instead of
 * quietly landing in a band. Anything outside 14–80 is treated the same way:
 * it is a typo in the source sheet, not a colleague.
 */
export function ageFromDisplayDate(
  dob: string | null | undefined,
  on: Date = new Date(),
): number | null {
  if (!dob || !dob.trim()) return null;
  const parsed = new Date(`${dob.trim()} 00:00:00 GMT`);
  if (Number.isNaN(parsed.getTime())) return null;
  let age = on.getUTCFullYear() - parsed.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < parsed.getUTCMonth() ||
    (on.getUTCMonth() === parsed.getUTCMonth() && on.getUTCDate() < parsed.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 14 && age <= 80 ? age : null;
}

/** Which band an age falls in, or null when there is no usable age. */
export function ageBandOf(age: number | null): string | null {
  if (age == null) return null;
  return AGE_BANDS.find((b) => age >= b.min && age <= b.max)?.key ?? null;
}

/**
 * Card re-issue reasons.
 *
 * `fast: true`  -> the old card came back, so a straight swap is honest.
 * `fast: false` -> the card is unaccounted for. A card opens doors that are shut
 *                  to outsiders, so this path demands a full written record.
 * Changing a reason from false to true removes a control. Do not do it casually.
 */
export const REISSUE_REASONS = {
  first: { label: 'First issue', fast: true, tone: 'gold', blurb: 'New joiner. No previous card.' },
  damaged: {
    label: 'Damaged / worn out',
    fast: true,
    tone: 'green',
    blurb: 'Old card handed back. Straight swap.',
  },
  faded: {
    label: 'Faded / unreadable',
    fast: true,
    tone: 'green',
    blurb: 'Old card handed back. Straight swap.',
  },
  broken: {
    label: 'Snapped / delaminated',
    fast: true,
    tone: 'green',
    blurb: 'Old card handed back. Straight swap.',
  },
  lost: {
    label: 'Lost',
    fast: false,
    tone: 'red',
    blurb: 'Card unaccounted for. Full record required.',
  },
  stolen: {
    label: 'Stolen',
    fast: false,
    tone: 'red',
    blurb: 'Card unaccounted for. Full record required.',
  },
  notreturn: {
    label: 'Not returned by holder',
    fast: false,
    tone: 'red',
    blurb: 'Card unaccounted for. Full record required.',
  },
  namechg: {
    label: 'Name or designation changed',
    fast: false,
    tone: 'amber',
    blurb: 'Old card must be surrendered before the new one is handed over.',
  },
} as const;

export type ReissueReason = keyof typeof REISSUE_REASONS;
export const REISSUE_KEYS = Object.keys(REISSUE_REASONS) as ReissueReason[];

/** A re-issue for an unaccounted-for card needs the long form. */
export const isFastReissue = (r: string): boolean =>
  REISSUE_REASONS[r as ReissueReason]?.fast === true;

/** Deboarding stages. Order is the gate — a stage may only advance to the next one. */
export const EXIT_STAGES = [
  { key: 'decision', label: 'Decision recorded', blurb: 'Why, when, and who signed it off.' },
  {
    key: 'handover',
    label: 'Work handed over',
    blurb: 'Files, keys, pending jobs — to a named person.',
  },
  {
    key: 'assets',
    label: 'Assets & access back',
    blurb: 'Devices returned, card killed, logins revoked.',
  },
  { key: 'dues', label: 'Full & final settled', blurb: 'Salary, leave encashment, recoveries.' },
  { key: 'papers', label: 'Papers issued', blurb: 'Relieving letter and character certificate.' },
  { key: 'closed', label: 'Employment ended', blurb: 'Signed, paid, closed.' },
] as const;

export type ExitStage = (typeof EXIT_STAGES)[number]['key'];
export const EXIT_STAGE_KEYS = EXIT_STAGES.map((s) => s.key) as ExitStage[];

/** Clearing 'assets' is the point of no return: it marks the person exited. */
export const EXIT_STAGE_THAT_DEACTIVATES = 'assets' satisfies ExitStage;

export const EXIT_REASONS = [
  'Resigned',
  'Terminated — performance',
  'Terminated — conduct',
  'Contract ended',
  'Retirement',
  'Absconded',
] as const;

export const LEDGER_KINDS = [
  'join',
  'exit',
  'card',
  'policy',
  'doc',
  'company',
  'project',
  'salary',
  'device',
  'contact',
  'auth',
  'import',
  'person',
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const RERA_STATUSES = ['received', 'applied', 'notyet', 'na'] as const;
export type ReraStatus = (typeof RERA_STATUSES)[number];

export const PROJECT_STAGES = ['pre', 'building', 'handover', 'closed'] as const;

/** Roles, most privileged first. `rank` drives every permission check. */
export const ROLES = {
  ADMIN: { rank: 40, label: 'Administrator' },
  HR: { rank: 30, label: 'HR' },
  MANAGER: { rank: 20, label: 'Manager' },
  VIEWER: { rank: 10, label: 'Viewer' },
} as const;

export type Role = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as Role[];

/** True when `role` is at least as privileged as `min`. */
export const roleAtLeast = (role: Role, min: Role): boolean => ROLES[role].rank >= ROLES[min].rank;

/** Addresses we refuse to accept as a *personal* contact. */
export const COMPANY_DOMAINS = ['marbellagroup.in', 'marbella.in'] as const;

export const ZONES_BY_DEPT: Record<Department, string[]> = {
  Admin: ['Main gate', 'Site office', 'Store & yard', 'Accounts room', 'Server room', 'Club house'],
  HR: ['Main gate', 'Site office', 'Accounts room'],
  Accounts: ['Main gate', 'Site office', 'Accounts room'],
  IT: ['Main gate', 'Site office', 'Accounts room', 'Server room'],
  Sales: ['Main gate', 'Site office', 'Sales office', 'Club house'],
  CRM: ['Main gate', 'Site office', 'Sales office', 'Club house'],
  Marketing: ['Main gate', 'Site office', 'Sales office', 'Club house'],
  Purchase: ['Main gate', 'Site office', 'Store & yard'],
  Project: ['Main gate', 'Site office', 'Store & yard', 'Tower floors'],
  Maintenance: ['Main gate', 'Site office', 'Basement plant', 'Club house', 'Tower floors'],
  Pantry: ['Main gate', 'Site office', 'Club house'],
  Horticulture: ['Main gate', 'Site office'],
};

export const DEFAULT_SHIFT = { in: '09:30', out: '18:30', hours: 9 } as const;

/** How many cards before the pattern is worth a conversation rather than a reprint. */
export const CARD_VERSION_CONCERN_THRESHOLD = 3;
