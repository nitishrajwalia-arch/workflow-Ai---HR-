/**
 * Refresh tokens.
 *
 * Access tokens are short-lived JWTs, held in memory by the browser and never
 * written to localStorage — an XSS that can read localStorage has your session
 * for as long as the token lives.
 *
 * Refresh tokens are opaque random strings in an httpOnly, SameSite=Strict
 * cookie. We store only their SHA-256, so a database dump does not hand anyone a
 * working session. They ROTATE: spending one revokes it and issues the next.
 *
 * That rotation is what makes theft detectable. If a revoked token is presented
 * again, either the legitimate client or the thief is replaying it — and we
 * cannot tell which — so every token in that family is revoked and both parties
 * have to sign in again. Annoying once; far better than a silent stowaway.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const REFRESH_COOKIE = 'marbella_rt';

export const newRefreshToken = (): string => randomBytes(48).toString('base64url');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Compare two hex digests without leaking their difference through timing. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export const refreshExpiry = (days: number): Date =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

export function refreshCookieOptions(isProduction: boolean, days: number) {
  return {
    httpOnly: true,
    // Strict, not Lax: nothing in this app is meant to be reached by following a
    // link from somewhere else, so there is no flow this breaks.
    sameSite: 'strict' as const,
    // Only over HTTPS in production. Left off locally so http://localhost works.
    secure: isProduction,
    // Scoped to the refresh route: it is not sent with every ordinary request.
    path: '/api/v1/auth',
    maxAge: days * 24 * 60 * 60,
  };
}
