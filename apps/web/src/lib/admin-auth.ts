import { prisma } from "@/lib/prisma";
import { clerkConfigured } from "@/lib/organizer-context";

/**
 * Who runs the platform, as opposed to who runs a venue.
 *
 * This exists because `ArtistSubmission` belongs to nobody. It has no
 * organizerId and no venueId — an artist applies to the ArtNight gallery
 * network, not to a room. So there is no per-venue scope to filter it by, and
 * putting it on the venue dashboard would hand every organizer who ever claims
 * a venue the home address and phone number of every artist who ever applied.
 * `queries.ts` is careful never to fetch a payout account it will not send;
 * this is the same rule applied to somebody's street address.
 *
 * The allowlist is an env var rather than a column because there are two
 * people, they change roughly never, and a `User.isAdmin` boolean is a
 * privilege escalation waiting for the first bug in whatever writes it. When
 * the platform needs real roles, this file is the one place to change.
 *
 * ADMIN_EMAILS=dino@example.com,michael@example.com
 */
export type AdminContext =
  | { status: "denied"; reason: "signed-out" | "not-admin" | "unconfigured" }
  | { status: "ok"; email: string | null; unauthenticated: boolean };

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminContext(): Promise<AdminContext> {
  const allowed = adminEmails();

  if (clerkConfigured()) {
    // Lazy: @clerk/nextjs throws at import time when unconfigured.
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (!userId) return { status: "denied", reason: "signed-out" };

    // Read the address from our own User row rather than calling Clerk again.
    // It is the same value, we already store it, and it keeps this decision
    // auditable against a table we control.
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { email: true },
    });

    const email = user?.email?.toLowerCase() ?? null;

    // An empty allowlist denies everyone. Failing closed matters more here
    // than convenience: the alternative reading — "unset means everybody" —
    // publishes artists' addresses to any signed-in account the first time
    // someone deploys without setting the variable.
    if (!email || !allowed.includes(email)) {
      return { status: "denied", reason: allowed.length === 0 ? "unconfigured" : "not-admin" };
    }

    return { status: "ok", email, unauthenticated: false };
  }

  // DEVELOPMENT ONLY, matching the escape hatch in organizer-context.ts. Never
  // in production: without Clerk there is no identity to check an allowlist
  // against, so "allow" would mean "allow the internet".
  if (process.env.NODE_ENV === "production") return { status: "denied", reason: "unconfigured" };

  return { status: "ok", email: null, unauthenticated: true };
}
