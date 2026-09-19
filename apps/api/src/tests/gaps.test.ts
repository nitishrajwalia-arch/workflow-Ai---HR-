/**
 * What HR's filled data-gap workbook put into the system, and the two things it
 * broke in doing so.
 *
 * The workbook answered a holiday calendar, seven leave rules the written policy
 * had deferred to a document that did not exist, a personal email and a
 * reporting line for everybody, and a job description for all 68 titles. Each
 * one of those needed somewhere to live, and two of the places it needed were
 * wrong before it arrived: a job description was keyed on the title alone, and a
 * reporting line could only be a foreign key.
 */

import type { PrismaClient } from '@prisma/client';
import { readJd } from '@marbella/shared';
import { REAL_PEOPLE } from '../../prisma/real-data.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

let app: App;
let db: PrismaClient;
let token: string;

beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token } = await signIn(app));
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

const boot = async () =>
  (await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: auth(token) })).json<{
    holidays: Array<{ name: string; on: string; allSites: boolean }>;
    leavePolicy: Record<string, Record<string, unknown>>;
    jds: Record<string, Record<string, { purpose: string }>>;
    people: Array<{ id: string; reportsTo: string | null; reportsToNote: string }>;
  }>();

describe('the holiday calendar', () => {
  it('is in the payload, soonest first', async () => {
    const { holidays } = await boot();
    expect(holidays.length).toBeGreaterThan(0);
    const names = holidays.map((h) => h.name);
    expect(names).toContain('Republic Day');
    // Sorted on the server by the sortable copy, not by the display string —
    // "02 Oct" sorts before "26 Jan" as text and after it as a date.
    const first = holidays[0]!;
    expect(first.on).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/);
  });

  it('records whether every site closes, rather than assuming it', async () => {
    const { holidays } = await boot();
    // The workbook came back with every row marked "NO". That is very likely the
    // column read the wrong way round, and it is flagged for HR — but it is
    // loaded as written, because the alternative is the software deciding.
    expect(holidays.every((h) => typeof h.allSites === 'boolean')).toBe(true);
  });
});

describe('the leave rules', () => {
  it('carries the seven the written policy left open, and who decided them', async () => {
    const { leavePolicy } = await boot();
    const hr = leavePolicy.HR!;
    expect(hr.casual).toBe(12);
    expect(hr.sick).toBe(6);
    expect(hr.earned).toBe(12);
    expect(hr.lateAfter).toBe(10);
    expect(hr.lateStrikes).toBe(3);
    expect(hr.carryForward).toBe(false);
    expect(hr.encashable).toBe(true);
    expect(hr.maternityWeeks).toBe(26);
    expect(hr.paternityDays).toBe(7);
    // A number on a screen with nobody's name against it is indistinguishable
    // from one somebody made up.
    expect(hr.setBy).toBeTruthy();
    expect(hr.setOn).toBeTruthy();
  });

  it('stamps who changed it from the session, not from the request body', async () => {
    const before = await db.leavePolicy.findUniqueOrThrow({ where: { dept: 'Pantry' } });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/leave-policy/Pantry',
      headers: auth(token),
      payload: {
        casual: 12,
        sick: 6,
        earned: 12,
        lateAfter: 10,
        // A client claiming somebody else decided this, last year.
        setBy: 'The Board',
        setOn: '01 Jan 2020',
      },
    });
    expect(res.statusCode).toBe(200);
    const after = await db.leavePolicy.findUniqueOrThrow({ where: { dept: 'Pantry' } });
    expect(after.setBy).not.toBe('The Board');
    expect(after.setOn).not.toBe('01 Jan 2020');

    await db.leavePolicy.update({ where: { dept: 'Pantry' }, data: before });
  });
});

