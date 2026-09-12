/**
 * Seed the database with Marbella Group as it actually is.
 *
 * Everything here comes from real-data.ts, which is generated from the two
 * workbooks the company supplied. There is no invented data in this file and
 * no generated roster: what the company sent is what goes in, and where the
 * company was silent the field stays empty.
 *
 * Run with `--wipe` to clear what is already there first. That path truncates
 * the ledger, which the database otherwise refuses — see wipe() below.
 */
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { DEPT_CODES } from '@marbella/shared';
import { hashPassword } from '../src/lib/password.js';
import { REAL_COMPANIES, REAL_PEOPLE, REAL_PROJECTS, REAL_UNITS } from './real-data.js';
import { LEAVE_POLICY, DEPT_HOURS } from './real-policy.js';

// Same as the server: load .env from apps/api if it is there. Node 22 has this
// built in, and it throws when the file is absent rather than when it matters.
try {
  process.loadEnvFile();
} catch {
  /* No .env — the variables are expected to come from the environment. */
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const WIPE = process.argv.includes('--wipe');

/**
 * Empty every table.
 *
 * The ledger has BEFORE DELETE and BEFORE TRUNCATE triggers precisely so that
 * history cannot be quietly rewritten, so clearing it means disabling them,
 * truncating, and putting them back — inside one transaction, so a failure
 * halfway cannot leave the table unprotected. This is the only place in the
 * codebase that does it, it is deliberate, and it is loud.
 */
async function wipe() {
  console.log('  wiping — including the append-only ledger, deliberately');
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`ALTER TABLE "ledger_entry" DISABLE TRIGGER USER`),
    prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`),
    prisma.$executeRawUnsafe(`ALTER TABLE "ledger_entry" ENABLE TRIGGER USER`),
  ]);
}

async function main() {
  console.log('Marbella Group — real company data\n');
  if (WIPE) await wipe();

  /* ------------------------------------------------------------ companies */

  for (const c of REAL_COMPANIES) {
    await prisma.company.upsert({
      where: { id: c.id },
      create: { id: c.id, name: c.name, kind: c.kind },
      update: { name: c.name, kind: c.kind },
    });
  }
  console.log(`  companies   ${REAL_COMPANIES.length}`);

  /* ------------------------------------------------- projects and offices */

  for (const p of REAL_PROJECTS) {
    await prisma.project.upsert({
      where: { id: p.id },
      create: { id: p.id, name: p.name, short: p.short, companyId: p.companyId },
      update: { name: p.name, short: p.short, companyId: p.companyId },
    });
    // One site office per project. Where people sit is not where the money
    // comes from, so these stay separate from Company above.
    await prisma.office.upsert({
      where: { id: p.id },
      create: { id: p.id, name: `${p.name} — Site Office`, short: p.short, projectId: p.id },
      update: { name: `${p.name} — Site Office`, short: p.short, projectId: p.id },
    });
    await prisma.firm.upsert({
      where: { id: p.id },
      create: { id: p.id, short: p.short, name: p.name, firm: p.firm },
      update: { short: p.short, name: p.name, firm: p.firm },
    });
  }
  console.log(`  projects    ${REAL_PROJECTS.length} (with a site office each)`);

  /* --------------------------------------------------------------- people */

  for (const p of REAL_PEOPLE) {
    const data = {
      name: p.name,
      designation: p.designation,
      dept: p.dept,
      type: p.type,
      joined: p.joined,
      dob: p.dob,
      shiftIn: p.shiftIn || '10:30',
      shiftOut: p.shiftOut || '18:30',
      officeId: p.office,
      employerId: p.employer,
    };
    await prisma.person.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });
  }

  // Reporting lines in a second pass: a manager has to exist before anyone can
  // be pointed at them.
  let placed = 0;
  for (const p of REAL_PEOPLE) {
    if (!p.reportsTo) continue;
    if (p.reportsTo === p.id) {
      throw new Error(`${p.id} (${p.name}) was given themselves as a manager.`);
    }
    await prisma.person.update({ where: { id: p.id }, data: { reportsToId: p.reportsTo } });
    placed++;
  }
  const noManager = REAL_PEOPLE.length - placed;
  console.log(`  people      ${REAL_PEOPLE.length}  (${noManager} with no manager recorded)`);

  /* --------------------------------------------- contact, KYC and assets  */

  let kyc = 0;
  let devices = 0;
  for (const p of REAL_PEOPLE) {
    if (p.phone) {
      await prisma.contact.upsert({
        where: { personId: p.id },
        create: { personId: p.id, phone: p.phone },
        update: { phone: p.phone },
      });
    }
    if (p.aadhaar || p.pan || p.address) {
      await prisma.kyc.upsert({
        where: { personId: p.id },
        create: { personId: p.id, aadhaar: p.aadhaar, pan: p.pan, address: p.address },
        update: { aadhaar: p.aadhaar, pan: p.pan, address: p.address },
      });
      kyc++;
    }
    // The asset sheet lists a computer and sometimes a handset. Each becomes a
    // device against the person, which is what the exit flow checks for return.
    if (p.computerType) {
      const have = await prisma.device.findFirst({
        where: { personId: p.id, type: p.computerType },
      });
      if (!have) {
        await prisma.device.create({
          data: {
            personId: p.id,
            type: p.computerType,
            model: p.computerModel,
            issued: p.assetHandover || '',
          },
        });
        devices++;
      }
    }
    if (p.phoneModel) {
      const have = await prisma.device.findFirst({ where: { personId: p.id, type: 'Phone' } });
      if (!have) {
        await prisma.device.create({
          data: {
            personId: p.id,
            type: 'Phone',
            model: p.phoneModel,
            issued: p.assetHandover || '',
          },
        });
        devices++;
      }
    }
  }
  console.log(`  contacts    ${REAL_PEOPLE.filter((p) => p.phone).length}`);
  console.log(`  KYC         ${kyc}  (Aadhaar / PAN / address — HR and above only)`);
  console.log(`  assets      ${devices}`);

  /* ------------------------------------------------- hours and leave rules */

  for (const [dept, r] of Object.entries(DEPT_HOURS)) {
    await prisma.deptRule.upsert({
      where: { dept },
      create: { dept, ...r },
      update: r,
    });
    await prisma.leavePolicy.upsert({
      where: { dept },
      create: { dept, ...LEAVE_POLICY },
      update: LEAVE_POLICY,
    });
  }
  console.log(`  hours       ${Object.keys(DEPT_HOURS).length} departments`);
  console.log(`  leave       company policy applied to every department`);

  /* -------------------------------------------------------------- residents */

  for (const u of REAL_UNITS) {
    await prisma.unit.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        tower: u.tower,
        address: u.address,
        phone1: u.phone1,
        phone2: u.phone2,
        email1: u.email1,
        email2: u.email2,
      },
      update: {
        tower: u.tower,
        address: u.address,
        phone1: u.phone1,
        phone2: u.phone2,
        email1: u.email1,
        email2: u.email2,
      },
    });
    for (const [i, a] of u.applicants.entries()) {
      await prisma.applicant.upsert({
        where: { unitId_seq: { unitId: u.id, seq: i + 1 } },
        create: { unitId: u.id, seq: i + 1, name: a.name, pan: a.pan },
        update: { name: a.name, pan: a.pan },
      });
    }
  }
  const towers = new Set(REAL_UNITS.map((u) => u.tower)).size;
  const applicants = REAL_UNITS.reduce((n, u) => n + u.applicants.length, 0);
  console.log(
    `  residents   ${REAL_UNITS.length} units in ${towers} towers, ${applicants} named applicants`,
  );

  /* ------------------------------------------------------- the first login */

  const existing = await prisma.user.count();
  if (existing === 0) {
    const hr = REAL_PEOPLE.find((p) => p.dept === 'HR');
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? randomBytes(9).toString('base64url');
    await prisma.user.create({
      data: {
        email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@marbellagroup.in',
        name: hr?.name ?? 'Administrator',
        role: 'ADMIN',
        passwordHash: await hashPassword(password),
        personId: hr?.id ?? null,
        // The ID people actually sign in with. Separate from personId because
        // an account can exist before, or without, a person record.
        employeeId: hr?.id ?? null,
        // Which set of screens they land on. The HR manager gets the HR desk;
        // every other department's desk is still to be decided, so nobody else
        // has an account yet.
        userKey: 'hr',
        mustChangePassword: true,
      },
    });
    console.log(`\n  FIRST LOGIN  ${hr?.id ?? 'admin@marbellagroup.in'}`);
    console.log(`  PASSWORD     ${password}`);
    console.log('  This is shown once. It must be changed at first sign-in.');
  } else {
    console.log(`  accounts    ${existing} already exist, none created`);
  }

  console.log('\nDone. No sample data was loaded.');
  const codes = Object.keys(DEPT_CODES).length;
  console.log(`${codes} departments, ${REAL_PEOPLE.length} people, ${REAL_UNITS.length} units.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
