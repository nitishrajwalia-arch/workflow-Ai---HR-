# Security

What is protected, how, and — the part that matters more — what still is not.

The original README had an honesty table. This is the same instinct applied to
the whole system. Read the "What is still not protected" section before telling
anyone this is secure.

---

## Threat model

This holds staff records, salaries, personal phone numbers and the access-card
register for buildings. Realistically, the threats are:

1. A former employee, or someone who borrowed a logged-in screen, reading or
   changing records they should not.
2. Someone guessing a password from outside.
3. Someone with database access quietly altering the record of what happened.
4. A stolen laptop or an open browser session.

It is **not** designed against a determined attacker who already has root on the
server or superuser on the database. If they have that, they have everything.
Say so plainly rather than implying otherwise.

---

## Passwords

Argon2id, at OWASP's minimum parameters (19 MiB memory, 2 iterations,
parallelism 1). Memory-hard, so a GPU farm gains far less than it would against
bcrypt or PBKDF2. `@node-rs/argon2` ships prebuilt binaries, so no compiler is
needed on the deployment host.

The parameters are embedded in each stored hash. Raising them later needs no
migration: old hashes keep verifying, and `needsRehash` upgrades one during a
successful login — the single moment the plaintext is in hand.

Minimum length twelve, and nothing else. Length beats punctuation, and
composition rules mostly produce `Password1!`.

**No self-service reset.** An administrator resets a password, which also ends
every session that account had. A reset-by-email flow is a second way in, and
its security is the security of that mailbox.

---

## Sessions

|               |                                                                                      |
| ------------- | ------------------------------------------------------------------------------------ |
| Access token  | JWT, 15 minutes, **in memory in the browser only**                                   |
| Refresh token | Opaque random string, httpOnly `SameSite=Strict` cookie, scoped to `/api/v1/auth`    |
| Stored as     | SHA-256 of the token. The token itself is never written down                         |
| Rotation      | Every use issues a new one and revokes the old                                       |
| Session hint  | A second cookie, `marbella_session`, holding the literal string `1` and nothing else |

**Why the access token is not in `localStorage`.** Anything there is readable by
any script that manages to run on the page. In memory, it dies with the tab: an
XSS bug steals a session that ends when the tab closes rather than one that
lasts a week. The cost is a silent re-auth on page load, which is what
`bootstrapSession` does.

**Why the hint cookie exists, and why it is safe.** The refresh cookie is
httpOnly, so JavaScript cannot ask whether a session exists — the app had to
POST `/auth/refresh` on every cold load just to find out, and a first-time
visitor got a red 401 in the console before they had even signed in. That
teaches people to ignore the console. `marbella_session` carries no token, no
user and no secret; it says only "there is a session here". Forging it grants
nothing: it makes the client attempt a refresh, which the server then refuses.

**Why rotation matters.** Presenting an already-spent refresh token revokes
_every_ session for that user. It is either the real client replaying or a
thief, and there is no way to tell which — so both sign in again. Annoying once;
far better than a silent stowaway.

**Every request re-checks the account**, not just the token. A demotion or a
disabled account takes effect immediately rather than waiting up to fifteen
minutes for a token to expire.

---

## Authorisation

Four roles: `ADMIN` › `HR` › `MANAGER` › `VIEWER`. Checked on the server, on
every request, against the database — never against the token alone.

**Which desk you get is the server's answer, not a request.** Sign-in returns
`userKey`, resolved from the account, and the shell renders that desk. In the
single-file build `Sign in` read `onClick={() => onLogin("admin")}` — it ignored
the credentials entirely and handed **everyone** the Chairman's desk, and the
nine role chips beneath it signed you in with no password at all.

This replaces the browser-side authorisation code in the single-file build. That
code was honestly described as stopping a colleague printing from someone else's
screen and _not_ being access control. This is the other thing.

**A test walks every registered route and fails the build if one outside an
explicit public list has no guard.** Forgetting a `preHandler` is the easiest
mistake to make here and the most expensive to find in production, so it is
checked mechanically rather than by review.

**The role check reaches the data, not just the route.** A `VIEWER` calling
`/bootstrap` gets `salaries: {}` — the server does not send it. A check that
only hides things in the browser is decoration.

---

## Against guessing

- Login is limited to 10 attempts per minute per IP (`RATE_LIMIT_AUTH_MAX`).
- After 8 wrong passwords the account locks for 15 minutes, and **the correct
  password is refused during that window too**. That is the point: an attacker
  who finds it on the ninth try still cannot get in.
- A wrong password and an unknown address return the same message and take the
  same time. The unknown-address path deliberately performs a real Argon2
  verification against a decoy hash, because answering instantly for unknown
  addresses is the same disclosure by a different route.

---

## The ledger

Three things make it more than decoration:

1. **On a server the user does not control** — PostgreSQL behind the API.
2. **Append-only at the database level** — `BEFORE UPDATE`, `BEFORE DELETE` and
   `BEFORE TRUNCATE` triggers that raise, plus a unique index on `prev` so the
   chain cannot be forked. Not application logic a bug can route around.
3. **Seals the browser cannot forge** — real SHA-256, computed server-side only.
   A seal a client sends is ignored.

Entries are written inside the transaction of the operation they describe, so
one cannot exist without the other.

**What is still true:** a superuser, or anyone who can restore a backup or drop
the triggers, can rewrite history. What they cannot do is rewrite it _quietly_ —
dropping a trigger is a schema change, and the whole chain would have to be
recomputed.

