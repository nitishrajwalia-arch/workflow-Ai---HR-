# Start here

Marbella Procurement OS — purchasing, stores, accounts, the gate and HR, as one
application. React front end, Fastify + PostgreSQL behind it.

This file is the ten-minute version. `README.md` is the real one, and
`docs/DEPLOYMENT.md` is what you want when you put it on a server.

---

## Run it locally

You need **Node 22+** and **PostgreSQL 16**.

```bash
npm run setup                 # install, generate the Prisma client, build shared
cp .env.example .env          # then edit the two lines below
npm run db:deploy             # create the tables
npm run db:seed               # people, projects, vendors, stock, the ledger
npm run dev                   # API on :4000, web on :5173
```

Two lines in `.env` must change before anything starts:

```dotenv
DATABASE_URL="postgresql://user:password@localhost:5432/marbella?schema=public"
JWT_SECRET="<openssl rand -base64 48>"
```

The server refuses to start without them, **by name**, rather than failing later
on the first request that happens to need one.

Then open <http://localhost:5173>.

## Signing in

Sign in with an **Employee ID** and a password. The seed prints the
administrator's password once; set `BOOTSTRAP_ADMIN_PASSWORD` in `.env`
beforehand if you would rather choose it.

The nine chips under the sign-in button fill in a desk's Employee ID for you.
They do **not** sign you in — the password is still required, and which desk you
land on is decided by the database, not by the browser.

| Desk               | Employee ID   |
| ------------------ | ------------- |
| Chairman           | `MB-ADM-0001` |
| HR Head            | `MB-HR-0001`  |
| Purchase Manager   | `MB-PUR-0012` |
| Purchase Assistant | `MB-PUR-0018` |
| Store Manager      | `MB-STR-0004` |
| Store Assistant    | `MB-STR-0009` |
| Accounts           | `MB-ACC-0002` |
| Maintenance        | `MB-MNT-0006` |
| Gate / Security    | `MB-SEC-0007` |

## Just want to look at it?

```bash
npm run demo
```

That writes `apps/web/dist-demo/demo.html` — one self-contained file, about
1.5 MB. Open it in a browser with nothing else running. It is the real interface
on seeded data with **no server behind it**, so nothing is saved past a refresh
and none of the rules are enforced; the banner across the top says so. Useful
for showing someone the screens before there is anywhere to deploy it.

## Checking it for yourself

```bash
npm run check                 # format, lint, typecheck, 164 tests — what CI runs
npm run build                 # production build of all three packages
```

With `npm run dev` up, two scripts drive a real browser:

```bash
node scripts/audit-desks.mjs  # all nine desks, 71 screens, console must be empty
node scripts/tamper.mjs       # corrupt the ledger five ways, read back the verdict
```

Both need Playwright's Chromium (`npx playwright install chromium` once). Set
`CHROMIUM=/path/to/chrome` to use one you already have.

## Where things are

```
packages/shared/   validation, the ledger seal, the API contract — imported by
                   BOTH sides, so the browser and the server cannot disagree
apps/api/          Fastify server, Prisma schema, migrations, seed
apps/web/          React app; the original UI lives in src/legacy/
scripts/           the two browser checks above
docs/              deployment, architecture, API, security, front-end notes
```

`apps/web/src/legacy/PATCHES-PROCUREMENT.md` lists the **ten edits** made to the
original single-file build and why each one was needed. Nothing else in that
file was touched.

## Read before you go live

- `docs/DEPLOYMENT.md` — nginx, TLS, systemd or Docker, backups, first-run list.
- `docs/SECURITY.md` — including **"What is still NOT protected"**. Read that
  section to whoever is paying. Salary is not encrypted at column level, there
  is no 2FA, `DEMO_OTP` is still a constant, and nothing here talks to a bank,
  a mail server or WhatsApp — every such response says so in as many words.
- Set `OVERRIDE_PIN`. Leave it unset and every override is refused, which is the
  right way round, but nobody will be able to breach a storage cap.

Live API reference at `/docs` once the server is running.
