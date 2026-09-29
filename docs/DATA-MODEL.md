# The data model

Sixty-one tables. This is the map you want before opening
`apps/api/prisma/schema.prisma`, which is long and has the real answer.

The schema itself is commented heavily, and those comments are where the
reasoning lives — several of them record a bug the shape used to allow. Read
them before changing a column.

---

## The spine

Almost everything hangs off four tables.

```
Company ──< Project ──< Office ──< Person
   │                                 │
   └──< PayRun ──< PayRunLine ───────┘
```

**Company** — the four legal entities that sign and pay: SRG Developers &
Promoters, New Marbella Developers And Promoters LLP, SRG Marbella Developers
And Promoters LLP, Garg Builders And Promoters LLP. Getting this wrong puts a
payslip on the wrong letterhead.

**Project** — the five developments: Grand, Curo One, Manifest, Twin Towers,
Royce. Each belongs to one Company.

**Office** — the site office of a project. **Where somebody sits**, which is
not who pays them. A person carries both, separately and on purpose.

**Person** — the employee register. `officeId` is where they are posted,
`employerId` is who pays them. `status` is `active`, `pending` or `exited`;
`exitedOn` is the day they stopped working, not the day their laptop came back.

---

## People, and what hangs off them

| Table | Holds | Note |
| --- | --- | --- |
| `Person` | The register | `joined` may be empty for somebody reconstructed from a salary book. It is never guessed. |
| `PersonNote` | Free text against a person | Where the "how we established this" of a reconstructed record lives |
| `Kyc` | Aadhaar, PAN, address | **Regulated.** Behind a role check on the server |
| `Contact` | Mobile, email | **Regulated.** Masked in the preview, absent from it |
| `Salary` | The monthly structure — basic, HRA, travel, medical, special | Not a payment. What they are *on* |
| `Device` | Handsets and laptops issued | IMEI is Luhn-checked |
| `Card` | Every ID card ever printed, issued or cancelled | Append-only in practice: a re-issue is a new row |
| `Exit` / `ExitStep` | Deboarding, six stages, gated in order | `Exit.lastDay` is what a final salary is worked out to |
| `RetiredEmployeeId` | IDs that must never be reissued | A new person must never inherit an old person's card |

---

## Payroll

| Table | Holds |
| --- | --- |
| `SalaryPolicy` | How one company turns a gross into the parts of a payslip. Two genuinely different rules across the group |
| `DeductionHead` | What comes **off** a payslip, per company, with the rule it comes from in words |
| `AllowanceHead` | What goes **on** it, per company, with the policy it comes from |
| `PayRun` | One month for one company. `draft` → `released` → `paid`. A released run is frozen |
| `PayRunLine` | One person's line. Carries the attendance it was worked out from, the deductions and the allowances itemised, and the reason for a short month |
| `AttendanceDay` | One row per person per calendar day. `inAt` null means no punch. **Dates carry the year** — `28 Jul 2026`, not `28 Jul` |
| `IncentivePackage` | Sales incentive schemes |

`PayRunLine.personId` is **nullable**, deliberately. Thirteen people were paid
in August whom the register has never heard of. Dropping them to satisfy a
foreign key would have hidden that.

---

## The ledger

`LedgerEntry` is the audit trail, and it is not an ordinary table.

Each row is sealed with a hash of itself plus the hash of the row before it.
Change one and every seal after it stops matching. Three database triggers
block `UPDATE` and `DELETE` outright — which is why the application's database
user must not be a superuser, because a superuser can drop them.

The browser re-verifies the whole chain itself rather than trusting the
server's word, because a tampered server would report its own ledger healthy.

It shows tampering. It cannot prevent it.

---

## Procurement and money

The other half of the application, largely independent of HR.

`Vendor`, `PurchaseRequest`, `PurchaseOrder`, `Requisition`, `VendorInvoice`,
`Expense`, `BankAccount`, `CreditCard`, `MasterCompany`, `CatalogItem`,
`PaymentReminder`.

Stores and gate: `InventoryItem`, `StockMove`, `Hold`, `StorageCap`,
`GatePass`, `GateEvent`.

Sales: `Unit`, `Applicant`, `Sale` — **`Unit` and `Applicant` carry residents'
names, addresses, emails and PANs. Regulated, and absent from the preview.**

Site: `Submittal`, `SubmittalVersion`, `SiteReport`.

---

## Policy and housekeeping

`DeptRule` (each department's own working hours), `LeavePolicy`, `Holiday`,
`JobDescription`, `DocLog`, `HrLog`, `HrTask`, `Announcement`,
`CalendarEvent`, `UsageCounter`, `Firm`, `AccessGrant`, `Connection`,
`ExportRecord`, `Draft`.

Auth: `User` and `RefreshToken`. A `User` is an account; a `Person` is an
employee. They are separate because an account can exist before a person
record does, and a person can exist without ever having an account — which is
true of most of the 126.

---

## Conventions worth knowing before you write a migration

**Dates are stored twice.** `joined` is the display form (`16 Mar 2024`) and
`joinedOn` is a sortable `DateTime`. The API writes both on every write. The
seed once wrote only the display string, and everything that ordered by date
saw an empty column.

**Money is whole rupees, as integers.** No floats, no paise.

**Migrations are forward-only.** There are no down migrations. Undoing a schema
change means writing a new migration that undoes it.

**A JSON column is read defensively.** `reductions` and `additions` on a pay
line are read through `readReductions` / `readAdditions`, which drop anything
that is not the shape expected — so a row written by an older version renders
instead of taking a payroll screen down.

**-1 is not 0.** On the attendance columns of a pay line, `-1` means *not
recorded* and `0` means *zero days*. A zero in a "days present" column is a
sentence about somebody who never came to work.
