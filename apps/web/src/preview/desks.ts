/**
 * The desk shortcuts, for the shareable preview only.
 *
 * `vite.config.demo.ts` puts this in place of `lib/desks.ts`. One click opens a
 * desk. That is safe HERE and nowhere else: this build has no server, so there
 * is no password to bypass, and no Aadhaar, PAN, address, full mobile, salary or
 * resident name exists in the file to reach.
 *
 * Every name below is LOOKED UP from the roster the preview carries rather than
 * typed in. The version of this that was typed in named nine people who had all
 * since left, and a shortcut that fills in an ID the server rejects reads as
 * "the app is broken" rather than "that ID is wrong".
 */
import { PREVIEW_WORLD } from './data.js';
import type { QuickDesk } from '../lib/desks.js';

export type { QuickDesk } from '../lib/desks.js';

type Person = { id: string; name: string; designation: string; dept: string };
const PEOPLE = (PREVIEW_WORLD as { people: Person[] }).people ?? [];
const byId = new Map(PEOPLE.map((p) => [p.id, p]));

/** Management is not on the payroll register, so it has no employee ID. */
export const MANAGEMENT_ID = 'MANAGEMENT';

const DESKS: ReadonlyArray<{ key: string; label: string; id: string; fallback: string }> = [
  { key: 'admin', label: 'Management', id: MANAGEMENT_ID, fallback: 'Everything, company-wide' },
  { key: 'hr', label: 'HR', id: 'MB-HR-0001', fallback: '' },
  { key: 'accounts', label: 'Accounts', id: 'MB-ACC-0001', fallback: '' },
  { key: 'purchase', label: 'Purchase', id: 'MB-PUR-0001', fallback: '' },
  { key: 'purchaseAsst', label: 'Purchase desk', id: 'MB-PUR-0002', fallback: '' },
  { key: 'maintenance', label: 'Maintenance', id: 'MB-MNT-0019', fallback: '' },
  // Marbella has no Store department. The people who run the stores sit in
  // Project, with "Store Incharge" as their title, so that is who these open as.
  { key: 'store', label: 'Store', id: 'MB-PRJ-0004', fallback: '' },
  { key: 'storeAsst', label: 'Store floor', id: 'MB-PRJ-0043', fallback: '' },
  // And no security staff at all. The screen exists; nobody holds it yet.
  { key: 'security', label: 'Gate', id: 'GATE', fallback: 'No security staff on the roster yet' },
];

export const QUICK_DESKS: readonly QuickDesk[] = DESKS.map((d) => {
  const p = byId.get(d.id);
  return { key: d.key, label: d.label, id: d.id, sub: p ? `${p.name} · ${p.designation}` : d.fallback };
});

/** In the preview a desk button goes straight in: there is nothing to check. */
export const DESKS_SIGN_IN_DIRECTLY = true;

/**
 * Which desk an Employee ID opens.
 *
 * In the product the SERVER answers this and the browser has no say. Here there
 * is no server, so the rule is written down: the desk shortcuts map to their own
 * desk, and anybody else lands on the desk for their department. Sales, CRM,
 * Project, Marketing, Pantry, IT and Horticulture have no desk of their own yet,
 * so those IDs open the HR desk.
 */
const BY_ID = new Map(DESKS.map((d) => [d.id, d.key]));
const BY_DEPT: Record<string, string> = {
  Accounts: 'accounts',
  Purchase: 'purchase',
  Maintenance: 'maintenance',
  HR: 'hr',
};

export function deskFor(id: string): string {
  const direct = BY_ID.get(id.trim().toUpperCase());
  if (direct) return direct;
  const p = byId.get(id.trim().toUpperCase());
  return (p && BY_DEPT[p.dept]) || 'hr';
}
