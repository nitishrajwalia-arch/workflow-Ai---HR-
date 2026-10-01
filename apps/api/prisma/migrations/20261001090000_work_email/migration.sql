-- The work email.
--
-- The personal email field refuses a @marbellagroup.in address, deliberately:
-- the company account closes the day somebody leaves, which is exactly when
-- their details are needed. That left the company address with nowhere to go.
--
-- It belongs beside the company SIM rather than beside the personal email: both
-- are issued on joining and must be taken back on leaving, and the deboarding's
-- assets stage is where that happens.
ALTER TABLE "contact" ADD COLUMN "workEmail" TEXT NOT NULL DEFAULT '';