Use a non-superuser database role for the application. This is the main reason.

---

## Secrets that used to be in the browser bundle

The Chairman's override code was a constant in the front-end file. Anything in
the bundle is readable by anyone who opens devtools, so it protected nothing.

It is `OVERRIDE_PIN` on the server now, checked at `POST /override/verify`,
rate-limited to five attempts a minute, and **every attempt — accepted or
refused — is sealed into the ledger**, so a run of wrong codes is visible rather
than merely unsuccessful. With no `OVERRIDE_PIN` configured the server refuses
every override instead of waving them through.

Still outstanding, and stated here rather than buried: `DEMO_OTP = "4821"` is
still a constant in the legacy file. It gates nothing the override code does not
already gate, so it is not a hole so much as an unfinished feature — but it is
**not** a second factor and must not be described as one.

---

## Rules that are refusals, not screens

A rule enforced in React is not enforced. These are conditions on the request,
and `apps/api/src/tests/procurement.test.ts` sends the requests a tampered front
end would send to prove it:

- Stock someone is holding back cannot be issued.
- A delivery that breaches a storage cap is refused without an override, and the
  override is recorded with the name of whoever authorised it.
- A unit already sold cannot be booked again.
- RERA escrow money does not move until the engineer, the architect and the
  chartered accountant have all certified.
- A payment reminder is drafted by one person and approved by another.

---

## Input

- Every request body, query and param is validated by Zod before a handler sees
  it. Unknown fields on strict schemas are rejected, which is what stops a client
  supplying its own card version number.
- Prisma parameterises everything. The two raw queries in the codebase
  (`pg_advisory_xact_lock` and one roster check) use tagged templates, which
  parameterise too.
- **Uploads are sniffed by magic bytes**, not by filename or `Content-Type`. The
  stored name is generated server-side; a client-supplied one is how you get
  `../../etc/something` written where it should not be. Size is capped before
  the file is read into memory.

---

## Transport and headers

- HSTS, and HTTPS only in production. The refresh cookie is `Secure` there.
- `helmet` sets `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy` and a strict CSP. The API serves JSON and images and never
  HTML, so the strictest CSP costs nothing.
- CORS lists explicit origins with credentials. It cannot be `*` — a browser
  would refuse that combination anyway. Best is to serve both from one origin
  and not need CORS at all.

---

## Logging

Authorization headers, cookies, `set-cookie`, and every password field are
redacted before anything is written. Redaction is cheaper than an incident.

Every request has an id, in the log line and in any error body. A user quoting
"it said req-8f2c" leads straight to the trace. **The stack never leaves the
server** — a stack trace in a 500 tells an attacker what you are running.

---

## What is still NOT protected

Read this section to whoever is paying.

|                                                         |                                                                                                                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Salary is not encrypted at rest at the column level** | Anyone with database access reads it. Use an encrypted volume, keep database access to as few people as possible, and rotate that access when someone leaves.                                                                         |
| **No two-factor authentication**                        | An Employee ID (or email) and a password only. A stolen password is a stolen account until someone notices. The OTP component from the original build exists but is still not wired to a gateway, so it is still not a second factor. |
| **No SSO**                                              | No Google Workspace, no Entra.                                                                                                                                                                                                        |
| **Backups are not encrypted by default**                | `pg_dump` output is plain. Encrypt it before it leaves the server, and store it somewhere the server itself cannot reach — otherwise ransomware takes the backups too.                                                                |
| **No audit trail for reads**                            | The ledger records what changed. It does not record who _looked_ at a salary.                                                                                                                                                         |
| **No account expiry**                                   | Accounts stay live until someone disables them. Disable them as part of the exit process; the deboarding flow does not do it for you.                                                                                                 |
| **Rate limiting is in-memory**                          | Run more than one API instance and each keeps its own counters, so the effective limit multiplies. Move to a shared store before scaling out.                                                                                         |
| **Photo uploads are not virus-scanned**                 | The magic bytes are checked, so it is an image. That does not make it a safe image.                                                                                                                                                   |
| **The override code is one shared code**                | Not one per person, so the ledger records that _an_ override happened and who was signed in, not that a particular person knew the code. Rotate it when someone who knew it leaves.                                                   |
| **Nothing reaches a bank, a mailbox or WhatsApp**       | Withdrawal requests and payment reminders are recorded and sealed and go no further. Every such response says so — `submittedToBank: false`, `delivered: false`. Do not let a screen imply otherwise.                                 |

---

## If something goes wrong

1. **Rotate `JWT_SECRET`.** Every access token becomes invalid immediately.
2. `UPDATE refresh_token SET "revokedAt" = now() WHERE "revokedAt" IS NULL;` —
   ends every session everywhere.
3. Reset passwords for anyone affected (`PATCH /auth/users/:id` with a new
   password; it revokes their sessions too).
4. `GET /api/v1/ledger/verify`. If it returns `ok: false`, the record has been
   altered at the database level and you have a much larger problem — the
   application cannot do that.
5. `grep 'append-only' ` the logs. Anything there means something tried to modify
   the ledger. **Nothing in this codebase does that.**
6. Check `app_user` for accounts nobody created, and `lastLoginAt` for sign-ins
   at times nobody was working.

---

## Reporting a vulnerability

Email whoever administers this system directly. Do not open a public issue.
