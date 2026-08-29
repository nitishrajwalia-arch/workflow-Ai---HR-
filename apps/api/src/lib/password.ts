/**
 * Password hashing.
 *
 * Argon2id, the current recommendation: memory-hard, so a GPU farm gains far
 * less than it would against bcrypt or PBKDF2. Parameters follow the OWASP
 * minimum (19 MiB, 2 iterations, 1 degree of parallelism). @node-rs/argon2 ships
 * prebuilt binaries, so no compiler is needed on the deployment host.
 *
 * Raising these values later is safe and needs no migration: the parameters are
 * embedded in each stored hash, so old hashes keep verifying, and `needsRehash`
 * below tells you when to upgrade one during a successful login.
 */

import { hash, verify, type Algorithm } from '@node-rs/argon2';

const OPTIONS = {
  // Algorithm.Argon2id. Written as its numeric value because @node-rs/argon2
  // exports it as an ambient `const enum`, which isolatedModules cannot read
  // across a module boundary. The cast keeps it type-checked against the enum.
  algorithm: 2 as Algorithm,
  memoryCost: 19_456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const hashPassword = (plain: string): Promise<string> => hash(plain, OPTIONS);

/**
 * Constant-time verify. Returns false rather than throwing on a malformed hash,
 * so a corrupted row cannot turn a failed login into a 500 that leaks its shape.
 */
export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    return false;
  }
}

/** True when a stored hash was made with weaker parameters than we now use. */
export function needsRehash(storedHash: string): boolean {
  const m = storedHash.match(/\$m=(\d+),t=(\d+),p=(\d+)/);
  if (!m) return true;
  return (
    Number(m[1]) < OPTIONS.memoryCost ||
    Number(m[2]) < OPTIONS.timeCost ||
    Number(m[3]) < OPTIONS.parallelism
  );
}
