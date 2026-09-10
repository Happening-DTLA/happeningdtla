-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('FASHION_APPAREL', 'ACCESSORIES', 'BEAUTY_WELLNESS', 'ART_ARTISAN_GOODS', 'HOME_LIFESTYLE', 'PLANTS_GARDEN', 'PET_PRODUCTS', 'KIDS_FAMILY', 'DIGITAL_CREATIVE_SERVICES', 'VINTAGE_ANTIQUES', 'CULTURAL_METAPHYSICAL', 'SERVICES_EXPERIENCES', 'FOOD_BEVERAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorSubmissionStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'CONFIRMED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

-- AlterEnum
ALTER TYPE "ProfileType" ADD VALUE 'VENDOR';

-- CreateTable
CREATE TABLE "VendorMarket" (
    "id" TEXT NOT NULL,
    "nightId" TEXT,
    "name" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "address" TEXT,
    "date" DATE NOT NULL,
    "hours" TEXT,
    "priceCents" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "acceptsFoodVendors" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "businessName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "socials" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "merchandise" TEXT NOT NULL,
    "presentation" TEXT NOT NULL,
    "standout" TEXT NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "VendorSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "emailConsent" BOOLEAN NOT NULL DEFAULT false,
    "smsConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "payBy" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorSubmissionMarket" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "status" "VendorSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',

    CONSTRAINT "VendorSubmissionMarket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorMarket_date_idx" ON "VendorMarket"("date");

-- CreateIndex
CREATE INDEX "VendorMarket_nightId_idx" ON "VendorMarket"("nightId");

-- CreateIndex
CREATE INDEX "VendorSubmission_email_idx" ON "VendorSubmission"("email");

-- CreateIndex
CREATE INDEX "VendorSubmission_status_createdAt_idx" ON "VendorSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VendorSubmission_userId_idx" ON "VendorSubmission"("userId");

-- CreateIndex
CREATE INDEX "VendorSubmissionMarket_marketId_status_idx" ON "VendorSubmissionMarket"("marketId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VendorSubmissionMarket_submissionId_marketId_key" ON "VendorSubmissionMarket"("submissionId", "marketId");

-- AddForeignKey
ALTER TABLE "VendorMarket" ADD CONSTRAINT "VendorMarket_nightId_fkey" FOREIGN KEY ("nightId") REFERENCES "Night"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSubmission" ADD CONSTRAINT "VendorSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSubmissionMarket" ADD CONSTRAINT "VendorSubmissionMarket_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "VendorSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSubmissionMarket" ADD CONSTRAINT "VendorSubmissionMarket_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "VendorMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
