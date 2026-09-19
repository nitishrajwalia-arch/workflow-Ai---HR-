-- An employee ID that was issued on paper and must never be given to anybody
-- else. Two were reserved for people the company's own files named but the
-- master list did not; both turned out to be a second copy of somebody already
-- on the payroll. Deleting the rows freed the numbers for reuse, and both had
-- already been printed against a name in the workbooks the company holds.
CREATE TABLE "retired_employee_id" (
    "id"        TEXT         NOT NULL,
    "reason"    TEXT         NOT NULL,
    "retiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retired_employee_id_pkey" PRIMARY KEY ("id")
);
