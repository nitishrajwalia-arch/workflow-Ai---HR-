# Going live

What has to be true before real people use this, what is deliberately not in
it, and what is still open. Written to be argued with: if you disagree with a
line, that is the point of writing it down.

Nothing here is aspirational. Every "done" below is something you can check
yourself with the command beside it.

---

## 1. Blockers — do not go live without these

| | Why | How to check |
| --- | --- | --- |
| **`JWT_SECRET` is 32+ random characters, not a phrase** | It signs every session. Guess it and you are every user. | `openssl rand -base64 48` to make one. The server refuses to start without at least 32 characters. |
| **The database user is not a superuser** | A superuser can drop the append-only triggers on the ledger, which is most of what makes the ledger worth having. | `\du marbella` in psql — no `Superuser` attribute. |
| **The three `ledger_entry` triggers exist** | Without them the audit trail can be edited in place and the app cannot tell. | Query in `DEPLOYMENT.md` §1. |
| **Ports 4000 and 5432 are closed to the internet** | The API trusts nginx for TLS and rate limits. The database trusts nobody. | `nmap` from outside, or `ss -tlnp` on the box. |
| **`CORS_ORIGINS` is the real origin, not `localhost`** | A wildcard or a stale origin lets another site drive the API as a signed-in user. | The server warns on boot if it still says localhost. |
| **A backup has been taken AND restored once** | An untested backup is a belief, not a backup. | `RUNBOOK.md` §1. Restore into a scratch database and sign in against it. |
| **The bootstrap password has been changed** | The seed prints it once, to a terminal, and it may be in somebody's scrollback. | Sign in; the account is forced to change it. |
| **`OVERRIDE_PIN` is set to something nobody has been told casually** | It is the override on money screens. | It has no default; unset means the override is unavailable, which is a safe state. |

---

## 2. What is deliberately NOT in this

Not oversights. Each one was a decision, and each is cheap to add later if the
answer changes.

**No email and no SMS.** Letters, ID cards and payroll files are generated and
downloaded. Nothing is sent. Adding sending means choosing a provider, and
an offer letter that "was sent" and silently was not is worse than one HR
knows they have to attach.

**No object storage.** Uploads go to `UPLOAD_DIR` on local disk. This is why
there is one API process and why the backup in `RUNBOOK.md` includes that
directory. Moving to S3 is a day's work and is the first thing to do if you
ever want two API processes.

**No background jobs.** Everything happens inside the request that asked for
it. There is no queue to get stuck and no worker to monitor.

**No multi-tenancy.** One company group, one database. The four legal entities
are rows, not tenants.

**The browser is not trusted with anything.** Role checks, rate limits and
every rule live on the server. The front end is a rendering of what the server
already decided. Do not move a check into it "for speed".

---

## 3. Data that is real, and data that is missing

The register carries **126 people**. Everything in it came from the company's
own registers and August salary books. **Nothing is invented** — where a fact
is not known, the field is empty and something on screen says so.

Known gaps, in the order they cost something:

| Gap | Where it shows |
| --- | --- |
| **11 people paid in August whom the register has never heard of** (Manya and Sumedha of the original 13 are now enrolled) | Exits & F&F → *Paid, and not on the register*. Each one is answerable: an employee under a different spelling, or somebody never enrolled who has since left. |
| **Nobody is recorded as having left** | Exits & F&F says so plainly. Until a deboarding is carried through, the register shows all 126 as employed. |
| **7 active people with no salary on file** | They are left out of a pay run and named after it. |
| **126 people with no photograph** | ID cards print without one. |
| **No allowance policy is set** | The mechanism exists; no company has a row. Nothing was invented to fill it. |
| **Two people share a mobile number; one number has 20 digits** | The HR checklist covers these. |

None of these stops the app working. All of them are things a person has to
answer, and the app asks rather than guessing.

---

## 4. Before the first payroll runs on it

Payroll is the part that moves money, and it is worth a separate pass.

- [ ] Work a month out that has **already been paid** and compare every line
      with the company's own book. `apps/api/src/tests/pay.test.ts` does this
      for August 2026 and lists the six places the books differ from their own
      rules — read that list before you trust a seventh.
- [ ] Check the **deduction heads** for each of the four companies against what
      the law says today. The rates are rows, not code, precisely so that this
      is an edit somebody makes and signs rather than a release.
- [ ] Decide the **E.S.I. ceiling question**. The August books deduct E.S.I.
      from nine people earning above the statutory ₹21,000 ceiling. The software
      does what the company does. Somebody should decide which is right.
- [ ] Decide the **rounding question**. Three of the four books round E.S.I. to
      the nearest rupee; the regulation says round up. It is about a rupee a
      head a month, and it is the kind of rupee an inspection asks about.
- [ ] Run one month, download the Accounts file, and have Accounts confirm the
      shape is what they can pay from **before** anybody depends on it.

---

## 5. Regulated data (DPDP)

Aadhaar, PAN, home addresses, full mobile numbers, salaries and residents'
details are in the database. The rules the code already enforces:

- Salary and identity documents are behind a role check on the **server**, not
  hidden in the UI.
- The shareable preview bundle has them **absent, not masked** — there is
  nothing to recover in devtools. `scripts/leak-check.py` proves it by reading
  every regulated value out of the database and searching the built file for
  it. It runs in CI. If you change what the preview carries, run it.
- The assistant refuses salary, Aadhaar, PAN and addresses outright rather than
  answering carefully.

What is still on you:

- [ ] A retention decision. Nothing is deleted today.
- [ ] Who at Marbella is accountable for a data request, and how it is answered.
- [ ] Backups contain everything above. They belong somewhere encrypted with
      access you can list.

---

## 6. What green looks like

```bash
npm ci
npm run typecheck     # 0 errors
npm run lint          # 0 errors (warnings are allowed)
npm test              # 421 tests, all passing
python3 scripts/leak-check.py    # 0 found
```

CI runs all of it against a real PostgreSQL on every push. If CI is red, do
not deploy it — there is no test in here that fails for an interesting reason.
