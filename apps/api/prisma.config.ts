/**
 * Prisma CLI configuration (Prisma 7).
 *
 * Only the CLI reads this — `migrate`, `db push`, `studio`, `generate`. The
 * running server never does: it builds its own pool in src/db.ts. Keeping them
 * separate means a migration can point at a different database (a shadow, a
 * restore) without touching the app.
 */
import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
    // Prisma builds each candidate migration here before touching the real
    // database. Leave unset locally and Prisma creates a temporary one.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
