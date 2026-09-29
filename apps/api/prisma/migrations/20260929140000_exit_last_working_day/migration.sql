-- The last day somebody actually worked.
--
-- Deboarding stamped the person as having left on the day their assets came
-- back, which is a different date and quietly wrong: a man who stopped coming
-- in on the 5th and handed his laptop back on the 20th was paid to the 20th.
--
-- Nullable, and left null on every exit already open. Those keep whatever date
-- they were stamped with — rewriting them would be inventing a fact about when
-- somebody stopped working.
ALTER TABLE "exit" ADD COLUMN "lastDay" TEXT;
