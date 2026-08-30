# Marbella Procurement OS

Purchasing, stores, accounts, the gate and the people system for Marbella
Group, as one real full-stack application.

React front end. Fastify + PostgreSQL back end. One command to start, one
command to deploy, and 164 tests that run against a real database.

This is the single-file `MarbellaProcurementOS.jsx` build with a server
underneath it. The UI is the same UI — **ten edits**, all listed in
[`apps/web/src/legacy/PATCHES-PROCUREMENT.md`](apps/web/src/legacy/PATCHES-PROCUREMENT.md).
Nine desks, about 85 screens, every one of them walked in a real browser.

The HR build (`MarbellaHR.jsx`) is still in the tree and still runs — Procurement
OS absorbed it, so the HR desk is now one of the nine rather than the whole app.
Its own notes are in [`PATCHES.md`](apps/web/src/legacy/PATCHES.md).

---

## Start it

You need **Node 22+** and **PostgreSQL 16** (or Docker, which brings its own).

```bash
git clone <this repo> && cd marbella-procurement-os
cp .env.example .env          # then edit DATABASE_URL and JWT_SECRET
npm run setup                 # install, generate the DB client, build shared
npm run db:migrate            # create the tables
npm run db:seed               # people, projects, vendors, stock, the ledger
npm run dev                   # API on :4000, web on :5173
```

Open **http://localhost:5173**. The seed prints the administrator password
once — that account must change it at first sign-in.

Generate a real `JWT_SECRET` with `openssl rand -base64 48`. The server refuses
to start without one, by name, rather than failing later on the first request
that needs it.

### Or with Docker

```bash
export POSTGRES_PASSWORD="$(openssl rand -base64 24)"
export JWT_SECRET="$(openssl rand -base64 48)"
docker compose up -d          # database, API and web, on :8080
docker compose exec api npx tsx prisma/seed.ts
docker compose logs -f api
```

Compose **refuses to start** without those two rather than falling back to a
default. A known default JWT secret is a footgun: it would make every token
forgeable by anyone who has read the compose file.

---

## What you get

|            |                                                                               |
| ---------- | ----------------------------------------------------------------------------- |
| **API**    | Fastify 5 · TypeScript · Prisma 7 · PostgreSQL 16 · Zod 4                     |
| **Web**    | React 19 · Vite 8 · TypeScript                                                |
| **Auth**   | Argon2id · JWT access tokens · rotating refresh tokens · 4 roles              |
| **Docs**   | OpenAPI at `/docs`, generated from the same schemas the server validates with |
| **Tests**  | 164, against a real PostgreSQL — no mocked database anywhere                  |
| **Deploy** | Dockerfiles, compose file, nginx config, GitHub Actions CI                    |

```
marbella-procurement-os/
├── packages/shared/     validation, the ledger seal, the API contract
│                        — imported by BOTH sides, so they cannot disagree
├── apps/api/            Fastify server, Prisma schema, migrations, seed
├── apps/web/            React app + the original UI, essentially unchanged
└── scripts/             the two browser checks described below
```

`packages/shared` is the reason the two halves stay honest with each other. The
Zod schemas in it validate every request on the server, generate the OpenAPI
document, AND provide the browser's types. A field renamed on one side fails the
TypeScript build on the other.

---

## The things worth knowing

### 1. Signing in is real now

`Sign in` used to read `onClick={() => onLogin("admin")}`. It ignored the
Employee ID and the password you had just typed and signed **everyone** in as
the Chairman — salaries, budgets, overrides, the lot — and the nine desk chips
below it were nine doors with no locks.

It now sends the Employee ID (or email) and the password to the server and
awaits the answer. **The desk you land on is the one the database says you
hold**, not a prop. The chips are still there because they are genuinely useful
for a demo, but they only fill the ID in for you; the password is still
required. Every desk was walked in Chromium afterwards to confirm each one gets
its own screens and nobody else's.

### 2. The ledger is now genuinely append-only

The old README was straight about this: a browser ledger is **tamper-evident,
not tamper-proof**, and it named the three things real immutability needs.
All three are here:

