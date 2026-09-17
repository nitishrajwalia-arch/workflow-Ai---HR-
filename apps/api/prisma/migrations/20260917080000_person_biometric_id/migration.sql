-- The number the attendance machine knows somebody by. Additive and nullable:
-- nobody has one until the roll is matched by hand, once. Unique because two
-- people sharing a machine number would silently merge their attendance.
ALTER TABLE "person" ADD COLUMN "biometricId" TEXT;

CREATE UNIQUE INDEX "person_biometricId_key" ON "person"("biometricId");
