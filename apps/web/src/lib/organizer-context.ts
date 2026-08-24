import { prisma } from "@/lib/prisma";
import type { OrganizerRole } from "@/generated/prisma/enums";

/**
 * Who the current page is acting as, for server components.
 *
 * Mirrors requireOrganizer (which serves route handlers) including its
 * development fallback, so the dashboard is usable before Clerk is configured
 * and needs no changes once it is.
 */
export interface OrganizerContext {
  organizerId: string;
  organizerName: string;
  role: OrganizerRole;
  /** True when this came from the dev fallback rather than a real session. */
  unauthenticated: boolean;
}

const clerkConfigured = () =>
  Boolean(process.env.CLERK_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

export async function getOrganizerContext(
  searchParams?: { organizerId?: string },
): Promise<OrganizerContext | null> {
  if (clerkConfigured()) {
    // Lazy: @clerk/nextjs throws at import time when unconfigured.
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (!userId) return null;

    const membership = await prisma.organizerMember.findFirst({
      where: { user: { clerkId: userId } },
      orderBy: { role: "asc" },
      select: { organizerId: true, role: true, organizer: { select: { name: true } } },
    });
    if (!membership) return null;

    return {
      organizerId: membership.organizerId,
      organizerName: membership.organizer.name,
      role: membership.role,
      unauthenticated: false,
    };
  }

  // DEVELOPMENT ONLY. Lets the dashboard be built and reviewed before Clerk
  // exists; never reachable in production.
  if (process.env.NODE_ENV === "production") return null;

  const organizerId = searchParams?.organizerId;
  const organizer = organizerId
    ? await prisma.organizer.findUnique({ where: { id: organizerId }, select: { id: true, name: true } })
    : await prisma.organizer.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });

  if (!organizer) return null;
  return {
    organizerId: organizer.id,
    organizerName: organizer.name,
    role: "OWNER",
    unauthenticated: true,
  };
}
