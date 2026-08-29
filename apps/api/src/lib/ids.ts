/**
 * Employee IDs.
 *
 * MB-PUR-0012 is printed on a card that opens doors, so it is allocated by the
 * server inside the same transaction as the person row. Two people filling in
 * the intake form at the same moment must not be handed the same number.
 */

import { DEPT_CODES, type Department } from '@marbella/shared';
import type { PrismaClient } from '@prisma/client';
import { conflict } from './errors.js';

/** The client Prisma hands to a `$transaction` callback. */
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export const deptCode = (dept: string): string => DEPT_CODES[dept as Department] ?? 'GEN';

/**
 * Next free ID for a department.
 *
 * Reads the highest number currently in use and adds one. Safe against races
 * because the caller holds a transaction and `person.id` is the primary key: a
 * loser on the insert retries. `attempt` is how many times we have already lost.
 */
export async function nextEmployeeId(tx: Tx, dept: string, attempt = 0): Promise<string> {
  const code = deptCode(dept);
  const prefix = `MB-${code}-`;
  const highest = await tx.person.findFirst({
    where: { id: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  const current = highest ? Number(highest.id.slice(prefix.length)) : 0;
  const next = (Number.isFinite(current) ? current : 0) + 1 + attempt;
  if (next > 9999) {
    throw conflict(
      `Department ${dept} has used every ID from ${prefix}0001 to ${prefix}9999. ` +
        'The ID format needs widening before another person can be added.',
    );
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}
