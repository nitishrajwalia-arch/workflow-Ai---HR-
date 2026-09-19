-- The Roles screen has always edited a job description as three fields —
-- purpose, duties, requirements — and posted them as an object. The column was
-- a single string and the body schema required one, so every save from that
-- screen was answered with a 400 and nothing was ever stored through it. The
-- column now holds what the screen sends.
DELETE FROM "job_description";
ALTER TABLE "job_description" DROP COLUMN "jd";
ALTER TABLE "job_description" ADD COLUMN "jd" JSONB NOT NULL;
