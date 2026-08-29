/**
 * The tamper-evident ledger.
 *
 * Every entry is sealed with SHA-256 over its own canonical payload plus the seal
 * of the entry before it. Change any past entry and its seal stops matching; because
 * the next entry's seal was computed over the broken one, re-sealing a single entry
 * does not repair the chain either. You have to rewrite the whole tail.
 *
 * WHAT CHANGED FROM THE BROWSER-ONLY BUILD, AND WHY IT MATTERS
 * ------------------------------------------------------------
 * The original README was honest that a browser ledger is tamper-EVIDENT, not
 * tamper-PROOF, and listed the three things real immutability needs. This build has
 * all three:
 *
 *   1. Storage on a server the user does not control  -> PostgreSQL behind the API.
 *   2. Append-only permissions at the database level  -> a BEFORE UPDATE OR DELETE
 *      trigger on ledger_entry raises an exception. See the migration
 *      `ledger_append_only`. This is not application logic that a bug can bypass:
 *      the database itself refuses.
 *   3. Fingerprints computed where the browser cannot reach -> seals are computed
 *      server-side only. The browser may VERIFY a chain (same function, below) but
 *      a seal it computes is never accepted; the API always recomputes.
 *
 * The hash is real SHA-256 now, not the 64-bit FNV pair the single-file build used.
 * That one was fine for spotting an accidental edit and far too short to stand up to
 * anyone deliberately looking for a collision.
 *
 * This runs identically in Node 22 and in the browser: both provide WebCrypto at
 * `globalThis.crypto.subtle`.
 */

export interface SealedEntry {
  /** Display stamp, e.g. "18 Jul 2026 - 10:12". Part of the sealed payload. */
  at: string;
  /** Human who caused it. Part of the sealed payload. */
  who: string;
  kind: string;
  /** Employee ID, department, company id - whatever the entry is about. */
  subject: string;
  detail: string;
  /** Seal of the entry before this one, or GENESIS for the first. */
  prev: string;
  /** SHA-256 hex, upper case. */
  seal: string;
}

export type UnsealedEntry = Omit<SealedEntry, 'prev' | 'seal'>;

export const GENESIS = 'GENESIS';

/**
 * Unit separator (U+001F). Not typeable, so it cannot appear inside a field and
 * shift the boundaries: without it, {who:'ab', kind:'c'} and {who:'a', kind:'bc'}
 * would hash identically.
 */
const SEP = '\u001F';

/**
 * The exact bytes that get hashed. Field order is part of the format: change it and
 * every seal ever written stops verifying. If you must add a field, append it and
 * bump LEDGER_FORMAT rather than inserting it in the middle.
 */
export const LEDGER_FORMAT = 1;

export function canonicalPayload(e: UnsealedEntry): string {
  return [e.at, e.who, e.kind, e.subject, e.detail].join(SEP);
}

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error(
      'WebCrypto is unavailable. Node 22+ provides it as globalThis.crypto; a browser only ' +
        'provides crypto.subtle on a secure origin (https, or localhost).',
    );
  }
  return c.subtle;
}

/** SHA-256 over `prev|payload`, hex, upper case. */
export async function fingerprint(payload: string, prev: string): Promise<string> {
  const digest = await subtle().digest('SHA-256', encoder.encode(`${prev}|${payload}`));
  return toHex(digest);
}

/** Seal one entry onto the head of a chain. */
export async function sealEntry(entry: UnsealedEntry, prev: string): Promise<SealedEntry> {
  const seal = await fingerprint(canonicalPayload(entry), prev);
  return { ...entry, prev, seal };
}

export type VerifyResult =
  | { ok: true; count: number; head: string }
  | {
      ok: false;
      /** Position in the ascending chain where it first breaks. */
      index: number;
      entry: SealedEntry;
      expected: string;
      reason: 'seal-mismatch' | 'broken-link';
      message: string;
    };

/**
 * Verify a chain given OLDEST FIRST.
 *
 * The UI holds the ledger newest-first for display; pass `[...ledger].reverse()`,
 * or use `verifyChainNewestFirst` below and let it do that for you.
 */
export async function verifyChain(ascending: SealedEntry[]): Promise<VerifyResult> {
  let prev = GENESIS;
  for (let i = 0; i < ascending.length; i++) {
    const e = ascending[i] as SealedEntry;
    if (e.prev !== prev) {
      return {
        ok: false,
        index: i,
        entry: e,
        expected: prev,
        reason: 'broken-link',
        message:
          `Entry ${i + 1} says it follows ${e.prev.slice(0, 12)} but the entry before it ` +
          `sealed as ${prev.slice(0, 12)}. An entry has been removed, reordered or inserted.`,
      };
    }
    const want = await fingerprint(canonicalPayload(e), prev);
    if (e.seal !== want) {
      return {
        ok: false,
        index: i,
        entry: e,
        expected: want,
        reason: 'seal-mismatch',
        message:
          `Entry ${i + 1} (${e.kind} / ${e.subject}) does not match its seal. Its contents have ` +
          `been changed since it was written.`,
      };
    }
    prev = e.seal;
  }
  return { ok: true, count: ascending.length, head: prev };
}

/** Same check for a newest-first list, which is how the UI holds it. */
export async function verifyChainNewestFirst(descending: SealedEntry[]): Promise<VerifyResult> {
  return verifyChain([...descending].reverse());
}
