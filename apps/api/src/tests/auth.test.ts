/**
 * Authentication, and the guard audit.
 *
 * The last test in this file is the important one: it walks every registered
 * route and fails the build if one outside an explicit public list has no auth
 * guard. Forgetting a `preHandler` is the easiest possible mistake and the most
 * expensive; this makes it impossible to merge one.
 */

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { hashPassword } from '../lib/password.js';
import { ADMIN_EMAIL, ADMIN_PASSWORD, auth, makeApp, signIn } from './helpers.js';

let app: App;
let db: PrismaClient;

beforeAll(async () => {
  ({ app, db } = await makeApp());
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

const login = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/login', payload });

describe('signing in', () => {
  it('accepts the right password and returns a token plus an httpOnly cookie', async () => {
    const res = await login({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(res.statusCode).toBe(200);

    const body = res.json<{ accessToken: string; user: { role: string } }>();
    expect(body.accessToken).toBeTruthy();
    expect(body.user.role).toBe('ADMIN');

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('never returns the password hash', async () => {
    const res = await login({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(res.body).not.toMatch(/passwordHash|argon2/i);
  });

  it('says the same thing for a wrong password and an unknown address', async () => {
    // Distinguishing them would hand an attacker a list of who works here.
    const wrong = await login({ identifier: ADMIN_EMAIL, password: 'not-the-password' });
    const unknown = await login({ identifier: 'nobody@example.com', password: 'not-the-password' });

    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json<{ error: { message: string } }>().error.message).toBe(
      unknown.json<{ error: { message: string } }>().error.message,
    );
  });

  it('rejects a malformed body with field-level detail', async () => {
    const res = await login({ identifier: 'x' });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toMatch(/VALIDATION|BAD_REQUEST/);
  });
});

describe('the session', () => {
  it('rejects a request with no token', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me' })).statusCode).toBe(401);
  });

  it('rejects a forged token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: auth('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJoYWNrZXIifQ.bm90LWEtcmVhbC1zaWduYXR1cmU'),
    });
    expect(res.statusCode).toBe(401);
  });

  it('rotates the refresh token, and a spent one kills every session', async () => {
    const user = await db.user.create({
      data: {
        email: `rotate-${Date.now()}@example.com`,
        name: 'Rotation Test',
        passwordHash: await hashPassword('a-long-enough-password'),
        role: 'VIEWER',
      },
    });

    const { cookie } = await signIn(app, user.email, 'a-long-enough-password');

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie },
    });
    expect(first.statusCode).toBe(200);

    // Presenting the SAME token again is either a replay by the real client or
    // by a thief. We cannot tell which, so everyone is signed out.
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json<{ error: { message: string } }>().error.message).toMatch(/already used/i);

    const live = await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
    expect(live).toBe(0);

    await db.refreshToken.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  });

  it('locks an account after too many wrong passwords', async () => {
    const user = await db.user.create({
      data: {
        email: `lockout-${Date.now()}@example.com`,
        name: 'Lockout Test',
        passwordHash: await hashPassword('the-correct-password'),
        role: 'VIEWER',
      },
    });

    // The env used by tests keeps the default of 8 attempts.
    let last = await login({ identifier: user.email, password: 'wrong' });
    for (let i = 1; i < 8; i++) {
      last = await login({ identifier: user.email, password: 'wrong' });
    }
    expect(last.statusCode).toBe(401);

    // Even the RIGHT password is refused while the lock stands. That is the
    // point: an attacker who finds it on attempt nine still cannot get in.
    const correct = await login({ identifier: user.email, password: 'the-correct-password' });
    expect(correct.statusCode).toBe(429);
    expect(correct.json<{ error: { message: string } }>().error.message).toMatch(/locked/i);

    await db.user.delete({ where: { id: user.id } });
  });
});

describe('roles', () => {
  it('refuses a VIEWER the things only HR may do', async () => {
    const user = await db.user.create({
      data: {
        email: `viewer-${Date.now()}@example.com`,
        name: 'Viewer Test',
        passwordHash: await hashPassword('a-long-enough-password'),
        role: 'VIEWER',
      },
    });
    const { token } = await signIn(app, user.email, 'a-long-enough-password');

    const salaries = await app.inject({
      method: 'GET',
      url: '/api/v1/salaries',
      headers: auth(token),
    });
    expect(salaries.statusCode).toBe(403);

    // And the bootstrap payload gives them nothing either: a role check that
    // lives only in the browser is decoration.
    const boot = await app.inject({
      method: 'GET',
      url: '/api/v1/bootstrap',
      headers: auth(token),
    });
    expect(boot.statusCode).toBe(200);
    expect(boot.json<{ salaries: Record<string, unknown> }>().salaries).toEqual({});
    expect(boot.json<{ people: unknown[] }>().people.length).toBeGreaterThan(100);

    await db.refreshToken.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  });

  it('will not let an administrator lock themselves out', async () => {
    const { token } = await signIn(app);
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: auth(token) });
    const id = me.json<{ id: string }>().id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/auth/users/${id}`,
      headers: auth(token),
      payload: { disabled: true },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('every route is guarded', () => {
  /**
   * Routes that are deliberately reachable without signing in. Adding to this
   * list should be a conscious decision reviewed by a person, which is exactly
   * why the list lives in the test rather than being inferred.
   */
  const PUBLIC = new Set([
    'POST /api/v1/auth/login',
    'POST /api/v1/auth/refresh',
    'POST /api/v1/auth/logout',
    'GET /health/live',
    'GET /health/ready',
  ]);

  it('has no unguarded route outside the explicit public list', () => {
    expect(app.routeTable.length).toBeGreaterThan(20);

    const unguarded = app.routeTable
      .filter((r) => r.method !== 'HEAD' && r.method !== 'OPTIONS')
      .filter((r) => !r.url.startsWith('/docs'))
      .map((r) => ({ key: `${r.method} ${r.url}`, guarded: r.guarded }))
      .filter((r) => !PUBLIC.has(r.key) && !r.guarded)
      .map((r) => r.key);

    expect(unguarded, `These routes have no auth guard:\n  ${unguarded.join('\n  ')}`).toEqual([]);
  });

  it('the public list is not quietly rotting', () => {
    // If a route in PUBLIC no longer exists, the list is stale and the next
    // person reading it will trust something that is not true.
    const registered = new Set(app.routeTable.map((r) => `${r.method} ${r.url}`));
    for (const key of PUBLIC) {
      expect(registered.has(key), `${key} is listed as public but is not registered`).toBe(true);
    }
  });
});
