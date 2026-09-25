-- How the paise are dealt with, per head. The ESI regulation says round up, and
-- one of Marbella's four books does; the other three round to nearest. Assuming
-- either would have been a rupee a head a month that nobody chose.
ALTER TABLE "deduction_head" ADD COLUMN "rounding" TEXT NOT NULL DEFAULT 'nearest';
