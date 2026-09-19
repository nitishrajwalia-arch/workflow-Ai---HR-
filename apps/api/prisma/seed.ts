/**
 * Seed the database with Marbella Group as it actually is.
 *
 * Everything here comes from real-data.ts, generated from the two workbooks the
 * company supplied, and real-gaps.ts, generated from the data-gap workbook HR
 * filled in afterwards. The second is applied over the first and never the
 * other way round, so a field can always be traced to the sheet it came from.
 * There is no invented data in this file and no generated roster: what the
 * company sent is what goes in, and where it was silent the field stays empty.
 *
 * Run with `--wipe` to clear what is already there first. That path truncates
 * the ledger, which the database otherwise refuses — see wipe() below.
 */
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { DEPT_CODES, parseDisplayDate } from '@marbella/shared';
import { hashPassword } from '../src/lib/password.js';
import {
  REAL_COMPANIES,
  REAL_PENDING,
  REAL_PEOPLE,
  REAL_PROJECTS,
  REAL_UNITS,
} from './real-data.js';
import { LEAVE_POLICY, DEPT_HOURS } from './real-policy.js';
import {
  GAP_CONFLICTS,
  GAP_DEVICES,
  GAP_HOLIDAYS,
  GAP_HOURS,
  GAP_JDS,
  GAP_LEAVE,
  GAP_MERGES,
  GAP_PEOPLE,
  GAP_REDATED,
} from './real-gaps.js';
import {
  ATTENDANCE_HELD,
  ATTENDANCE_SOURCE,
  REAL_ATTENDANCE,
  REAL_BIOMETRIC,
} from './real-attendance.js';

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
      // The sortable twin of every display date. The API writes both forms on
      // every write and the schema says so; the seed wrote only the display
      // string, so all 126 real people had a NULL `joinedOn` and `dobOn` and
      // anything the database ordered by date saw an empty column.
      joinedOn: parseDisplayDate(p.joined),
      dob: p.dob,
      dobOn: parseDisplayDate(p.dob),
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
  console.log(`  people      ${REAL_PEOPLE.length}  (${noManager} the register puts under nobody)`);

  // Mentioned in the company's files but not on the master list. They get an ID
  // now and stay out of every count until somebody confirms them — see the note
  // on REAL_PENDING.
  // Two of the reserved IDs turned out to be a second copy of somebody already
  // on the payroll — same serial number, same row of every sheet in the source,
  // confirmed by the name HR corrected on the gap workbook. They are folded into
  // the real record below rather than left standing as people who do not exist.
  const merged = new Set(GAP_MERGES.map((m) => m.id));
  for (const p of REAL_PENDING) {
    if (merged.has(p.id)) continue;
    const data = {
      name: p.name,
      designation: p.designation || 'Not recorded',
      dept: p.dept,
      type: p.type,
      joined: p.joined || '',
      joinedOn: parseDisplayDate(p.joined || ''),
      dob: p.dob || null,
      dobOn: parseDisplayDate(p.dob || ''),
      status: 'pending' as const,
      growth: p.evidence,
      officeId: p.office,
      employerId: p.employer,
    };
    await prisma.person.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });
  }
  const stillPending = REAL_PENDING.filter((p) => !merged.has(p.id)).length;
  console.log(`  pending     ${stillPending}  (an ID reserved, not counted as staff)`);

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

  /* -------------------------------------- what HR filled in on the gap sheet */

  // Applied over the register above. A key that is absent was not answered, so
  // the field keeps whatever the register had; it is never blanked.
  let genders = 0;
  let emails = 0;
  let lines = 0;
  for (const g of GAP_PEOPLE) {
    const data: Record<string, unknown> = {};
    if (g.name) data.name = g.name;
    if (g.designation) data.designation = g.designation;
    // Corrections to the columns the sheet asked HR to CHECK rather than fill.
    // Both forms of a date go together, always — see the note in the schema.
    if (g.joined) {
      data.joined = g.joined;
      data.joinedOn = parseDisplayDate(g.joined);
    }
    if (g.dob) {
      data.dob = g.dob;
      data.dobOn = parseDisplayDate(g.dob);
    }
    if (g.office) data.officeId = g.office;
    if (g.gender) {
      data.gender = g.gender;
      genders++;
    }
    if (g.reportsTo) {
      data.reportsToId = g.reportsTo;
      data.reportsToNote = '';
      lines++;
    } else if (g.reportsToNote) {
      // Answering to a director, who is not on the payroll. The line is real
      // and belongs on the record; it just cannot be a foreign key.
      data.reportsToId = null;
      data.reportsToNote = g.reportsToNote;
      lines++;
    }
    if (Object.keys(data).length) await prisma.person.update({ where: { id: g.id }, data });

    // A key that is present and null is HR answering "there is no such thing" —
    // "Not Given" in the cell — which clears the field. A key that is absent was
    // not answered and leaves what is on file alone. Collapsing the two meant a
    // later revision could add a personal email but never remove a wrong one.
    const has = (k: 'email' | 'phone') => k in g;
    const pick = (k: 'email' | 'phone') => (g as Record<string, string | null>)[k] ?? '';
    if (has('email') || has('phone')) {
      const c = {
        ...(has('email') ? { email: pick('email') } : {}),
        ...(has('phone') ? { phone: pick('phone') } : {}),
      };
      await prisma.contact.upsert({
        where: { personId: g.id },
        create: { personId: g.id, phone: pick('phone'), email: pick('email') },
        update: c,
      });
      if (pick('email')) emails++;
    }
  }
  console.log(`  answered    ${genders} genders, ${emails} personal emails, ${lines} reporting lines`);
  if (GAP_REDATED.length) {
    console.log(`  corrected   ${GAP_REDATED.length} date or posting: ` +
      GAP_REDATED.map((d) => `${d.id} ${d.field} ${d.was} -> ${d.now}`).join('; '));
  }

  // The two reserved IDs, folded away. Whatever was filed under them in the
  // company's own workbook — a KYC record, an issued desktop — moves to the
  // person it turned out to belong to rather than disappearing with the row.
  for (const m of GAP_MERGES) {
    await prisma.person.deleteMany({ where: { id: m.id } });
    // The row goes; the number does not come back. Both IDs were printed against
    // a name in the workbooks the company was sent, so handing one to a new
    // joiner would put two different people on the same number on two documents.
    await prisma.retiredEmployeeId.upsert({
      where: { id: m.id },
      create: { id: m.id, reason: `Reserved for ${m.name}, who turned out to be ${m.into} ${m.as}.` },
      update: { reason: `Reserved for ${m.name}, who turned out to be ${m.into} ${m.as}.` },
    });
    const c = m.carries;
    if (c?.kind === 'kyc') {
      await prisma.kyc.upsert({
        where: { personId: m.into },
        create: { personId: m.into, aadhaar: c.aadhaar, pan: c.pan, address: c.address },
        update: { aadhaar: c.aadhaar, pan: c.pan, address: c.address },
      });
    } else if (c?.kind === 'device') {
      const have = await prisma.device.findFirst({ where: { personId: m.into, type: c.type } });
      if (!have) {
        await prisma.device.create({
          data: { personId: m.into, type: c.type, model: c.model, issued: c.issued },
        });
      }
    }
    console.log(`  merged      ${m.id} ${m.name} into ${m.into} ${m.as}` +
      (c ? `, carrying the ${c.kind === 'kyc' ? 'KYC record' : `${c.type.toLowerCase()} issued to them`}` : ''));
  }

  // IMEI and SIM against the devices already on record. Matched on the person
  // and the kind of device, because that pair is unique on the asset sheet.
  let tagged = 0;
  for (const d of GAP_DEVICES) {
    if (!d.imei && !d.sim && !d.returned) continue;
    const have = await prisma.device.findFirst({
      where: { personId: d.id, type: { equals: d.type, mode: 'insensitive' } },
    });
    if (!have) continue;
    await prisma.device.update({
      where: { id: have.id },
      data: { ...(d.imei ? { imei: d.imei } : {}), ...(d.sim ? { sim: d.sim } : {}) },
    });
    tagged++;
  }
  console.log(`  devices     ${tagged} given an IMEI or a SIM`);

  /* ------------------------------------------------- hours and leave rules */

  for (const [dept, r] of Object.entries(DEPT_HOURS)) {
    // The hours themselves are the shift the department actually works, from
    // the company's timings sheet. The working days, the grace period and the
    // name against the decision are what HR answered.
    const answered = GAP_HOURS[dept as keyof typeof GAP_HOURS];
    const rule = {
      ...r,
      ...(answered
        ? {
            days: answered.days,
            grace: answered.grace,
            setBy: answered.setBy,
            setOn: answered.setOn,
            note: [r.note, answered.note].filter(Boolean).join(' '),
          }
        : {}),
    };
    await prisma.deptRule.upsert({
      where: { dept },
      create: { dept, ...rule },
      update: rule,
    });
    // Sheet 3 was asked whether the rules differ by department and answered no,
    // so one set goes to all twelve.
    const leave = {
      ...LEAVE_POLICY,
      casual: GAP_LEAVE.casual,
      sick: GAP_LEAVE.sick,
      earned: GAP_LEAVE.earned,
      lateAfter: GAP_LEAVE.lateAfter,
      lateStrikes: GAP_LEAVE.lateStrikes,
      carryForward: GAP_LEAVE.carryForward,
      encashable: GAP_LEAVE.encashable,
      probation: GAP_LEAVE.probation,
      maternityWeeks: GAP_LEAVE.maternityWeeks,
      paternityDays: GAP_LEAVE.paternityDays,
      notice: GAP_LEAVE.notice,
      setBy: GAP_LEAVE.setBy,
      setOn: GAP_LEAVE.setOn,
    };
    await prisma.leavePolicy.upsert({
      where: { dept },
      create: { dept, ...leave },
      update: leave,
    });
  }
  console.log(`  hours       ${Object.keys(DEPT_HOURS).length} departments`);
  console.log(`  leave       ${GAP_LEAVE.casual} casual, ${GAP_LEAVE.sick} sick, ` +
    `${GAP_LEAVE.earned} earned, ${GAP_LEAVE.lateAfter}-minute grace — set by ` +
    `${GAP_LEAVE.setBy}, ${GAP_LEAVE.setOn}`);

  /* ------------------------------------------------------------- holidays */

  for (const h of GAP_HOLIDAYS) {
    const data = {
      onDate: new Date(`${h.onDate}T00:00:00Z`),
      allSites: h.allSites,
      closure: h.closure,
      note: h.note,
    };
    await prisma.holiday.upsert({
      where: { name_on: { name: h.name, on: h.on } },
      create: { name: h.name, on: h.on, ...data },
      update: data,
    });
  }
  console.log(`  holidays    ${GAP_HOLIDAYS.length}  (${GAP_HOLIDAYS.filter((h) => h.allSites).length} closing every site)`);

  /* ------------------------------------------------------------ attendance */

  // The machine's own roll number, matched to the employee once, by name. Every
  // export after this one joins on the number — which is the whole point, since
  // joining a new month on a NAME is how "Rohit" ends up credited to "Mohit".
  for (const b of REAL_BIOMETRIC) {
    await prisma.person.update({ where: { id: b.id }, data: { biometricId: b.code } });
  }
  for (const a of REAL_ATTENDANCE) {
    const data = { inAt: a.in, outAt: a.out, source: ATTENDANCE_SOURCE };
    await prisma.attendanceDay.upsert({
      where: { personId_date: { personId: a.personId, date: a.date } },
      create: { personId: a.personId, date: a.date, ...data },
      update: data,
    });
  }
  console.log(`  attendance  ${REAL_ATTENDANCE.length} days for ${REAL_BIOMETRIC.length} people — ${ATTENDANCE_SOURCE}`);
  if (ATTENDANCE_HELD.length) {
    console.log(`              ${ATTENDANCE_HELD.length} on the machine matched to nobody: ` +
      ATTENDANCE_HELD.map((h) => `${h.machineName} (#${h.code})`).join(', '));
  }

  /* ----------------------------------------------------- job descriptions */

  for (const j of GAP_JDS) {
    // HR wrote one paragraph per role. It goes in verbatim, as the purpose, and
    // the duties and requirements stay empty for whoever wants to break them
    // out. Splitting her sentences on their commas would read as a list of
    // duties and be a list of fragments.
    const jd = { purpose: j.jd, duties: [], needs: [] };
    await prisma.jobDescription.upsert({
      where: { dept_role: { dept: j.dept, role: j.role } },
      create: { dept: j.dept, role: j.role, jd, updatedBy: GAP_LEAVE.setBy },
      update: { jd, updatedBy: GAP_LEAVE.setBy },
    });
  }
  console.log(`  job descr.  ${GAP_JDS.length} of 68 titles`);

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

  /* ----------------------------------------- what nobody has answered yet */

  // The importers refuse to resolve a contradiction in the company's own
  // records. Printing them on a console nobody reads is not the same as telling
  // anybody, so each one becomes a task on the HR desk. `where` is the text
  // itself, so re-running the seed does not pile up twelve copies.
  const questions = [
    ...GAP_CONFLICTS,
    ...ATTENDANCE_HELD.map(
      (h) =>
        `Attendance machine #${h.code} records "${h.machineName}", who is not on the roster` +
        (h.candidates.length ? ` — closest names are ${h.candidates.join(', ')}` : '') +
        '. Nobody is being credited for those days.',
    ),
  ];
  for (const text of questions) {
    const have = await prisma.hrTask.findFirst({ where: { text } });
    if (!have) await prisma.hrTask.create({ data: { text, who: 'HR', due: '' } });
  }
  console.log(`  questions   ${questions.length} raised on the HR desk`);

  console.log('\nDone. No sample data was loaded.');
  const codes = Object.keys(DEPT_CODES).length;
  console.log(`${codes} departments, ${REAL_PEOPLE.length} people, ${REAL_UNITS.length} units.`);

  // Printed every run, deliberately. These are contradictions in the company's
  // own records that nobody has answered; the importer refuses to resolve them
  // and they are not worth less for being seen a second time.
  if (GAP_CONFLICTS.length) {
    console.log(`\n${GAP_CONFLICTS.length} things on the gap workbook that nobody has answered:`);
    for (const c of GAP_CONFLICTS) console.log(`  ! ${c}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
