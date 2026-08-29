# API reference

Base URL `/api/v1`. Live, always-current reference at **`/docs`** while the
server is running — it is generated from the same Zod schemas the server
validates with, so it cannot drift. This page is the prose version.

---

## Conventions

**Authentication.** Every endpoint except the three marked _public_ needs
`Authorization: Bearer <accessToken>`.

**Roles**, most privileged first: `ADMIN` › `HR` › `MANAGER` › `VIEWER`. Where a
role is listed, it means _that or above_.

**Errors** are always this shape:

```json
{
  "error": {
    "code": "UNPROCESSABLE",
    "message": "This re-issue is missing what the record needs.",
    "details": [{ "path": "circumstances", "message": "…at least 25 characters…" }],
    "requestId": "req-8f2c1a3d"
  }
}
```

Branch on `code`. Show `message` — it is written to be read. Quote `requestId`
when reporting a problem; it finds the exact trace in the logs.

| Status | Means                                                                                      |
| ------ | ------------------------------------------------------------------------------------------ |
| 400    | The request did not match its schema. `details` names every bad field, not just the first. |
| 401    | Not signed in, or the token expired.                                                       |
| 403    | Signed in, but not allowed.                                                                |
| 404    | No such record.                                                                            |
| 409    | A conflict: a duplicate, or someone else changed it first.                                 |
| 422    | Well-formed, but the business rules refuse it.                                             |
| 429    | Rate limited.                                                                              |

---

## Health

Public. Two endpoints because they answer different questions.

```http
GET /health/live     → {"status":"live","uptime":142}
GET /health/ready    → {"status":"ready","database":"ok"}   (503 if not)
```

`live` never touches the database, so a database outage does not make your
orchestrator kill otherwise healthy processes. Point the liveness probe at
`live` and the readiness probe at `ready`.

---

## Auth

### `POST /auth/login` — public

```json
{ "identifier": "MB-PUR-0012", "password": "…" }
```

`identifier` is an **Employee ID or an email**. On site people know their
MB-PUR-0012 and not their mailbox, so both are accepted.

Returns the access token, its lifetime in seconds, and the user — including
`userKey`, **which desk this account holds**. That is the server's decision; the
browser does not pick it.

Also sets two cookies:

