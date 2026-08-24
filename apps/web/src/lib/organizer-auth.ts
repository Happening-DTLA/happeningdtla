import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/api-response";
import { bearerToken } from "@/lib/door-auth";
import type { OrganizerRole } from "@/generated/prisma/enums";

/**
 * Who is acting on behalf of a venue.
 *
 * Resolution order:
 *   1. A signed-in Clerk user, mapped through User.clerkId to their
 *      OrganizerMember row. This is the real path.
 *   2. A shared ADMIN_API_SECRET plus an explicit organizer id. A DEVELOPMENT
 *      ESCAPE HATCH so the platform is usable before Clerk is configured. It
 *      is refused outright in production.
 *
 * Both return the same shape, so route handlers never learn which one ran and
 * removing the fallback changes nothing above this file.
 */

export type OrganizerAuth =
  | { ok: false; error: Response }
  | { ok: true; organizerId: string; role: OrganizerRole; userId: string | null };

const clerkConfigured = () =>
  Boolean(process.env.CLERK_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

async function fromClerk(): Promise<OrganizerAuth | null> {
  if (!clerkConfigured()) return null;

  // Imported lazily: @clerk/nextjs throws at import time when unconfigured,
  // which would take down every route that merely imports this module.
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: fail(401, "signed_out", "Sign in to manage your venue.") };
  }

  const membership = await prisma.organizerMember.findFirst({
    where: { user: { clerkId: userId } },
    // OWNER before MANAGER before DOOR_STAFF, so someone who is both gets the
    // stronger role rather than whichever row was written first.
    orderBy: { role: "asc" },
    select: { organizerId: true, role: true, userId: true },
  });

  if (!membership) {
    return {
      ok: false,
      error: fail(403, "not_an_organizer", "This account isn't linked to a venue yet."),
    };
  }

  return { ok: true, organizerId: membership.organizerId, role: membership.role, userId: membership.userId };
}

async function fromDevSecret(request: Request): Promise<OrganizerAuth | null> {
  if (process.env.NODE_ENV === "production") return null;
  const expected = process.env.ADMIN_API_SECRET?.trim();
  if (!expected || bearerToken(request) !== expected) return null;

  const url = new URL(request.url);
  const organizerId =
    url.searchParams.get("organizerId") ?? request.headers.get("x-organizer-id");

  if (!organizerId) {
    return {
      ok: false,
      error: fail(
        400,
        "organizer_required",
        "Development auth needs an organizerId query param or x-organizer-id header.",
      ),
    };
  }

  const exists = await prisma.organizer.findUnique({
    where: { id: organizerId },
    select: { id: true },
  });
  if (!exists) return { ok: false, error: fail(404, "not_found", "No such organizer.") };

  return { ok: true, organizerId, role: "OWNER", userId: null };
}

export async function requireOrganizer(request: Request): Promise<OrganizerAuth> {
  const viaClerk = await fromClerk();
  if (viaClerk) return viaClerk;

  const viaSecret = await fromDevSecret(request);
  if (viaSecret) return viaSecret;

  return {
    ok: false,
    error: fail(
      401,
      "unauthorized",
      clerkConfigured()
        ? "Sign in to manage your venue."
        : "Organizer accounts aren't configured yet. Set the Clerk keys in apps/web/.env.",
    ),
  };
}

/** Payouts and door codes are owner/manager work; door staff never see either. */
export function requireManager(auth: OrganizerAuth): Response | null {
  if (!auth.ok) return auth.error;
  if (auth.role === "DOOR_STAFF") {
    return fail(403, "insufficient_role", "Door staff can't manage venue settings.");
  }
  return null;
}