| What was needed                               | What it is now                                                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage on a server the user does not control | PostgreSQL behind the API                                                                                                                                                   |
| Append-only permissions at the database level | A `BEFORE UPDATE OR DELETE` trigger on `ledger_entry` that raises an exception, plus a `BEFORE TRUNCATE` trigger and a unique index on `prev` so the chain cannot be forked |
| Fingerprints the browser cannot forge         | Real SHA-256, computed server-side only. A seal a client sends is ignored                                                                                                   |

`UPDATE`, `DELETE`, `TRUNCATE` and a forked chain are all refused **by Postgres
itself**, not by application code a bug could route around. There is a test for
each. Entries are appended inside the transaction of the operation they
describe, so a card issued with no ledger entry — or an entry for a card that
was never issued — cannot happen; there is a test for that too.

**Still true, and still worth saying to the client:** anyone with superuser
rights on the database, or the ability to restore a backup, can still rewrite
history. What they cannot do is rewrite it _quietly_ — dropping the trigger is
itself a schema change, and the whole hash chain would have to be recomputed.

### 3. Rules the browser used to enforce are now enforced by the server

A re-issue for a card nobody can produce needs the circumstances in the holder's
own words (25 characters minimum — "lost it" does not pass), when it was last in
hand, who they told, an FIR number if it was stolen, and all five undertakings
ticked individually.

In the single-file build those were screens, and a modified browser could skip
them. Now they are conditions on the request. `apps/api/src/tests/cards.test.ts`
sends exactly the requests a tampered front end would send and checks the API
refuses each one.

The card **version number** is the server's to assign, too. Two clerks on two
screens cannot both be handed "version 3": there is a unique index on
`(personId, ver)` and a transaction that stops them racing for it.

### 4. A project is still not an employer — and nor is an office

The original build kept `office` and `employer` apart, for the right reason: get
it wrong and the relieving letter goes out on the wrong letterhead and the PF
challan names the wrong company.

Working through the seed data surfaced a **third** thing hiding in the same
field. The office ids are `hq, grand, twin, curo, royce`; the project ids are
`grand, twin, curo, royce, manifest`. They overlap but they are not the same
list — the Head Office has no project, and Manifest has no site office yet. So
there are three tables:

- **Company** — who pays. Decides the letterhead.
- **Project** — what is being built. Belongs to a company.
- **Office** — where a person sits. Usually a project's site office; sometimes not.

Changing someone's employer needs a **written reason** and is sealed into the
ledger, because it decides which letterhead every letter they are ever issued
goes out on. Changing their office is an ordinary edit.

Issuing a letter on a company that is not the person's employer is **not
refused** — HR may have a good reason — but the API says so out loud in the
response and puts it in the permanent record.

### 5. Salary is behind a role check that actually runs

`GET /salaries` needs HR or above. So does the salary map inside the bootstrap
payload: a VIEWER gets `{}`, not a filtered-in-the-browser copy. A role check
that lives only in the front end is decoration, and there is a test that a
VIEWER gets an empty map while still seeing the roster.

### 6. The yard's own rules are refusals, not warnings

Six rules used to live in React, which means they lived nowhere. They are
conditions on the request now, and each refusal says what to do about it rather
than printing a status code at a storeman:

> Only 7.4 T of TMT 550D steel are available — 6 are held back by R. Khanna ·
> Purchase Manager. Ask them to release it first.

> OPC 53 cement at Marbella Grand is capped at 2000 bags. This would take it to 2740. Yard shed holds no more; bags cake in the monsoon. An override from the
> Chairman is needed.

| Rule                    | What the server does                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Held stock**          | Refuses to issue what someone is holding back, and names who to ask                                                                                       |
| **Storage caps**        | Refuses a delivery the yard cannot physically hold, unless an override is attached — and seals who authorised it                                          |
| **A unit is sold once** | Refuses a second booking on a sold unit, naming the existing buyer. Two bookings on one unit is the mistake that ends up in court                         |
| **RERA escrow**         | Refuses a withdrawal until the engineer, the architect **and** the chartered accountant have all certified. Escrow money is not the developer's to move   |
| **Reminders**           | Drafting is not approving, and the same person cannot do both                                                                                             |
| **The override code**   | Lives in `OVERRIDE_PIN` on the server, is rate-limited to five attempts a minute, and **every attempt — accepted or refused — is sealed into the ledger** |

