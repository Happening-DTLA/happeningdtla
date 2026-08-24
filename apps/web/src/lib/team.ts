import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import type { OrganizerRole } from "@/generated/prisma/enums";

/**
 * Who counts as part of a business.
 *
 * Door staff are deliberately excluded. Someone working one door on one night
 * is not affiliated with the venue in any meaningful sense — listing them
 * alongside owners overstates their relationship, and a night with six casual
 * door people would drown the two people who actually run the place.
 *
 * They still appear on the door screen, where the question is "which phones
 * can scan tonight" rather than "who is this business".
 */
export const AFFILIATED_ROLES: OrganizerRole[] = ["OWNER", "MANAGER"];

export const isAffiliated = (role: OrganizerRole) => AFFILIATED_ROLES.includes(role);

export const INVITE_TTL_DAYS = 14;

/** Long and random: whoever holds this can join the business. */
const newInviteToken = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 40);

export class TeamError extends Error {
  constructor(message: string, readonly code: string, readonly status = 400) {
    super(message);
    this.name = "TeamError";
  }
}

/** Everyone attached to a business, split by whether they're really team. */
export async function listTeam(organizerId: string) {
  const members = await prisma.organizerMember.findMany({
    where: { organizerId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, displayName: true } },
    },
  });

  const invites = await prisma.organizerInvite.findMany({
    where: { organizerId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, token: true, expiresAt: true },
  });

  return {
    affiliated: members.filter((m) => isAffiliated(m.role)),
    doorStaff: members.filter((m) => !isAffiliated(m.role)),
    invites,
  };
}

export async function createInvite(input: {
  organizerId: string;
  email: string;
  role: OrganizerRole;
  invitedByUserId?: string | null;
}) {
  const email = input.email.trim().toLowerCase();

  // Already on the team — inviting again would just create a confusing link.
  const existing = await prisma.organizerMember.findFirst({
    where: { organizerId: input.organizerId, user: { email } },
    select: { id: true },
  });
  if (existing) throw new TeamError("They're already on this team.", "already_member", 409);

  // Supersede any outstanding invite rather than stacking duplicates.
  await prisma.organizerInvite.updateMany({
    where: { organizerId: input.organizerId, email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return prisma.organizerInvite.create({
    data: {
      organizerId: input.organizerId,
      email,
      role: input.role,
      token: newInviteToken(),
      invitedByUserId: input.invitedByUserId ?? undefined,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600_000),
    },
  });
}

/** Looks up a live invite without consuming it, for the accept screen. */
export async function peekInvite(token: string) {
  const invite = await prisma.organizerInvite.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      organizer: { select: { id: true, name: true } },
    },
  });
  if (!invite) return null;
  if (invite.revokedAt || invite.acceptedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

/**
 * Consumes an invite for a signed-in user.
 *
 * The claim is a conditional update, so two people opening the same link
 * cannot both join — and an invite genuinely works once.
 */
export async function acceptInvite(token: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.organizerInvite.updateMany({
      where: { token, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date(), acceptedByUserId: userId },
    });
    if (claimed.count === 0) {
      throw new TeamError("This invitation is no longer valid.", "invite_invalid", 410);
    }

    const invite = await tx.organizerInvite.findUniqueOrThrow({ where: { token } });

    await tx.organizerMember.upsert({
      where: { organizerId_userId: { organizerId: invite.organizerId, userId } },
      update: { role: invite.role },
      create: { organizerId: invite.organizerId, userId, role: invite.role },
    });

    return invite;
  });
}

/** Removing the last owner would leave a business nobody can administer. */
export async function removeMember(organizerId: string, memberId: string) {
  const member = await prisma.organizerMember.findFirst({
    where: { id: memberId, organizerId },
    select: { id: true, role: true },
  });
  if (!member) throw new TeamError("Not on this team.", "not_found", 404);

  if (member.role === "OWNER") {
    const owners = await prisma.organizerMember.count({ where: { organizerId, role: "OWNER" } });
    if (owners <= 1) {
      throw new TeamError("A business needs at least one owner.", "last_owner", 409);
    }
  }

  await prisma.organizerMember.delete({ where: { id: member.id } });
}
