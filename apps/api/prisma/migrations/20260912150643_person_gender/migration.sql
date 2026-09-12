-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('female', 'male', 'other', 'undisclosed');

-- AlterTable
ALTER TABLE "person" ADD COLUMN     "gender" "Gender";

-- CreateIndex
CREATE INDEX "person_gender_idx" ON "person"("gender");
