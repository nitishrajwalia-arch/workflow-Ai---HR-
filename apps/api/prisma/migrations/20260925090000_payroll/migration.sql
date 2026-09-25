-- Payroll.
--
-- HR works out a month's salaries and hands Accounts a sheet. Until now that
-- happened in four Excel books, one per company, with the arithmetic typed into
-- the cells. Those books are the specification: their rules are reproduced here,
-- including the two DIFFERENT ones the group runs.
--
-- Whole rupees throughout, not paise. Every figure on those books is a whole
-- rupee, and mixing units inside one subsystem is how somebody pays a hundred
-- times too much. See the note on the Salary model.

ALTER TABLE "salary"
  ADD COLUMN "gross"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "travel"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "medical" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "esiOn"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pfOn"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pfWages" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "salary_policy" (
    "companyId"        TEXT             NOT NULL,
    "kind"             TEXT             NOT NULL DEFAULT 'percent',
    "basicPct"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hraPctOfBasic"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "travelPctOfBasic" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esiEmployeePct"   DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "esiEmployerPct"   DOUBLE PRECISION NOT NULL DEFAULT 3.25,
    "esiCeiling"       INTEGER          NOT NULL DEFAULT 21000,
    "pfPct"            DOUBLE PRECISION NOT NULL DEFAULT 12,
    "pfWageCap"        INTEGER          NOT NULL DEFAULT 15000,
    "extraDayDivisor"  INTEGER          NOT NULL DEFAULT 30,
    "setBy"            TEXT             NOT NULL DEFAULT '',
    "setOn"            TEXT             NOT NULL DEFAULT '',
    "updatedAt"        TIMESTAMP(3)     NOT NULL,
    CONSTRAINT "salary_policy_pkey" PRIMARY KEY ("companyId")
);
ALTER TABLE "salary_policy" ADD CONSTRAINT "salary_policy_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pay_run" (
    "id"         TEXT         NOT NULL,
    "month"      TEXT         NOT NULL,
    "monthOn"    TIMESTAMP(3) NOT NULL,
    "monthDays"  INTEGER      NOT NULL,
    "companyId"  TEXT         NOT NULL,
    "status"     TEXT         NOT NULL DEFAULT 'draft',
    "source"     TEXT         NOT NULL DEFAULT 'computed',
    "note"       TEXT         NOT NULL DEFAULT '',
    "createdBy"  TEXT         NOT NULL DEFAULT '',
    "releasedAt" TIMESTAMP(3),
    "releasedBy" TEXT         NOT NULL DEFAULT '',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pay_run_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pay_run_companyId_month_key" ON "pay_run"("companyId", "month");
CREATE INDEX "pay_run_monthOn_idx" ON "pay_run"("monthOn");
ALTER TABLE "pay_run" ADD CONSTRAINT "pay_run_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pay_run_line" (
    "id"          TEXT             NOT NULL,
    "runId"       TEXT             NOT NULL,
    -- Nullable on purpose: thirteen people on the August books are not on the
    -- employee register, and dropping them to keep the key would hide it.
    "personId"    TEXT,
    "name"        TEXT             NOT NULL,
    "designation" TEXT             NOT NULL DEFAULT '',
    "days"        DOUBLE PRECISION NOT NULL,
    "gross"       INTEGER          NOT NULL DEFAULT 0,
    "basic"       INTEGER          NOT NULL DEFAULT 0,
    "hra"         INTEGER          NOT NULL DEFAULT 0,
    "travel"      INTEGER          NOT NULL DEFAULT 0,
    "medical"     INTEGER          NOT NULL DEFAULT 0,
    "special"     INTEGER          NOT NULL DEFAULT 0,
    "eBasic"      INTEGER          NOT NULL DEFAULT 0,
    "eHra"        INTEGER          NOT NULL DEFAULT 0,
    "eTravel"     INTEGER          NOT NULL DEFAULT 0,
    "eMedical"    INTEGER          NOT NULL DEFAULT 0,
    "eSpecial"    INTEGER          NOT NULL DEFAULT 0,
    "eGross"      INTEGER          NOT NULL DEFAULT 0,
    "dEsi"        INTEGER          NOT NULL DEFAULT 0,
    "dPf"         INTEGER          NOT NULL DEFAULT 0,
    "dTds"        INTEGER          NOT NULL DEFAULT 0,
    "dAdvance"    INTEGER          NOT NULL DEFAULT 0,
    "dOther"      INTEGER          NOT NULL DEFAULT 0,
    "dTotal"      INTEGER          NOT NULL DEFAULT 0,
    "erEsi"       INTEGER          NOT NULL DEFAULT 0,
    "erPf"        INTEGER          NOT NULL DEFAULT 0,
    "extraDays"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extraAmount" INTEGER          NOT NULL DEFAULT 0,
    "arrear"      INTEGER          NOT NULL DEFAULT 0,
    "net"         INTEGER          NOT NULL DEFAULT 0,
    "remark"      TEXT             NOT NULL DEFAULT '',
    CONSTRAINT "pay_run_line_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pay_run_line_runId_name_key" ON "pay_run_line"("runId", "name");
CREATE INDEX "pay_run_line_personId_idx" ON "pay_run_line"("personId");
ALTER TABLE "pay_run_line" ADD CONSTRAINT "pay_run_line_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "pay_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_run_line" ADD CONSTRAINT "pay_run_line_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
