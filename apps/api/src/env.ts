/**
 * Environment configuration.
 *
 * Every setting the server needs is declared here and validated once, at boot.
 * If something is missing or malformed the process exits immediately with a list
 * of exactly what is wrong — rather than starting happily and failing at 3am on
 * the first request that happens to need it.
 */

import { z } from 'zod';

const bool = z
  .string()
  .transform((v) => v === 'true' || v === '1' || v === 'yes')
  .pipe(z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  /** Postgres connections this process may hold. See docs/DEPLOYMENT.md. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  /**
   * Signs access tokens. 32+ characters of randomness.
   *   openssl rand -base64 48
   * Changing it logs everyone out, which is the correct response to a leak.
   */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),

  /** Comma-separated origins allowed to call the API with credentials. */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  /** Requests per minute per IP before the API starts refusing. */
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  /** A much tighter limit on the login route, where guessing is the threat. */
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(10),

  /** Wrong passwords in a row before the account is locked. */
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(8),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Human-readable logs. Never in production: the log shipper wants JSON. */
  LOG_PRETTY: bool.default(false),

  /** Where uploaded photos land. Swap the driver for S3 in src/modules/uploads. */
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .default(5 * 1024 * 1024),

  /** Serve /docs. Leave it on — an API nobody can read is an API nobody uses. */
  ENABLE_DOCS: bool.default(true),

  /** Set behind a load balancer so rate limiting sees the real client IP. */
  TRUST_PROXY: bool.default(false),

  /**
   * Seeded only when the database has no users at all. The seed prints the
   * password once and never again; the account must change it at first login.
   */
  BOOTSTRAP_ADMIN_EMAIL: z.string().default('hr@marbellagroup.in'),
  BOOTSTRAP_ADMIN_NAME: z.string().default('Simran Kaur'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    // Deliberately console, not the logger: the logger needs config to exist.
    console.error(`\nThe server cannot start. Fix these in your .env:\n${lines.join('\n')}\n`);
    throw new Error('Invalid environment configuration.');
  }
  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    if (env.LOG_PRETTY) console.warn('LOG_PRETTY is on in production; log shippers want JSON.');
    if (env.CORS_ORIGINS.includes('localhost'))
      console.warn('CORS_ORIGINS still lists localhost in production. Set it to the real origin.');
  }
  return env;
}

export const corsOrigins = (env: Env): string[] =>
  env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
