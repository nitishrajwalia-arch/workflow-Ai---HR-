/**
 * Walk every screen of every desk and report anything the console complains\n * about — errors, React warnings, failed requests, 5xx responses, blank pages —\n * and check that a page reload keeps you signed in.
 *
 * Needs the API on :4000 and the web app on :5173 — `npm run dev` starts both —
 * and a seeded database. Run it with `node scripts/audit-desks.mjs`.
 *
 * Uses whichever Chromium Playwright finds. Set CHROMIUM to point at a specific
 * binary, and SEED_PASSWORD if your seed used something other than the default.
 */
import { chromium } from 'playwright';

const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
const PASSWORD = process.env.SEED_PASSWORD ?? 'DevPassword123!';

const DESKS = {
  admin: [
    'MB-ADM-0001',
    [
      'Command',
      'Budget',
      'Cost IQ',
      'People',
      'HR Desk',
      'Population',
      'Org chart',
      'Card bureau',
      'Incentives',
      'Projects',
      'Accounts',
      'Expenses',
      'Sales & dues',
      'Masters',
      'Access',
      'Submissions',
      'Tax & RERA',
      'Calendar',
      'Connections',
      'Directory',
    ],
  ],
  hr: [
    'MB-HR-0001',
    [
      'HR Desk',
      'People',
      'Population',
      'Org chart',
      'Card bureau',
      'The desk',
      'Job descriptions',
      'Companies',
      'Bulk intake',
      'Exits & F&F',
      'Working hours',
      'Usage',
      'Attendance',
      'Incentives',
      'Letters',
      'Calendar',
      'Directory',
    ],
  ],
  purchase: [
    'MB-PUR-0012',
    ['Purchasing', 'Intent → PO', 'Invoices', 'Submissions', 'Vendors', 'Calendar', 'Directory'],
  ],
  purchaseAsst: ['MB-PUR-0018', ['Purchasing', 'Intent → PO', 'Calendar', 'Directory']],
  store: ['MB-STR-0004', ['Store Floor', 'Inventory', 'Calendar', 'Directory']],
  storeAsst: ['MB-STR-0009', ['Store Floor', 'Inventory', 'Calendar', 'Directory']],
  maintenance: ['MB-MNT-0006', ['Maintenance', 'Calendar', 'Directory']],
  accounts: [
    'MB-ACC-0002',
    [
      'Reconciliation',
      'Expenses',
      'Sales & dues',
      'Masters',
      'Submissions',
      'Cost IQ',
      'Tax & RERA',
      'Projects',
      'Calendar',
      'Directory',
    ],
  ],
  security: ['MB-SEC-0007', ['Gate', 'Calendar']],
};

const browser = await chromium.launch(LAUNCH);
let bad = 0,
  screens = 0;
const report = [];

for (const [desk, [empId, tabs]] of Object.entries(DESKS)) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  let current = `${desk}:login`;
  const errs = {};
  const note = (t) => {
    (errs[current] ??= []).push(t);
  };
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') note('ERR ' + t);
    else if (m.type() === 'warning' && /key|Warning:|React/i.test(t)) note('WARN ' + t);
  });
  page.on('pageerror', (e) => note('PAGEERROR ' + e.message));
  page.on('requestfailed', (r) => note('REQFAIL ' + r.url()));
  page.on('response', (r) => {
    if (r.status() >= 500) note(`HTTP ${r.status()} ${r.url()}`);
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder="MB-PUR-0012"]', { timeout: 20000 });
  await page.fill('input[placeholder="MB-PUR-0012"]', empId);
  await page.fill('input[type=password]', PASSWORD);
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForTimeout(3500);

  if (await page.locator('input[placeholder="MB-PUR-0012"]').count()) {
    report.push(`${desk}: LOGIN FAILED — still on the sign-in screen`);
    bad++;
    await ctx.close();
    continue;
  }

  for (const tab of tabs) {
    current = `${desk} › ${tab}`;
    screens++;
    const btn = page.getByRole('button', { name: tab, exact: true }).first();
    if ((await btn.count()) === 0) {
      note('NAV BUTTON MISSING');
      bad++;
      report.push(`${current}: nav button missing`);
      continue;
    }
    await btn.click({ timeout: 5000 }).catch((e) => note('CLICK FAILED ' + e.message));
    await page.waitForTimeout(1400);
    const body = await page.innerText('body').catch(() => '');
    const chars = body.length;
    const e = errs[current] || [];
    if (chars < 300) {
      note(`BLANK SCREEN (${chars} chars)`);
    }
    const line = `${current.padEnd(34)} chars=${String(chars).padStart(6)} issues=${(errs[current] || []).length}`;
    report.push(line);
    if ((errs[current] || []).length) {
      bad++;
      [...new Set(errs[current])]
        .slice(0, 4)
        .forEach((x) => report.push('      ' + x.slice(0, 180)));
    }
  }
  // A page reload must keep you signed in: the access token is in memory only,
  // so this exercises the silent refresh off the cookie.
  current = `${desk} › reload`;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  if (await page.locator('input[placeholder="MB-PUR-0012"]').count()) {
    report.push(`${desk}: RELOAD LOST THE SESSION`);
    bad++;
  }
  const reloadErrs = errs[current] || [];
  if (reloadErrs.length) {
    bad++;
    report.push(`${desk} › reload issues=${reloadErrs.length}`);
    [...new Set(reloadErrs)].slice(0, 4).forEach((x) => report.push('      ' + x.slice(0, 180)));
  }

  const loginErrs = errs[`${desk}:login`] || [];
  if (loginErrs.length) {
    bad++;
    report.push(`${desk}:login issues=${loginErrs.length}`);
    [...new Set(loginErrs)].slice(0, 4).forEach((x) => report.push('      ' + x.slice(0, 180)));
  }
  await ctx.close();
}

console.log(report.join('\n'));
console.log(
  `\n=== ${screens} screens across ${Object.keys(DESKS).length} desks · ${bad} with issues ===`,
);
await browser.close();
process.exit(bad ? 1 : 0);
