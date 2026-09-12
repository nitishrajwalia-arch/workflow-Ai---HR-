/**
 * The rules the yard actually runs on.
 *
 * Every refusal in this file is one a modified browser could try to talk its
 * way past, so each test sends the request the front end would send and checks
 * the SERVER says no — not the form. The prototype these screens came from
 * enforced all of this in React, which means it enforced none of it.
 *
 * The messages are asserted too, not just the status codes. A storeman reading
 * "422" learns nothing; "6 are held back by R. Khanna" tells them who to go
 * and ask.
 */

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../app.js';
import { auth, makeApp, signIn, testEnv } from './helpers.js';

type _env = ReturnType<typeof testEnv>;

let app: App;
let db: PrismaClient;
let token: string;

const STEEL = 'TMT 550D steel';
const CEMENT = 'OPC 53 cement';
const PROJ = 'Test Project';
const SALE_ID = 'SL-TEST-0001';
const ESCROW = 'BK-TEST-ESCROW';

/**
 * These tests build the world they need.
 *
 * They used to lean on whatever the seed happened to contain, which broke the
 * moment the invented data was replaced with the company's own — and would have
 * broken again on any real stock movement. A rule test should assert the rule,
 * not the fixtures somebody else loaded.
 */
beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token } = await signIn(app));

  await db.storageCap.deleteMany({ where: { item: { in: [STEEL, CEMENT] } } });
  await db.inventoryItem.deleteMany({ where: { item: { in: [STEEL, CEMENT] } } });
  await db.inventoryItem.createMany({
    data: [
      { item: STEEL, qty: 13.4, unit: 'T', proj: PROJ, loc: 'Steel bay' },
      { item: CEMENT, qty: 1240, unit: 'bags', proj: PROJ, loc: 'Yard shed' },
    ],
  });
  await db.storageCap.createMany({
    data: [
      {
        item: CEMENT,
        proj: PROJ,
        max: 2000,
        unit: 'bags',
        why: 'Yard shed holds no more; bags cake in the monsoon.',
      },
      { item: STEEL, proj: PROJ, max: 25, unit: 'T', why: 'Steel bay capacity.' },
    ],
  });

  await db.sale.deleteMany({ where: { id: SALE_ID } });
  await db.sale.create({
    data: {
      id: SALE_ID,
      unit: 'TEST-0001',
      proj: PROJ,
      buyer: 'A Test Buyer',
      price: BigInt(9_900_000_00),
    },
  });

  await db.bankAccount.deleteMany({ where: { id: ESCROW } });
  await db.bankAccount.create({
    data: {
      id: ESCROW,
      bank: 'Test Bank',
      acc: '0000',
      type: 'RERA escrow · Test',
      bal: BigInt(4_21_00_00_000),
    },
  });
});

afterAll(async () => {
  await db.hold.deleteMany({ where: { itemName: { in: [STEEL, CEMENT] } } });
  await db.storageCap.deleteMany({ where: { item: { in: [STEEL, CEMENT] } } });
  await db.inventoryItem.deleteMany({ where: { item: { in: [STEEL, CEMENT] } } });
  await db.sale.deleteMany({ where: { id: SALE_ID } });
  await db.bankAccount.deleteMany({ where: { id: ESCROW } });
  await app.close();
  await db.$disconnect();
});

/** Put the two items this file moves back where the seed left them. */
beforeEach(async () => {
  await db.hold.deleteMany({ where: { itemName: { in: [STEEL, CEMENT] } } });
  await db.inventoryItem.update({ where: { item: STEEL }, data: { qty: 13.4 } });
  await db.inventoryItem.update({ where: { item: CEMENT }, data: { qty: 1240 } });
});

const post = (url: string, payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: `/api/v1${url}`, headers: auth(token), payload });

const get = (url: string) =>
  app.inject({ method: 'GET', url: `/api/v1${url}`, headers: auth(token) });

const message = (res: { json: () => unknown }): string =>
  (res.json() as { error?: { message?: string } }).error?.message ?? '';