Quantities are rounded where they are computed, so a gate pass reads `12.4 T`
and never `12.399999999999999 T`. Every money column is `BIGINT`: a ₹4.21 crore
escrow balance in paise is six times what a 32-bit `INTEGER` holds, and that
overflow is silent.

`apps/api/src/tests/procurement.test.ts` sends the exact requests a tampered
front end would send and checks the API refuses each one — asserting the
**messages**, not just the status codes.

---

## How the old UI runs against a live server

The existing UI reads everything out of one `ProcCtx` object and expects every
collection to be present, synchronously, on first render. Around 85 screens
across nine desks, no loading states anywhere.

Rather than rewrite all of them, `GET /api/v1/bootstrap` hands the browser that
whole world in **one request**, in exactly the shape `ProcCtx` already provides.
`ProcurementProvider` puts it in state and supplies the ~70 actions the screens
call; every one of those is an individual, properly-scoped API call that patches
the local copy — applied optimistically, and **rolled back with the server's own
message if it fails**. So a refusal leaves the screen showing what is true, not
what was hoped for.

Measured on the seeded data — roster, vendors, purchase orders, stock, the
ledger and the rest: **153 KB, 21 KB gzipped.**

[`docs/FRONTEND-INTEGRATION.md`](docs/FRONTEND-INTEGRATION.md) covers when that
stops being the right trade (roughly 2,000 people) and how to migrate one screen
at a time when it does — the per-screen endpoints all exist already.

---

## Commands

|                      |                                              |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | API and web, both watching                   |
| `npm run check`      | format, lint, typecheck, test — what CI runs |
| `npm test`           | 164 tests against a real PostgreSQL          |
| `npm run build`      | production build of all three packages       |
| `npm run db:migrate` | create/apply a migration                     |
| `npm run db:seed`    | seed (idempotent — safe to re-run)           |
| `npm run db:studio`  | browse the database in a GUI                 |
| `npm run demo`       | one-file HTML demo of the UI, no server      |

`npm run demo` builds the interface as **one self-contained HTML file** —
`apps/web/dist-demo/demo.html`, about 1.5 MB, no server, no install. Open it
from the filesystem or email it to someone who asks to see the thing. It carries
a banner saying what it is: the screens on seeded data, where nothing is saved
and none of the rules are enforced, because the rules live on the server this
build does not have.

Two checks run a real browser against a running app, because test output is not
the same as looking at it. Both need `npm run dev` up first.

|                                |                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `node scripts/audit-desks.mjs` | Signs into all nine desks, opens all 71 nav screens, reports anything the console says |
| `node scripts/tamper.mjs`      | Corrupts the ledger five ways on its way into the browser and reads back the verdict   |

---

## Documentation

|                                                                                            |                                                                                                       |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)                                                 | **Start here to put it on a server.** Nginx, TLS, systemd or Docker, backups, the first-run checklist |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                             | How it fits together and why each decision was made                                                   |
| [`docs/API.md`](docs/API.md)                                                               | Every endpoint, with examples                                                                         |
| [`docs/SECURITY.md`](docs/SECURITY.md)                                                     | What is protected, how, and what still is not                                                         |
| [`docs/FRONTEND-INTEGRATION.md`](docs/FRONTEND-INTEGRATION.md)                             | The `ProcCtx` contract and how to extend it                                                           |
| [`apps/web/src/legacy/PATCHES-PROCUREMENT.md`](apps/web/src/legacy/PATCHES-PROCUREMENT.md) | **The ten edits to `MarbellaProcurementOS.jsx`** — what each replaced and why                         |
| [`apps/web/src/legacy/PATCHES.md`](apps/web/src/legacy/PATCHES.md)                         | The seven edits to `MarbellaHR.jsx`, which Procurement OS absorbed                                    |

Live API reference at **`/docs`** once the server is running.

---

## Be honest about these — do not oversell them

The original README had a table like this. It is still the most useful thing in
it. Here is the same table, updated for what is now true.