describe('job descriptions', () => {
  it('keeps one title apart from the same title in another department', async () => {
    const { jds } = await boot();
    // "Assistant Manager" is three different jobs here. Accounts, Purchase and
    // Sales each wrote their own, and a key of the title alone meant whichever
    // was saved last replaced the other two.
    expect(jds.Accounts?.['Assistant Manager']?.purpose).toBeTruthy();
    expect(jds.Purchase?.['Assistant Manager']?.purpose).toBeTruthy();
    expect(jds.Accounts!['Assistant Manager']!.purpose).not.toBe(
      jds.Purchase!['Assistant Manager']!.purpose,
    );
  });

  it('saves the three fields the screen actually edits', async () => {
    // The screen has always posted { purpose, duties, needs }; the column was a
    // single string and the body schema demanded one, so every "Save this
    // description" was answered with a 400 and nothing was stored through it.
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/job-descriptions',
      headers: auth(token),
      payload: {
        dept: 'Pantry',
        role: 'Cook',
        jd: { purpose: 'Cook the food.', duties: ['Prepare meals'], needs: ['Food hygiene'] },
      },
    });
    expect(res.statusCode).toBe(200);
    const row = await db.jobDescription.findUniqueOrThrow({
      where: { dept_role: { dept: 'Pantry', role: 'Cook' } },
    });
    expect(readJd(row.jd)).toEqual({
      purpose: 'Cook the food.',
      duties: ['Prepare meals'],
      needs: ['Food hygiene'],
    });
  });

  it('does not fail the whole payload over one row in the wrong shape', async () => {
    // Free JSON on a column somebody can reach with psql. A row that will not
    // parse costs that one description, never the bootstrap request.
    expect(readJd('a bare string, from before the column was structured')).toEqual({
      purpose: '',
      duties: [],
      needs: [],
    });
    expect(readJd(null)).toEqual({ purpose: '', duties: [], needs: [] });
  });
});

describe('reporting lines', () => {
  it('lets somebody answer to a director without putting a director on the payroll', async () => {
    const { people } = await boot();
    const head = people.find((p) => p.id === 'MB-PRJ-0014')!;
    expect(head.reportsTo).toBeNull();
    expect(head.reportsToNote).toMatch(/Managing Director/);
    // And the directors did NOT become employees to make that line work: the
    // roster is still exactly the people on the company's own register. Other
    // suites add people to this same database, so this counts the seeded ones.
    const seeded = new Set(REAL_PEOPLE.map((p) => p.id));
    expect(people.filter((p) => seeded.has(p.id))).toHaveLength(REAL_PEOPLE.length);
    expect(people.some((p) => /director/i.test(p.id))).toBe(false);
  });

  it('leaves nobody without a line at all', async () => {
    const { people } = await boot();
    const seeded = new Set(REAL_PEOPLE.map((p) => p.id));
    const orphans = people.filter((p) => seeded.has(p.id) && !p.reportsTo && !p.reportsToNote);
    expect(orphans).toHaveLength(0);
  });

  it('never has somebody reporting to themselves', async () => {
    // Sheet 1 had two department heads pointing at their own employee ID. Sheet
    // 2 asked the same question properly and was taken as the answer.
    const { people } = await boot();
    expect(people.filter((p) => p.reportsTo === p.id)).toHaveLength(0);
  });
});

describe('the two reserved IDs the workbook struck off', () => {
  it('folds them into the person they turned out to be, and keeps what was filed under them', async () => {
    // MB-PRJ-0062 and MB-PRJ-0063 were IDs held for two people who appeared on
    // some sheets of the company file and not on the master list. Each sits on
    // the same row of every sheet as somebody already on the payroll, and HR's
    // corrections named them. Neither is a person any more.
    expect(await db.person.findMany({ where: { name: 'Ravinder Singh' } })).toHaveLength(0);
    const prems = await db.person.findMany({ where: { name: 'Prem Ranjan' } });
    expect(prems.map((p) => p.id)).toEqual(['MB-PRJ-0060']);

    // And neither number comes back. They were printed against a name in the
    // workbooks the company holds, so the next Project hire gets 0064.
    const retired = await db.retiredEmployeeId.findMany({ orderBy: { id: 'asc' } });
    expect(retired.map((r) => r.id)).toEqual(['MB-PRJ-0062', 'MB-PRJ-0063']);

    // The KYC record filed under one, and the desktop issued to the other, moved
    // with them rather than disappearing.
    const prem = await db.person.findUniqueOrThrow({
      where: { id: 'MB-PRJ-0060' },
      include: { kyc: true },
    });
    expect(prem.name).toBe('Prem Ranjan');
    expect(prem.kyc?.pan).toBeTruthy();

    const ravinder = await db.person.findUniqueOrThrow({
      where: { id: 'MB-PRJ-0036' },
      include: { devices: true },
    });
    expect(ravinder.name).toBe('Ravinder Bawa');
    expect(ravinder.devices.some((d) => d.type.toLowerCase() === 'desktop')).toBe(true);
  });
});
