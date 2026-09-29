# Runbook

Day-two operations. Backup, restore, migrate, rotate, and what to do when
something is wrong at nine in the morning with payroll due.

Every command here assumes you are on the server as a user who can `sudo -u
postgres`. Replace `marbella` with your database name if you chose another.

---

## 1. Backup, and the restore you must test

A backup nobody has restored is a belief. Do the restore once, now, before you
need it.

### Taking one

```bash
sudo -u postgres pg_dump -Fc marbella > /var/backups/marbella-$(date +%F).dump
tar czf /var/backups/uploads-$(date +%F).tgz -C /srv/marbella uploads
```

**Both halves, every time.** The dump has the records; the tarball has the
photographs, scanned documents and ID cards. A dump on its own restores an app
where every person's papers are gone.

Nightly, via cron:

```cron
15 2 * * * sudo -u postgres pg_dump -Fc marbella > /var/backups/marbella-$(date +\%F).dump
20 2 * * * tar czf /var/backups/uploads-$(date +\%F).tgz -C /srv/marbella uploads
30 3 * * * find /var/backups -name 'marbella-*.dump' -mtime +30 -delete
```

These files contain Aadhaar numbers, PAN numbers, home addresses and every
salary. They belong somewhere encrypted, with an access list you can produce
on request.

### Restoring one — practise this

```bash
sudo -u postgres createdb marbella_restore_test
sudo -u postgres pg_restore -d marbella_restore_test /var/backups/marbella-2026-09-29.dump
```

Then point a **local** copy of the API at it and sign in:

```bash
DATABASE_URL='postgresql://…/marbella_restore_test' npm run dev -w @marbella/api
```

You are checking three things: it restores without errors, you can sign in,
and the ledger still verifies (the HR desk shows *Ledger intact — N entries*).
If the ledger is broken in a restore, the dump was taken mid-write; use
`pg_dump` as above rather than copying data files.

Drop the scratch database when you are done.

---

## 2. Deploying a new version

```bash
cd /srv/marbella
git pull
npm ci
npm run build
npm run db:deploy                          # applies pending migrations only
sudo systemctl restart marbella-api
```

`db:deploy` never resets and never drops. If it refuses because a
migration is recorded as failed, do not delete the row blindly — read the
error, fix the database by hand to the state the migration wanted, then mark
it applied. A failed migration half-applied is the one situation where you
want the restore you practised.

**Migrations are forward-only.** There are no down migrations. To undo a
schema change, write a new migration that undoes it.

---

## 3. Rotating secrets

| Secret | Effect of rotating | How |
| --- | --- | --- |
| `JWT_SECRET` | Every signed-in person is signed out. Nothing is lost. | Set the new value, restart. Tell people first, or do it at night. |
| Database password | None, if you update `DATABASE_URL` in the same breath. | `ALTER USER marbella WITH PASSWORD '…';` then edit the env and restart. |
| `OVERRIDE_PIN` | The old pin stops working immediately. | Set and restart. Tell whoever uses it. |

Rotate `JWT_SECRET` if a `.env` has ever been pasted into a chat, a ticket, or
a screenshot.

---

## 4. When something is wrong

### The app will not start

Read the first twenty lines of the log. The environment is validated on boot
and the error names the variable:

```bash
journalctl -u marbella-api -n 40 --no-pager
```

`JWT_SECRET must be at least 32 characters` and `DATABASE_URL is required` are
exactly what they say.

### Everything returns 502

nginx cannot reach the API. Is it running, and on the port nginx proxies to?

```bash
systemctl status marbella-api
curl -s localhost:4000/health/ready
```

### `/health/ready` returns 503

The database is not answering. Check Postgres is up, then that the credentials
in `DATABASE_URL` still work:

```bash
systemctl status postgresql
psql "$DATABASE_URL" -c 'select 1'
```

### The ledger shows as broken

The HR desk says *Ledger broken at entry N*. This means an entry was changed,
removed or reordered in the database — the triggers make that hard, not
impossible for a superuser.

It is not a thing to fix by editing the ledger. Find out what happened:

```sql
SELECT seq, kind, subject, detail, "at" FROM ledger_entry
WHERE seq BETWEEN <N-3> AND <N+3> ORDER BY seq;
```

Then compare with last night's backup. The entry that differs is the answer,
and the question is who had superuser access.

### Somebody was paid twice

Look at the pay run, not the bank. `Payroll → What has gone out → Look at the
lines`. Two lines for one person on one sheet is the shape; the Accounts file
lists every person once per line so it is visible there too. The run is frozen
once released — a correction is a new run, deliberately, so that what Accounts
paid from stays readable.

### A month was worked out with the wrong attendance

Re-upload the attendance and work the month out again. A **draft** is replaced.
A **released** month is not: it is what Accounts paid from. Correct it in the
next month with an arrear line, which is what the arrear column is for.

---

## 5. Things to watch

There is no monitoring stack in here. The three things worth an alert:

| | Check | Why |
| --- | --- | --- |
| The API answers | `GET localhost:4000/health/ready` every minute | It is the whole app. |
| Disk | Under 80% | Uploads grow, and so does Postgres. A full disk corrupts nothing but stops everything. |
| The nightly dump | A file appeared, and it is bigger than 1 MB | A cron that silently stopped is the classic way to have no backups. |

If you want one thing: alert on the dump not appearing. The others announce
themselves.

---

## 6. Routine, by the calendar

**Every month, after payroll:** check the Accounts file against what was
actually paid out. Once.

**Every quarter:** restore a backup into a scratch database and sign in
(§1). Read the deduction heads against what the law says now.

**Every time somebody leaves the company:** their account, not just their
employee record. `Access` → revoke. The deboarding's assets stage prompts for
it; this is the one to check by hand anyway.

**Every time somebody joins IT or leaves it:** who has superuser on the
database. That is the access that can rewrite the ledger.
