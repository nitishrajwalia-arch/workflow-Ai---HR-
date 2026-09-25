-- What comes off a payslip, and under which rule.
--
-- The rates were in the code. They are rows now, one per company, each carrying
-- the rule it comes from and the name of whoever set it, so that a change in the
-- law is an edit somebody makes and signs rather than a release.

CREATE TABLE "deduction_head" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "basis" TEXT NOT NULL DEFAULT 'entered',
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wage" INTEGER NOT NULL DEFAULT 0,
    "personWage" BOOLEAN NOT NULL DEFAULT false,
    "ceiling" INTEGER NOT NULL DEFAULT 0,
    "proRate" BOOLEAN NOT NULL DEFAULT true,
    "requires" TEXT NOT NULL DEFAULT '',
    "authority" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "setBy" TEXT NOT NULL DEFAULT '',
    "setOn" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deduction_head_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deduction_head_companyId_code_key" ON "deduction_head"("companyId", "code");

ALTER TABLE "deduction_head" ADD CONSTRAINT "deduction_head_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The line keeps its roll-up columns and gains the itemisation behind them.
-- Stored rather than recomputed: a released line must still read the same after
-- somebody changes a rate.
ALTER TABLE "pay_run_line" ADD COLUMN "erOther" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pay_run_line" ADD COLUMN "reductions" JSONB NOT NULL DEFAULT '[]';
