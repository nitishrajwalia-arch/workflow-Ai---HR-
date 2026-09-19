# Importing the company's own data

These scripts turn the files the company supplies into the modules the seed
reads. Run them in order, from the repository root.

```bash
python3 scripts/import/01-employees.py    # employee register  -> people.json
python3 scripts/import/02-residents.py    # tower register     -> units.json
python3 scripts/import/03-generate.py     # both               -> real-data.ts
python3 scripts/import/05-gaps.py   gaps-v1.xlsx gaps-v2.xlsx [--master master.xlsx]
python3 scripts/import/06-attendance.py  attendance.xls      # -> real-attendance.ts
npm run db:seed -- --wipe                 # replace everything in the database
python3 scripts/import/04-preview.py boot.json   # -> the shareable preview
python3 scripts/leak-check.py             # prove the preview carries nothing regulated
```

`real-data.ts` is what the company's own registers say. `real-gaps.ts` is what
HR went and asked afterwards, on the data-gap workbook, and the seed applies the
second over the first — never the other way round, so any field in the database
can still be traced to the sheet it came from. `real-attendance.ts` is one month
of the biometric machine's export, matched to the roster once by name; after that
first match every export joins on `Person.biometricId`, the machine's own number.

Give `05-gaps.py` every revision of the gap workbook HR has sent, **oldest
first**. They are layered: a later file overrides the earlier answer for the
fields it carries and leaves the rest standing. HR corrects a copy and sends it
back rather than starting again, so a row a newer file gets wrong — or loses —
must not take a correct earlier answer down with it.

An EMPTY cell means "not answered" and leaves what is on file alone. A cell
reading **"Not Given"** is HR answering that there is no such thing, and clears
the field. The two are not the same: collapsing them meant a later revision
could add a personal email but never remove a wrong one.

`--master` is optional and points at the company's own workbook. It recovers the
rows the first import held back — a KYC record and an issued desktop filed under
a name the master list did not carry — now that the gap sheet has said whose they
are.

### A deleted row is not a correction

Deleting a row in Excel pulls every row below it up by one, and the employee ID
column does not come with them. The second revision removed a duplicate that
way, and three people in Maintenance ended up sitting on the ID above their
own — including the Maintenance Manager, whom nineteen people report to. The
department would have ended up reporting to the gym trainer.

`05-gaps.py` checks each file for that on its own, before anything is layered: a
name being replaced somewhere in a department that is also a name being
introduced somewhere else in the same file is a slip, not a rename. The whole
block is refused, the run says so in capitals, and the earlier revision's
answers stand. **Clear the contents of the row rather than deleting the row.**

**Nothing is resolved quietly.** Every contradiction the scripts find is printed,
written to `GAP_CONFLICTS`, and raised as a task on the HR desk. Run
`scripts/leak-check.py` after any change to what the preview carries: it reads
every regulated value out of the database and looks for it in what the preview
actually ships. Identifiers must therefore never be written into free text —
a task that quotes a mobile number puts that number at a URL.

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

Known things the last run reported, all genuine discrepancies in the source.
The first two were answered by the data-gap workbook: both reserved IDs turned
out to be a second copy of somebody already on the payroll, and `05-gaps.py`
folds them in. Neither number is reused — see `RetiredEmployeeId`.

| Sheet                                 | Row                                                   | What                                                                                           |
| ------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| KYC                                   | Prem Ranjan                                           | **Answered.** Same serial number, same row of every sheet, as MB-PRJ-0060 — whose name HR has corrected to Prem Ranjan. One person, two spellings. |
| Timings, Companies, Dept list, Assets | Ravinder Singh                                        | **Answered.** Same serial as MB-PRJ-0036, whose name HR has corrected to Ravinder Bawa. The desktop filed under him moves with him. |
| Dept Wise List                        | Chetan Malik, Sandeep Pathania, Manoj, Gurpreet Singh | Listed twice each in Purchase                                                                  |
| Tower D                               | D-2103                                                | Row appears twice, identical                                                                   |
| Tower E                               | E-2102                                                | Row appears twice, identical                                                                   |

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
