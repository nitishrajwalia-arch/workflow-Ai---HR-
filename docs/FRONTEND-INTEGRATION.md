# Front-end integration

How the existing UI runs against a live server, what changed, and what to do
when the current approach stops being the right one.

---

## The short version

`MarbellaProcurementOS.jsx` reads everything from one `ProcCtx` object.
`ProcurementProvider` fetches that whole object from `GET /api/v1/bootstrap` and
supplies it in exactly the shape the screens already expect. Every action
becomes an API call.

**Ten edits to the 12,931-line file.** All listed in
[`../apps/web/src/legacy/PATCHES-PROCUREMENT.md`](../apps/web/src/legacy/PATCHES-PROCUREMENT.md).
The HR build is still in the tree with its own
[`PATCHES.md`](../apps/web/src/legacy/PATCHES.md); Procurement OS absorbed it,
so the HR desk is one of the nine rather than the whole app.

```
App.tsx
 └── ErrorBoundary                one screen crashing must not white-page the system
      └── AuthProvider            who is signed in; shows Login when nobody is
           └── ProcurementProvider fetches /bootstrap, exposes it as ProcCtx
                └── Shell          your UI, unchanged — the desk comes from the server
```

**Which desk you land on is the server's decision.** `Shell` is given
`userKey={user.userKey}`, resolved from the signed-in account. It is not a prop
the browser picks, which is what it used to be.

---

## The contract

`ProcurementProvider` supplies every key the original `App` supplied — the HR
collections:

```
people  cardLog  ledger  salaries  devices  contacts  leavePolicy  deptRules
companies  projects  exits  usage  docLog  jds  scope  setScope  offices  hrLog
```

the procurement and money ones:

```
vendors  pos  prs  requisitions  inv  moves  holds  caps  catalog  siteReports
invoices  expenses  sales  reminders  banks  creditCards  gatePasses  gateEvents
firms  masterCompanies  calendar  incentives  attendance  connections  drafts
grants  exports
```

and about seventy actions — `addPO`, `raiseRequisition`, `moveStock`,
`placeHold`, `releaseHold`, `saveCap`, `receiveShipment`, `bookSale`,
`draftReminder`, `approveReminder`, `raiseWithdrawal`, `saveGrants`,
`checkOverride`, and the HR set that was there before (`issueCard`,
`bulkAddPeople`, `openExit`, `advanceExit`, `setSalary`, …).

Plus four that are new:

| Key             | What                                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `me`            | `{ id, name, email, role, personId, title }`. The UI no longer needs to hard-code Simran Kaur.                                                                                         |
| `chainVerified` | `true` / `false` / `null`. The browser independently recomputes every ledger seal on load. A server that lied about its own ledger health would be caught. `null` = still checking.    |
| `chainFault`    | `{ index, message }` for the entry that failed verification, or `null`. Without it a screen can only say "broken", and it used to say "broken at entry 1" whichever entry had changed. |
| `reload()`      | Re-fetch everything.                                                                                                                                                                   |

### Two behavioural changes

**Actions return promises.** Most callers ignore the return value and nothing
changes for them. Two did not, and those are edits 4 and 5:
`bulkAddPeople()` (its `.length` was read immediately) and `openExit()` (its id
was used immediately). Both are now awaited.

**`seal()` is a no-op.** It used to append a ledger entry from the browser. It
cannot any more and it must not — a client-written ledger entry is worth
nothing. Entries are appended by the server inside the transaction of the
operation they describe, so by the time a screen called `seal()`, the entry it
wanted already exists.

---

## Optimistic updates, and the half people skip

```
1. Apply the change locally          → the screen responds at once
2. Send it to the server
3. On failure: PUT THE OLD STATE BACK and show the server's own message
```

Step 3 is the one that gets skipped, and skipping it is worse than not being
optimistic at all: the screen shows a card issued that was never issued, and the
operator finds out weeks later from the client.

**Anything the server decides is never guessed at locally.** Card version
numbers, employee IDs, ledger seals, exit stage transitions — those actions
await the server's answer and use what comes back. That is why `issueCard` does
not invent a version, and why `bulkAddPeople` re-reads instead of reconstructing.

