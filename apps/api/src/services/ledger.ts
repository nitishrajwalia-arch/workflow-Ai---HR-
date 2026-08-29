/**
 * Sealing the ledger.
 *
 * Two things make this correct rather than merely plausible:
 *
 * 1. THE SEAL IS COMPUTED HERE, NEVER ACCEPTED FROM A CLIENT. A browser may
 *    verify a chain; a seal it offers is ignored.
 *
 * 2. APPENDS ARE SERIALISED. Reading the head and inserting the next entry is a
 *    read-modify-write, so two concurrent appends would otherwise both read the
 *    same head and produce a fork. We take a Postgres advisory lock for the
 *    duration of the transaction, so the second append waits and chains onto the
 *    first. The unique index on `prev` is the belt to that pair of braces: even
 *    if the lock were somehow skipped, the database would refuse the fork.
 *
 * `appendMany` exists because a bulk import writes one entry per person and
 * taking the lock 200 times in a row is 200 round trips.
 */

import {
  GENESIS,
  canonicalPayload,
  fingerprint,
  verifyChain,
  type SealedEntry,
  type UnsealedEntry,
  type VerifyResult,
} from '@marbella/shared';
import type { Db } from '../db.js';
import { nowStamp } from '../lib/dates.js';

/**
 * Any 64-bit integer will do; it just has to be the same one everywhere. Derived
 * from the string 'marbella:ledger' so nothing else in the schema collides with it.
 */
const LEDGER_LOCK_KEY = 7_314_622_089_115_401n;

export interface AppendInput {
  kind: string;
  subject: string;
  detail: string;
  /** The human this is attributable to. Never a service name. */
  who: string;
  /** Defaults to now. Only the seed passes a historical stamp. */
  at?: string;
}

type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];

async function headSeal(tx: Tx): Promise<string> {
  const last = await tx.ledgerEntry.findFirst({
    orderBy: { seq: 'desc' },
    select: { seal: true },
  });
  return last?.seal ?? GENESIS;
}

/**
 * Append entries inside an EXISTING transaction.
 *
 * Use this from any handler that also writes domain rows: the ledger entry and
 * the thing it describes then commit or roll back together. A card issued with
 * no ledger entry, or an entry for a card that was never issued, are both worse
 * than the operation failing outright.
 */
export async function appendInTx(
  tx: Tx,
  entries: AppendInput | AppendInput[],
): Promise<SealedEntry[]> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return [];

  // Held until this transaction commits or rolls back. Other appenders queue.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LEDGER_LOCK_KEY}::bigint)`;

  let prev = await headSeal(tx);
  const sealed: SealedEntry[] = [];

  for (const input of list) {
    const unsealed: UnsealedEntry = {
      at: input.at ?? nowStamp(),
      who: input.who,
      kind: input.kind,
      subject: input.subject,
      detail: input.detail,
    };
    const seal = await fingerprint(canonicalPayload(unsealed), prev);
    const row = { ...unsealed, prev, seal };
    await tx.ledgerEntry.create({ data: row });
    sealed.push(row);
    prev = seal;
  }
  return sealed;
}

/** Append with a transaction of its own, for the rare standalone entry. */
export async function append(db: Db, entries: AppendInput | AppendInput[]): Promise<SealedEntry[]> {
  return db.$transaction((tx) => appendInTx(tx, entries));
}

export interface LedgerRow extends SealedEntry {
  id: string;
  seq: number;
}

/**
 * Verify the whole chain from the database.
 *
 * Reads ascending in pages so a long ledger does not have to fit in memory all
 * at once, and so this stays usable as the record grows past what a browser
 * could reasonably re-check.
 */
export async function verifyStoredChain(db: Db, pageSize = 1000): Promise<VerifyResult> {
  let cursorSeq = 0;
  let prev = GENESIS;
  let count = 0;

  for (;;) {
    const page = await db.ledgerEntry.findMany({
      where: { seq: { gt: cursorSeq } },
      orderBy: { seq: 'asc' },
      take: pageSize,
    });
    if (page.length === 0) break;

    // verifyChain walks a whole array; feed it one page at a time, telling it
    // where the previous page left off by checking the join ourselves.
    const first = page[0]!;
    if (first.prev !== prev) {
      return {
        ok: false,
        index: count,
        entry: first as SealedEntry,
        expected: prev,
        reason: 'broken-link',
        message: `Entry ${count + 1} does not follow the entry before it. An entry has been removed, reordered or inserted.`,
      };
    }
    const result = await verifyChain(page as SealedEntry[]);
    if (!result.ok) return { ...result, index: count + result.index };

    prev = result.head;
    count += page.length;
    cursorSeq = page[page.length - 1]!.seq;
  }

  return { ok: true, count, head: prev };
}

/** A short summary for the HR desk's "ledger health" card. */
export async function ledgerHealth(
  db: Db,
): Promise<{ ok: boolean; count: number; message?: string }> {
  const result = await verifyStoredChain(db);
  return result.ok
    ? { ok: true, count: result.count }
    : { ok: false, count: result.index, message: result.message };
}