| Cookie             | What                                                                                                                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marbella_rt`      | The refresh token. httpOnly, `SameSite=Strict`, `Secure` in production, scoped to `/api/v1/auth`                                                                                                                                                                              |
| `marbella_session` | Contentless — it says only "a session exists here". Readable, so the app can skip the refresh call on a cold load instead of printing a 401 in every first-time visitor's console. It carries no secret and grants nothing: forging it only buys a refresh the server refuses |

A wrong password and an unknown identifier return **the same 401 with the same
message**, and take the same time. Distinguishing them would hand an attacker a
list of who works here.

After `LOGIN_MAX_ATTEMPTS` wrong passwords the account locks for
`LOGIN_LOCKOUT_MINUTES`, and the **correct** password is refused during that
window too. That is the point.

### `POST /auth/refresh` — public

Body optional. With none, the refresh cookie is used. Returns a new access token
and **rotates** the refresh token.

Presenting an already-spent token revokes **every** session for that user. It is
either the real client replaying or a thief, and we cannot tell which.

### `POST /auth/logout` — public

Revokes this session's refresh token and clears the cookie.

### `GET /auth/me`

The signed-in user.

### `POST /auth/change-password`

```json
{ "currentPassword": "…", "newPassword": "at least twelve characters" }
```

Ends every **other** session. If the reason for the change is that someone else
knew the password, that is the part that matters.

### `GET|POST /auth/users`, `PATCH /auth/users/:id` — ADMIN

Create an account (it is forced to change its password at first sign-in), change
a role, disable an account, or reset a password.

You cannot disable or demote **your own** account — locking yourself out is a
support call at best.

---

## Bootstrap

### `GET /bootstrap`

Everything the UI needs, in one call, in exactly the shape `ProcCtx` provides:
`people, cardLog, ledger, salaries, devices, contacts, leavePolicy, deptRules,
companies, projects, exits, usage, docLog, jds, offices, hrLog`, plus
`ledgerHealth`, `me`, `version` and `generatedAt`.

**Below HR, `salaries`, `contacts`, `devices`, `exits` and `docLog` come back
empty.** That is a server-side decision, not a filter the browser is trusted to
apply.

~114 KB for 200 people; 14 KB gzipped.

---

## People

### `GET /people`

Query: `q`, `dept`, `office`, `employer`, `status`, `page`, `pageSize`.
`q` matches employee ID, name or designation.

```json
{ "items": [...], "page": 1, "pageSize": 100, "total": 200 }
```

Each person carries **both** `office` (posted at) and `employer` (paid by).
They are different fields and neither is derived from the other.

### `GET /people/:id` · `GET /people/:id/org`

`/org` returns the person, their manager chain up to the root, and their direct
reports. The walk is bounded and guarded against a cycle — a broken `reportsTo`
must not spin the server.

### `POST /people` — HR

Omit `id` and the server allocates the next one for that department, inside the
transaction, so two people filling in the form at once cannot collide.

### `PATCH /people/:id` — HR

Any field except `employer`. Sending `employer` here is refused with a message
pointing at the right endpoint.

Only changes worth a permanent record are sealed into the ledger — designation,
department, posting, status. A performance number moving 74 → 76 is not one.

### `POST /people/:id/employer` — HR

```json
{ "employer": "dpre", "reason": "Moved onto the group payroll from 1 September." }
```

**The reason is required.** This decides which letterhead every letter they are
ever issued goes out on. Both company names and the reason go into the ledger
verbatim.

---

## Cards

### `GET /cards` · `POST /cards` — HR

Two deliberately unequal paths, **enforced by the server**.

**Old card came back** (`first`, `damaged`, `faded`, `broken`):

```json
{ "pid": "MB-STR-0014", "reason": "damaged", "recv": "Simran Kaur", "killed": true }
```

`killed: true` (received and destroyed) and `recv` are both required for
anything but a first issue. Omit either and you get a 422 that says to use the
Lost path instead, because that path exists for a reason.

**Card unaccounted for** (`lost`, `stolen`, `notreturn`) requires all of:

| Field           | Rule                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `circumstances` | The holder's own words, **25 characters minimum**. "lost it" gets a 422 that says how many you wrote. |
| `lastHeld`      | When it was last in their hand                                                                        |
| `toldWho`       | Who they reported it to                                                                               |
| `firNumber`     | Required when `reason` is `stolen`                                                                    |
| `undertakings`  | Exactly five `true` values, ticked individually                                                       |

Every one of these is checked on the **server**. A browser with the steps removed
gets a 422.

Also true:

- `ver` is assigned by the server and **refused** if a client sends it (the
  schema is strict). Unique on `(personId, ver)`.
- A card cannot be issued to someone who has left — 422.
- An unaccounted-for card sets `zonesKilled`: the old plastic still exists.
- A third card returns a non-blocking `pattern` note. Worth a conversation, not
  a refusal.

---

## Ledger

### `GET /ledger` — HR

Newest first. Filter by `kind` and `subject`.

### `GET /ledger/verify` — HR

Walks the whole chain server-side and recomputes every seal.

```json
{ "ok": true, "count": 214, "head": "72786FC4…" }
```

When broken, `brokenAt`, `reason` (`seal-mismatch` or `broken-link`) and a
`message` saying what happened.

**There is no endpoint that writes, edits or deletes a ledger entry.** Entries
are appended by the operation they describe, inside its transaction. An
edit attempt is refused by PostgreSQL itself and surfaces as
`409 LEDGER_APPEND_ONLY`.

---

## Exits

### `GET /exits` · `GET /exits/stages` · `POST /exits` — HR

Opening a second deboarding for someone who already has one open is a 409 that
names the stage the existing one is at.

### `POST /exits/:id/advance` — HR

```json
{ "fromStage": "handover", "payload": { "…": "…" }, "summary": "One sentence for the ledger." }
```

`fromStage` **must** equal the exit's current stage. If it does not, someone else
moved it since your screen loaded, and you get a 409 telling you so. Without
this, two people advancing from two screens would skip a stage between them —
assets never collected, but recorded as collected.

Clearing `assets` marks the person exited, in the same transaction as the stage
change. There is no window where one is true and the other is not.

---

## Payroll · contacts · devices

- `GET /salaries`, `PUT /salaries/:pid` — **HR**. The ledger records _that_ pay
  changed and who changed it, never the figures.
- `GET /contacts`, `PUT /contacts/:pid` — **HR**. A `@marbellagroup.in` address
  is **refused**: the company account closes the day they leave, which is exactly
  when these details are needed.
- `GET /devices`, `POST /devices`, `DELETE /devices/:id` — **HR**. The IMEI's
  Luhn check digit is arithmetic, not a guess, so a failure **blocks**.

---

## Policies

`GET|PUT /dept-rules/:dept` (MANAGER) and `GET|PUT /leave-policy/:dept` (HR).

Each department keeps its own clock. The store opens at 08:00 because site
starts at 08:00; Accounts opens at 10:00. There is no company-wide setting
because it would be wrong for every department except one.

---

## Documents and job descriptions

### `POST /documents` — HR

Records that a letter was issued: the template, the person, the letterhead, and
how it went out.

**It does not send email.** The response is explicit:

```json
{ "delivered": false, "deliveryNote": "Recorded, not sent. No mail gateway is configured…" }
```

Show that. Do not let a screen imply a send that did not happen.

It also returns a `warning` when the letterhead is not the person's employer.
Not a refusal — HR may have a reason — but it is said out loud and it goes into
the permanent record.

### `GET|PUT /job-descriptions`

---

## Bulk import

### `POST /imports/people` — HR

```json
{
  "rows": [
    { "name": "…", "desig": "…", "dept": "Store", "office": "Grand", "joined": "05/06/2024" }
  ],
  "commit": false
}
```

`commit: false` **validates and changes nothing**. The UI calls it that way
first, so the operator sees exactly what will and will not land. Preview and
commit run identical code, so the preview cannot be wrong.

```json
{
  "accepted": [{ "row": 1, "id": "MB-STR-0212", "name": "…" }],
  "rejected": [
    {
      "row": 2,
      "name": "…",
      "field": "joined",
      "reason": "\"last year\" is not a date I can read. Try 05/06/2020 or 2020-06-05."
    }
  ],
  "committed": false
}
```

Bad rows are held back **with a reason**; the good ones still land. Twenty good
rows must not be lost because row eleven has a typo.

The commit is one transaction: either the whole accepted set lands or none of it
does. A half-imported sheet is worse than a refused one — nobody can tell which
half.

`GET /imports/fields` returns the header aliases the importer recognises.

---

## Purchasing and stores

`GET` on each of these is available to anyone signed in; writes need `MANAGER`
or above unless noted. Every refusal below is a **422 with a sentence a storeman
can act on**, not a status code.

| Endpoint                                                                   | What                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET\|POST /vendors`, `POST /vendors/:code/verify`, `POST /vendors/import` | The supplier list. Raising a PO against a vendor nobody has verified returns a **warning in the response body** — it does not block, because sometimes you have to buy today, but nobody gets to say they were not told                                                                          |
| `GET\|POST /purchase-orders`                                               | POs. Amounts are rupees on the wire and paise in the column                                                                                                                                                                                                                                      |
| `GET\|POST /purchase-requests`, `POST /purchase-requests/:id/close`        | What the store is asking purchase to buy                                                                                                                                                                                                                                                         |
| `GET\|POST /requisitions`, `POST /requisitions/:id/close`                  | What site is asking the store for                                                                                                                                                                                                                                                                |
| `GET\|POST /inventory`                                                     | The stock list                                                                                                                                                                                                                                                                                   |
| `POST /inventory/move`                                                     | **Receive or issue stock.** Refuses to issue what someone is holding back, naming who to ask. Refuses a delivery that would breach a storage cap unless `override` is supplied — and then seals who authorised it. Quantities are rounded where they are computed, so a gate pass reads `12.4 T` |
| `GET /inventory/moves`                                                     | The movement history                                                                                                                                                                                                                                                                             |
| `GET\|POST /holds`, `DELETE /holds/:id`                                    | Holding stock back. A hold larger than what is physically there is refused                                                                                                                                                                                                                       |
| `GET\|PUT /caps`                                                           | What a project may hold of one thing. Chairman only                                                                                                                                                                                                                                              |
| `GET\|PUT /catalog`                                                        | The item master                                                                                                                                                                                                                                                                                  |
| `GET\|POST /site-reports`                                                  | What site says it did                                                                                                                                                                                                                                                                            |

