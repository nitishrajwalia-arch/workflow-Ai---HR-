/**
 * Field validation, shared byte-for-byte between the browser and the server.
 *
 * Two rules this file follows:
 *
 * 1. A message says what is wrong AND what to do. "Invalid email" helps nobody.
 * 2. Where the check itself is uncertain, it WARNS. It never blocks. A real
 *    registration must never be rejected because of arithmetic we cannot verify.
 */

export type CheckLevel = 'none' | 'ok' | 'warn' | 'error';

export interface CheckResult {
  level: CheckLevel;
  msg?: string;
  /** A corrected value the UI may offer as a one-click fix. */
  fix?: string;
  [extra: string]: unknown;
}

export const isBlocking = (r: CheckResult): boolean => r.level === 'error';

/* ------------------------------------------------------------------ email */

const TYPO_DOMAINS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gnail.com': 'gmail.com',
  'yahoo.co': 'yahoo.co.in',
  'yahho.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'rediffmail.co': 'rediffmail.com',
  'redifmail.com': 'rediffmail.com',
};

export const COMPANY_EMAIL_DOMAINS = ['marbellagroup.in', 'marbella.in'];

export interface EmailOptions {
  required?: boolean;
  /** Reject a company address. The company account dies the day they leave. */
  mustBePersonal?: boolean;
  /** Warn when it is not a company address. */
  mustBeCompany?: boolean;
}

export function emailCheck(raw: unknown, opts: EmailOptions = {}): CheckResult {
  const v = String(raw ?? '').trim();
  if (!v) {
    return opts.required
      ? {
          level: 'error',
          msg: 'No email. Once they leave, the company address dies with the account — this is the only way to reach them.',
        }
      : { level: 'none' };
  }
  if (/\s/.test(v))
    return { level: 'error', msg: "There's a space in it. Emails can't contain spaces." };

  const parts = v.split('@');
  if (parts.length === 1) return { level: 'error', msg: 'No @ sign.' };
  if (parts.length > 2)
    return { level: 'error', msg: `${parts.length - 1} @ signs — there can only be one.` };

  const local = parts[0] ?? '';
  const domain = parts[1] ?? '';
  if (!local) return { level: 'error', msg: 'Nothing before the @.' };
  if (!domain) return { level: 'error', msg: 'Nothing after the @.' };
  if (local.length > 64)
    return { level: 'error', msg: 'The part before the @ is over 64 characters.' };
  if (/^\.|\.$/.test(local))
    return { level: 'error', msg: 'The part before the @ starts or ends with a dot.' };
  if (/\.\./.test(v)) return { level: 'error', msg: 'Two dots in a row.' };
  if (!/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local))
    return {
      level: 'error',
      msg: 'Unusual character before the @ — letters, numbers, dot, underscore, hyphen and plus are safe.',
    };
  if (!domain.includes('.'))
    return { level: 'error', msg: `"${domain}" has no dot — a domain needs one, like gmail.com.` };
  if (!/^[A-Za-z0-9.-]+$/.test(domain))
    return { level: 'error', msg: 'Unusual character in the domain.' };

  const firstLabel = domain.split('.')[0] ?? '';
  if (/^-|-$/.test(firstLabel))
    return { level: 'error', msg: 'The domain starts or ends with a hyphen.' };

  const tld = domain.split('.').pop() ?? '';
  if (tld.length < 2) return { level: 'error', msg: `".${tld}" is too short to be a real ending.` };
  if (/\d/.test(tld))
    return { level: 'error', msg: `".${tld}" has digits in it — endings are letters.` };

  const low = domain.toLowerCase();
  const typo = TYPO_DOMAINS[low];
  if (typo)
    return {
      level: 'warn',
      msg: `Did you mean ${local}@${typo}? "${domain}" is a common slip.`,
      fix: `${local}@${typo}`,
    };
  if (opts.mustBePersonal && COMPANY_EMAIL_DOMAINS.includes(low))
    return {
      level: 'error',
      msg: "That's the company address. This field is their personal one — the company account is closed the day they leave.",
    };
  if (opts.mustBeCompany && !COMPANY_EMAIL_DOMAINS.includes(low))
    return {
      level: 'warn',
      msg: `Not a ${COMPANY_EMAIL_DOMAINS[0]} address. Fine if that's deliberate.`,
    };

  return { level: 'ok', msg: `Looks right — ${local.toLowerCase()}@${low}` };
}

export const emailOK = (s: unknown): boolean => emailCheck(s).level === 'ok';

/* ----------------------------------------------------------------- mobile */

/** Indian mobile: ten digits, first one 6-9. We read the last ten so +91 is fine. */
export function phoneCheck(raw: unknown, opts: { required?: boolean } = {}): CheckResult {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits)
    return opts.required ? { level: 'error', msg: 'No mobile number.' } : { level: 'none' };
  const ten = digits.slice(-10);
  if (ten.length < 10)
    return { level: 'error', msg: `Only ${ten.length} digits. An Indian mobile is ten.` };
  if (digits.length > 12)
    return { level: 'warn', msg: 'That is longer than a country code plus ten digits. Check it.' };
  if (!/^[6-9]/.test(ten))
    return { level: 'error', msg: `Starts with ${ten[0]}. Indian mobiles start 6, 7, 8 or 9.` };
  return { level: 'ok', msg: `${ten.slice(0, 5)} ${ten.slice(5)}` };
}

export const phoneOK = (s: unknown): boolean => phoneCheck(s).level === 'ok';

/** Ten digits with no country code, the form we store. */
export const normalisePhone = (s: unknown): string =>
  String(s ?? '')
    .replace(/\D/g, '')
    .slice(-10);

/* ------------------------------------------------------------------- IMEI */

