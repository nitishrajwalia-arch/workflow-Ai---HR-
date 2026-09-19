-- The closure column on the holiday sheet was laid out for YES or NO and came
-- back answered in sentences: "public holiday for all other departments, with
-- essential maintenance, pantry and project staff working on a rotational
-- basis". Reducing that to a boolean loses the part somebody needs when they
-- are working out who is on site, so the answer is kept as written.
ALTER TABLE "holiday" ADD COLUMN "closure" TEXT NOT NULL DEFAULT '';
