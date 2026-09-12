/**
 * Bulk intake.
 *
 * Twenty good rows must not be lost because row eleven has a typo, and the
 * preview must be the truth — it runs the same code as the commit.
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

const run = (rows: unknown[], commit = false) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/imports/people',
    headers: auth(token),
    payload: { rows, commit },
  });

const good = (n: number) => ({
  name: `Import Test ${n}`,
  desig: 'Civil Engineer',
  dept: 'Project',
  office: 'Grand',
  joined: '05/06/2024',
  phone: '9814012345',
});

describe('validating before committing', () => {
  it('changes nothing when commit is false', async () => {
    const before = await db.person.count();
    const res = await run([good(1), good(2)], false);
    expect(res.statusCode).toBe(200);
    expect(res.json<{ committed: boolean }>().committed).toBe(false);
    expect(await db.person.count()).toBe(before);
  });

  it('holds back a bad row WITH A REASON and keeps the good ones', async () => {
    const res = await run([
      good(10),
      { ...good(11), joined: 'sometime last year' },
      { ...good(12), phone: '1234567890' },
      { ...good(13), email: 'someone@marbellagroup.in' },
      good(14),
    ]);

    const body = res.json<{
      accepted: Array<{ row: number }>;
      rejected: Array<{ row: number; field: string; reason: string }>;
    }>();

    expect(body.accepted.map((a) => a.row)).toEqual([1, 5]);
    expect(body.rejected).toHaveLength(3);

    const byField = Object.fromEntries(body.rejected.map((r) => [r.field, r.reason]));
    expect(byField.joined).toMatch(/not a date I can read/);
    expect(byField.phone).toMatch(/6, 7, 8 or 9/);
    // The company address is closed the day they leave, so it is not a contact.
    expect(byField.email).toMatch(/company account is closed/);
  });

  it('rejects an office nobody has, and says which ones exist', async () => {
    const res = await run([{ ...good(20), office: 'Mumbai' }]);
    const reason = res.json<{ rejected: Array<{ reason: string }> }>().rejected[0]?.reason ?? '';
    expect(reason).toMatch(/not a place we have/);
    expect(reason).toMatch(/Grand/);
  });

  it('rejects an employee ID that already belongs to someone', async () => {
    const res = await run([{ ...good(21), id: 'MB-HR-0001' }]);
    expect(res.json<{ rejected: Array<{ reason: string }> }>().rejected[0]?.reason).toMatch(
      /already belongs to someone/,
    );
  });
});

describe('committing', () => {
  it('writes the accepted rows and gives each a fresh ID', async () => {
    const before = await db.person.count();
    const res = await run([good(30), good(31), { ...good(32), joined: 'nonsense' }], true);

    const body = res.json<{
      accepted: Array<{ id: string; name: string }>;
      rejected: unknown[];
      committed: boolean;
    }>();

    expect(body.committed).toBe(true);
    expect(body.accepted).toHaveLength(2);
    expect(body.rejected).toHaveLength(1);
    expect(await db.person.count()).toBe(before + 2);

    for (const a of body.accepted) {
      expect(a.id).toMatch(/^MB-PRJ-\d{4}$/);
      const row = await db.person.findUniqueOrThrow({ where: { id: a.id } });
      expect(row.imported).toBe(true);
      // Date normalised on the way in, and its sortable twin written with it.
      expect(row.joined).toBe('05 Jun 2024');
      expect(row.joinedOn).not.toBeNull();
    }

    // Two rows in one sheet must not collide on an ID.
    expect(body.accepted[0]!.id).not.toBe(body.accepted[1]!.id);
  });

  it('seals one ledger entry per person imported', async () => {
    const before = await db.ledgerEntry.count({ where: { kind: 'join' } });
    const res = await run([good(40), good(41), good(42)], true);
    expect(res.json<{ accepted: unknown[] }>().accepted).toHaveLength(3);
    expect(await db.ledgerEntry.count({ where: { kind: 'join' } })).toBe(before + 3);
  });

  it('is closed to anyone who is not signed in', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/people',
      payload: { rows: [good(50)], commit: true },
    });
    expect(res.statusCode).toBe(401);
  });
});
