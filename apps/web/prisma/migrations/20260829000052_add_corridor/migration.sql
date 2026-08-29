-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "corridorId" TEXT;

-- CreateTable
CREATE TABLE "Corridor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "along" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Corridor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Corridor_slug_key" ON "Corridor"("slug");

-- CreateIndex
CREATE INDEX "Corridor_sortOrder_idx" ON "Corridor"("sortOrder");

-- CreateIndex
CREATE INDEX "Venue_corridorId_idx" ON "Venue"("corridorId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "Corridor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
