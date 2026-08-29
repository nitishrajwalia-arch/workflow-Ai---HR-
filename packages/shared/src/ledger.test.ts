import { describe, expect, it } from 'vitest';
import {
  GENESIS,
  canonicalPayload,
  fingerprint,
  sealEntry,
  verifyChain,
  verifyChainNewestFirst,
  type SealedEntry,
  type UnsealedEntry,
} from './ledger.js';

const rows: UnsealedEntry[] = [
  {
    at: '10 Feb 2021 - 09:00',
    who: 'Nitish Walia',
    kind: 'join',
    subject: 'MB-HR-0001',
    detail: 'Simran Kaur joined as HR Head.',
  },
  {
    at: '14 Mar 2020 - 09:00',
    who: 'Nitish Walia',
    kind: 'join',
    subject: 'MB-PUR-0012',
    detail: 'R. Khanna joined as Purchase Manager.',
  },
  {
    at: '18 Jul 2026 - 10:12',
    who: 'Simran Kaur',
    kind: 'card',
    subject: 'MB-SEC-0007',
    detail: 'Card v2 issued - damaged replacement.',
  },
  {
    at: '01 Aug 2026 - 11:20',
    who: 'Simran Kaur',
    kind: 'policy',
    subject: 'Store',
    detail: 'Working hours set 08:00-18:00 by S. Verma.',
  },
];

async function buildChain(source = rows): Promise<SealedEntry[]> {
  const out: SealedEntry[] = [];
  let prev = GENESIS;
  for (const r of source) {
    const sealed = await sealEntry(r, prev);
    out.push(sealed);
    prev = sealed.seal;
  }
  return out;
}

describe('ledger', () => {
  it('produces a 64-character SHA-256 hex seal', async () => {
    expect(await fingerprint('anything', GENESIS)).toMatch(/^[0-9A-F]{64}$/);
  });

  it('is a real SHA-256 of `prev|payload`, checkable outside this codebase', async () => {
    //   printf 'GENESIS|abc' | sha256sum
    // If this ever fails, the seal format changed and every seal already written
    // in production stops verifying. That is a migration, not a bug fix.
    expect(await fingerprint('abc', GENESIS)).toBe(
      'E8EE4838AEF992DA6D962231070C242C3261C99036D5069911CB789AED17D593',
    );
  });

  it('is deterministic', async () => {
    const a = await fingerprint(canonicalPayload(rows[0]!), GENESIS);
    const b = await fingerprint(canonicalPayload(rows[0]!), GENESIS);
    expect(a).toBe(b);
  });

  it('changes the seal when any single field changes', async () => {
    const base = await fingerprint(canonicalPayload(rows[0]!), GENESIS);
    for (const field of ['at', 'who', 'kind', 'subject', 'detail'] as const) {
      const mutated = { ...rows[0]!, [field]: `${rows[0]![field]}x` };
      expect(await fingerprint(canonicalPayload(mutated), GENESIS)).not.toBe(base);
    }
  });

  it('changes the seal when only the previous seal changes', async () => {
    const p = canonicalPayload(rows[0]!);
    expect(await fingerprint(p, GENESIS)).not.toBe(await fingerprint(p, 'SOMETHINGELSE'));
  });

  it('cannot be fooled by shifting content across a field boundary', async () => {
    // Without a separator users cannot type, these two would hash alike.
    const a = await fingerprint(
      canonicalPayload({ at: 'x', who: 'ab', kind: 'c', subject: '', detail: '' }),
      GENESIS,
    );
    const b = await fingerprint(
      canonicalPayload({ at: 'x', who: 'a', kind: 'bc', subject: '', detail: '' }),
      GENESIS,
    );
    expect(a).not.toBe(b);
  });

  it('verifies an honest chain', async () => {
    const r = await verifyChain(await buildChain());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.count).toBe(rows.length);
  });

  it('verifies an honest chain given newest first', async () => {
    const chain = await buildChain();
    expect((await verifyChainNewestFirst([...chain].reverse())).ok).toBe(true);
  });

  it('stays valid when an entry is honestly appended', async () => {
    const chain = await buildChain();
    const head = chain[chain.length - 1]!.seal;
    chain.push(
      await sealEntry(
        {
          at: '02 Aug 2026 - 09:00',
          who: 'Simran Kaur',
          kind: 'doc',
          subject: 'MB-HR-0001',
          detail: 'Letter issued.',
        },
        head,
      ),
    );
    expect((await verifyChain(chain)).ok).toBe(true);
  });

  it('breaks when a past entry is edited', async () => {
    const chain = await buildChain();
    chain[1] = { ...chain[1]!, detail: 'R. Khanna joined as Chief Executive.' };
    const r = await verifyChain(chain);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.index).toBe(1);
      expect(r.reason).toBe('seal-mismatch');
    }
  });

  it('STILL breaks when the edited entry is re-sealed - the tail is what protects it', async () => {
    const chain = await buildChain();
    const edited = { ...chain[1]!, detail: 'R. Khanna joined as Chief Executive.' };
    chain[1] = await sealEntry(edited, edited.prev);
    const r = await verifyChain(chain);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Entry 2 now looks self-consistent; entry 3 is the one that gives it away.
      expect(r.index).toBe(2);
      expect(r.reason).toBe('broken-link');
    }
  });

  it('breaks when an entry is deleted', async () => {
    const chain = await buildChain();
    chain.splice(1, 1);
    expect((await verifyChain(chain)).ok).toBe(false);
  });

  it('breaks when two entries are swapped', async () => {
    const chain = await buildChain();
    [chain[1], chain[2]] = [chain[2]!, chain[1]!];
    expect((await verifyChain(chain)).ok).toBe(false);
  });

  it('breaks when an entry is inserted in the middle', async () => {
    const chain = await buildChain();
    const forged = await sealEntry(
      {
        at: '15 Mar 2020 - 09:00',
        who: 'Someone',
        kind: 'join',
        subject: 'MB-XXX-0001',
        detail: 'Never happened.',
      },
      chain[1]!.seal,
    );
    chain.splice(2, 0, forged);
    expect((await verifyChain(chain)).ok).toBe(false);
  });

  it('treats an empty ledger as valid at GENESIS', async () => {
    const r = await verifyChain([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.head).toBe(GENESIS);
  });
});
