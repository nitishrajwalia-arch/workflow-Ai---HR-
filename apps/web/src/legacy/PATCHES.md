# What changed in `MarbellaHR.jsx`, and why

This is your 7,312-line file. **Seven edits.** Nothing else was touched — no
screen was redesigned, no logic was rewritten, no styling was changed.

Every edit is marked in the file itself with `EDIT n of 7` and a comment saying
what it replaced. Search for `EDIT ` to find them all.

If you ship a new version of the single-file build, re-apply these seven and it
will run against the server again.

| # | Line (approx) | What | Why |
|---|---|---|---|
| 1 | 30, 181 | `ProcCtx` and `useProc` now come from `../proc/context.js` instead of being created locally. | `ProcProvider` has to put live server data into the **same** context object these screens read. Two `createContext()` calls make two unrelated contexts; the symptom is `useProc()` returning `null` and a screen rendering blank with no error at all. |
| 2 | ~7175 | `function HRShell()` → `export function HRShell()`. | So `App.tsx` can render it inside the provider. Purely additive. |
| 3 | ~185, ~201 | `toast` and `Toaster` exported. | So the shell and `ProcProvider` can raise a toast when the server refuses something. Purely additive. |
| 4 | ~4662 | `commit()` in Bulk intake is now `async` and `await`s `bulkAddPeople`. | The server assigns employee IDs, resolves the employer from the posting, and normalises dates — so the count has to come back from it. The screen now reports what actually **landed**; rows the server held back are counted as skipped, not added. |
| 5 | ~5331 | The "who is leaving" button's `onClick` is `async` and `await`s `openExit`. | The exit id is assigned by the server. |
| 6 | ~4477, ~5257, ~7130 | `verifyLedger` now checks the chain's **structure** synchronously and takes the **cryptographic** verdict from `chainVerified`. | **This was a real bug, caught by looking at the running app.** The server seals with SHA-256; the old `fingerprint()` in this file is the single-file build's 64-bit FNV pair. Re-deriving seals here disagreed with every entry, so a perfectly valid ledger showed **"SEAL BROKEN"** on the HR desk and **"Ledger broken at entry 5"** on Exits. A false alarm on a tamper-detector is worse than none: it teaches people to ignore it. |
| 7 | 1-40, ~5270, ~6770 | Four pieces of copy that were true of the single-file build and are now false. | The ledger explainer said "it cannot prevent it — this app runs entirely in your browser". Usage said "counts reset when the app reloads". The header said authorisation was browser-side only and salary sat in the file in plain text. All four now describe what is actually true, caveats included. |

## What did NOT change

- **The default export still works.** `import App from './legacy/MarbellaHR.jsx'`
  renders the original build against its own seeded data with no server at all,
  which is useful for showing the UI on a laptop with nothing running.
- All 20 letter templates, the CSS 3D org board, the card bureau's two
  deliberately unequal paths, every validation message, the whole palette.

## What edit 6 does NOT do

It does not make the check always pass. Verified in a real browser by
intercepting `/bootstrap` and corrupting the ledger on the way in:

| The ledger the browser was handed | What the UI said |
| --- | --- |
| untouched | seals intact (green) |
| one entry's `detail` edited | **SEAL BROKEN** (red) |
| one entry deleted | **SEAL BROKEN** (red) |
| two entries swapped | **SEAL BROKEN** (red) |

The structural half (does every entry name the previous one's seal?) runs
synchronously here and catches deletion, reordering and insertion on its own.
The cryptographic half is real SHA-256, computed by the server AND recomputed
independently by the browser in `ProcProvider` — so a server lying about its own
ledger health is caught too.

---

## One behaviour that genuinely changed

`seal()` is now a no-op.

In the single-file build it appended a ledger entry from the browser. It cannot
do that any more and it **must not**: a ledger entry written by a client is
worth nothing. Entries are appended by the server, inside the transaction of the
operation they describe — so by the time a screen used to call `seal()`, the
entry it wanted already exists. The stub is there only so the screens that call
it keep working.

## Where each action goes now

| `ProcCtx` action | Endpoint |
|---|---|
| `updatePerson` | `PATCH /api/v1/people/:id` |
| `setEmployer` | `POST /api/v1/people/:id/employer` — needs a written reason |
| `issueCard` | `POST /api/v1/cards` — the server assigns the version |
| `bulkAddPeople` | `POST /api/v1/imports/people` |
| `openExit` / `advanceExit` | `POST /api/v1/exits` · `POST /api/v1/exits/:id/advance` |
| `saveCompany` / `saveProject` | `PUT /api/v1/companies/:id` · `PUT /api/v1/projects/:id` |
| `setSalary` / `setContact` | `PUT /api/v1/salaries/:pid` · `PUT /api/v1/contacts/:pid` |
| `addDevice` / `dropDevice` | `POST /api/v1/devices` · `DELETE /api/v1/devices/:id` |
| `setDeptRule` / `setLeave` | `PUT /api/v1/dept-rules/:dept` · `PUT /api/v1/leave-policy/:dept` |
| `saveJD` | `PUT /api/v1/job-descriptions` |
| `logDoc` | `POST /api/v1/documents` |
| `track` | `POST /api/v1/usage/track` |
| `seal` | nothing — see above |

## Three things `ProcCtx` now has that it did not before

| Key | What it is |
|---|---|
| `me` | The signed-in user: `{ id, name, email, role, personId, title }`. The UI no longer needs to hard-code Simran Kaur. |
| `chainVerified` | `true` / `false` / `null`. The browser independently recomputes every ledger seal on load, so a server that lied about its own ledger health would be caught. `null` means the check has not finished. |
| `reload()` | Re-fetches everything. Useful after an import or on a "refresh" button. |
