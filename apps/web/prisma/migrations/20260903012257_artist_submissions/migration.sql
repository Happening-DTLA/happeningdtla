-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('ATTENDEE', 'ARTIST', 'VENUE');
-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'DECLINED', 'WITHDRAWN');
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileType" "ProfileType" NOT NULL DEFAULT 'ATTENDEE';
-- CreateTable
CREATE TABLE "ArtistSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "socials" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "media" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "portfolioImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNote" TEXT,
    "resubmitBy" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArtistSubmission_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "SubmissionArtwork" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "medium" TEXT,
    "heightIn" DOUBLE PRECISION,
    "widthIn" DOUBLE PRECISION,
    "depthIn" DOUBLE PRECISION,
    "weightLb" DOUBLE PRECISION,
    "priceCents" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SubmissionArtwork_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "ArtistSubmission_email_idx" ON "ArtistSubmission"("email");
-- CreateIndex
CREATE INDEX "ArtistSubmission_status_createdAt_idx" ON "ArtistSubmission"("status", "createdAt");
-- CreateIndex
CREATE INDEX "ArtistSubmission_userId_idx" ON "ArtistSubmission"("userId");
-- CreateIndex
CREATE INDEX "SubmissionArtwork_submissionId_idx" ON "SubmissionArtwork"("submissionId");
-- AddForeignKey
ALTER TABLE "ArtistSubmission" ADD CONSTRAINT "ArtistSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SubmissionArtwork" ADD CONSTRAINT "SubmissionArtwork_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ArtistSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