describe('stock that someone is holding back', () => {
  it('refuses to issue it, and names who to ask', async () => {
    const hold = await post('/holds', {
      item: STEEL,
      qty: 6,
      why: 'Booked for the Tower B raft pour on Thursday.',
    });
    expect(hold.statusCode).toBe(201);

    // 13.4 in the store, 6 held: 7.4 may leave. Asking for 9 must fail.
    const res = await post('/inventory/move', { dir: 'out', item: STEEL, qty: 9 });
    expect(res.statusCode).toBe(422);
    expect(message(res)).toMatch(/7\.4 T.*available/);
    expect(message(res)).toMatch(/6 are held back/);
    expect(message(res)).toMatch(/Ask them to release it first/);

    // And the stock did not move.
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { item: STEEL } })).qty).toBe(13.4);
  });

  it('lets the unheld remainder go out', async () => {
    await post('/holds', { item: STEEL, qty: 6, why: 'Raft pour on Thursday.' });
    const res = await post('/inventory/move', { dir: 'out', item: STEEL, qty: 7.4 });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ newQty: number }>().newQty).toBe(6);
  });

  it('does not leave a float tail in the quantity or the message', async () => {
    // 13.4 - 1 in binary floating point is 12.399999999999999. Nobody wants to
    // read that on a gate pass.
    const res = await post('/inventory/move', { dir: 'out', item: STEEL, qty: 1 });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ newQty: number }>().newQty).toBe(12.4);

    const refused = await post('/inventory/move', { dir: 'out', item: STEEL, qty: 99 });
    expect(message(refused)).toContain('12.4 T');
    expect(message(refused)).not.toContain('12.399999');
  });

  it('will not let more be held back than exists', async () => {
    const res = await post('/holds', {
      item: STEEL,
      qty: 20,
      why: 'Wishful thinking about next month.',
    });
    expect(res.statusCode).toBe(422);
    expect(message(res)).toMatch(/only 13\.4 T/i);
  });

  it('releases a hold, and the stock is issuable again', async () => {
    const hold = await post('/holds', { item: STEEL, qty: 6, why: 'Raft pour on Thursday.' });
    const id = hold.json<{ id: string }>().id;

    expect((await post('/inventory/move', { dir: 'out', item: STEEL, qty: 9 })).statusCode).toBe(
      422,
    );
    const released = await app.inject({
      method: 'DELETE',
      url: `/api/v1/holds/${id}`,
      headers: auth(token),
    });
    expect(released.statusCode).toBe(200);
    expect((await post('/inventory/move', { dir: 'out', item: STEEL, qty: 9 })).statusCode).toBe(
      201,
    );
  });
});

describe('what the yard can physically hold', () => {
  it('refuses a delivery that would go over the cap, and says why', async () => {
    // 1240 bags there, capped at 2000. 1500 more would make 2740.
    const res = await post('/inventory/move', { dir: 'in', item: CEMENT, qty: 1500 });
    expect(res.statusCode).toBe(422);
    expect(message(res)).toContain('capped at 2000 bags');
    expect(message(res)).toContain('would take it to 2740');
    expect(message(res)).toMatch(/override from the Chairman/i);
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { item: CEMENT } })).qty).toBe(1240);
  });

  it('accepts it once an override is attached, and seals who authorised it', async () => {
    const res = await post('/inventory/move', {
      dir: 'in',
      item: CEMENT,
      qty: 1500,
      override: "Chairman's override code",
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ newQty: number }>().newQty).toBe(2740);

    const sealed = await db.ledgerEntry.findFirst({
      where: { subject: CEMENT, kind: 'policy' },
      orderBy: { seq: 'desc' },
    });
    expect(sealed?.detail).toMatch(/cap overridden.*authorised by Chairman's override code/i);
  });

  it('lets a delivery under the cap through untouched', async () => {
    const res = await post('/inventory/move', { dir: 'in', item: CEMENT, qty: 100 });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ newQty: number }>().newQty).toBe(1340);
  });
});

describe('things that are not on the store list', () => {
  it('cannot be moved, held, or invented by typing a name', async () => {
    const moved = await post('/inventory/move', { dir: 'out', item: 'Unobtanium', qty: 1 });
    expect(moved.statusCode).toBe(404);
    expect(message(moved)).toContain('is not on the store list');

    const held = await post('/holds', { item: 'Unobtanium', qty: 1, why: 'A test of nothing.' });
    expect(held.statusCode).toBe(404);
  });
});

describe('the override code', () => {
  it('is checked on the server, and never sent to the browser', async () => {
    const pin = app.env.OVERRIDE_PIN;
    expect(pin).toBeTruthy();

    const wrong = await post('/override/verify', { code: '0000', what: 'a storage cap' });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.body).not.toContain(pin);

    const right = await post('/override/verify', { code: pin ?? '', what: 'a storage cap' });
    expect(right.statusCode).toBe(200);
    expect(right.json<{ authorisedBy: string }>().authorisedBy).toMatch(/override code/);
  });

  it('says so plainly when no code has been configured, rather than letting anything through', async () => {
    const { OVERRIDE_PIN: _omitted, ...withoutPin } = testEnv();
    const bare = await buildApp({ env: withoutPin as typeof _env, db });
    const { token: t } = await signIn(bare);
    const res = await bare.inject({
      method: 'POST',
      url: '/api/v1/override/verify',
      headers: auth(t),
      payload: { code: 'anything', what: 'a storage cap' },
    });
    expect(res.statusCode).toBe(403);
    expect(message(res)).toMatch(/No override code is configured/);
    await bare.close();
  });

  it('seals every attempt, including the refused ones', async () => {
    await post('/override/verify', { code: '9999', what: 'the cement cap' });
    const sealed = await db.ledgerEntry.findFirst({
      where: { kind: 'auth' },
      orderBy: { seq: 'desc' },
    });
    expect(sealed?.detail).toMatch(/Override REFUSED.*the cement cap/);
  });
});

