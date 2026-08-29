# What changed in `MarbellaProcurementOS.jsx`, and why

This is your 12,931-line file. **Ten edits.** Nothing else was touched — no
screen was redesigned, no layout moved, no copy rewritten except where it had
become untrue, and not one colour changed.

Every edit is marked in the file with `EDIT n of 10` and a comment saying what
it replaced and why. Search for `EDIT ` to find them all.

If you ship a new version of the single-file build, re-apply these ten and it
runs against the server again.

| # | Line | What | Why |
|---|---|---|---|
| 1 | 601 | `ProcCtx` / `useProc` now come from `../proc/context.js` instead of being created here. | `ProcurementProvider` has to put live server data into the **same** context object these screens read. Two `createContext()` calls make two unrelated contexts; the symptom is `useProc()` returning `null` and a screen rendering blank with no error at all. |
| 2 | 751 | **The important one.** `Sign in` was `onClick={() => onLogin("admin")}`. | It ignored the Employee ID and the password you had just typed and signed **everyone** in as the Chairman — salaries, budgets, overrides, the lot. It now sends both to the server and awaits the answer, and the desk you land on is the one the **database** says you hold. Errors are shown in the server's own words. |
| 3 | 764 | The nine desk chips prefill the Employee ID instead of signing you in. | They used to sign you straight in as that role with no password: nine doors with no locks. They are still there — they are genuinely useful for a demo — but they only type the ID for you now. |
| 4 | 10190 | `verifyLedger` checks the chain's **structure** here and takes the **cryptographic** verdict from `chainVerified`, naming the entry that failed. | **A real bug, found by opening the app rather than reading test output.** The server seals with SHA-256; the `fingerprint()` in this file is the single-file build's 64-bit FNV pair. Re-deriving seals here disagreed with every entry, so a perfectly healthy ledger reported **"Ledger broken at entry 5"**. A false alarm on a tamper-detector is worse than none: it teaches people to ignore it. |
| 5 | 10378 | `commit()` in Bulk intake is `async` and awaits `bulkAddPeople`. | The server assigns employee IDs, resolves the employer from the posting and normalises dates, so the count has to come back from it. The screen now reports what actually **landed**; rows the server held back are counted as skipped. |
| 6 | 7396 | Eight `Print` buttons now open the print dialog. | They said "Sending to printer…" and did nothing whatsoever — no dialog, no document, nothing reaching a printer. If a kiosk browser blocks the dialog, the screen says so rather than pretending. |
| 7 | 7408 | `Call` buttons dial. | They raised a "Calling…" toast and stopped there. On a site phone this opens the dialler; on a desktop it hands off to whatever handles `tel:` links, and if nothing does, the number is shown so it can be dialled by hand. |
| 8 | 1495 | `Save these permissions` writes access rows and awaits the result. | It announced a change and forgot it the moment the screen closed. **Nobody's access ever moved.** The grid is now sent to the server, sealed against the administrator who made the change, and applies at their next sign-in. |
| 9 | 2427 | Purchase desk: `const list = [...pos, ...POS]` → `const list = pos`. | `pos` is the live list from the server, and the server was seeded from the `POS` constant below — so every purchase order rendered **twice**, with a duplicate React key. |
| 10 | 6670 | Receive-shipment scanning reads `pos`, not the `POS` constant. | Half the search pool was a stale copy, so scanning a PO could match the frozen version rather than the live one. |

## What did NOT change

- **The default export still works.** `import App from './legacy/MarbellaProcurementOS.jsx'`
  renders the original build against its own constants with no server at all,
  which is useful for showing the UI on a laptop with nothing running.
- All nine desks and their navigation, every card, the coach marks, the gate
  screens, the cost engine, the whole palette and every line of copy that was
  still true.

## Proof that edit 4 did not simply switch the detector off

The tamper check is not "always green now". Verified in Chromium by
intercepting `/api/v1/bootstrap` and corrupting the ledger on the way into the
browser, then reading the verdict off the Exits screen:

| The ledger the browser was handed | What the UI said |
| --- | --- |
| untouched | **Ledger intact — 7 entries** |
| one entry's `detail` edited | **Ledger broken at entry 5** |
| one entry deleted | **Ledger broken at entry 5** |
| two entries swapped | **Ledger broken at entry 5** |
| one entry's `seal` rewritten | **Ledger broken at entry 6** |

Each of those points at the right row. It used to say "entry 1" for any
contents change, because the boolean the provider passed down carried no
position — which sends whoever investigates to an innocent entry. The provider
now hands the index and the reason through, so the screen can name the row that
actually failed. (A rewritten seal is caught one entry later, at the row whose
`prev` no longer matches — which is exactly where the break is.)

Reproduce it with `scripts/tamper.mjs`, or by editing a `detail` in the
response in devtools.

## Things still worth doing

Nothing here is a lie the app tells; they are limits, and each is stated on the
screen it affects.

- `DEMO_OTP = "4821"` is still a constant in this file. The Chairman's override
  PIN was moved to the server (`OVERRIDE_PIN`, checked at
  `POST /api/v1/override/verify`, rate-limited, every attempt sealed) — the OTP
  path has not been. It gates nothing the override does not already gate, but
  it should become a real one-time code before this faces the internet.
- Nothing talks to a bank, a mail server, or WhatsApp. Withdrawal requests and
  payment reminders are recorded and sealed, and each response says plainly
  that it has not been submitted or sent.
- The main JS chunk is about 1.4 MB (449 KB gzipped). It loads fine on a site
  phone but would load faster split per desk.
