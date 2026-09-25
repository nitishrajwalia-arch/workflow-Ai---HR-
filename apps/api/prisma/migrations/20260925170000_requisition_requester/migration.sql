-- A requisition now remembers who asked for it and what the store promised.
-- The counter checks the ID card against byEid before anything leaves the store,
-- so the handover step had nothing to check against until these existed.
ALTER TABLE "requisition" ADD COLUMN "byName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "requisition" ADD COLUMN "byEid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "requisition" ADD COLUMN "promisedFor" TEXT NOT NULL DEFAULT '';
