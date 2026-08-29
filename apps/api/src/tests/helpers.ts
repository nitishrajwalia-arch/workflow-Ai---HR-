/**
 * Test harness.
 *
 * Every test drives a REAL app against a REAL PostgreSQL, through
 * `app.inject()` rather than a socket. No mocked database: a mocked Prisma would
 * only ever prove that the mock behaves as written, and every interesting rule
 * in this system — the append-only trigger, the unique index on card versions,
 * transaction rollback — lives in the database.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { buildApp, type App } from '../app.js';
import { loadEnv } from '../env.js';

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres@127.0.0.1:5433/marbella_test?schema=public';

export function testEnv() {
  return loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL,
    JWT_SECRET: 'test-secret-that-is-definitely-long-enough-to-pass-validation',
    LOG_LEVEL: 'silent',
    ENABLE_DOCS: 'false',
    // Generous, so a test that makes many calls does not trip the limiter and
    // fail for the wrong reason. The limiter itself is tested explicitly.
    RATE_LIMIT_MAX: '100000',
    RATE_LIMIT_AUTH_MAX: '100000',
    // The Chairman's override code. Set here so the override path is exercised
    // against a configured server; procurement.test.ts builds a second app
    // WITHOUT it to check what happens when nobody configured one.
    OVERRIDE_PIN: 'test-override-2417',
  } as NodeJS.ProcessEnv);
}

export function testDb(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
}

export async function makeApp(): Promise<{ app: App; db: PrismaClient }> {
  const db = testDb();
  const app = await buildApp({ env: testEnv(), db });
  return { app, db };
}

export const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'hr@marbellagroup.in';
export const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'DevPassword123!';

/**
 * Sign in and return the bearer token plus the refresh cookie.
 *
 * `identifier` is an Employee ID or an email — the login route takes either,
 * because on site people know their MB-PUR-0012 and not their mailbox.
 */
export async function signIn(
  app: App,
  identifier = ADMIN_EMAIL,
  password = ADMIN_PASSWORD,
): Promise<{ token: string; cookie: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { identifier, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Sign-in failed (${res.statusCode}): ${res.body}`);
  }
  const body = res.json<{ accessToken: string }>();
  const setCookie = res.headers['set-cookie'];
  const raw = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie ?? '');
  const match = raw.match(/marbella_rt=([^;]+)/);
  return { token: body.accessToken, cookie: match ? `marbella_rt=${match[1]}` : '' };
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });
