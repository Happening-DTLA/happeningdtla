-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "kind" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "website" TEXT;