## Money

| Endpoint                                                    | What                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /invoices`, `POST /invoices/:id/clear`                 | Incoming bills                                                                                                                                                                                                                                                          |
| `GET\|POST /expenses`                                       | Petty and site spend                                                                                                                                                                                                                                                    |
| `GET\|POST /sales`                                          | Bookings. **A second booking on a unit already sold is refused with a 409** naming the existing buyer. Two bookings on one unit is the mistake that ends up in court                                                                                                    |
| `GET\|POST /reminders`, `POST /reminders/:id/approve`       | Payment chasers. Drafting is not approving, and the same person cannot do both. The response says `delivered: false` — there is no mail or WhatsApp gateway                                                                                                             |
| `GET /banks`, `GET /credit-cards`                           | Accounts. (`/credit-cards`, not `/cards` — that is the HR card bureau)                                                                                                                                                                                                  |
| `POST /banks/:id/withdrawal`                                | **RERA escrow is refused until the engineer, the architect and the chartered accountant have all certified.** Escrow money is not the developer's to move. The response says `submittedToBank: false`: nothing here talks to a bank                                     |
| `GET\|PUT /master-companies`, `PATCH /master-companies/:id` | Counterparties                                                                                                                                                                                                                                                          |
| `GET\|POST /exports`                                        | What left the building, and who took it                                                                                                                                                                                                                                 |
| `POST /override/verify`                                     | The Chairman's code, checked against `OVERRIDE_PIN` **on the server**. Rate-limited to five tries a minute. **Every attempt — accepted or refused — is sealed into the ledger.** With no `OVERRIDE_PIN` configured the server refuses rather than waving things through |

## The rest of the platform

| Endpoint                                               | What                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET\|POST /events`, `DELETE /events/:id`              | The calendar                                                                                                                       |
| `GET\|POST /incentives`, `POST /incentives/:id/decide` | HR proposes, `ADMIN` approves. Two people, on purpose                                                                              |
| `GET /attendance`, `POST /attendance/import`           | Import from a biometric export. Chunked — a year for 200 people is 70,000 rows — and the report names the IDs it skipped           |
| `GET\|POST /hr-tasks`, `POST /hr-tasks/:id/toggle`     | The HR desk's list                                                                                                                 |
| `GET\|POST /announcements`                             | Notices                                                                                                                            |
| `GET /connections`, `PUT /connections/:key`            | Which integrations are configured. None of them are wired to anything yet, and this says so                                        |
| `GET\|PUT\|DELETE /drafts/:type`                       | Half-finished work, kept server-side so it survives a closed tab                                                                   |
| `GET\|PUT /access`                                     | Who may do what. Writing here **writes rows** — the screen used to announce a change and forget it, and nobody's access ever moved |
| `GET /firms`                                           | Projects and the companies behind them                                                                                             |

---

## Usage · uploads

- `GET /usage`, `POST /usage/track` — counters, persisted now.
- `POST /people/:id/photo` — HR, multipart. The **magic bytes** are checked, not
  the filename or the `Content-Type`: a file named `.png` that is not a PNG is
  the oldest trick there is. The stored filename is generated server-side.

---

## Rate limits

`RATE_LIMIT_MAX` per minute overall (default 300); `RATE_LIMIT_AUTH_MAX` on
login (default 10, because that is where guessing is the threat). Keyed by user
when we know who you are, by IP when we do not — so a whole office behind one
NAT does not share a budget.

Set `TRUST_PROXY=true` behind nginx, or every request looks like it came from
the proxy.
