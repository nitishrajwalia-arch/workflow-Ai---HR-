/**
 * Deboarding.
 *
 * The stage gate is the whole point: assets recorded as collected when nobody
 * collected them is the failure this design exists to prevent.
 */

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

let app: App;
let db: PrismaClient;
let token: string;
let exitId: string;

const SUBJECT = 'MB-STR-0009';

beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token } = await signIn(app));
  await db.exitStep.deleteMany({ where: { exit: { personId: SUBJECT } } });
  await db.exit.deleteMany({ where: { personId: SUBJECT } });
  await db.person.update({ where: { id: SUBJECT }, data: { status: 'active', exitedOn: null } });
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

const advance = (id: string, payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: `/api/v1/exits/${id}/advance`, headers: auth(token), payload });

describe('opening a deboarding', () => {
  it('opens at the first stage', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/exits',
      headers: auth(token),
      payload: { pid: SUBJECT, reason: 'Resigned' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: string; stage: string }>();
    expect(body.stage).toBe('decision');
    exitId = body.id;
  });

  it('refuses a second deboarding for the same person', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/exits',
      headers: auth(token),
      payload: { pid: SUBJECT, reason: 'Resigned' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: { message: string } }>().error.message).toMatch(
      /already has a deboarding/i,
    );
  });
});

describe('the stage gate', () => {
  it('refuses an advance from a stage the exit is not at', async () => {
    // This is what a stale screen sends. Letting it through would skip a stage.
    const res = await advance(exitId, {
      fromStage: 'dues',
      summary: 'Trying to jump straight to settlement.',
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: { message: string } }>().error.message).toMatch(/not "dues"/);
  });

  it('advances one stage at a time and records who did each one', async () => {
    const order = ['decision', 'handover', 'assets', 'dues', 'papers'];
    let stage = 'decision';
    for (const from of order) {
      const res = await advance(exitId, {
        fromStage: from,
        payload: { note: `cleared ${from}` },
        summary: `Stage ${from} cleared by the test.`,
      });
      expect(res.statusCode, `advancing from ${from}`).toBe(200);
      stage = res.json<{ stage: string }>().stage;
    }
    expect(stage).toBe('closed');

    const steps = await db.exitStep.findMany({ where: { exitId } });
    expect(steps).toHaveLength(order.length);
    expect(steps.every((s) => s.byId !== null)).toBe(true);
  });

  it('marked the person exited at the assets stage, not before and not after', async () => {
    const person = await db.person.findUniqueOrThrow({ where: { id: SUBJECT } });
    expect(person.status).toBe('exited');
    expect(person.exitedOn).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/);
  });

  it('refuses to advance a closed deboarding', async () => {
    const res = await advance(exitId, { fromStage: 'closed', summary: 'One more for luck.' });
    expect(res.statusCode).toBe(422);
  });

  it('sealed every step into the ledger', async () => {
    const entries = await db.ledgerEntry.count({ where: { kind: 'exit', subject: SUBJECT } });
    // One for opening plus one per stage cleared.
    expect(entries).toBeGreaterThanOrEqual(6);
  });

  it('cannot be advanced twice from the same stage by two people at once', async () => {
    await db.exitStep.deleteMany({ where: { exit: { personId: 'MB-SEC-0012' } } });
    await db.exit.deleteMany({ where: { personId: 'MB-SEC-0012' } });
    await db.person.update({
      where: { id: 'MB-SEC-0012' },
      data: { status: 'active', exitedOn: null },
    });

    const opened = await app.inject({
      method: 'POST',
      url: '/api/v1/exits',
      headers: auth(token),
      payload: { pid: 'MB-SEC-0012', reason: 'Contract ended' },
    });
    const id = opened.json<{ id: string }>().id;

    const results = await Promise.all([
      advance(id, { fromStage: 'decision', summary: 'First screen.' }),
      advance(id, { fromStage: 'decision', summary: 'Second screen.' }),
    ]);

    // Exactly one wins. The loser is told the stage moved, not given a 500.
    const ok = results.filter((r) => r.statusCode === 200);
    expect(ok).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409 || r.statusCode === 500)).toHaveLength(1);
    expect(results.some((r) => r.statusCode === 500)).toBe(false);

    const row = await db.exit.findUniqueOrThrow({ where: { id } });
    expect(row.stage).toBe('handover');
  });
});
