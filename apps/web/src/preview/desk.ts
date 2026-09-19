/**
 * Which desk the preview is showing.
 *
 * The real application gets this from the server at sign-in: `user.userKey` is
 * the server's answer to "which screens does this account see", and the browser
 * has no say in it. There is no server here, so the answer is derived from the
 * Employee ID that was signed in with — see `deskFor` in ./desks.ts — and kept
 * for the length of the tab so a reload does not drop you somewhere else.
 *
 * This file exists only in the preview build. Nothing in the product reads it.
 */
const KEY = 'marbella.previewSession';

export interface PreviewSession {
  /** Which set of screens — the server's `userKey` in the product. */
  desk: string;
  /** The Employee ID signed in with, or a desk that has no employee behind it. */
  id: string;
  name: string;
  title: string;
  /** Null when the desk has no employee record — Management, and the gate. */
  personId: string | null;
}

const NOBODY: PreviewSession = {
  desk: 'hr',
  id: '',
  name: 'Preview',
  title: '',
  personId: null,
};

export function currentSession(): PreviewSession {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? { ...NOBODY, ...(JSON.parse(raw) as Partial<PreviewSession>) } : NOBODY;
  } catch {
    return NOBODY;
  }
}

export function rememberSession(s: PreviewSession): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* A private window. The session still holds for this page view. */
  }
}
