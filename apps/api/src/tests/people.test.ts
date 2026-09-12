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

  it('starts with gender unrecorded, and keeps "not asked" apart from "would rather not say"', async () => {
    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/people/MB-ADM-0001',
      headers: auth(token),
    });
    // Nobody was asked during the import, so it is null — NOT 'undisclosed'.
    expect(before.json<{ gender: string | null }>().gender).toBeNull();

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
