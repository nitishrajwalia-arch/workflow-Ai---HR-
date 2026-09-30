# The developer pack

Everything needed to take this from a repository to a thing real people use,
and to keep it running afterwards.

Read in this order if you have never seen it before.

| | | |
| --- | --- | --- |
| 1 | [**../START-HERE.md**](../START-HERE.md) | Running it locally in about five minutes |
| 2 | [**ARCHITECTURE.md**](ARCHITECTURE.md) | How it is put together, and why it is put together that way |
| 3 | [**DATA-MODEL.md**](DATA-MODEL.md) | The map of sixty-one tables, before you open the schema |
| 4 | [**CONTRIBUTING.md**](CONTRIBUTING.md) | How the code here is written. Read before your first pull request |
| 5 | [**API.md**](API.md) | Every endpoint in prose. The live version is at `/docs` |
| 6 | [**FRONTEND-INTEGRATION.md**](FRONTEND-INTEGRATION.md) | How the browser talks to the API |
| 7 | [**SECURITY.md**](SECURITY.md) | What is defended, and what is not |
| 8 | [**DEPLOYMENT.md**](DEPLOYMENT.md) | Putting it on a server. Docker or systemd |
| 9 | [**GO-LIVE.md**](GO-LIVE.md) | **The blockers, the known gaps, and what is deliberately not in it** |
| 10 | [**RUNBOOK.md**](RUNBOOK.md) | Backup, restore, migrate, rotate, and what to do when it breaks |
| — | [**ASSISTANTS.md**](ASSISTANTS.md) | The ChatGPT and Claude connector |

---

## The short version

A Fastify 5 / Prisma 7 / PostgreSQL 16 API and a React front end, in an npm
workspaces monorepo. One database, one API process, no queue, no object store.
421 tests against a real database, no mocks. CI runs all of it on every push.

```bash
npm run setup     # install, generate the Prisma client, build shared
npm run db:deploy # create the tables
npm run db:seed   # people, projects, vendors, stock, the ledger
npm run dev       # API on :4000, web on :5173, live API docs on :4000/docs
npm test
```

`START-HERE.md` has the same four lines with the database set-up around them.

## Three things to know before you change anything

**Nothing is invented.** Where a fact is not known, the field is empty and
something on screen says so. A made-up date looks exactly like a real one and
will be read as a fact by every letter, report and payslip downstream.

**The browser is not trusted.** Every role check, rate limit and business rule
is on the server. The front end renders what the server already decided.

**The ledger is append-only, and the database enforces it.** Three triggers
block `UPDATE` and `DELETE`. This is why the application's database user must
not be a superuser — see [GO-LIVE.md](GO-LIVE.md).

## If you only read one page

[GO-LIVE.md](GO-LIVE.md). It is the honest list: what must be true before real
people use this, what is deliberately absent, and what is still open — with the
command to check each one yourself.
