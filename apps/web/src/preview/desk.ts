/**
 * Which desk the preview is showing.
 *
 * The real application gets this from the server at sign-in: `user.userKey` is
 * the server's answer to "which screens does this account see", and the browser
 * has no say in it. The preview has no server, so the choice has to live
 * somewhere — here, in session storage, set by the switcher in the banner.
 *
 * This file exists only in the preview build. Nothing in the product reads it.
 */
const KEY = 'marbella.previewDesk';

export type Desk = 'hr' | 'admin';

export const DESKS: ReadonlyArray<{ key: Desk; label: string; who: string }> = [
  { key: 'hr', label: 'HR desk', who: 'Pooja Dahiya · HR Manager' },
  { key: 'admin', label: 'Admin desk', who: 'Chairman · full company view' },
];

export function currentDesk(): Desk {
  try {
    const v = window.sessionStorage.getItem(KEY);
    return v === 'admin' ? 'admin' : 'hr';
  } catch {
    return 'hr';
  }
}

export function chooseDesk(desk: Desk): void {
  try {
    window.sessionStorage.setItem(KEY, desk);
  } catch {
    /* Private window. The picker still works for this page view. */
  }
  window.location.reload();
}
