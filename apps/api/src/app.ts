/**
 * Builds the Fastify instance.
 *
 * Kept separate from server.ts so tests can build an app, drive it through
 * `app.inject()` and never open a socket. Everything the app needs is passed in;
 * nothing here reads process.env directly.
 */

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import underPressure from '@fastify/under-pressure';
import scalar from '@scalar/fastify-api-reference';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';

import { createDb, pingDb, type Db } from './db.js';
import { corsOrigins, type Env } from './env.js';
import { authPlugin } from './plugins/auth.js';
import { errorsPlugin } from './plugins/errors.js';
import { registerRoutes } from './routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    env: Env;
    /**
     * Every route that got registered, and whether it has an auth guard.
     *
     * Collected so a test can walk the whole surface and fail the build if a
     * route outside the explicit public list has no `preHandler`. Forgetting one
     * is the easiest mistake to make and the most expensive to discover in
     * production, so it is checked mechanically rather than by review.
     */
    routeTable: Array<{ method: string; url: string; guarded: boolean }>;
  }
}

export interface BuildOptions {
  env: Env;
  /** Tests pass their own client so they can wrap everything in a rollback. */
  db?: Db;
}

export type App = FastifyInstance<
  import('node:http').Server,
  import('node:http').IncomingMessage,
  import('node:http').ServerResponse,
  import('fastify').FastifyBaseLogger,
  ZodTypeProvider
>;

export async function buildApp({ env, db }: BuildOptions): Promise<App> {
  const app = Fastify({
    // Tests set LOG_LEVEL=silent, which suppresses the per-request lines without
    // the `disableRequestLogging` flag that Fastify 6 removes.
    logger: {
      level: env.LOG_LEVEL,
      ...(env.LOG_PRETTY
        ? {
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            },
          }
        : {}),
      // Never let a password, token or cookie reach the log. Redaction is
      // cheaper than an incident.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.newPassword',
          'req.body.currentPassword',
          'req.body.refreshToken',
        ],
        censor: '[redacted]',
      },
    },
    // Every request gets an id. It goes in the log line AND in any error body,
    // so a user quoting "the screen said req-8f2c" leads straight to the trace.
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? `req-${randomUUID().slice(0, 8)}`,
    trustProxy: env.TRUST_PROXY,
    // 413 rather than reading an unbounded body into memory.
    bodyLimit: 2 * 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  // Zod validates every request and serialises every response, and the same
  // schemas generate the OpenAPI document. One source of truth, no drift.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('env', env);
  app.decorate('db', db ?? createDb(env));
  app.decorate('routeTable', [] as Array<{ method: string; url: string; guarded: boolean }>);

  app.addHook('onRoute', (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      app.routeTable.push({
        method,
        url: route.url,
        guarded: route.preHandler !== undefined,
      });
    }
  });

  await app.register(errorsPlugin);

  await app.register(helmet, {
    // The API serves JSON and uploaded images, never HTML, so the strictest CSP
    // is free. The web app ships its own, tuned to what it actually loads.
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:'] },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cors, {
    origin: corsOrigins(env),
    // The refresh cookie has to be allowed through, so this cannot be `*` —
    // and a browser would refuse the combination anyway.
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie, { secret: env.JWT_SECRET });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    // Rate limit the user when we know who they are, the IP when we do not.
    // Otherwise a whole office behind one NAT shares a budget.
    keyGenerator: (req) => req.currentUser?.sub ?? req.ip,
    errorResponseBuilder: (_req, ctx) => ({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: `Too many requests. Try again in ${Math.ceil(ctx.ttl / 1000)} seconds.`,
      },
    }),
  });

  await app.register(multipart, {
    limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
  });

  // Sheds load with a 503 before the event loop is so far behind that every
  // request times out. A slow honest "not now" beats a fast dishonest hang.
  await app.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 1_000_000_000,
    message: 'The server is busy. Try again shortly.',
    retryAfter: 5,
    exposeStatusRoute: false,
  });

  await app.register(authPlugin, { env });

  if (env.ENABLE_DOCS) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Marbella HR API',
          version: '1.0.0',
          description:
            'The people system for Marbella Group. Every endpoint below is generated from ' +
            'the same Zod schemas the server validates with, so this document cannot drift ' +
            'from the implementation.',
        },
        servers: [{ url: '/', description: 'This server' }],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      transform: jsonSchemaTransform,
    });
    await app.register(scalar, { routePrefix: '/docs' });
  }

  await app.register(healthPlugin);
  await app.register(registerRoutes, { prefix: '/api/v1' });

  // Close the pool on shutdown so in-flight queries finish and Postgres does not
  // sit on abandoned connections.
  app.addHook('onClose', async (instance) => {
    await instance.db.$disconnect();
  });

  await app.ready();
  return app as App;
}

/**
 * Two health endpoints, because they answer different questions.
 *   /health/live  — is the process up? Never touches the database, so a database
 *                   outage does not make the orchestrator kill healthy pods.
 *   /health/ready — can it actually serve? Checks the database.
 */
const healthPlugin = fp(async function healthPlugin(app: FastifyInstance) {
  app.get('/health/live', { logLevel: 'warn' }, async () => ({
    status: 'live',
    uptime: Math.round(process.uptime()),
  }));

  app.get('/health/ready', { logLevel: 'warn' }, async (_req, reply) => {
    const dbOk = await pingDb(app.db);
    if (!dbOk) {
      return reply.status(503).send({ status: 'not-ready', database: 'unreachable' });
    }
    return { status: 'ready', database: 'ok' };
  });
});