/** IMEI is fifteen digits with a Luhn check digit. This one is arithmetic, so it blocks. */
export function luhnOK(s: unknown): boolean {
  const d = String(s ?? '').replace(/\D/g, '');
  if (d.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = Number(d[14 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function imeiCheck(raw: unknown, opts: { required?: boolean } = {}): CheckResult {
  const v = String(raw ?? '').trim();
  if (!v || v === '—')
    return opts.required ? { level: 'error', msg: 'No IMEI.' } : { level: 'none' };
  const d = v.replace(/\D/g, '');
  if (d.length !== 15)
    return {
      level: 'error',
      msg: `${d.length} digits. An IMEI is fifteen — dial *#06# on the handset.`,
    };
  if (!luhnOK(d))
    return {
      level: 'error',
      msg: 'Fifteen digits, but the check digit does not add up. One digit is wrong — read it off the handset again.',
    };
  return { level: 'ok', msg: 'Check digit adds up.' };
}

/* ------------------------------------------------------------------ GSTIN */

const GST_ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GST_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

/**
 * A GSTIN is 15 characters: 2 state digits, a 10-character PAN, an entity code,
 * a literal Z, and a check character.
 *
 * The check character NEVER blocks. Our arithmetic agreed with only some published
 * sample GSTINs and we could not establish whether the samples or the arithmetic
 * were wrong. Only the GST portal settles it, so a mismatch is a warning to go and
 * confirm — never a refusal of a registration that may well be real.
 */
export function gstinCheck(raw: unknown): CheckResult {
  const g = String(raw ?? '')
    .toUpperCase()
    .trim();
  if (!g) return { level: 'none' };
  if (!GST_SHAPE.test(g))
    return {
      level: 'error',
      msg: 'Not a GSTIN shape — 15 characters: 2 state digits, a 10-character PAN, entity code, Z, check character.',
    };

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = GST_ALPHA.indexOf(g[i] as string) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  const expect = GST_ALPHA[(36 - (sum % 36)) % 36];
  const stateCode = g.slice(0, 2);
  const state = GST_STATES[stateCode];
  const pan = g.slice(2, 12);

  if (!state)
    return {
      level: 'warn',
      msg: `State code ${stateCode} isn't one I recognise. Worth a look.`,
      pan,
    };
  if (expect !== g[14])
    return {
      level: 'warn',
      state,
      pan,
      msg: `Shape is right and the state reads ${state}, but my check character comes out "${expect}" not "${g[14]}". Usually a typo — confirm it on the GST portal before you rely on it.`,
    };
  return { level: 'ok', state, pan, msg: `${state} · PAN ${pan} · check character matches.` };
}

/* -------------------------------------------------------------------- PAN */

const PAN_SHAPE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function panCheck(raw: unknown): CheckResult {
  const p = String(raw ?? '')
    .toUpperCase()
    .trim();
  if (!p) return { level: 'none' };
  if (!PAN_SHAPE.test(p))
    return {
      level: 'error',
      msg: 'A PAN is ten characters: five letters, four digits, one letter.',
    };
  return { level: 'ok', msg: 'Shape is right. Only the income tax portal confirms it is live.' };
}

/* ------------------------------------------------------------------- RERA */

const RERA_SHAPE = /^[A-Z]{2}RERA[-\s]?[A-Z0-9]{3,10}[-\s]?[A-Z0-9]{4,12}$/i;

export function reraCheck(raw: unknown, status: string): CheckResult {
  const r = String(raw ?? '').trim();
  if (status !== 'received') return { level: 'none' };
  if (!r) return { level: 'error', msg: 'Marked as received but no number entered.' };
  if (!RERA_SHAPE.test(r))
    return {
      level: 'warn',
      msg: "Doesn't look like the usual PBRERA-SAS79-PR0421 pattern. Check it — formats do vary by state.",
    };
  return { level: 'ok', msg: 'Shape looks right. Only the RERA portal can confirm it is live.' };
}

/* ------------------------------------------------------------------ dates */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Accepts what people actually paste — 05/06/2020, 5-6-20, 2020-06-05 — and
 * returns the one display form this system uses: "05 Jun 2020".
 * Day-first, because that is how the subcontinent writes a date.
 */
export function normDate(s: unknown): string {
  const t = String(s ?? '').trim();
  let m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const raw = m[3] as string;
    const y = raw.length === 2 ? 2000 + Number(raw) : Number(raw);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31)
      return `${String(d).padStart(2, '0')} ${MONTHS[mo - 1]} ${y}`;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  return t;
}

/** "05 Jun 2020" -> Date, or null if it is not that shape. */
export function parseDisplayDate(s: unknown): Date | null {
  const m = String(s ?? '')
    .trim()
    .match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
  if (!m) return null;
  const mi = MONTHS.findIndex((x) => x.toLowerCase() === (m[2] as string).toLowerCase());
  if (mi < 0) return null;
  const d = new Date(Date.UTC(Number(m[3]), mi, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDisplayDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "18 Jul 2026 · 10:12" — the stamp the ledger and the card log use. */
export function toDisplayStamp(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${toDisplayDate(d)} · ${hh}:${mm}`;
}

/* ------------------------------------------------------------- employee id */

export const EMPLOYEE_ID_SHAPE = /^MB-[A-Z]{2,3}-\d{4}$/;

export function employeeIdCheck(raw: unknown): CheckResult {
  const v = String(raw ?? '')
    .toUpperCase()
    .trim();
  if (!v) return { level: 'none' };
  if (!EMPLOYEE_ID_SHAPE.test(v))
    return {
      level: 'error',
      msg: 'An employee ID looks like MB-PUR-0012 — MB, the department code, four digits.',
    };
  return { level: 'ok' };
}
