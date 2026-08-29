/**
 * Seed the database.
 *
 * Idempotent: run it as often as you like. Everything is an upsert keyed on the
 * real identifier, so a second run changes nothing. The one exception is the
 * ledger, which is append-only by construction — it is seeded once and skipped
 * thereafter, because rewriting it is precisely what the ledger exists to prevent.
 *
 *   npm run db:seed
 *
 * The bootstrap administrator is created only when there are no users at all.
 * Its password comes from BOOTSTRAP_ADMIN_PASSWORD, or is generated and printed
 * ONCE if that is unset. It must be changed at first sign-in.
 */

import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { GENESIS, canonicalPayload, fingerprint } from '@marbella/shared';
import { hashPassword } from '../src/lib/password.js';
import { buildRoster, type RosterPerson } from './roster.js';
import { seedProcurement } from './seed-procurement.js';
import {
  CARD_LOG_SEED,
  COMPANY_SEED,
  CONTACT_SEED,
  DEPT_RULES_SEED,
  DEVICE_SEED,
  EMPLOYER_SEED,
  LEAVE_SEED,
  OFFICES,
  ORG_SEED,
  PEOPLE_SEED,
  PROJECT_SEED,
  SAL_SEED,
} from './seed-data.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

/** Which project, if any, each office belongs to. Head Office belongs to none. */
const OFFICE_PROJECT: Record<string, string | null> = {
  hq: null,
  grand: 'grand',
  twin: 'twin',
  curo: 'curo',
  royce: 'royce',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function toDate(display: string | null | undefined): Date | null {
  if (!display) return null;
  const m = display.trim().match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[2] as string);
  if (mi < 0) return null;
  return new Date(Date.UTC(Number(m[3]), mi, Number(m[1])));
}

