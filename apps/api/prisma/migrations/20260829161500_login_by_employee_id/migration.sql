-- People sign in with the Employee ID printed on their card, not an email
-- address they may not have. `employeeId` is nullable because a service
-- account has no employee record, and unique because two people must never
-- resolve to the same login.
ALTER TABLE "app_user" ADD COLUMN "employeeId" TEXT;
CREATE UNIQUE INDEX "app_user_employeeId_key" ON "app_user"("employeeId");

-- Which desk this account sees. This is the SERVER's answer to "who are you":
-- before this, the browser decided, and the Sign in button simply asserted
-- "admin" for everyone who pressed it.
ALTER TABLE "app_user" ADD COLUMN "userKey" TEXT NOT NULL DEFAULT 'viewer';
