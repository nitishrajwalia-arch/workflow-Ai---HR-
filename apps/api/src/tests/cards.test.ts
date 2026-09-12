/**
 * The card bureau.
 *
 * These tests exist because the two paths are deliberately unequal and that
 * inequality has to survive a modified browser. Every one of them sends a
 * request that a tampered front end could send, and checks the server refuses.
 */

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

let app: App;
let db: PrismaClient;
let token: string;

const SUBJECT = 'MB-ADM-0001';
const LEAVER = 'MB-PRJ-0002'; // A real, active person. The suite cares that they exist and
// have no card history, not who they are.

beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token } = await signIn(app));
  // Start from a known card history for the people this file touches, so the
  // version numbers asserted below mean what they say however often it runs.
  await db.card.deleteMany({ where: { personId: { in: [SUBJECT, 'MB-ADM-0002'] } } });
  await db.person.updateMany({
    where: { id: { in: [SUBJECT, 'MB-ADM-0002'] } },
    data: { status: 'active', exitedOn: null },
  });
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

const issue = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/v1/cards', headers: auth(token), payload });

const FULL_RECORD = {
  circumstances:
    'Left in a shared auto between Sector 22 and the site. Retraced the route, not found.',
  lastHeld: 'Yesterday evening, around 6pm',
  toldWho: 'Told R. Khanna the same evening',
  undertakings: [true, true, true, true, true],
};

describe('the fast path', () => {
  it('issues a first card without demanding the long form', async () => {
    const res = await issue({ pid: SUBJECT, reason: 'first', note: 'New joiner.' });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ card: { ver: number } }>().card.ver).toBe(1);
  });

  it('refuses a "damaged" swap that does not confirm the old card came back', async () => {
    // This is the exact request a browser with the checkbox removed would send.
    const res = await issue({
      pid: SUBJECT,
      reason: 'damaged',
      recv: 'Pooja Dahiya',
      killed: false,
    });
    expect(res.statusCode).toBe(422);
    const details = res.json<{ error: { details: Array<{ path: string }> } }>().error.details;
    expect(details.map((d) => d.path)).toContain('killed');
  });

  it('refuses a swap with nobody named as having taken the card back', async () => {
    const res = await issue({ pid: SUBJECT, reason: 'damaged', killed: true });
    expect(res.statusCode).toBe(422);
    expect(
      res.json<{ error: { details: Array<{ path: string }> } }>().error.details.map((d) => d.path),
    ).toContain('recv');
  });

  it('accepts a proper swap and cancels the previous version', async () => {
    const res = await issue({
      pid: SUBJECT,
      reason: 'damaged',
      recv: 'Pooja Dahiya',
      killed: true,
      note: 'Edge delaminated. Destroyed in front of the holder.',
    });
    expect(res.statusCode).toBe(201);
    const card = res.json<{ card: { ver: number; killed: string; zonesKilled: boolean } }>().card;
    expect(card.ver).toBe(2);
    expect(card.killed).toBe('v1');
    // The old card came back, so its zones do not need revoking separately.
    expect(card.zonesKilled).toBe(false);
  });
});

