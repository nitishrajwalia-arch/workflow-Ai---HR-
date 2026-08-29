/**
 * The shape of the organisation.
 *
 * Two bugs shipped once and were caught by the client. Both are checked here so
 * neither can come back quietly:
 *
 *   1. The tree flattening so that everyone reports to the Chairman.
 *   2. The Chairman being given himself as a manager, which detaches the root
 *      and breaks every headcount above it.
 */

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildRoster } from '../../prisma/roster.js';
import { testDb } from './helpers.js';

let db: PrismaClient;

beforeAll(() => {
  db = testDb();
});

afterAll(async () => {
  await db.$disconnect();
});

describe('buildRoster is deterministic', () => {
  it('produces the same people every time', () => {
    const a = buildRoster();
    const b = buildRoster();
    expect(a.map((p) => `${p.id}|${p.name}|${p.joined}`)).toEqual(
      b.map((p) => `${p.id}|${p.name}|${p.joined}`),
    );
  });

  it('produces 181 people, giving 200 with the named leadership', () => {
    expect(buildRoster()).toHaveLength(181);
  });

  it('never gives anyone themselves as a manager', () => {
    expect(buildRoster().filter((p) => p.reportsTo === p.id)).toEqual([]);
  });

  it('puts security and labour on SRG, and Curo/Royce staff on D.R. Developers', () => {
    // A project is not an employer. This is the rule that decides which
    // letterhead a relieving letter goes out on.
    for (const p of buildRoster()) {
      if (p.office === 'curo' || p.office === 'royce') expect(p.employer).toBe('drdc');
      else if (p.dept === 'Security' || p.dept === 'Labour') expect(p.employer).toBe('srg');
      else expect(p.employer).toBe('dpre');
    }
  });
});

describe('the seeded tree', () => {
  it('has exactly one root among people who were keyed in, and it is the Chairman', async () => {
    // Bulk-imported people deliberately arrive with NO manager rather than being
    // parked under the Chairman. Parking them there is what flattens the tree,
    // and it hides the fact that nobody has decided who they report to. They
    // show up as needing attention instead — see the next test.
    const roots = await db.person.findMany({ where: { reportsToId: null, imported: false } });
    expect(roots).toHaveLength(1);
    expect(roots[0]!.id).toBe('MB-ADM-0001');
  });

  it('leaves imported people without a manager rather than parking them on the Chairman', async () => {
    const parked = await db.person.count({
      where: { imported: true, reportsToId: 'MB-ADM-0001' },
    });
    expect(parked).toBe(0);
  });

  it('has NOT flattened: the Chairman has a manageable number of directs', async () => {
    const directs = await db.person.count({ where: { reportsToId: 'MB-ADM-0001' } });
    expect(directs).toBeGreaterThan(5);
    // If this ever approaches 200 the tree has collapsed and the org board will
    // render as a single fan. That is the bug that shipped once.
    expect(directs).toBeLessThan(30);
  });

  it('has no self-reports in the database either', async () => {
    const selfs = await db.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM person WHERE "reportsToId" = id`;
    expect(selfs).toEqual([]);
  });

  it('has no cycles in the reporting line', async () => {
    const all = await db.person.findMany({ select: { id: true, reportsToId: true } });
    const boss = new Map(all.map((p) => [p.id, p.reportsToId]));

    for (const p of all) {
      const seen = new Set<string>([p.id]);
      let cursor = boss.get(p.id) ?? null;
      let depth = 0;
      while (cursor && depth < 50) {
        expect(seen.has(cursor), `cycle reaching ${cursor} from ${p.id}`).toBe(false);
        seen.add(cursor);
        cursor = boss.get(cursor) ?? null;
        depth++;
      }
      expect(depth).toBeLessThan(50);
    }
  });

  it('runs labour through a site supervisor, mostly at their own site', async () => {
    const rows = await db.$queryRaw<Array<{ same: bigint; total: bigint }>>`
      SELECT count(*) FILTER (WHERE p."officeId" = m."officeId") AS same, count(*) AS total
      FROM person p JOIN person m ON m.id = p."reportsToId"
      WHERE p.dept = 'Labour'`;
    const { same, total } = rows[0]!;
    expect(Number(total)).toBeGreaterThan(0);
    // Not all of them: a site with no supervisor of the right rank falls back.
    expect(Number(same) / Number(total)).toBeGreaterThan(0.8);
  });

  it('never sends labour to report to the Chairman', async () => {
    const bad = await db.person.count({ where: { dept: 'Labour', reportsToId: 'MB-ADM-0001' } });
    expect(bad).toBe(0);
  });
});
