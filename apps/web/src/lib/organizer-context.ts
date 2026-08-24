import { prisma } from "@/lib/prisma";
import type { OrganizerRole } from "@/generated/prisma/enums";

/**
 * Who the current page is acting as, for server components.
 *
 * Three states, deliberately distinct. Collapsing "signed out" and "signed in
 * but not linked to a venue" into one null was a redirect loop: the layout
 * sent an already-signed-in user to sign-in, and Clerk sent them straight
 * back.
 */
export type OrganizerContext =
  | { status: "signed-out" }
  | { status: "no-venue"; clerkUserId: string }
  | {
      status: "ok";
      organizerId: string;
      organizerName: string;
      role: OrganizerRole;
      /** True when this came from the dev fallback rather than a real session. */
      unauthenticated: boolean;
    };

export const clerkConfigured = () =>
  Boolean(process.env.CLERK_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

export async function getOrganizerContext(
  searchParams?: { organizerId?: string },
): Promise<OrganizerContext> {
  if (clerkConfigured()) {
    // Lazy: @clerk/nextjs throws at import time when unconfigured.
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (!userId) return { status: "signed-out" };

    const membership = await prisma.organizerMember.findFirst({
      where: { user: { clerkId: userId } },
      // OWNER before MANAGER before DOOR_STAFF, so someone holding two roles
      // gets the stronger one rather than whichever row was written first.
      orderBy: { role: "asc" },
      select: { organizerId: true, role: true, organizer: { select: { name: true } } },
    });
    if (!membership) return { status: "no-venue", clerkUserId: userId };

    return {
      status: "ok",
      organizerId: membership.organizerId,
      organizerName: membership.organizer.name,
      role: membership.role,
      unauthenticated: false,
    };
  }

  // DEVELOPMENT ONLY. Lets the dashboard be used before Clerk exists.
  if (process.env.NODE_ENV === "production") return { status: "signed-out" };

  const organizerId = searchParams?.organizerId;
  const organizer = organizerId
    ? await prisma.organizer.findUnique({ where: { id: organizerId }, select: { id: true, name: true } })
    : await prisma.organizer.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });

  if (!organizer) return { status: "signed-out" };
  return {
    status: "ok",
    organizerId: organizer.id,
    organizerName: organizer.name,
    role: "OWNER",
    unauthenticated: true,
  };
}
