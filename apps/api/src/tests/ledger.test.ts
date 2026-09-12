/**
 * The ledger, against a real PostgreSQL.
 *
 * The unit tests in @marbella/shared prove the hash chain behaves. These prove
 * the three things that only a real database can: that it refuses to be edited,
 * that concurrent writers cannot fork it, and that an operation and its ledger
 * entry commit or roll back together.
 */

import { GENESIS, canonicalPayload, fingerprint } from '@marbella/shared';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { fromLedgerTrigger } from '../plugins/errors.js';
import { append, verifyStoredChain } from '../services/ledger.js';
import { auth, makeApp, signIn } from './helpers.js';

let app: App;
let db: PrismaClient;
let token: string;

beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token } = await signIn(app));
  // The ledger starts empty now that no sample data is loaded, so these tests
  // write the entry they then try to tamper with. Attacking a real appended
  // entry is a better test than attacking one a seed happened to leave behind.
  if ((await db.ledgerEntry.count()) === 0) {
    await append(db, {
      kind: 'policy',
      subject: 'test',
      detail: 'Opening entry written by the test suite.',
      who: 'Test Suite',
    });
  }
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe('the ledger the database enforces', () => {
  it('verifies the seeded chain end to end', async () => {
    const result = await verifyStoredChain(db);
    expect(result.ok).toBe(true);
  });

  it('REFUSES an update, at the database, not in application code', async () => {
    const entry = await db.ledgerEntry.findFirstOrThrow({ orderBy: { seq: 'asc' } });
    await expect(
      db.ledgerEntry.update({ where: { id: entry.id }, data: { detail: 'rewritten' } }),
    ).rejects.toThrow(/append-only/i);

    // And the row is genuinely untouched.
    const after = await db.ledgerEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(after.detail).toBe(entry.detail);
  });

  it('REFUSES a delete', async () => {
    const entry = await db.ledgerEntry.findFirstOrThrow({ orderBy: { seq: 'asc' } });
    await expect(db.ledgerEntry.delete({ where: { id: entry.id } })).rejects.toThrow(
      /append-only/i,
    );
  });

  it('REFUSES a truncate, which bypasses row triggers', async () => {
    await expect(db.$executeRawUnsafe('TRUNCATE ledger_entry')).rejects.toThrow(/append-only/i);
  });

  it('REFUSES a forked chain: two entries cannot share a predecessor', async () => {
    const head = await db.ledgerEntry.findFirstOrThrow({ orderBy: { seq: 'desc' } });
    await expect(
      db.ledgerEntry.create({
        data: {
          at: '01 Jan 2027 · 00:00',
          who: 'Attacker',
          kind: 'join',
          subject: 'MB-XXX-0001',
          detail: 'A second branch of history.',
          prev: head.prev,
          seal: 'FORGED'.padEnd(64, '0'),
        },
      }),
    ).rejects.toThrow();
  });

  it('turns the refusal into an explainable answer, not a crash', async () => {
    // There is deliberately no route that edits the ledger, so the raw database
    // error is what any future code path would hit. Check that the error handler
    // turns it into something a person can act on rather than a 500.
    const entry = await db.ledgerEntry.findFirstOrThrow({ orderBy: { seq: 'asc' } });
    const err = await db.ledgerEntry
      .update({ where: { id: entry.id }, data: { detail: 'x' } })
      .catch((e: unknown) => e as Error);

    const mapped = fromLedgerTrigger(String((err as Error).message));
    expect(mapped).not.toBeNull();
    expect(mapped!.statusCode).toBe(409);
    expect(mapped!.code).toBe('LEDGER_APPEND_ONLY');
    expect(mapped!.message).toMatch(/appending a correcting one/i);
  });

  it('does not mistake an unrelated failure for a ledger refusal', () => {
    expect(fromLedgerTrigger('connection reset by peer')).toBeNull();
  });

  it('stays valid after an honest append', async () => {
    await append(db, {
      kind: 'policy',
      subject: 'Store',
      detail: 'Test append.',
      who: 'Test Runner',
    });
    expect((await verifyStoredChain(db)).ok).toBe(true);
  });

  it('does not fork under concurrent appends', async () => {
    const before = await db.ledgerEntry.count();

    // Twelve at once. Without the advisory lock these read the same head and
    // race; the unique index on `prev` would then reject most of them.
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        append(db, {
          kind: 'policy',
          subject: 'concurrency',
          detail: `Concurrent append ${i}.`,
          who: 'Test Runner',
        }),
      ),
    );

    expect(await db.ledgerEntry.count()).toBe(before + 12);
    const result = await verifyStoredChain(db);
    expect(result.ok).toBe(true);

    // Every entry links to exactly one predecessor.
    const all = await db.ledgerEntry.findMany({ orderBy: { seq: 'asc' } });
    const prevs = all.map((e) => e.prev);
    expect(new Set(prevs).size).toBe(prevs.length);
  });

  it('rolls the ledger entry back when the operation it describes fails', async () => {
    const before = await db.ledgerEntry.count();

    await expect(
      db.$transaction(async (tx) => {
        await tx.usageCounter.upsert({
          where: { key: 'rollback:test' },
          create: { key: 'rollback:test', count: 1 },
          update: { count: { increment: 1 } },
        });
        const { appendInTx } = await import('../services/ledger.js');
        await appendInTx(tx, {
          kind: 'policy',
          subject: 'rollback',
          detail: 'This must not survive.',
          who: 'Test Runner',
        });
        throw new Error('the operation failed after the entry was written');
      }),
    ).rejects.toThrow(/the operation failed/);

    // Neither the counter nor the entry survived. A ledger entry for something
    // that did not happen is worse than no ledger at all.
    expect(await db.ledgerEntry.count()).toBe(before);
    expect(await db.usageCounter.findUnique({ where: { key: 'rollback:test' } })).toBeNull();
    expect((await verifyStoredChain(db)).ok).toBe(true);
  });

  it('seals with real SHA-256 that anyone can recompute', async () => {
    const first = await db.ledgerEntry.findFirstOrThrow({ orderBy: { seq: 'asc' } });
    expect(first.prev).toBe(GENESIS);
    expect(first.seal).toBe(await fingerprint(canonicalPayload(first), GENESIS));
    expect(first.seal).toMatch(/^[0-9A-F]{64}$/);
  });

  it('reports its health over the API', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ledger/verify',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it('is not readable without signing in', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/ledger' })).statusCode).toBe(401);
  });
});