---

## Why one big request

The UI expects every collection present, synchronously, on first render. Around
85 screens across nine desks, no loading states. The alternatives were:

1. Rewrite 85 screens into per-screen queries with loading and error states.
2. Hand the browser the whole world once, in the shape it expects.

Option 2, measured on the seeded data: **153 KB, 21 KB gzipped**. It is
comfortably the cheapest correct thing at this size.

### When it stops being right

Watch for any of these:

- The payload passes **~2 MB uncompressed** (roughly 2,000 people)
- First paint on a site-office phone is visibly waiting on it
- Two people editing at once start overwriting each other

### How to migrate when it does

One screen at a time. **The per-screen endpoints already exist**, so this is not
a rewrite:

1. Pick the heaviest screen — Population is the obvious first.
2. Give it its own hook against `GET /people?dept=…&page=…`, with its own
   loading and error states.
3. Drop that collection from the bootstrap payload
   (`apps/api/src/modules/bootstrap.routes.ts`) and bump `BOOTSTRAP_VERSION`.
4. Leave every other screen exactly as it is.

Repeat only as far as you need to. There is no requirement to finish.

At that point adding TanStack Query starts to earn its place. Today it would add
a dependency and a second source of truth without removing a line of the code it
is meant to serve.

---

## Adding a screen that uses the API directly

You do not have to go through `ProcCtx`.

```tsx
import { api, ApiError } from '../lib/api';

const people = await api.get<{ items: Person[] }>('/people?dept=Store');
```

The client handles the token, refreshes it on a 401 (sharing one in-flight
refresh across concurrent calls), and turns every failure into an `ApiError`
carrying the **server's own message** and its `requestId`. Show `err.full` — it
includes the field-level detail.

---

## Adding a field end to end

Five steps, in this order:

1. **Database** — add the column in `apps/api/prisma/schema.prisma`, then
   `npm run db:migrate`.
2. **Contract** — add it to the relevant schema in
   `packages/shared/src/schemas.ts`. The OpenAPI document updates itself.
3. **Serialiser** — add it in `apps/api/src/modules/serialisers.ts`. **This is
   the step people forget**, and the symptom is a field that saves correctly and
   never comes back.
4. **Bootstrap type** — add it to `packages/shared/src/bootstrap.ts` so the
   browser's types know about it.
5. **UI** — read it from `useProc()`.

If you skip 2, the server rejects the field. If you skip 3, it vanishes on
read. TypeScript catches 4.

---

## Things that will bite you

**`useProc()` returns null / "Cannot destructure property 'people' of null".**
Two `createContext()` calls somewhere. The legacy file must import `ProcCtx`
from `../proc/context.js`, not create its own. That is edit 1.

**A change saves and then reverts on screen.** The server refused it and the
optimistic update rolled back. The toast has the reason — read it rather than
assuming a bug.

**Card version numbers look wrong in a test.** The server assigns them and they
accumulate. Reset the card log for that person first; see the `beforeAll` in
`cards.test.ts`.

**Signed out on every page refresh.** The refresh cookie is not reaching
`/api/v1/auth`. Either the app and the API are on different origins, or the site
is not on HTTPS in production (the cookie is `Secure` there).

**A new route works but is open to everyone.** Add the `preHandler` guard. The
route audit test in `auth.test.ts` will fail the build until you do — that is
what it is for.

**The same row appears twice, with a duplicate React key.** A screen is merging
the live list from the server with the module constant the database was _seeded
from_. Read the live one only; that is edits 9 and 10.

**A refusal appears as a toast and the screen keeps the change anyway.** The
optimistic update did not roll back. Every mutation must go through `optimistic`
or `server` in `ProcurementProvider` — those restore the previous world and
surface `err.full`.

---

## Running the old build with no server

The default export still works:

```tsx
import App from './legacy/MarbellaProcurementOS.jsx'; // seeded data, no API, no login
```

Useful for showing the UI on a laptop with nothing running.
