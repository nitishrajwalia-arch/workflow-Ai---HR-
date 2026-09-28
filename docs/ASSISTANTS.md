# Connecting ChatGPT and Claude

One connector serves both. ChatGPT and Claude have converged on the same
protocol — MCP — so there is a single endpoint, and anything else that learns to
speak it later will work without more being built.

```
POST  https://<your-server>/api/v1/assistant/mcp
```

## What it is, in one paragraph

Somebody's assistant signs in **as them**, with the same Employee ID and
password they type into the app, and holds **their** role. A storeman's Claude
sees what the storeman sees. It has no account of its own, because an account of
its own would be a way round every gate on the other 129 routes in this API.

## What it may do today

**Reading only.** Nothing it can do changes a record.

| Tool | What it answers | Needs |
| --- | --- | --- |
| `find_people` | Search the register by name, department, designation or site | Viewer |
| `get_person` | Role, department, manager, site, joining date, weekly off | Viewer |
| `headcount` | Counts by department, company, site or staff type | Viewer |
| `who_reports_to` | Somebody's manager and their direct reports | Viewer |
| `list_projects` | The projects and which company owns each | Viewer |
| `upcoming_dates` | Birthdays and work anniversaries ahead | Viewer |
| `holidays` | The holiday calendar and working hours by department | Viewer |
| `attendance_summary` | Days present, absent and on their weekly off | Manager |
| `open_hr_tasks` | What is outstanding on the HR desk | HR |

## What it can never do

Not gated — **absent**. The tools that could carry this data are not written, so
no configuration mistake can switch them on:

- salary figures, of any person or in any total
- pay runs, payslips, what went out in a month
- Aadhaar numbers, PAN numbers, home addresses
- personal mobile numbers and personal email addresses
- bank accounts, cards, anything that moves money

A test asserts that **every** tool, called with every argument, returns no
twelve-digit number, no PAN-shaped string and no salary-sized figure.

### Why that line is drawn there

A question typed into ChatGPT or Claude travels to OpenAI's or Anthropic's
servers. Under India's DPDP Act, sending an employee's Aadhaar to a third party
is a decision for the company to take deliberately and write down — not one to
arrive at because a flag was left on. If the management later decide otherwise,
that is a conversation and a signature, not a config change.

## Setting it up

**Claude** — Settings → Connectors → Add custom connector. Give it the URL above
and the bearer token from a normal sign-in.

**ChatGPT** — Settings → Connectors → Add. Same URL, same token. (Business,
Enterprise or Edu; personal plans cannot add custom connectors yet.)

Then, once:

```
POST /api/v1/assistant/connect   { "client": "Claude" }
```

That writes one line into the ledger — who pointed an assistant at the company,
when, and that it was read-only. Individual reads are **not** sealed; that would
bury the ledger in noise. The act of connecting is the thing worth recording.

## Seeing what yours can do

```
GET /api/v1/assistant/permissions
```

Answers in plain words: what your assistant may read, what is withheld from
your role, and what is withheld from every role. Any signed-in person can call
it — the honest answer to "what can ChatGPT see about me" should not itself
need a privilege.

## Widening it later

`apps/api/src/assistant/permissions.ts` is the whole list, on purpose, in one
readable file. To give an assistant more, change a line there. To answer "can
ChatGPT see our salaries", read that file — you do not have to be a programmer.

Turning on a **write** means an assistant can change a real record from a
sentence somebody typed. Each one should be a deliberate act with a name against
it, which is why every tool ships `writes: false`.
