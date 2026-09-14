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

describe('updating people already on the roster', () => {
  const update = (rows: unknown[], commit = false) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/imports/people/update',
      headers: auth(token),
      payload: { rows, commit },
    });

  it('matches on the employee ID and says which fields a row will touch', async () => {
    const res = await update([{ id: 'MB-HR-0001', gender: 'Female', email: 'her@gmail.com' }]);
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      accepted: Array<{ id: string; fields: string[] }>;
      committed: boolean;
    }>();
    expect(body.committed).toBe(false);
    expect(body.accepted[0]!.id).toBe('MB-HR-0001');
    expect(body.accepted[0]!.fields).toEqual(['gender', 'email']);
  });

  it('holds back a row for somebody who is not on the roster', async () => {
    const body = (await update([{ id: 'MB-PUR-9999', gender: 'F' }])).json<{
      accepted: unknown[];
      rejected: Array<{ field: string }>;
    }>();
    expect(body.accepted).toHaveLength(0);
    expect(body.rejected[0]!.field).toBe('id');
  });

  it('holds back a gender it cannot place rather than guessing at it', async () => {
    const body = (await update([{ id: 'MB-HR-0001', gender: 'probably a woman' }])).json<{
      accepted: unknown[];
      rejected: Array<{ field: string }>;
    }>();
    expect(body.accepted).toHaveLength(0);
    expect(body.rejected[0]!.field).toBe('gender');
  });

  it('holds back the same person listed twice in one sheet', async () => {
    const body = (
      await update([
        { id: 'MB-HR-0001', gender: 'F' },
        { id: 'MB-HR-0001', gender: 'M' },
      ])
    ).json<{ accepted: unknown[]; rejected: Array<{ field: string }> }>();
    expect(body.accepted).toHaveLength(1);
    expect(body.rejected[0]!.field).toBe('id');
  });

  it('refuses a manager nobody has, so a typo cannot orphan somebody', async () => {
    const body = (await update([{ id: 'MB-HR-0001', reportsTo: 'MB-ADM-0009' }])).json<{
      accepted: unknown[];
      rejected: Array<{ field: string }>;
    }>();
    expect(body.accepted).toHaveLength(0);
    expect(body.rejected[0]!.field).toBe('reportsTo');
  });

  it('leaves a field alone when its cell is blank, instead of clearing it', async () => {
    const before = await db.person.findUniqueOrThrow({ where: { id: 'MB-ADM-0002' } });
    try {
      await update([{ id: 'MB-ADM-0002', gender: 'Male', email: 'him@gmail.com' }], true);
      // A second sheet carrying ONLY the gender column must not wipe the email.
      await update([{ id: 'MB-ADM-0002', gender: 'Prefers not to say' }], true);

      const after = await db.person.findUniqueOrThrow({
        where: { id: 'MB-ADM-0002' },
        include: { contact: true },
      });
      expect(after.gender).toBe('undisclosed');
      expect(after.contact?.email).toBe('him@gmail.com');
    } finally {
      await db.contact.deleteMany({ where: { personId: 'MB-ADM-0002', email: 'him@gmail.com' } });
      await db.person.update({
        where: { id: 'MB-ADM-0002' },
        data: { gender: before.gender },
      });
    }
  });

  it('seals a ledger entry naming what was filled in', async () => {
    const before = await db.ledgerEntry.count();
    try {
      await update([{ id: 'MB-ADM-0002', gender: 'Other' }], true);
      expect(await db.ledgerEntry.count()).toBe(before + 1);
      const last = await db.ledgerEntry.findFirst({ orderBy: { seq: 'desc' } });
      expect(last?.subject).toBe('MB-ADM-0002');
      expect(last?.detail).toContain('gender');
    } finally {
      await db.person.update({ where: { id: 'MB-ADM-0002' }, data: { gender: null } });
    }
  });

  it('treats a row that repeats what we already hold as no change at all', async () => {
    const before = await db.person.findUniqueOrThrow({
      where: { id: 'MB-ADM-0002' },
      include: { contact: true },
    });
    try {
      await update([{ id: 'MB-ADM-0002', gender: 'Male' }], true);
      const entries = await db.ledgerEntry.count();

      // The collection sheet comes back pre-filled, so the same value arrives
      // again on the next upload. It must not be written, logged, or counted.
      const again = (await update([{ id: 'MB-ADM-0002', gender: 'Male' }], true)).json<{
        accepted: unknown[];
        unchanged: number;
      }>();
      expect(again.accepted).toHaveLength(0);
      expect(again.unchanged).toBe(1);
      expect(await db.ledgerEntry.count()).toBe(entries);
    } finally {
      await db.person.update({
        where: { id: 'MB-ADM-0002' },
        data: { gender: before.gender },
      });
    }
  });

  it('is closed to anyone who is not signed in', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/people/update',
      payload: { rows: [{ id: 'MB-HR-0001', gender: 'F' }], commit: true },
    });
    expect(res.statusCode).toBe(401);
  });
});
