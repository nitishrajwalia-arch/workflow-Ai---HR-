-- Money must be 64-bit.
--
-- Everything monetary is stored in PAISE as an integer, because a purchase
-- order is not a thing to hold approximately. But Postgres INTEGER is 32-bit
-- and tops out at 2,147,483,647 — which is only ₹2.14 crore. The seeded RERA
-- escrow balance alone is ₹4.21 crore, and it overflowed on the first insert.
--
-- BIGINT tops out around ₹92,00,00,00,00,00,00,000. That will do.
ALTER TABLE "purchase_order"    ALTER COLUMN "amt"    TYPE BIGINT;
ALTER TABLE "gate_pass"         ALTER COLUMN "total"  TYPE BIGINT;
ALTER TABLE "vendor_invoice"    ALTER COLUMN "amt"    TYPE BIGINT;
ALTER TABLE "expense"           ALTER COLUMN "amt"    TYPE BIGINT;
ALTER TABLE "sale"              ALTER COLUMN "price"  TYPE BIGINT;
ALTER TABLE "bank_account"      ALTER COLUMN "bal"    TYPE BIGINT;
ALTER TABLE "credit_card"       ALTER COLUMN "limit"  TYPE BIGINT;
ALTER TABLE "credit_card"       ALTER COLUMN "used"   TYPE BIGINT;
ALTER TABLE "incentive_package" ALTER COLUMN "amount" TYPE BIGINT;
ALTER TABLE "catalog_item"      ALTER COLUMN "rate"   TYPE BIGINT;
