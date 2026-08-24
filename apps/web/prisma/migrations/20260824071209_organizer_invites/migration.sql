-- CreateTable
CREATE TABLE "OrganizerInvite" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizerRole" NOT NULL DEFAULT 'DOOR_STAFF',
    "token" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerInvite_token_key" ON "OrganizerInvite"("token");

-- CreateIndex
CREATE INDEX "OrganizerInvite_organizerId_idx" ON "OrganizerInvite"("organizerId");

-- CreateIndex
CREATE INDEX "OrganizerInvite_email_idx" ON "OrganizerInvite"("email");

-- AddForeignKey
ALTER TABLE "OrganizerInvite" ADD CONSTRAINT "OrganizerInvite_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
