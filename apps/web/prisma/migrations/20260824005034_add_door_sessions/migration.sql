-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "doorSessionId" TEXT;

-- CreateTable
CREATE TABLE "DoorSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "pairingCode" TEXT NOT NULL,
    "pairingCodeExpiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "token" TEXT,
    "deviceLabel" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoorSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoorSession_pairingCode_key" ON "DoorSession"("pairingCode");

-- CreateIndex
CREATE UNIQUE INDEX "DoorSession_token_key" ON "DoorSession"("token");

-- CreateIndex
CREATE INDEX "DoorSession_eventId_idx" ON "DoorSession"("eventId");

-- AddForeignKey
ALTER TABLE "DoorSession" ADD CONSTRAINT "DoorSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_doorSessionId_fkey" FOREIGN KEY ("doorSessionId") REFERENCES "DoorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
