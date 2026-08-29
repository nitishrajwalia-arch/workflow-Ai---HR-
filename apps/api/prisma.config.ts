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
import { defineConfig } from 'prisma/config';

/*
 * `prisma generate` needs no database — it only reads the schema and writes a
 * client — but this file is loaded for EVERY prisma command, and `env()` throws
 * the moment it is. `npm ci` runs `prisma generate` through `prepare`, so on a
 * fresh clone, before anyone has written a .env, the very first command a new
 * developer runs would fail on a variable that command does not use.
 *
 * So: no throw here. If the URL is genuinely missing, the placeholder below
 * carries the reason in its own text, and any command that really does need a
 * database fails at connect time saying `DATABASE_URL-is-not-set`. Nothing is
 * weakened by this — src/env.ts still refuses to start the server without a
 * real URL, by name, before it serves a single request.
 */
const url =
  process.env.DATABASE_URL ??
  'postgresql://DATABASE_URL-is-not-set@localhost:1/DATABASE_URL-is-not-set';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url,
    // Prisma builds each candidate migration here before touching the real
    // database. Leave unset locally and Prisma creates a temporary one.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
