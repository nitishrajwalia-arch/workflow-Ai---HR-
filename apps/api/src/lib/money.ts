/**
 * Money.
 *
 * Stored as PAISE in a 64-bit integer column. Never a float: ₹78,00,000 is an
 * exact number of paise and a Float would hold it approximately, which is not a
 * thing to say about a purchase order.
 *
 * 64-bit is not belt-and-braces. Postgres INTEGER stops at 2,147,483,647 —
 * ₹2.14 crore — and the seeded RERA escrow account alone holds ₹4.21 crore. The
 * first seed run failed on exactly that row.
 *
 * At the API boundary paise become a JS number of RUPEES, because that is what
 * the UI displays and what every existing screen already expects. Rupees stay
 * exact as a double up to ₹90,07,19,92,54,740 — comfortably beyond any project
 * this will ever hold — but the DATABASE remains the source of truth in paise.
 */

/** Paise (bigint from the database) -> rupees for the wire. */
export const toRupees = (paise: bigint | number | null | undefined): number =>
  paise == null ? 0 : Number(paise) / 100;

/** Rupees from a client -> paise for the database. Rounded: no fractional paise. */
export const toPaise = (rupees: unknown): bigint => {
  const n = Number(rupees ?? 0);
  if (!Number.isFinite(n)) return 0n;
  return BigInt(Math.round(n * 100));
};

/**
 * BigInt cannot be JSON-serialised — `JSON.stringify(1n)` throws. Any object
 * going out of a route that came from a money column must pass through a
 * converter, or the response dies at serialisation time with a confusing error.
 * Prefer `toRupees` on the specific field; this is for bulk cases.
 */
export function bigintsToNumbers<T>(value: T): T {
  if (typeof value === 'bigint') return Number(value) as unknown as T;
  if (Array.isArray(value)) return value.map(bigintsToNumbers) as unknown as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = bigintsToNumbers(v);
    return out as T;
  }
  return value;
}

/**
 * Round a quantity to three decimals.
 *
 * Quantities are Float, because 18.4 tonnes of steel is a real number and no
 * integer unit fits every line (bags, tonnes, cubic metres, square feet). Float
 * arithmetic then does what float arithmetic does: 18.4 - 6 is
 * 12.399999999999999, and that number reaches a storeman in a refusal message
 * and looks like the app is broken.
 *
 * Three decimals is finer than anything anyone weighs on site and coarse enough
 * to swallow the representation error.
 */
export const qty = (n: number): number => Math.round(n * 1000) / 1000;
