/**
 * The desk shortcuts offered on the sign-in screen.
 *
 * EMPTY IN THE REAL BUILD, and it stays empty. Two reasons, both of which
 * matter more than the typing it would save:
 *
 *  - A button that signs you in without a password is the hole this project
 *    already closed once. The sign-in button used to read `onLogin("admin")`
 *    and handed everybody the Chairman's desk — salaries, budgets, overrides.
 *    It is not coming back through the front door.
 *  - A fixed list of Employee IDs shown to somebody who has NOT signed in tells
 *    an unauthenticated visitor who works here and what they do, and it goes
 *    stale the day one of them leaves.
 *
 * The shareable preview replaces this file (see vite.config.demo.ts). There is
 * no server behind that build, no password to bypass and no real identifier in
 * it, so one-click desks there cost nothing and save a lot of typing.
 */

export interface QuickDesk {
  /** Which set of screens it opens — the server's `userKey`. */
  key: string;
  label: string;
  /** Who that is, or why nobody is. Shown under the label. */
  sub: string;
  /** What gets put in the Employee ID box. */
  id: string;
}

export const QUICK_DESKS: readonly QuickDesk[] = [];

/**
 * True when a desk button signs straight in, false when it only fills the
 * Employee ID and leaves the password to the person. Always false here.
 */
export const DESKS_SIGN_IN_DIRECTLY = false;
