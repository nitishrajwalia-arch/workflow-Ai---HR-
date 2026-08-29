/**
 * Prove the ledger tamper-check actually detects tampering.\n *\n * Corrupts the ledger on its way into the browser, five different ways, and\n * reads back what the running UI says about each. A detector that cannot fail\n * is not a detector.
 *
 * Needs the API on :4000 and the web app on :5173 — `npm run dev` starts both —
 * and a seeded database. Run it with `node scripts/tamper.mjs`.
 *
 * Uses whichever Chromium Playwright finds. Set CHROMIUM to point at a specific
 * binary, and SEED_PASSWORD if your seed used something other than the default.
 */
import { chromium } from 'playwright';

const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
const PASSWORD = process.env.SEED_PASSWORD ?? 'DevPassword123!';

const CASES = {
  untouched: (l) => l,
  'one detail edited': (l) => {
    const c = structuredClone(l);
    c[2].detail = 'something else entirely';
    return c;
  },
  'one entry deleted': (l) => {
    const c = structuredClone(l);
    c.splice(2, 1);
    return c;
  },
  'two entries swapped': (l) => {
    const c = structuredClone(l);
    [c[1], c[2]] = [c[2], c[1]];
    return c;
  },
  'one seal rewritten': (l) => {
    const c = structuredClone(l);
    c[2].seal = 'f'.repeat(64);
    return c;
  },
};

const browser = await chromium.launch(LAUNCH);
for (const [name, mangle] of Object.entries(CASES)) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  await page.route('**/api/v1/bootstrap*', async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.ledger = mangle(body.ledger);
    await route.fulfill({ response: res, body: JSON.stringify(body) });
  });
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder="MB-PUR-0012"]', { timeout: 20000 });
  await page.fill('input[placeholder="MB-PUR-0012"]', 'MB-HR-0001');
  await page.fill('input[type=password]', PASSWORD);
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: 'Exits & F&F', exact: true }).first().click();
  await page.waitForTimeout(1500);
  const text = await page.innerText('body');
  const m = text.match(/Ledger (intact — \d+ entries|broken at entry \d+)/);
  console.log(`${name.padEnd(22)} → ${m ? m[0] : 'no verdict shown'}`);
  await ctx.close();
}
await browser.close();
