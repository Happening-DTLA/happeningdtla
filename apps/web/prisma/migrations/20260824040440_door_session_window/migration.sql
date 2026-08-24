-- DoorSession.activeFrom: pairing and scanning are only valid inside a window
-- anchored to the event, rather than for a fixed period after the code is
-- created. Added nullable, backfilled, then made required — existing rows have
-- no value and a Prisma-level default is generated client-side.

ALTER TABLE "DoorSession" ADD COLUMN "activeFrom" TIMESTAMP(3);

-- Existing sessions were already usable when created, so preserve that.
UPDATE "DoorSession" SET "activeFrom" = "createdAt" WHERE "activeFrom" IS NULL;

ALTER TABLE "DoorSession" ALTER COLUMN "activeFrom" SET NOT NULL;
