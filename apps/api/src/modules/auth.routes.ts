/**
 * Sign in, refresh, sign out, change password, manage accounts.
 *
 * Points worth knowing before you change anything here:
 *
 *  - A failed login says the same thing whether the address is unknown or the
 *    password is wrong. Distinguishing them hands an attacker a list of who
 *    works here.
 *  - An unknown address still costs a password verification. Answering instantly
 *    for unknown addresses and slowly for known ones is the same disclosure by
 *    another route.
 *  - Refresh tokens rotate, and replaying a spent one kills the whole family.
 *    See lib/tokens.ts for why.
 */

import { schemas } from '@marbella/shared';
import type { Role } from '@marbella/shared';
import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '../plugins/auth.js';
import { nowStamp } from '../lib/dates.js';
import { forbidden, tooMany, unauthorized } from '../lib/errors.js';
import { hashPassword, needsRehash, verifyPassword } from '../lib/password.js';
import {
  REFRESH_COOKIE,
  hashToken,
  newRefreshToken,
  refreshCookieOptions,
  refreshExpiry,
} from '../lib/tokens.js';
import { appendInTx } from '../services/ledger.js';

/**
 * A real Argon2 hash of a password nobody has.
 *
 * When the address is unknown we still verify against this, so an unknown
 * address costs the same time as a wrong password. It has to be a genuine hash:
 * a malformed one would be rejected in microseconds and give the timing away,
 * which is the whole thing we are avoiding. Computed once, lazily, on the first
 * failed login rather than at boot, so startup stays fast.
 */
