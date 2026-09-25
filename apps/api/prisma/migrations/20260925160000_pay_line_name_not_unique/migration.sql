-- A pay run line is not unique on the name.
--
-- Two different people called Parveen Kumar are paid by SRG on the same August
-- book: an AGM - Accounts on 98,000 and an MEP-Supervisor on 35,000. Both are
-- matched to their own employee IDs, and the unique key on (runId, name)
-- collapsed them into one line — 35,000 of that month's payroll simply was not
-- there, and nothing said so. A run is rebuilt whole rather than merged row by
-- row, so the key was never needed.
DROP INDEX IF EXISTS "pay_run_line_runId_name_key";
CREATE INDEX IF NOT EXISTS "pay_run_line_runId_idx" ON "pay_run_line"("runId");