| Thing               | What is real now                                                                                                                                          | What is still not                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ledger**          | SHA-256 chain, computed server-side, in a table Postgres refuses to update, delete, truncate or fork. Tested against all four.                            | A superuser or a backup restore can still rewrite it. Not quietly, but they can.                                                                                                                                                                                                                                                                  |
| **Authorisation**   | Real access control. Argon2id passwords, rotating refresh tokens, four roles, checked on the server on every request. A modified browser gains nothing.   | No two-factor authentication. No SSO.                                                                                                                                                                                                                                                                                                             |
| **Salary**          | In a table only HR and above can read, and absent from the payload for everyone else.                                                                     | **Not encrypted at rest at the column level.** Anyone with database access reads it. Use an encrypted volume and keep database access short.                                                                                                                                                                                                      |
| **Email a letter**  | The merge, the letterhead, the permanent record that it went out, the warning when the letterhead is not the employer.                                    | **The send.** There is no mail gateway. The API returns `delivered: false` and says so, and the UI must show that rather than implying otherwise.                                                                                                                                                                                                 |
| **GSTIN**           | Shape checked strictly. State code and PAN read out of the number.                                                                                        | The check character is **a warning, never a block** — deliberately. Our arithmetic agreed with only some published samples and we could not establish which was wrong, so a real registration is never refused on our uncertainty. Only the GST portal settles it. All four seeded GSTINs are placeholders and correctly show "needs confirming". |
| **RERA**            | Shape checked. "Received" with no number is refused.                                                                                                      | Not verified against the portal.                                                                                                                                                                                                                                                                                                                  |
| **Override code**   | Lives on the server as `OVERRIDE_PIN`, checked at `POST /override/verify`, rate-limited to five tries a minute, and every attempt sealed into the ledger. | It is one shared code, not per-person. Rotate it when someone who knew it leaves.                                                                                                                                                                                                                                                                 |
| **OTP**             | The component still exists.                                                                                                                               | `DEMO_OTP = "4821"` is still a constant in the legacy file, so it is **not** a second factor. It gates nothing the override code does not already gate — but wire it to a gateway before this faces the internet.                                                                                                                                 |
| **Bank / WhatsApp** | Withdrawal requests and payment reminders are recorded and sealed, with who asked and why.                                                                | **Nothing talks to a bank, a mail server or WhatsApp.** Each response says so in as many words: `submittedToBank: false`, `delivered: false`. Take the record to the bank, or wire an integration up.                                                                                                                                             |
| **Money**           | Every money column is `BIGINT`, in paise. A ₹4.21 crore escrow balance is six times what a 32-bit `INTEGER` holds, and that overflow is silent.           | No currency other than the rupee, and no FX.                                                                                                                                                                                                                                                                                                      |
| **Photo capture**   | Upload works, and the file's **magic bytes** are checked, not just its name or its `Content-Type`.                                                        | Camera capture is still untested — there was no camera in the build sandbox.                                                                                                                                                                                                                                                                      |
| **Attendance**      | Department clocks, leave policy, and an import from a biometric export — chunked, and the report names the rows it skipped and why.                       | No live biometric feed. Someone still exports the file.                                                                                                                                                                                                                                                                                           |
| **Usage counts**    | Persisted now. They survive a reload.                                                                                                                     | —                                                                                                                                                                                                                                                                                                                                                 |

---

## What was found and fixed while building this

Stated plainly, because "it works" is worth less than knowing what was checked.

1. **The Chairman reported to himself.** Porting the seed, `?? 'MB-ADM-0001'`
   collapsed a deliberate `null` boss into a self-reference — 17 direct reports
   and no root node. Fixed, plus a guard that throws during seeding and two
   tests (`roster.test.ts`) that assert exactly one root and no self-reports.
   This is the same shape as the flattening bug that shipped once before.
2. **A wrong password said "your session has ended".** The login call went
   through the client's 401-refresh path, which swallowed the server's actual
   message. The most confusing thing this client could possibly say, on the
   first screen anyone sees. Fixed.
3. **`POST /auth/refresh` with no body returned 400.** A body-less POST arrives
   as `null`, which `.optional()` does not accept — so refreshing from the
   cookie alone, exactly as a browser does it, failed. Fixed.
4. **The server did not load `.env`.** It would have failed on your dev's first
   run. Now loaded with Node 22's built-in loader, no extra dependency.