let decoyHash: Promise<string> | null = null;
const getDecoyHash = (): Promise<string> => {
  decoyHash ??= hashPassword(randomUUID());
  return decoyHash;
};

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const { env, db } = app;
  const isProd = env.NODE_ENV === 'production';

  const issueTokens = async (user: {
    id: string;
    email: string;
    name: string;
    role: string;
    personId: string | null;
    employeeId: string | null;
    userKey: string;
    mustChangePassword: boolean;
  }) => {
    const accessToken = app.jwt.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      personId: user.personId,
      userKey: user.userKey,
    });
    const refreshToken = newRefreshToken();
    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiry(env.REFRESH_TOKEN_TTL_DAYS),
      },
    });
    return { accessToken, refreshToken };
  };

  const ttlSeconds = (() => {
    const m = env.ACCESS_TOKEN_TTL.match(/^(\d+)([smhd])$/);
    if (!m) return 900;
    const n = Number(m[1]);
    return { s: n, m: n * 60, h: n * 3600, d: n * 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
  })();

  /* ----------------------------------------------------------------- login */

  app.post(
    '/auth/login',
    {
      // A much tighter budget than the rest of the API: this is the route where
      // guessing is the threat, and ten tries a minute is generous for a human.
      config: { rateLimit: { max: env.RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Sign in',
        security: [],
        body: schemas.loginBody,
        response: { 200: schemas.authTokens, 401: schemas.errorBody, 429: schemas.errorBody },
      },
    },
    async (req, reply) => {
      const { identifier, password } = req.body;

      // An Employee ID (MB-PUR-0012) or an email. Site staff often have no
      // company email, so the ID is the primary way in.
      const looksLikeId = /^MB-[A-Za-z]{2,3}-\d{4}$/.test(identifier.trim());
      const user = looksLikeId
        ? await db.user.findUnique({ where: { employeeId: identifier.trim().toUpperCase() } })
        : await db.user.findUnique({ where: { email: identifier.trim().toLowerCase() } });

      if (!user) {
        // Same work, same wording, same timing as a wrong password.
        await verifyPassword(await getDecoyHash(), password);
        throw unauthorized('That Employee ID and password do not match an account.');
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        throw tooMany(
          `Too many wrong passwords. This account is locked for another ${mins} minute${mins === 1 ? '' : 's'}.`,
        );
      }

      const ok = await verifyPassword(user.passwordHash, password);

      if (!ok) {
        const failed = user.failedLogins + 1;
        const lock = failed >= env.LOGIN_MAX_ATTEMPTS;
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLogins: lock ? 0 : failed,
            lockedUntil: lock ? new Date(Date.now() + env.LOGIN_LOCKOUT_MINUTES * 60_000) : null,
          },
        });
        req.log.warn({ userId: user.id, failed }, 'failed login');
        throw unauthorized('That Employee ID and password do not match an account.');
      }

      if (user.disabledAt) throw forbidden('That account has been disabled.');

      // A successful login is the natural moment to upgrade an old hash: we
      // have the plaintext in hand exactly once.
      const rehash = needsRehash(user.passwordHash) ? await hashPassword(password) : undefined;

      await db.user.update({
        where: { id: user.id },
        data: {
          failedLogins: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          ...(rehash ? { passwordHash: rehash } : {}),
        },
      });

      const { accessToken, refreshToken } = await issueTokens(user);
      void reply.setCookie(
        REFRESH_COOKIE,
        refreshToken,
        refreshCookieOptions(isProd, env.REFRESH_TOKEN_TTL_DAYS),
      );

      return {
        accessToken,
        expiresIn: ttlSeconds,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          personId: user.personId,
          employeeId: user.employeeId,
          userKey: user.userKey,
          mustChangePassword: user.mustChangePassword,
        },
      };
    },
  );

  /* --------------------------------------------------------------- refresh */

  app.post(
    '/auth/refresh',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Exchange a refresh token for a new access token',
        security: [],
        // `.nullish()`, not `.optional()`: a POST with no body at all arrives as
        // `null`, and refreshing from a cookie is exactly that request.
        body: schemas.refreshBody.nullish(),
        response: { 200: schemas.authTokens, 401: schemas.errorBody },
      },
    },
    async (req, reply) => {
      const presented = req.body?.refreshToken ?? req.cookies[REFRESH_COOKIE];
      if (!presented) throw unauthorized('No refresh token.');

      const record = await db.refreshToken.findUnique({
        where: { tokenHash: hashToken(presented) },
        include: { user: true },
      });

      if (!record) throw unauthorized('That session is not recognised. Sign in again.');

      if (record.revokedAt) {
        // Someone is replaying a spent token. We cannot tell whether that is the
        // real client or a thief, so we end every session this user has and make
        // both sign in. See lib/tokens.ts.
        req.log.error({ userId: record.userId }, 'refresh token reuse — revoking all sessions');
        await db.refreshToken.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        void reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
        throw unauthorized(
          'That session was already used. Everyone signed in as you has been signed out.',
        );
      }

      if (record.expiresAt < new Date())
        throw unauthorized('That session has expired. Sign in again.');
      if (record.user.disabledAt) throw forbidden('That account has been disabled.');

      const { accessToken, refreshToken } = await issueTokens(record.user);
      const replacement = await db.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
        select: { id: true },
      });
      await db.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date(), replacedById: replacement?.id ?? null },
      });

      void reply.setCookie(
        REFRESH_COOKIE,
        refreshToken,
        refreshCookieOptions(isProd, env.REFRESH_TOKEN_TTL_DAYS),
      );

      return {
        accessToken,
        expiresIn: ttlSeconds,
        user: {
          id: record.user.id,
          email: record.user.email,
          name: record.user.name,
          role: record.user.role,
          personId: record.user.personId,
          employeeId: record.user.employeeId,
          userKey: record.user.userKey,
          mustChangePassword: record.user.mustChangePassword,
        },
      };
    },
  );

  /* ---------------------------------------------------------------- logout */

  app.post(
    '/auth/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign out of this session',
        security: [],
        response: { 200: schemas.okBody },
      },
    },
    async (req, reply) => {
      const presented = req.cookies[REFRESH_COOKIE];
      if (presented) {
        await db.refreshToken.updateMany({
          where: { tokenHash: hashToken(presented), revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      void reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      return { ok: true as const };
    },
  );

  /* ------------------------------------------------------------------- me */

  app.get(
    '/auth/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Who am I',
        response: { 200: schemas.sessionUser },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const user = await db.user.findUniqueOrThrow({ where: { id: me.sub } });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        personId: user.personId,
        employeeId: user.employeeId,
        userKey: user.userKey,
        mustChangePassword: user.mustChangePassword,
      };
    },
  );

  /* ------------------------------------------------------- change password */

  app.post(
    '/auth/change-password',
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Change your own password',
        body: schemas.changePasswordBody,
        response: { 200: schemas.okBody, 401: schemas.errorBody },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const { currentPassword, newPassword } = req.body;

      const user = await db.user.findUniqueOrThrow({ where: { id: me.sub } });
      if (!(await verifyPassword(user.passwordHash, currentPassword))) {
        throw unauthorized('That is not your current password.');
      }
      if (currentPassword === newPassword) {
        throw unauthorized('The new password is the same as the old one.');
      }

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
        });
        // Changing a password ends every other session. If the reason for the
        // change is that someone else had it, this is the part that matters.
        await tx.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await appendInTx(tx, {
          kind: 'auth',
          subject: user.id,
          detail: `${user.name} changed their password. All other sessions ended.`,
          who: user.name,
          at: nowStamp(),
        });
      });

      void reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      return { ok: true as const };
    },
  );

  /* --------------------------------------------------------- user accounts */

  app.get(
    '/auth/users',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['auth'],
        summary: 'List accounts',
        response: {
          200: z.array(
            schemas.sessionUser.extend({
              disabledAt: z.string().nullable(),
              lastLoginAt: z.string().nullable(),
            }),
          ),
        },
      },
    },
    async () => {
      const users = await db.user.findMany({ orderBy: { createdAt: 'asc' } });
      return users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        personId: u.personId,
        employeeId: u.employeeId,
        userKey: u.userKey,
        mustChangePassword: u.mustChangePassword,
        disabledAt: u.disabledAt?.toISOString() ?? null,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      }));
    },
  );

  app.post(
    '/auth/users',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['auth'],
        summary: 'Create an account',
        body: schemas.createUserBody,
        response: { 201: schemas.sessionUser, 409: schemas.errorBody },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const body = req.body;

      const user = await db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: body.email,
            name: body.name,
            passwordHash: await hashPassword(body.password),
            role: body.role as Role,
            personId: body.personId ?? null,
            employeeId: body.loginId ?? body.personId ?? null,
            userKey: body.userKey ?? 'viewer',
            // Whoever created the account knows the password. They should not
            // still know it tomorrow.
            mustChangePassword: true,
          },
        });
        await appendInTx(tx, {
          kind: 'auth',
          subject: created.id,
          detail: `Account created for ${created.email} with ${created.role} access.`,
          who: me.name,
        });
        return created;
      });

      return reply.status(201).send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        personId: user.personId,
        employeeId: user.employeeId,
        userKey: user.userKey,
        mustChangePassword: user.mustChangePassword,
      });
    },
  );

  app.patch(
    '/auth/users/:id',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['auth'],
        summary: 'Change an account role, or disable it',
        params: z.object({ id: z.string() }),
        body: z.object({
          role: schemas.role.optional(),
          disabled: z.boolean().optional(),
          /** Admin-set password. Forces a change at next sign-in. */
          password: z.string().min(12).max(200).optional(),
        }),
        response: { 200: schemas.sessionUser, 403: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { id } = req.params;
      const { role, disabled, password } = req.body;

      // Locking yourself out is a support call at best. Refuse it.
      if (id === me.sub && (disabled === true || (role && role !== 'ADMIN'))) {
        throw forbidden(
          'You cannot disable or demote your own account. Ask another administrator.',
        );
      }

      const user = await db.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id },
          data: {
            ...(role ? { role: role as Role } : {}),
            ...(disabled === undefined ? {} : { disabledAt: disabled ? new Date() : null }),
            ...(password
              ? { passwordHash: await hashPassword(password), mustChangePassword: true }
              : {}),
          },
        });
        if (disabled || password) {
          await tx.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        const changes = [
          role ? `role set to ${role}` : null,
          disabled === true ? 'account disabled' : disabled === false ? 'account re-enabled' : null,
          password ? 'password reset' : null,
        ].filter(Boolean);
        await appendInTx(tx, {
          kind: 'auth',
          subject: id,
          detail: `${updated.email}: ${changes.join(', ')}.`,
          who: me.name,
        });
        return updated;
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        personId: user.personId,
        employeeId: user.employeeId,
        userKey: user.userKey,
        mustChangePassword: user.mustChangePassword,
      };
    },
  );
};
