-- Order.accessToken: a bearer secret proving a device owns this order.
--
-- Added in three steps rather than as a NOT NULL column with a default,
-- because existing rows have no value and Prisma-level defaults are generated
-- by the client, not the database. This is the same shape the migration would
-- need against a production table with real orders in it.

-- 1. Add nullable so existing rows are allowed.
ALTER TABLE "Order" ADD COLUMN "accessToken" TEXT;

-- 2. Backfill. gen_random_uuid() is built into Postgres 13+; dashes stripped
--    so the value is URL-safe without encoding.
UPDATE "Order"
SET "accessToken" = replace(gen_random_uuid()::text, '-', '')
WHERE "accessToken" IS NULL;

-- 3. Now that every row has one, enforce the constraints.
ALTER TABLE "Order" ALTER COLUMN "accessToken" SET NOT NULL;
CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");
