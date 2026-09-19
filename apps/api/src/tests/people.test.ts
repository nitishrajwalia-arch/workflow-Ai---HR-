/**
 * People, and the rule that a project is not an employer.
 */

import type { PrismaClient } from '@prisma/client';
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

describe('reading people', () => {
  it('returns where they are posted AND who employs them, separately', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people/MB-ADM-0003',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    const p = res.json<{ office: string; employer: string }>();
    // Chenema Sharma sits at Marbella Grand and is paid by SRG. Two fields.
    expect(p.office).toBe('twin');
    expect(p.employer).toBe('srgmarb');
  });

  it('filters, and paginates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people?dept=Project&pageSize=5',
      headers: auth(token),
    });
    const body = res.json<{ items: Array<{ dept: string }>; total: number }>();
    expect(body.items.length).toBeLessThanOrEqual(5);
    expect(body.items.every((p) => p.dept === 'Project')).toBe(true);
    expect(body.total).toBeGreaterThan(5);
  });

  it('finds someone by their employee ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people?q=MB-HR-0001',
      headers: auth(token),
    });
    expect(res.json<{ items: Array<{ name: string }> }>().items[0]?.name).toBe('Pooja Dahiya');
  });

  it('rejects an employee ID that is not one', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people/NOT-AN-ID',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s for an ID that is well-formed but nobody has', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people/MB-PUR-9999',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('age and gender', () => {
  it('computes age in completed years from the date of birth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people/MB-ADM-0003',
      headers: auth(token),
    });
    const p = res.json<{ dob: string | null; age: number | null }>();
    expect(p.dob).toBeTruthy();
    // Whatever the seed holds, the age must agree with the date of birth it
    // was computed from. Recomputing here rather than asserting a literal is
    // the point: a literal would be wrong on somebody's birthday.
    const born = new Date(`${p.dob} 00:00:00 GMT`);
    const now = new Date();
    let expected = now.getUTCFullYear() - born.getUTCFullYear();
    if (
      now.getUTCMonth() < born.getUTCMonth() ||
      (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())
    ) {
      expected -= 1;
    }
    expect(p.age).toBe(expected);
  });

  it('reports no age rather than a wrong one when there is no date of birth', async () => {
    const kept = await db.person.findUniqueOrThrow({ where: { id: 'MB-ADM-0003' } });
    await db.person.update({ where: { id: 'MB-ADM-0003' }, data: { dob: null, dobOn: null } });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/people/MB-ADM-0003',
        headers: auth(token),
      });
      expect(res.json<{ age: number | null }>().age).toBeNull();
    } finally {
      // Other files read this person. Put them back whatever happens above.
      await db.person.update({
        where: { id: 'MB-ADM-0003' },
        data: { dob: kept.dob, dobOn: kept.dobOn },
      });
    }
  });

  it('keeps "not asked" apart from "would rather not say"', async () => {
    // HR has since gone and asked all 126 people, so the seed carries an answer
    // for everybody. What still has to hold is that clearing one puts it back to
    // "nobody has asked" rather than to "they declined to say" — the two mean
    // different things and HR reports on them separately.
    const cleared0 = await app.inject({
      method: 'PATCH',
      url: '/api/v1/people/MB-ADM-0001',
      headers: auth(token),
      payload: { gender: null },
    });
    expect(cleared0.json<{ gender: string | null }>().gender).toBeNull();

    const set = await app.inject({
      method: 'PATCH',
      url: '/api/v1/people/MB-ADM-0001',
      headers: auth(token),
      payload: { gender: 'undisclosed' },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json<{ gender: string | null }>().gender).toBe('undisclosed');

    const cleared = await app.inject({
      method: 'PATCH',
      url: '/api/v1/people/MB-ADM-0001',
      headers: auth(token),
      payload: { gender: null },
    });
    expect(cleared.json<{ gender: string | null }>().gender).toBeNull();

    // Other files read this person. Put back what the workbook says.
    await db.person.update({ where: { id: 'MB-ADM-0001' }, data: { gender: 'female' } });
  });

  it('refuses a gender it does not recognise', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/people/MB-ADM-0001',
      headers: auth(token),
      payload: { gender: 'inferred-from-the-name' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('changing who employs someone', () => {
  it('will not let it happen as an ordinary edit', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/people/MB-ADM-0003',
      headers: auth(token),
      payload: { employer: 'newmarb' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { message: string } }>().error.message).toMatch(/written reason/);
  });

  it('demands a reason on the dedicated route', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/people/MB-ADM-0003/employer',
      headers: auth(token),
      payload: { employer: 'newmarb' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('records the move, both companies by name, and the reason', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/people/MB-ADM-0002/employer',
      headers: auth(token),
      payload: { employer: 'newmarb', reason: 'Moved onto the group payroll from 1 September.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ employer: string }>().employer).toBe('newmarb');

    const entry = await db.ledgerEntry.findFirst({
      where: { subject: 'MB-ADM-0002', kind: 'person' },
      orderBy: { seq: 'desc' },
    });
    expect(entry?.detail).toMatch(/SRG Developers & Promoters/);
    expect(entry?.detail).toMatch(/New Marbella Developers And Promoters LLP/);
    expect(entry?.detail).toMatch(/Moved onto the group payroll/);

    await app.inject({
      method: 'POST',
      url: '/api/v1/people/MB-ADM-0002/employer',
      headers: auth(token),
      payload: { employer: 'srg', reason: 'Reverting the test.' },
    });
  });
});

describe('pending people', () => {
  const SUBJECT = 'MB-ADM-0004';

  const makePending = () =>
    db.person.update({
      where: { id: SUBJECT },
      data: { status: 'pending', designation: 'Not recorded', joined: '' },
    });

  const activate = (basis = 'Confirmed by their department head.') =>
    app.inject({
      method: 'POST',
      url: `/api/v1/people/${SUBJECT}/activate`,
      headers: auth(token),
      payload: { basis },
    });

  it('refuses to make somebody staff on a name alone, and says what is missing', async () => {
    const was = await db.person.findUniqueOrThrow({ where: { id: SUBJECT } });
    try {
      await makePending();
      const res = await activate();
      expect(res.statusCode).toBe(422);
      const body = res.json<{ error: { message: string; details: Array<{ path: string }> } }>();
      expect(body.error.details.map((d) => d.path).sort()).toEqual(['designation', 'joined']);
      // Still pending — a refusal must not half-apply.
      const after = await db.person.findUniqueOrThrow({ where: { id: SUBJECT } });
      expect(after.status).toBe('pending');
    } finally {
      await db.person.update({ where: { id: SUBJECT }, data: was });
    }
  });

  it('activates once the record is filled in, and seals why', async () => {
    const was = await db.person.findUniqueOrThrow({ where: { id: SUBJECT } });
    try {
      await makePending();
      await db.person.update({
        where: { id: SUBJECT },
        data: { designation: 'Rider', joined: '01 Apr 2023' },
      });
      const res = await activate('Confirmed by the site engineer.');
      expect(res.statusCode).toBe(200);
      expect(res.json<{ status: string }>().status).toBe('active');

      const last = await db.ledgerEntry.findFirst({ orderBy: { seq: 'desc' } });
      expect(last?.subject).toBe(SUBJECT);
      expect(last?.detail).toContain('Confirmed by the site engineer.');
    } finally {
      await db.person.update({ where: { id: SUBJECT }, data: was });
    }
  });

  it('will not activate somebody who is already staff', async () => {
    const res = await activate();
    expect(res.statusCode).toBe(409);
  });

  /**
   * The regression that prompted the dedicated route. Zod's `.partial()` does
   * not strip a `.default()`, so while `status` sat in the patch body carrying
   * `.default('active')`, ANY edit that never mentioned status still parsed to
   * `status: 'active'` — quietly putting a former employee back on the payroll.
   */
  it('does not change status as a side effect of an ordinary edit', async () => {
    const was = await db.person.findUniqueOrThrow({ where: { id: SUBJECT } });
    try {
      await db.person.update({
        where: { id: SUBJECT },
        data: { status: 'exited', exitedOn: '01 Sep 2026' },
      });
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/people/${SUBJECT}`,
        headers: auth(token),
        payload: { designation: 'Senior Rider' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ status: string; designation: string }>()).toMatchObject({
        designation: 'Senior Rider',
        status: 'exited',
      });
    } finally {
      await db.person.update({ where: { id: SUBJECT }, data: was });
    }
  });
});

describe('the org endpoint', () => {
  it('walks the manager chain up to the department head', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people/MB-PRJ-0002/org',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ chain: Array<{ id: string; reportsTo?: string | null }> }>();
    // The chain is the ancestors, not including the person themselves.
    expect(body.chain.length).toBeGreaterThanOrEqual(1);
    // The chain ends at the department head. There is no company-wide root:
    // the company has not recorded who its department heads report to, and the
    // system does not invent one.
    expect(body.chain.at(-1)?.id).toBe('MB-PRJ-0014');
    expect(body.chain.at(-1)?.reportsTo ?? null).toBeNull();
  });

  it('gives the department head their direct reports', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people/MB-PRJ-0014/org',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ headcount: number }>().headcount).toBeGreaterThan(0);
  });
});

describe('letters', () => {
  it("warns when the letterhead is not the person's employer", async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents',
      headers: auth(token),
      payload: {
        tpl: 'experience-certificate',
        pid: 'MB-ADM-0003',
        company: 'newmarb',
        via: 'print',
        subject: 'Experience certificate',
      },
    });
    expect(res.statusCode).toBe(201);
    // Not a refusal — HR may have a reason — but it must be said out loud.
    expect(res.json<{ warning: string | null }>().warning).toMatch(/employed by SRG/);
  });

  it('is honest that an emailed letter was not actually sent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents',
      headers: auth(token),
      payload: { tpl: 'appreciation', pid: 'MB-HR-0001', company: 'newmarb', via: 'email' },
    });
    const body = res.json<{ delivered: boolean; deliveryNote: string }>();
    expect(body.delivered).toBe(false);
    expect(body.deliveryNote).toMatch(/Recorded, not sent/);
  });
});
