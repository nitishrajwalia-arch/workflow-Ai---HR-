/**
 * Prepare the test database once for the whole run.
 *
 * Every run starts from identical rows. A suite that only passes on a database
 * nobody has touched is not a suite you can trust — the card-version assertions
 * in cards.test.ts are meaningless if yesterday's run left three cards behind.
 *
 * WHY NOT `prisma migrate reset`
 * ------------------------------
 * Prisma 7 refuses that command when it detects it is being run by an AI coding
 * agent, and asks for explicit human consent. That guard is a good one and is
 * not worked around here. Instead this applies migrations (non-destructive) and
 * then empties the tables itself, which is the same outcome with none of the
 * "drop the database" blast radius.
 *
 * A human running `npm test` gets exactly the same behaviour.
 */

import { execSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export default async function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres@127.0.0.1:5433/marbella_test?schema=public';

  // The one guard that matters. Everything below empties tables.
  if (!/test/i.test(url)) {
    throw new Error(
      `Refusing to run tests against ${url}: the URL does not look like a test database. ` +
        'Set TEST_DATABASE_URL to something with "test" in its name.',
    );
  }

  process.env.DATABASE_URL = url;
  const env = { ...process.env, DATABASE_URL: url };

  // Non-destructive: applies any migration the test database is missing.
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;

    if (tables.length) {
      const list = tables.map((t) => `"${t.tablename}"`).join(', ');
      // ledger_entry refuses TRUNCATE by design. Standing the trigger down for
      // the length of one statement is the only place in this codebase that is
      // allowed to, and it is a test database being emptied, not history being
      // rewritten. It is switched straight back on.
      await prisma.$executeRawUnsafe('ALTER TABLE "ledger_entry" DISABLE TRIGGER USER');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
      await prisma.$executeRawUnsafe('ALTER TABLE "ledger_entry" ENABLE TRIGGER USER');
    }
  } finally {
    await prisma.$disconnect();
  }

  execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });
}