async function main() {
  console.log('Seeding Marbella HR...\n');

  /* ------------------------------------------------------------ companies */

  for (const c of COMPANY_SEED) {
    await prisma.company.upsert({
      where: { id: c.id },
      create: { id: c.id, name: c.name, kind: c.kind, gstin: c.gstin, pan: c.pan, addr: c.addr },
      update: { name: c.name, kind: c.kind, gstin: c.gstin, pan: c.pan, addr: c.addr },
    });
  }
  console.log(`  companies   ${COMPANY_SEED.length}`);

  /* ------------------------------------------------------------- projects */

  for (const p of PROJECT_SEED) {
    // The seed uses "exempt" where the schema enum says "na".
    const reraStatus = p.reraStatus === 'exempt' ? 'na' : p.reraStatus;
    await prisma.project.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        short: p.short,
        companyId: p.company,
        reraStatus,
        rera: p.rera,
        stage: p.stage,
        addr: p.addr,
      },
      update: {
        name: p.name,
        short: p.short,
        companyId: p.company,
        reraStatus,
        rera: p.rera,
        stage: p.stage,
        addr: p.addr,
      },
    });
  }
  console.log(`  projects    ${PROJECT_SEED.length}`);

  /* -------------------------------------------------------------- offices */

  for (const o of OFFICES) {
    await prisma.office.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        name: o.name,
        short: o.short,
        tint: o.tint,
        projectId: OFFICE_PROJECT[o.id] ?? null,
      },
      update: {
        name: o.name,
        short: o.short,
        tint: o.tint,
        projectId: OFFICE_PROJECT[o.id] ?? null,
      },
    });
  }
  console.log(`  offices     ${OFFICES.length}`);

  /* --------------------------------------------------------------- people */

  const named = (PEOPLE_SEED as RosterPerson[]).map((p) => ({
    ...p,
    office: p.office ?? ORG_SEED[p.id]?.office ?? 'hq',
    employer: p.employer ?? EMPLOYER_SEED[p.id] ?? 'dpre',
    // `?? ` would be wrong here: the Chairman's boss is deliberately null, and
    // `null ?? 'MB-ADM-0001'` would make him report to himself. Test for it in
    // src/tests/roster.test.ts.
    reportsTo:
      p.reportsTo !== undefined
        ? p.reportsTo
        : p.id in ORG_SEED
          ? ORG_SEED[p.id].boss
          : 'MB-ADM-0001',
  }));

  const all: RosterPerson[] = [...named, ...buildRoster()];

  // Two passes. Reporting lines point at other people, so nobody can be given a
  // manager until every row exists. Inserting in one pass would fail on the very
  // first person whose manager happens to come later in the list.
  for (const p of all) {
    const joined = toDate(p.joined);
    const dob = toDate(p.dob);
    await prisma.person.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        designation: p.designation,
        dept: p.dept,
        type: p.type,
        joined: p.joined,
        joinedOn: joined,
        dob: p.dob ?? null,
        dobOn: dob,
        status: p.status === 'exited' ? 'exited' : 'active',
        exitedOn: p.exitedOn ?? null,
        perf: p.perf ?? 75,
        growth: p.growth ?? '',
        officeId: p.office,
        employerId: p.employer,
      },
      update: { name: p.name, designation: p.designation, dept: p.dept },
    });
  }

  for (const p of all) {
    if (!p.reportsTo) continue;
    // Nobody manages themselves. A self-report renders the org board as a
    // detached node and silently breaks every headcount above it.
    if (p.reportsTo === p.id) {
      throw new Error(`${p.id} (${p.name}) was given themselves as a manager. Fix the seed.`);
    }
    await prisma.person.update({ where: { id: p.id }, data: { reportsToId: p.reportsTo } });
  }
  console.log(
    `  people      ${all.length} (${all.filter((p) => p.status !== 'exited').length} active)`,
  );

  /* ---------------------------------------------------------------- notes */

  for (const p of named) {
    if (!p.notes?.length) continue;
    const have = await prisma.personNote.count({ where: { personId: p.id } });
    if (have) continue;
    await prisma.personNote.createMany({
      data: p.notes.map((n: { when: string; text: string }) => ({
        personId: p.id,
        when: n.when,
        text: n.text,
      })),
    });
  }

  /* ------------------------------------------------- salaries / contacts */

  for (const [pid, s] of Object.entries(SAL_SEED) as Array<
    [string, Record<string, number | string>]
  >) {
    await prisma.salary.upsert({
      where: { personId: pid },
      create: {
        personId: pid,
        basic: Number(s.basic),
        hra: Number(s.hra),
        special: Number(s.special),
        pf: Number(s.pf),
        pt: Number(s.pt),
        note: String(s.note ?? ''),
      },
      update: {
        basic: Number(s.basic),
        hra: Number(s.hra),
        special: Number(s.special),
        pf: Number(s.pf),
        pt: Number(s.pt),
        note: String(s.note ?? ''),
      },
    });
  }

  // The generated roster carries a plausible basic pay; give everyone a structure
  // so the F&F screens have something real to compute against.
  for (const p of all) {
    if (!p._basic) continue;
    const basic = p._basic;
    await prisma.salary.upsert({
      where: { personId: p.id },
      create: {
        personId: p.id,
        basic,
        hra: Math.round(basic * 0.5),
        special: Math.round(basic * 0.25),
        pf: 1800,
        pt: 200,
        note: '',
      },
      update: {},
    });
  }

  for (const [pid, c] of Object.entries(CONTACT_SEED) as Array<[string, Record<string, unknown>]>) {
    await prisma.contact.upsert({
      where: { personId: pid },
      create: {
        personId: pid,
        phone: String(c.phone ?? ''),
        email: String(c.email ?? ''),
        vPhone: !!c.vPhone,
        vEmail: !!c.vEmail,
      },
      update: {
        phone: String(c.phone ?? ''),
        email: String(c.email ?? ''),
        vPhone: !!c.vPhone,
        vEmail: !!c.vEmail,
      },
    });
  }
  for (const p of all) {
    if (!p._phone) continue;
    await prisma.contact.upsert({
      where: { personId: p.id },
      create: { personId: p.id, phone: p._phone, email: '' },
      update: {},
    });
  }
  console.log('  salaries and contacts');

  /* -------------------------------------------------------------- devices */

  for (const d of DEVICE_SEED) {
    const exists = await prisma.device.findFirst({ where: { personId: d.pid, imei: d.imei } });
    if (exists) continue;
    await prisma.device.create({
      data: {
        personId: d.pid,
        type: d.type,
        model: d.model,
        imei: d.imei,
        sim: d.sim,
        issued: d.issued,
      },
    });
  }
  console.log(`  devices     ${DEVICE_SEED.length}`);

  /* ------------------------------------------------------------ policies */

  for (const [dept, r] of Object.entries(DEPT_RULES_SEED) as Array<
    [string, Record<string, unknown>]
  >) {
    await prisma.deptRule.upsert({
      where: { dept },
      create: {
        dept,
        in: String(r.in),
        out: String(r.out),
        hours: Number(r.hours),
        days: String(r.days),
        grace: Number(r.grace),
        setBy: String(r.setBy),
        note: String(r.note ?? ''),
      },
      update: {
        in: String(r.in),
        out: String(r.out),
        hours: Number(r.hours),
        days: String(r.days),
        grace: Number(r.grace),
        setBy: String(r.setBy),
        note: String(r.note ?? ''),
      },
    });
  }
  for (const [dept, l] of Object.entries(LEAVE_SEED) as Array<[string, Record<string, unknown>]>) {
    await prisma.leavePolicy.upsert({
      where: { dept },
      create: {
        dept,
        casual: Number(l.casual),
        sick: Number(l.sick),
        earned: Number(l.earned),
        halfDay: String(l.halfDay ?? ''),
        lateAfter: Number(l.lateAfter),
      },
      update: {
        casual: Number(l.casual),
        sick: Number(l.sick),
        earned: Number(l.earned),
        halfDay: String(l.halfDay ?? ''),
        lateAfter: Number(l.lateAfter),
      },
    });
  }
  console.log('  department clocks and leave');

  /* ----------------------------------------------------------------- cards */

  for (const c of [...CARD_LOG_SEED].reverse()) {
    const exists = await prisma.card.findFirst({ where: { personId: c.pid, ver: c.ver } });
    if (exists) continue;
    await prisma.card.create({
      data: {
        personId: c.pid,
        name: c.name,
        ver: c.ver,
        reason: c.reason,
        at: c.at,
        by: c.by,
        recv: c.recv,
        note: c.note ?? '',
        killed: c.killed ? `v${c.ver - 1}` : null,
        zonesKilled: !!c.zonesKilled,
      },
    });
  }
  console.log(`  cards       ${CARD_LOG_SEED.length}`);

  /* ---------------------------------------------------------------- ledger */

  // Append-only, so this runs exactly once. If entries already exist we leave
  // them alone rather than trying to "fix" a chain that is already sealed.
  const ledgerCount = await prisma.ledgerEntry.count();
  if (ledgerCount === 0) {
    const rows = [
      {
        at: '10 Feb 2021 · 09:00',
        who: 'Nitish Walia',
        kind: 'join',
        subject: 'MB-HR-0001',
        detail: 'Simran Kaur joined as HR Head.',
      },
      {
        at: '14 Mar 2020 · 09:00',
        who: 'Nitish Walia',
        kind: 'join',
        subject: 'MB-PUR-0012',
        detail: 'R. Khanna joined as Purchase Manager.',
      },
      {
        at: '18 Jul 2026 · 10:12',
        who: 'Simran Kaur',
        kind: 'card',
        subject: 'MB-SEC-0007',
        detail: 'Card v2 issued — damaged replacement.',
      },
      {
        at: '02 Jul 2026 · 16:40',
        who: 'Simran Kaur',
        kind: 'card',
        subject: 'MB-PUR-0018',
        detail: 'Card v2 issued — previous card lost.',
      },
      {
        at: '01 Aug 2026 · 11:20',
        who: 'Simran Kaur',
        kind: 'policy',
        subject: 'Store',
        detail: 'Working hours set 08:00–18:00 by S. Verma.',
      },
    ];
    let prev = GENESIS;
    for (const r of rows) {
      const seal = await fingerprint(canonicalPayload(r), prev);
      await prisma.ledgerEntry.create({ data: { ...r, prev, seal } });
      prev = seal;
    }
    console.log(`  ledger      ${rows.length} sealed`);
  } else {
    console.log(`  ledger      ${ledgerCount} entries already sealed, left alone`);
  }

  /* ---------------------------------------------------- bootstrap account */

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'hr@marbellagroup.in';
    const name = process.env.BOOTSTRAP_ADMIN_NAME ?? 'Simran Kaur';
    const generated = !process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');

    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
        personId: (await prisma.person.findUnique({ where: { id: 'MB-HR-0001' } }))?.id ?? null,
        mustChangePassword: true,
      },
    });

    console.log('\n  ─────────────────────────────────────────────────────────');
    console.log('  Administrator account created.');
    console.log(`    email     ${email}`);
    console.log(`    password  ${password}`);
    if (generated)
      console.log('  This password is shown ONCE and is not stored anywhere in plain text.');
    console.log('  It must be changed at first sign-in.');
    console.log('  ─────────────────────────────────────────────────────────\n');
  } else {
    console.log(`  accounts    ${userCount} already exist, none created`);
  }

  /* ------------------------------------------------- procurement and the rest */

  // MarbellaProcurementOS.jsx contains the HR system above as a subset, and
  // adds procurement, the gate, accounts, sales and the calendar on top.
  await seedProcurement(prisma, {
    defaultPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeThisAtFirstSignIn!',
    announce: (line) => console.log(line),
  });

  console.log('Done.\n');
}

main()
  .catch((err: unknown) => {
    console.error('\nSeed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
