# Working on this

How the code here is written, and how to add to it without the next person
having to guess.

---

## The one rule

**Nothing is invented.** Not a joining date, not a salary, not a plausible
default. Where a fact is not known, the field is empty and something on screen
says so.

This is not fussiness. Every screen in here is read by somebody deciding what
to pay a person or what to tell them about their own record. A made-up date
looks exactly like a real one, and it will be read as a fact by every letter,
report and payslip downstream.

If you find yourself writing `|| 'Unknown'` or `?? new Date()`, stop and ask
what the screen should say when nobody knows.

---

## Comments

Comments here say **why**, and most of them record something that was once
wrong. They are long where the reason is long. That is deliberate.

```ts
/* Optional, NOT defaulted to "". A default survives .partial(), so every
   PATCH that never mentioned this field arrived carrying an empty string —
   and a route that wrote it would wipe the note every time somebody edited a
   performance score. Absent has to stay absent. */
reportsToNote: z.string().trim().max(200).optional(),
```

That comment is worth more than the line under it, because the line looks
obviously correct and the bug it prevents is invisible.

Do not write comments that restate the code. Do write one when you have just
spent an hour finding out why something had to be that way.

---

## Layout

```
packages/shared    Types, Zod schemas, and every rule that both halves need.
                   The payroll engine lives here. No I/O, no framework.
apps/api           Fastify 5, Prisma 7, PostgreSQL. Every check that matters.
apps/web           React. A rendering of what the server already decided.
scripts            Import, preview build, leak check, sheet generators.
```

**The browser is not trusted with anything.** Role checks, rate limits and
every business rule are on the server. If you are tempted to move a check into
the front end for speed, the answer is no; make the server faster.

**Shared code is shared for a reason.** The payroll engine, the Accounts file
and the assistant's question reader are all in `packages/shared` so that a test
can check them without a server, and so the browser and the API cannot come to
different answers about the same month.

---

## Adding an API route

1. The body schema goes in `packages/shared/src/schemas.ts`, as Zod.
2. The route goes in the matching `apps/api/src/modules/*.routes.ts`, with
   `preHandler: app.requireRole('HR')` or higher.
3. Anything that changes money, people or access writes a ledger entry in the
   **same transaction** — `appendInTx(tx, …)`. Not after. Not best-effort.
4. Write the test before you wire the screen.

Two Zod traps this codebase has already been bitten by:

- **`.default()` survives `.partial()`.** A defaulted field arrives on every
  PATCH whether or not the caller mentioned it. If the route writes it, it
  wipes the stored value. Use `.optional()` for anything a PATCH may omit.
- **Zod strips keys the schema does not name.** A field the browser sends and
  the schema has never heard of is silently dropped, and the screen says it
  saved. If a value is not landing, check the schema before the route.

---

## Adding a screen

The front end is one large file, `apps/web/src/legacy/MarbellaProcurementOS.jsx`.
That is not an accident to be tidied up in passing — it is the prototype the
business signed off, and it is being carved up as each part is touched, not in
one go. Work with it.

State comes from `useProc()`. Writes go through the provider's helpers:

- `optimistic(apply, send)` — for a change the browser can predict. **Apply
  inside the `setWorld` updater**, never against `ref.current`, which lags a
  render.
- `server(send, apply)` — for anything where the server decides. Payroll, exits
  and anything that creates a record use this: the browser shows what the
  server holds rather than its own guess.

---

## Tests

**409 tests, no mocked database.** The API tests run against a real PostgreSQL
and the payroll tests recompute every line of four real salary books and
compare with what the company actually paid.

A test here is written to fail for exactly one reason, and its name says what
went wrong in plain words:

```
it('prints a DASH, never a zero, for somebody nobody counted')
it('refuses to put two payslips on one person in one month')
it('reaches NOBODY when the group is mistyped, rather than everybody')
```

Prefer a test that describes the money that would have moved. `expect(days).toBe(12)`
is fine; a comment saying *twelve days of a twenty-eight day month, not a whole
one and not none* is what makes it survive a refactor.

**Clean up after yourself.** A test that leaves a person marked as having left,
or an allowance on a company, has put money on somebody's payslip. Every test
that writes uses `try/finally` to put it back.

---

## Before you push

```bash
npm run typecheck     # must be 0 errors
npm run lint          # must be 0 errors; warnings are allowed
npm test              # must be all green
```

And if you touched anything the shareable preview carries:

```bash
npm run demo && python3 scripts/leak-check.py
```

That script reads every regulated value straight out of the database and
searches the built bundle for it. It is the thing standing between a URL and
126 people's Aadhaar numbers. It runs in CI too.

---

## Verifying in a browser

Test output is not the acceptance standard for a screen. Open it.

Chromium and Playwright are already available:

```js
import pw from './node_modules/playwright/index.js';
const { chromium } = pw;
```

Two things that waste an afternoon if you do not know them:

- A `hasText` regex is **not** whitespace-trimmed. `/^Post$/` fails on a button
  whose text is `" Post"`. Use `getByText(x, { exact: true })`, or
  `filter({ hasText: 'substring' })`.
- A `.first()` that matches a hidden element hangs for the whole timeout. If a
  click times out, screenshot the page before assuming the app is broken —
  usually a dropdown is open and eating the click.

---

## Commit messages

Say what was wrong and what it cost, not what you typed. The subject is one
line in the imperative; the body explains the fault to somebody who was not
there.

A commit that says *Fix payroll bug* has thrown away the only chance anyone
had to learn what the bug was.
