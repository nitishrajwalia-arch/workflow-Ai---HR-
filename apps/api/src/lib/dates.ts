/**
 * Dates.
 *
 * The letters merge a display date ("05 Jun 2020") and the database wants
 * something sortable. We keep BOTH: `joined` is the string that gets printed and
 * `joinedOn` is the timestamp that gets ordered and compared. The API writes the
 * second from the first, so they can never drift.
 */

import { normDate, parseDisplayDate, toDisplayDate, toDisplayStamp } from '@marbella/shared';

export { normDate, parseDisplayDate, toDisplayDate, toDisplayStamp };

/** The stamp written into the ledger and card log: "18 Jul 2026 · 10:12". */
export const nowStamp = (d = new Date()): string => toDisplayStamp(d);

/**
 * Normalise a user-supplied date to the display form and its sortable twin.
 * Returns null for `on` when the string is not a date we can read — better an
 * unsorted row than a wrong one.
 */
export function bothForms(input: unknown): { display: string; on: Date | null } {
  const display = normDate(input);
  return { display, on: parseDisplayDate(display) };
}
