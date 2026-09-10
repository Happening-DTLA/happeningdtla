-- CreateEnum
CREATE TYPE "EntertainerFeePreference" AS ENUM ('FEE_REQUIRED', 'VOLUNTEER', 'OTHER');

-- CreateEnum
CREATE TYPE "VolunteerRole" AS ENUM ('INFORMATION_BOOTH', 'DOOR_ATTENDANT', 'BLOCK_ENTERTAINMENT', 'GALLERY_ASSISTANT', 'RUNNER');

-- CreateTable
CREATE TABLE "EntertainmentSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "actName" TEXT NOT NULL,
    "performanceType" TEXT,
    "links" TEXT NOT NULL,
    "promoImageUrl" TEXT NOT NULL,
    "feePreference" "EntertainerFeePreference" NOT NULL,
    "feeNote" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntertainmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "bestTimeToReach" TEXT NOT NULL,
    "roles" "VolunteerRole"[] DEFAULT ARRAY[]::"VolunteerRole"[],
    "isAdult" BOOLEAN NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntertainmentSubmission_email_idx" ON "EntertainmentSubmission"("email");

-- CreateIndex
CREATE INDEX "EntertainmentSubmission_status_createdAt_idx" ON "EntertainmentSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EntertainmentSubmission_userId_idx" ON "EntertainmentSubmission"("userId");

-- CreateIndex
CREATE INDEX "VolunteerSubmission_email_idx" ON "VolunteerSubmission"("email");

-- CreateIndex
CREATE INDEX "VolunteerSubmission_status_createdAt_idx" ON "VolunteerSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VolunteerSubmission_userId_idx" ON "VolunteerSubmission"("userId");

-- AddForeignKey
ALTER TABLE "EntertainmentSubmission" ADD CONSTRAINT "EntertainmentSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerSubmission" ADD CONSTRAINT "VolunteerSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