describe('the path for a card nobody can produce', () => {
  it('refuses "lost it" — a 25-character floor, enforced by the server', async () => {
    const res = await issue({
      pid: SUBJECT,
      reason: 'lost',
      circumstances: 'lost it',
      lastHeld: 'yesterday',
      toldWho: 'manager',
      undertakings: [true, true, true, true, true],
    });
    expect(res.statusCode).toBe(422);
    const msg = res
      .json<{ error: { details: Array<{ path: string; message: string }> } }>()
      .error.details.find((d) => d.path === 'circumstances')?.message;
    expect(msg).toMatch(/at least 25 characters/);
    expect(msg).toMatch(/You wrote 7/);
  });

  it('refuses four undertakings out of five', async () => {
    const res = await issue({
      pid: SUBJECT,
      reason: 'lost',
      ...FULL_RECORD,
      undertakings: [true, true, true, true, false],
    });
    expect(res.statusCode).toBe(422);
    expect(
      res
        .json<{ error: { details: Array<{ path: string; message: string }> } }>()
        .error.details.find((d) => d.path === 'undertakings')?.message,
    ).toMatch(/4 of 5/);
  });

  it('refuses an empty undertakings array, which is how a stripped form arrives', async () => {
    const res = await issue({ pid: SUBJECT, reason: 'lost', ...FULL_RECORD, undertakings: [] });
    expect(res.statusCode).toBe(422);
  });

  it('demands an FIR number when the card was stolen', async () => {
    const res = await issue({ pid: SUBJECT, reason: 'stolen', ...FULL_RECORD });
    expect(res.statusCode).toBe(422);
    expect(
      res.json<{ error: { details: Array<{ path: string }> } }>().error.details.map((d) => d.path),
    ).toContain('firNumber');
  });

  it('accepts the complete record and revokes the old card zones', async () => {
    const res = await issue({ pid: SUBJECT, reason: 'lost', ...FULL_RECORD });
    expect(res.statusCode).toBe(201);
    const card = res.json<{ card: { ver: number; zonesKilled: boolean } }>().card;
    expect(card.ver).toBe(3);
    // The old plastic still exists somewhere, so its access must actually die.
    expect(card.zonesKilled).toBe(true);
  });

  it('flags a pattern on a third card rather than refusing it', async () => {
    const res = await issue({
      pid: SUBJECT,
      reason: 'damaged',
      recv: 'Pooja Dahiya',
      killed: true,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ pattern: string | null }>().pattern).toMatch(/worth a conversation/i);
  });
});

describe('things a card must never do', () => {
  it('will not issue a card to someone who has left', async () => {
    // Nobody in the company's real roster has left, so this makes a leaver
    // rather than depending on one existing. It is put back afterwards.
    await db.person.update({
      where: { id: LEAVER },
      data: { status: 'exited', exitedOn: '01 Sep 2026' },
    });
    const res = await issue({ pid: LEAVER, reason: 'first' });
    await db.person.update({ where: { id: LEAVER }, data: { status: 'active', exitedOn: null } });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ error: { message: string } }>().error.message).toMatch(/has left the group/i);
  });

  it('will not take a version number from the client', async () => {
    // `ver` is not in the schema at all, and the schema is strict.
    const res = await issue({ pid: SUBJECT, reason: 'first', ver: 99 });
    expect(res.statusCode).toBe(400);
  });

  it('assigns one version per issue even when two requests race', async () => {
    const target = 'MB-ADM-0002';
    const [a, b, c] = await Promise.allSettled([
      issue({ pid: target, reason: 'first' }),
      issue({ pid: target, reason: 'first' }),
      issue({ pid: target, reason: 'first' }),
    ]);

    const created = [a, b, c].filter(
      (r) => r.status === 'fulfilled' && r.value.statusCode === 201,
    ).length;
    expect(created).toBeGreaterThanOrEqual(1);

    // Whatever raced, no two cards share a version. That is the unique index
    // doing its job, and it is why the version is not the client's to send.
    const cards = await db.card.findMany({ where: { personId: target } });
    const versions = cards.map((x) => x.ver);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('seals every issue into the ledger', async () => {
    const before = await db.ledgerEntry.count({ where: { kind: 'card', subject: SUBJECT } });
    await issue({ pid: SUBJECT, reason: 'faded', recv: 'Pooja Dahiya', killed: true });
    const after = await db.ledgerEntry.count({ where: { kind: 'card', subject: SUBJECT } });
    expect(after).toBe(before + 1);
  });

  it('is closed to anyone below HR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cards',
      payload: { pid: SUBJECT, reason: 'first' },
    });
    expect(res.statusCode).toBe(401);
  });
});
