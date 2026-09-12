# Importing the company's own data

These three scripts turn the workbooks the company supplies into
`apps/api/prisma/real-data.ts`. Run them in order, from the repository root,
with the workbooks in the current directory.

```bash
python3 scripts/import/01-employees.py    # employee register -> people.json
python3 scripts/import/02-residents.py    # tower register    -> units.json
python3 scripts/import/03-generate.py     # both              -> real-data.ts
npm run db:seed -- --wipe                 # replace everything in the database
```

`--wipe` empties every table, **including the append-only ledger**. That is the
only operation in this system that can, it disables the database triggers for
the length of one transaction to do it, and it exists so that a data load
starts from a known state. Do not run it against a live database that has
history worth keeping.

## What these scripts refuse to do

They do not guess. Every join is on `(name, department)` and, where a
department holds two people of the same name, their position in that
department's block. A row that will not join is **reported, not merged** — the
run prints them and they are left out rather than attached to whoever looks
closest.

Known things the last run reported, all genuine discrepancies in the source:

| Sheet | Row | What |
| --- | --- | --- |
| KYC | Prem Ranjan | Employee Details has a Prem Kumar in Project; no way to tell whether these are the same person |
| Timings, Companies, Dept list, Assets | Ravinder Singh | Not in Employee Details, which instead has a Vinod Kumar in Project |
| Dept Wise List | Chetan Malik, Sandeep Pathania, Manoj, Gurpreet Singh | Listed twice each in Purchase |
| Tower D | D-2103 | Row appears twice, identical |
| Tower E | E-2102 | Row appears twice, identical |

## Things the source gets wrong that the scripts work around

- **"Companies Wise Employee Salary" has its Designation and Department headers
  swapped.** The data is department-then-designation. Joining on the header
  matched nothing at all.
- **Tower E's "Address" column contains email addresses.** Resolved by content,
  not by position.
- **Every tower sheet has a different column layout** — B and E carry a fourth
  applicant, C has no third. Columns are found by header name per sheet.
- **"MAINTAINANCE"** is normalised to Maintenance. Department names are
  structural and code branches on them. **Designations are left exactly as
  written** — "Plunber", "Carpainter", "Computer Oprater", "Planing" and
  "Senior Formen" are all in the source. Correct them in the source and re-run;
  they are job titles that print on letters, and this import is not the place
  to decide what somebody's title should say.
