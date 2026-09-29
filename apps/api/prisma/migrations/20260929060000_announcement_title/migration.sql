-- An announcement kept only its body. The screen asked for a heading and an
-- audience, refused to post without a heading, and discarded both.
ALTER TABLE "announcement" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "announcement" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'Everyone';
