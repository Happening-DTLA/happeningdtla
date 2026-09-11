-- CreateEnum
CREATE TYPE "ParticipationFeeKind" AS ENUM ('ARTIST_SUBMISSION', 'VENDOR_BOOTH');

-- CreateEnum
CREATE TYPE "ParticipationFeeStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateTable
CREATE TABLE "ParticipationFee" (
    "id" TEXT NOT NULL,
    "kind" "ParticipationFeeKind" NOT NULL,
    "organizerId" TEXT NOT NULL,
    "artistSubmissionId" TEXT,
    "vendorSubmissionMarketId" TEXT,
    "advertisedCents" INTEGER NOT NULL,
    "processingCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "status" "ParticipationFeeStatus" NOT NULL DEFAULT 'PENDING',
    "payerEmail" TEXT NOT NULL,
    "payerName" TEXT,
    "payBy" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeAccountId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipationFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationFee_artistSubmissionId_key" ON "ParticipationFee"("artistSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationFee_vendorSubmissionMarketId_key" ON "ParticipationFee"("vendorSubmissionMarketId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationFee_accessToken_key" ON "ParticipationFee"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationFee_stripePaymentIntentId_key" ON "ParticipationFee"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "ParticipationFee_organizerId_idx" ON "ParticipationFee"("organizerId");

-- CreateIndex
CREATE INDEX "ParticipationFee_status_payBy_idx" ON "ParticipationFee"("status", "payBy");

-- CreateIndex
CREATE INDEX "ParticipationFee_payerEmail_idx" ON "ParticipationFee"("payerEmail");

-- AddForeignKey
ALTER TABLE "ParticipationFee" ADD CONSTRAINT "ParticipationFee_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationFee" ADD CONSTRAINT "ParticipationFee_artistSubmissionId_fkey" FOREIGN KEY ("artistSubmissionId") REFERENCES "ArtistSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationFee" ADD CONSTRAINT "ParticipationFee_vendorSubmissionMarketId_fkey" FOREIGN KEY ("vendorSubmissionMarketId") REFERENCES "VendorSubmissionMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
