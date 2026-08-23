-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('ART', 'MUSIC', 'NIGHTLIFE', 'FOOD_DRINK', 'PERFORMANCE', 'MARKET', 'WORKSHOP', 'OTHER');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "category" "EventCategory" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "Event_category_startsAt_idx" ON "Event"("category", "startsAt");
