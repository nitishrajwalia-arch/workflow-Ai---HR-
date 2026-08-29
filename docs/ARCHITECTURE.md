# Architecture

Why it is put together this way. Every section is a decision that could have
gone another way, with the reason it did not.

---

## The shape

```
Browser
  │  one origin, always. nginx serves the app and proxies /api.
  ▼
nginx ── /            → static files (Vite build)
      └─ /api/v1/*    → Fastify, 127.0.0.1:4000
                          │
                          ▼
                       PostgreSQL 16
```

```
packages/shared/   validation · the ledger seal · the Zod API contract
        │                        │
        ├───────────────►  apps/api    Fastify · Prisma · Postgres
        └───────────────►  apps/web    React · Vite
```

The dependency arrow points one way only. `shared` never imports from either
app; both import from it.

---

## Why a shared package at all

Because the alternative is drift.

The Zod schemas in `packages/shared/src/schemas.ts` do three jobs at once:

1. Fastify validates every request body, query and param against them.
2. The OpenAPI document at `/docs` is generated from them.
3. The browser imports the inferred TypeScript types from them.

Rename a field and the TypeScript build fails on the other side. The API
documentation cannot describe an endpoint the server does not implement, because
it is not written by hand.

The same applies to `validation.ts`. The browser tells you an IMEI's check digit
is wrong before you submit; the server tells you the same thing, in the same
words, using the same function. There is no way for the two to disagree about
what a valid IMEI is.

---

## Why Fastify

Speed is the least interesting reason. The two that mattered:

- **Schema-first.** Fastify was built around validating and serialising through
  schemas, so `fastify-type-provider-zod` gives fully typed `request.body` from
  the same object that generates the docs. Express would need three separate
  mechanisms and a lot of `as` casts.
- **Encapsulation.** Plugins have real scope, which is what makes the
  `preHandler` guard on a route table auditable — and that audit is a test that
  fails the build if a route is left unguarded.

---

## Why Prisma, and why the driver adapter

The schema is the documentation. `apps/api/prisma/schema.prisma` is readable by
someone who has never seen this codebase, and migrations are generated from it
rather than written by hand and hoped over.

Prisma 7 takes an explicit driver adapter (`@prisma/adapter-pg`) instead of
opening its own connection. That is an improvement: the pool is ours, so it can
be sized to the deployment rather than discovered at load. See `src/db.ts`.

**Raw SQL is still used where it belongs.** The append-only triggers are a
hand-written migration, and `pg_advisory_xact_lock` is a raw query. An ORM is
for the 95% of queries that are CRUD; the other 5% should be SQL and should look
like SQL.

---

## The ledger

This is the part worth reading closely.

### The chain

Each entry is sealed with `SHA-256(prev | at ␟ who ␟ kind ␟ subject ␟ detail)`,
where `prev` is the previous entry's seal. Change any past entry and its seal no
longer matches. Re-seal that one entry and the _next_ one breaks, because its
seal was computed over the original. To hide an edit you must rewrite every
entry after it — and, because seals are computed server-side only, you cannot.

The separator is U+001F (unit separator), a character nobody can type. Without
it, `{who: 'ab', kind: 'c'}` and `{who: 'a', kind: 'bc'}` would hash identically
and content could be shifted across a field boundary undetected. There is a test.

### What the database enforces

Migration `20260829100000_ledger_append_only` adds:

- `BEFORE UPDATE` and `BEFORE DELETE` row triggers that raise an exception
- a `BEFORE TRUNCATE` statement trigger, because `TRUNCATE` bypasses row triggers
- a unique index on `prev`, so two entries cannot claim the same predecessor —
  a fork is how you would splice a rewritten tail in beside the real one

All four are tested in `src/tests/ledger.test.ts` against a real database. This
is not application logic a bug can route around: the database refuses.

### Why appends are serialised

Reading the head and inserting the next entry is a read-modify-write. Two
concurrent appends would read the same head and fork the chain. So `appendInTx`
takes `pg_advisory_xact_lock` for the transaction's duration; the second append
waits and chains onto the first.

The unique index on `prev` is the belt to that pair of braces. There is a test
that fires twelve concurrent appends and asserts all twelve land, in one chain,
verifying.

### Why entries are written inside the caller's transaction

`appendInTx(tx, ...)` takes the _caller's_ transaction. So a card and its ledger
entry commit together or roll back together. A card issued with no ledger entry
— or an entry for a card that was never issued — is worse than the operation
failing outright. There is a test that forces a rollback and checks the entry
did not survive.

### Why there is no endpoint that writes one

There deliberately is not. An endpoint that let a client write an arbitrary
ledger entry would make the entire record worth nothing. Entries are only ever
appended by the operation they describe.

---

## Why the browser gets everything in one request

The existing UI reads its whole world from one context object and expects each
collection present, synchronously, on first render. Forty screens, no loading
states.

Two options:

1. Rewrite forty screens into per-screen queries with loading and error states.
   Weeks of work, and it would break behaviour that is already correct and
   already reviewed by the client.
