-- The enrolment form asks fifteen questions whose answers had nowhere to go.
-- Zod strips what a schema does not name, so HR filled them in, the screen said
-- the person was enrolled, and every one of them was dropped in silence.

-- Terms of employment, and the weekly off attendance needs to tell a day off
-- from an absence.
ALTER TABLE "person" ADD COLUMN "offDay" TEXT NOT NULL DEFAULT 'Sunday';
ALTER TABLE "person" ADD COLUMN "probation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "person" ADD COLUMN "conditions" TEXT NOT NULL DEFAULT '';

-- Where they worked before. The profile card that asks for this has been
-- pointing HR at a form that discarded it.
ALTER TABLE "person" ADD COLUMN "prevEmployer" TEXT NOT NULL DEFAULT '';
ALTER TABLE "person" ADD COLUMN "prevRole" TEXT NOT NULL DEFAULT '';
ALTER TABLE "person" ADD COLUMN "prevFrom" TEXT NOT NULL DEFAULT '';
ALTER TABLE "person" ADD COLUMN "prevTo" TEXT NOT NULL DEFAULT '';

-- The rest of the identity papers: the driving licence for whoever drives as
-- part of the work, the two photo IDs, and whether the address on file is the
-- one printed on the Aadhaar.
ALTER TABLE "kyc" ADD COLUMN "addressMatchesAadhaar" TEXT NOT NULL DEFAULT '';
ALTER TABLE "kyc" ADD COLUMN "drives" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "kyc" ADD COLUMN "dl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "kyc" ADD COLUMN "dlExpires" TEXT NOT NULL DEFAULT '';
ALTER TABLE "kyc" ADD COLUMN "idType1" TEXT NOT NULL DEFAULT '';
ALTER TABLE "kyc" ADD COLUMN "idNo1" TEXT NOT NULL DEFAULT '';
ALTER TABLE "kyc" ADD COLUMN "idType2" TEXT NOT NULL DEFAULT '';
ALTER TABLE "kyc" ADD COLUMN "idNo2" TEXT NOT NULL DEFAULT '';
