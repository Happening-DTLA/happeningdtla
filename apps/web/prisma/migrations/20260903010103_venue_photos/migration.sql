-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