2. Hand the browser that world in one request, in the shape it already expects,
   and make every mutation an individual scoped call.

Option 2, measured: **114 KB, 14 KB gzipped**, for 200 people.

This is a real trade and it has a real expiry date. `docs/FRONTEND-INTEGRATION.md`
says when it expires (around 2,000 people) and how to migrate — one screen at a
time, because the per-screen endpoints already exist.

**The role check is not part of the trade.** A `VIEWER` gets `salaries: {}` from
the server, not a full map the browser is trusted to hide.

---

## Optimistic updates, and the half people skip

`ProcProvider` applies a change locally, then sends it. On failure it **puts the
old state back** and shows the server's own message.

An optimistic update without rollback is worse than no optimism: the screen
shows a card issued that was never issued, and the operator finds out weeks
later, from the client.

Anything the server decides is never guessed at locally — card version numbers,
employee IDs, ledger seals, exit stage transitions. Those actions are `async`
and the caller awaits the real value.

---

## Authentication

|               |                                                                                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords     | Argon2id, OWASP minimum parameters. Parameters are embedded in each hash, so raising them later needs no migration — `needsRehash` upgrades a hash during a successful login, the one moment the plaintext is in hand.                          |
| Access token  | JWT, 15 minutes, **held in memory in the browser**, never in `localStorage`. An XSS bug then steals a session that ends with the tab rather than one that lasts a week.                                                                         |
| Refresh token | Opaque random string in an httpOnly `SameSite=Strict` cookie. Only its SHA-256 is stored, so a database dump does not hand anyone a working session.                                                                                            |
| Rotation      | Spending a refresh token revokes it and issues the next. Presenting a spent one revokes **every** session for that user — we cannot tell the real client from a thief, so both sign in again. Annoying once; far better than a silent stowaway. |

The client shares one in-flight refresh across concurrent 401s. Without that,
ten requests expiring together would trigger ten refreshes, nine of which would
present an already-spent token — and the server would correctly end every
session. That would look exactly like a bug and would not be one.

---

## The three things that are not the same thing

The original build kept `office` and `employer` apart, correctly. Porting the
seed surfaced a third hiding in the same field.

|             |                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Company** | Who pays. Decides the letterhead, the PF challan, the experience certificate.                                              |
| **Project** | What is being built. Belongs to a company; several projects share one.                                                     |
| **Office**  | Where a person sits. Usually a project's site office — but the Head Office has no project, and Manifest has no office yet. |

Office ids: `hq, grand, twin, curo, royce`. Project ids: `grand, twin, curo,
royce, manifest`. Overlapping, not identical. Collapsing them is how "who
employs them" and "where they sit" quietly drift apart.

`Person` carries both `officeId` and `employerId`, and neither is derived from
the other. Changing the employer needs a written reason and is sealed into the
ledger.

---

## Errors

One shape, everywhere:

```json
{ "error": { "code": "...", "message": "...", "details": [...], "requestId": "req-8f2c1a3d" } }
```

`message` is written for a person to read; `code` is what client code branches
on. Anything that is not a deliberate `AppError` is treated as a bug: logged in
full with its stack, and answered with a generic message plus the request id.
The id is the bridge — the user quotes it, and it finds the trace. The stack
never leaves the server, because a stack trace in a 500 tells an attacker what
you are running.

---

## Testing

**137 tests, no mocked database.**

A mocked Prisma proves the mock behaves as written. Every interesting rule in
this system lives in the database: the append-only triggers, the unique index on
card versions, transaction rollback, advisory locks. Mocking it would test none
of them.

So the suite resets a real PostgreSQL, seeds it, and drives a real Fastify app
through `app.inject()` — no sockets, full stack.

The suite resets on every run and passes twice in a row from cold. A suite that
only passes on a database nobody has touched is not a suite you can trust.

Three tests are load-bearing beyond what they assert:

- **The route audit** (`auth.test.ts`) walks every registered route and fails the
  build if one outside an explicit public list has no auth guard. Forgetting a
  `preHandler` is the easiest mistake to make and the most expensive to discover
  in production.
- **The roster invariants** (`roster.test.ts`) assert exactly one root, no
  self-reports, no cycles, and that labour never reports to the Chairman. The
  flattening bug shipped once and the client caught it.
- **The card refusals** (`cards.test.ts`) send exactly the requests a tampered
  browser would send.

---

## What is deliberately absent

|                      | Why                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A state library      | The UI has one context object. Redux or Zustand would add a dependency and a second source of truth without removing a line.              |
| TanStack Query       | Right answer for per-screen queries; this UI is not built that way. Revisit alongside the bootstrap migration.                            |
| A CSS framework      | The existing UI styles itself inline with no framework. Adding Tailwind for six shell screens would mean two styling systems for no gain. |
| A microservice split | 200 people. One service, one database, one deploy.                                                                                        |
| GraphQL              | The client asks for the whole world once, then makes specific mutations. That is what REST is good at.                                    |