describe('a unit is sold once', () => {
  it('refuses a second booking on a unit that is already sold', async () => {
    const existing = await db.sale.findUniqueOrThrow({ where: { id: SALE_ID } });
    const res = await post('/sales', {
      unit: existing.unit,
      proj: existing.proj,
      price: 9900000,
      buyer: 'Someone Else Entirely',
    });
    expect(res.statusCode).toBe(409);
    expect(message(res)).toContain(existing.buyer);
    expect(message(res)).toMatch(/Two bookings on one unit/);
  });
});

describe('RERA escrow money', () => {
  it('will not move without all three certifications', async () => {
    const escrow = await db.bankAccount.findFirstOrThrow({
      where: { type: { contains: 'escrow' } },
    });
    const res = await post(`/banks/${escrow.id}/withdrawal`, {
      amount: 100000,
      purpose: 'Slab work at Tower B.',
      certifications: { engineer: true, architect: false, ca: false },
    });
    expect(res.statusCode).toBe(422);
    expect(message(res)).toContain('missing architect, ca');
  });

  it('records the request with all three, and is honest that no bank was told', async () => {
    const escrow = await db.bankAccount.findFirstOrThrow({
      where: { type: { contains: 'escrow' } },
    });
    const res = await post(`/banks/${escrow.id}/withdrawal`, {
      amount: 100000,
      purpose: 'Slab work at Tower B.',
      certifications: { engineer: true, architect: true, ca: true },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ submittedToBank: boolean }>().submittedToBank).toBe(false);
    expect(res.json<{ note: string }>().note).toMatch(/NOT been submitted to the bank/);
  });

  it('will not draw more than the account holds', async () => {
    const escrow = await db.bankAccount.findFirstOrThrow({
      where: { type: { contains: 'escrow' } },
    });
    const res = await post(`/banks/${escrow.id}/withdrawal`, {
      amount: 99_00_00_000,
      purpose: 'Everything, all at once.',
      certifications: { engineer: true, architect: true, ca: true },
    });
    expect(res.statusCode).toBe(422);
    expect(message(res)).toMatch(/You cannot draw/);
  });

  it('holds a balance too big for a 32-bit column', async () => {
    // ₹4.21 crore in paise is 4_21_00_00_000 — six times what an INTEGER holds.
    // This is why every money column is BIGINT.
    const res = await get('/banks');
    expect(res.statusCode).toBe(200);
    const total = res.json<Array<{ bal: number }>>().reduce((s, b) => s + b.bal, 0);
    expect(total).toBeGreaterThan(21474836);
  });
});

describe('a payment reminder', () => {
  it('is drafted by one person and approved by another', async () => {
    const draft = await post('/reminders', {
      buyer: 'Aman Gill',
      phone: '+91 98140 00000',
      amount: 250000,
      due: '12/09/2026',
      note: 'Second instalment.',
    });
    expect(draft.statusCode).toBe(201);
    expect(draft.json<{ approved: boolean }>().approved).toBe(false);

    const id = draft.json<{ id: string }>().id;
    const mine = await app.inject({
      method: 'POST',
      url: `/api/v1/reminders/${id}/approve`,
      headers: auth(token),
    });
    // The drafter is the signed-in administrator; a second approval by the same
    // person is refused.
    expect(mine.statusCode).toBe(200);
    const again = await app.inject({
      method: 'POST',
      url: `/api/v1/reminders/${id}/approve`,
      headers: auth(token),
    });
    expect(again.statusCode).toBe(409);
    expect(message(again)).toMatch(/already approved/);

    await db.paymentReminder.deleteMany({ where: { id } });
  });
});

describe('none of it is readable without signing in', () => {
  it.each(['/inventory', '/holds', '/caps', '/purchase-orders', '/vendors', '/banks'])(
    '%s refuses an anonymous request',
    async (path) => {
      const res = await app.inject({ method: 'GET', url: `/api/v1${path}` });
      expect(res.statusCode).toBe(401);
    },
  );
});
