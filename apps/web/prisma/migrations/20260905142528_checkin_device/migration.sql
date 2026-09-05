-- DropForeignKey
ALTER TABLE "VenueCheckIn" DROP CONSTRAINT "VenueCheckIn_userId_fkey";
-- DropIndex
DROP INDEX "VenueCheckIn_userId_venueId_nightId_key";
-- AlterTable
ALTER TABLE "VenueCheckIn" ADD COLUMN     "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "userId" DROP NOT NULL;
-- CreateIndex
CREATE INDEX "VenueCheckIn_userId_idx" ON "VenueCheckIn"("userId");
-- CreateIndex
CREATE UNIQUE INDEX "VenueCheckIn_deviceId_venueId_nightId_key" ON "VenueCheckIn"("deviceId", "venueId", "nightId");
-- AddForeignKey
ALTER TABLE "VenueCheckIn" ADD CONSTRAINT "VenueCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
