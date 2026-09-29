-- Allowances, and the attendance a pay line was worked out from.
--
-- Two things the payroll could not say. An allowance granted by company policy
-- had nowhere to go but "extra days amount", which is a lie about what the
-- money was for; and the days a line was paid for were a single number with the
-- reasons behind it discarded, so a query about a short month came back to HR to
-- re-derive by hand.
--
-- Both are additive. Nothing already released changes: every existing line gets
-- an empty allowance list and -1 for each attendance count, which reads as
-- "not recorded" rather than as zero days present.

CREATE TABLE "allowance_head" (
    "id"         TEXT    NOT NULL,
    "companyId"  TEXT    NOT NULL,
    "code"       TEXT    NOT NULL,
    "label"      TEXT    NOT NULL,
    "basis"      TEXT    NOT NULL DEFAULT 'flat',
    "rate"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wage"       INTEGER NOT NULL DEFAULT 0,
    "ceiling"    INTEGER NOT NULL DEFAULT 0,
    "floor"      INTEGER NOT NULL DEFAULT 0,
    "proRate"    BOOLEAN NOT NULL DEFAULT true,
    "rounding"   TEXT    NOT NULL DEFAULT 'nearest',
    "appliesTo"  TEXT    NOT NULL DEFAULT '',
    "taxable"    BOOLEAN NOT NULL DEFAULT true,
    "authority"  TEXT    NOT NULL DEFAULT '',
    "note"       TEXT    NOT NULL DEFAULT '',
    "active"     BOOLEAN NOT NULL DEFAULT true,
    "sort"       INTEGER NOT NULL DEFAULT 0,
    "setBy"      TEXT    NOT NULL DEFAULT '',
    "setOn"      TEXT    NOT NULL DEFAULT '',
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowance_head_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "allowance_head_companyId_code_key" ON "allowance_head"("companyId", "code");

ALTER TABLE "allowance_head"
  ADD CONSTRAINT "allowance_head_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pay_run_line"
  ADD COLUMN "additions" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "eAllow"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dPresent"  DOUBLE PRECISION NOT NULL DEFAULT -1,
  ADD COLUMN "dAbsent"   DOUBLE PRECISION NOT NULL DEFAULT -1,
  ADD COLUMN "dWeekOff"  DOUBLE PRECISION NOT NULL DEFAULT -1,
  ADD COLUMN "dHoliday"  DOUBLE PRECISION NOT NULL DEFAULT -1,
  ADD COLUMN "dLeave"    DOUBLE PRECISION NOT NULL DEFAULT -1,
  ADD COLUMN "dLost"     DOUBLE PRECISION NOT NULL DEFAULT -1;
