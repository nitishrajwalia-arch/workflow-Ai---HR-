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
      url: '/api/v1/people/MB-SEC-0007',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    const p = res.json<{ office: string; employer: string }>();
    // Gurpreet Singh sits at Marbella Grand but is paid by SRG. Two fields.
    expect(p.office).toBe('grand');
    expect(p.employer).toBe('srg');
  });

  it('filters, and paginates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people?dept=Store&pageSize=5',
      headers: auth(token),
    });
    const body = res.json<{ items: Array<{ dept: string }>; total: number }>();
    expect(body.items.length).toBeLessThanOrEqual(5);
    expect(body.items.every((p) => p.dept === 'Store')).toBe(true);
    expect(body.total).toBeGreaterThan(5);
  });

  it('finds someone by their employee ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people?q=MB-HR-0001',
      headers: auth(token),
    });
    expect(res.json<{ items: Array<{ name: string }> }>().items[0]?.name).toBe('Simran Kaur');
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

describe('changing who employs someone', () => {
  it('will not let it happen as an ordinary edit', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/people/MB-SEC-0007',
      headers: auth(token),
      payload: { employer: 'dpre' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { message: string } }>().error.message).toMatch(/written reason/);
  });

  it('demands a reason on the dedicated route', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/people/MB-SEC-0007/employer',
      headers: auth(token),
      payload: { employer: 'dpre' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('records the move, both companies by name, and the reason', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/people/MB-SEC-0012/employer',
      headers: auth(token),
      payload: { employer: 'dpre', reason: 'Moved onto the group payroll from 1 September.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ employer: string }>().employer).toBe('dpre');

    const entry = await db.ledgerEntry.findFirst({
      where: { subject: 'MB-SEC-0012', kind: 'person' },
      orderBy: { seq: 'desc' },
    });
    expect(entry?.detail).toMatch(/SRG Developers and Promoters/);
    expect(entry?.detail).toMatch(/Delhi Punjab Real Estates LLP/);
    expect(entry?.detail).toMatch(/Moved onto the group payroll/);

    await app.inject({
      method: 'POST',
      url: '/api/v1/people/MB-SEC-0012/employer',
      headers: auth(token),
      payload: { employer: 'srg', reason: 'Reverting the test.' },
    });
  });
});

describe('the org endpoint', () => {
  it('gives the manager chain and the direct reports', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/people/MB-SIT-0021/org',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ chain: Array<{ id: string }>; headcount: number }>();
    expect(body.chain.at(-1)?.id).toBe('MB-ADM-0001');
    expect(body.headcount).toBeGreaterThan(0);
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
        pid: 'MB-SEC-0007',
        company: 'dpre',
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
      payload: { tpl: 'appreciation', pid: 'MB-HR-0001', company: 'dpre', via: 'email' },
    });
    const body = res.json<{ delivered: boolean; deliveryNote: string }>();
    expect(body.delivered).toBe(false);
    expect(body.deliveryNote).toMatch(/Recorded, not sent/);
  });
});
