/**
 * Authentication and authorisation.
 *
 * This is real access control, unlike the browser-side authorisation code the
 * single-file build used. That code stopped a colleague printing from someone
 * else's screen, which was worth having and was described honestly as not being
 * access control. This is the other thing: the server decides, and a modified
 * browser gains nothing.
 *
 * Two decorators come out of this plugin:
 *
 *   app.authenticate          — require a valid, non-disabled user
 *   app.requireRole('HR')     — require that, and a rank of at least HR
 *
 * Both are `preHandler` hooks. A route with neither is public, and that must be
 * a deliberate choice: see the audit test in src/tests/auth.test.ts, which fails
 * the build if a route outside the known-public list has no guard.
 */

import fastifyJwt from '@fastify/jwt';
import { roleAtLeast, type Role } from '@marbella/shared';
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import type { Env } from '../env.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
  personId: string | null;
  /**
   * Which desk they see. Read from the DATABASE on every request, not from the
   * token: a desk change must take effect at once, and a token minted fourteen
   * minutes ago must not still be able to assert the old one.
   */
  userKey: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    requireRole: (min: Role) => preHandlerHookHandler;
  }
  interface FastifyRequest {
    /** Present on any route behind `authenticate`. */
    currentUser?: AccessTokenPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

export const authPlugin = fp(async function authPlugin(app: FastifyInstance, opts: { env: Env }) {
  const { env } = opts;

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.ACCESS_TOKEN_TTL },
    // The refresh token lives in a cookie; the ACCESS token does not, so that a
    // stolen cookie alone cannot be replayed against the API.
  });

  /** Shared by both decorators so there is exactly one place this check happens. */
  async function establishUser(req: FastifyRequest): Promise<AccessTokenPayload> {
    try {
      await req.jwtVerify();
    } catch {
      throw unauthorized('Your session has expired. Sign in again.');
    }

    // The token may outlive the account. Check the account still exists and is
    // enabled on every request rather than trusting a token minted 14 minutes ago.
    const user = await app.db.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true, disabledAt: true, role: true, personId: true,
        email: true, name: true, userKey: true,
      },
    });
    if (!user) throw unauthorized('That account no longer exists.');
    if (user.disabledAt) throw forbidden('That account has been disabled.');

    // Trust the database over the token for anything a change should take effect
    // on immediately — a demotion must not wait for the token to expire.
    const current: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      personId: user.personId,
      userKey: user.userKey,
    };
    req.currentUser = current;
    return current;
  }

  app.decorate('authenticate', async function authenticate(req: FastifyRequest) {
    await establishUser(req);
  });

  app.decorate('requireRole', (min: Role): preHandlerHookHandler => {
    return async function requireRole(req: FastifyRequest) {
      const user = await establishUser(req);
      if (!roleAtLeast(user.role, min)) {
        throw forbidden(
          `This needs ${min} access or above. Your account is ${user.role}. ` +
            'Ask an administrator if that is wrong.',
        );
      }
    };
  });
});

/** The signed-in user, or a clear failure. Never returns undefined. */
export function requireUser(req: FastifyRequest): AccessTokenPayload {
  const u = req.currentUser;
  if (!u) throw unauthorized();
  return u;
}
