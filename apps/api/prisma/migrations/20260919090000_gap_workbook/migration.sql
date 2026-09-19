-- HR's filled data-gap workbook, 18 September 2026.
--
-- Four things the workbook answered that the schema had nowhere to put:
--   * a holiday calendar, which attendance was being judged without;
--   * seven leave rules the written policy left to "the approved HR policy";
--   * the twenty-three people who report to a Managing Director rather than to
--     an employee;
--   * job descriptions, which the company writes per department, not per title.

ALTER TABLE "person" ADD COLUMN "reportsToNote" TEXT NOT NULL DEFAULT '';

ALTER TABLE "dept_rule" ADD COLUMN "setOn" TEXT NOT NULL DEFAULT '';

ALTER TABLE "leave_policy"
  ADD COLUMN "lateStrikes"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "carryForward"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "encashable"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "probation"      TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "maternityWeeks" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paternityDays"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notice"         TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "setBy"          TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "setOn"          TEXT    NOT NULL DEFAULT '';

CREATE TABLE "holiday" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "on"        TEXT         NOT NULL,
    "onDate"    TIMESTAMP(3) NOT NULL,
    "allSites"  BOOLEAN      NOT NULL DEFAULT true,
    "note"      TEXT         NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holiday_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "holiday_name_on_key" ON "holiday"("name", "on");
CREATE INDEX "holiday_onDate_idx" ON "holiday"("onDate");

-- A job description belonged to a title alone, so the Sales "Assistant Manager"
-- overwrote the one Accounts wrote. There is nothing to preserve: the table has
-- never held a row that was not seeded.
DELETE FROM "job_description";
ALTER TABLE "job_description" DROP CONSTRAINT "job_description_pkey";
ALTER TABLE "job_description" ADD COLUMN "dept" TEXT NOT NULL;
ALTER TABLE "job_description" ADD CONSTRAINT "job_description_pkey" PRIMARY KEY ("dept", "role");
