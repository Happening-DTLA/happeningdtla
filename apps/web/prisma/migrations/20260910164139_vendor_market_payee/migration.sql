/*
  Warnings:

  - Added the required column `organizerId` to the `VendorMarket` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VendorMarket" ADD COLUMN     "organizerId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "VendorMarket_organizerId_idx" ON "VendorMarket"("organizerId");

-- AddForeignKey
ALTER TABLE "VendorMarket" ADD CONSTRAINT "VendorMarket_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
