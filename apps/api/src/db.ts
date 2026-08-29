/**
 * The database client.
 *
 * Prisma 7 takes an explicit driver adapter rather than opening its own
 * connection. That is a good thing: the pool is ours, so we can size it to the
 * deployment instead of discovering the default at load.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { Env } from './env.js';

export type Db = PrismaClient;

export function createDb(env: Env): Db {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    // Fail fast rather than queue for ever behind an exhausted pool.
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });
}

/** True when the database answers. Used by /health/ready. */
export async function pingDb(db: Db): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