5. **`npm run build` failed on a clean clone**, because Prisma's client is
   generated into `node_modules` and a fresh install has none. Generation is now
   part of the build rather than a README step someone would skip.
6. **The test suite only passed on a database nobody had touched.** Card version
   assertions drifted as rows accumulated. The suite now resets the test
   database on every run and passes twice in a row from cold.
7. **The ledger could fork, and nothing said so.** The unique index on `prev` —
   the thing that stops two entries claiming the same predecessor — was written
   by hand in SQL and never declared in `schema.prisma`. So when a later
   migration was generated by diffing the schema against the database, the
   index looked like drift and the generated migration **dropped it**. Nothing
   failed loudly: appends kept working and the chain kept verifying, right up
   until the history became a tree with no way to say which branch was real.
   `prev` is `@unique` in the schema now, so a future diff preserves it.
8. **A healthy ledger reported itself broken.** Found by opening the app, not by
   reading test output. The server seals with SHA-256; the legacy file still
   re-derived seals with its own 64-bit FNV pair, so every entry disagreed and
   the landing screen said **"Ledger broken at entry 5"** on a perfectly sound
   chain. A false alarm on a tamper-detector is worse than none.
9. **And then it accused the wrong entry.** Once fixed, editing an entry's
   contents was reported as a break at _entry 1_, whichever entry had actually
   been changed — because the verdict passed down to the screen was a bare
   boolean carrying no position. It carries the index and the reason now.
   `scripts/tamper.mjs` proves all five cases.
10. **Every purchase order rendered twice.** Two screens merged the live list
    from the server with the module constant the database had been _seeded
    from_, so `PO-4471` appeared sixteen times over, with duplicate React keys.
11. **`12.399999999999999 T` on a gate pass.** Issuing 1 T from 13.4 T left the
    binary floating-point tail in the stored quantity _and_ in the message
    shown to the storeman. Quantities are rounded where they are computed now.
12. **Fastify refused to boot** once the procurement routes landed: `/cards` was
    already the HR card bureau. The new one is `/credit-cards`. Better a
    startup crash than two routes quietly shadowing each other.
13. **`npm run dev` started nothing.** npm runs workspaces sequentially, so the
    API held the terminal and the web app never started. Both run together now.
14. **`npm ci` failed on a fresh clone.** It runs `prisma generate` through
    `prepare`, and the Prisma config called `env('DATABASE_URL')`, which throws
    the moment the file is loaded. `generate` does not use a database — so the
    very first command your dev would run failed on a variable that command
    does not need, before there was any `.env` to put it in. Found by
    unpacking the dev pack into an empty directory and installing it cold.
15. **Every uploaded photo came back a 404.** `POST /people/:id/photo` stored
    the file and returned `/uploads/<uuid>.jpg`, and **nothing served that
    path** — not in development, not in production. `@fastify/static` sat in
    `package.json` for the job and was never registered. Both halves worked;
    only the join was missing, which is exactly the shape a green test suite
    says nothing about. There is a purpose-built route and a test now.
16. **Four open advisories, in a package that was never used.** That same
    unregistered `@fastify/static` carried four path-traversal and
    authorisation-bypass advisories. Rather than a two-major upgrade of
    something this app does not call, it is gone: `npm audit` goes from four
    high findings to zero in the runtime.

---

## If you extend it

- **A new endpoint**: add the Zod schema to `packages/shared/src/schemas.ts`,
  the route to `apps/api/src/modules/`, and register it in `routes.ts`. The
  OpenAPI document updates itself. If you forget the auth guard, the audit test
  in `auth.test.ts` fails the build.
- **A new table**: edit `apps/api/prisma/schema.prisma`, run
  `npm run db:migrate`. Migrations are committed and applied automatically on
  deploy.
- **A new letter**: still `TEMPLATES` in the legacy file. Unfilled merge fields
  still render as `‹field›` and still block sending — keep that.
- **The org tree**: never filter the array passed as `all`. It computes both
  structure _and_ headcounts; filtering it severs branches and produces phantom
  counts. That shipped once and the client caught it. There is now a test.

---

## Licence

Proprietary — Marbella Group.
