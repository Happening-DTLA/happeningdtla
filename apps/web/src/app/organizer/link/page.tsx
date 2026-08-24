import { prisma } from "@/lib/prisma";
import { getOrganizerContext, clerkConfigured } from "@/lib/organizer-context";
import { redirect } from "next/navigation";
import { ClaimVenue } from "./claim-venue";

export const dynamic = "force-dynamic";

/**
 * Signed in, but this account isn't attached to a venue.
 *
 * In production this is where an invite would land. Until invites exist, a
 * development-only claim lets the first person bootstrap themselves as an
 * owner — otherwise there is no way to get the first account in.
 */
export default async function LinkPage() {
  const ctx = await getOrganizerContext();
  if (ctx.status === "signed-out") redirect("/sign-in?redirect_url=/organizer");
  if (ctx.status === "ok") redirect("/organizer");

  const canClaim = process.env.NODE_ENV !== "production";
  const venues = canClaim
    ? await prisma.organizer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Venue access</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">You&apos;re signed in</h1>
      <p className="mt-3 text-text-muted">
        This account isn&apos;t linked to a venue yet.
        {canClaim
          ? " While we're in development, pick the venue you manage."
          : " Ask whoever runs your venue's account to invite you."}
      </p>

      {canClaim ? (
        <div className="mt-6">
          <ClaimVenue venues={venues} />
          <p className="mt-4 text-xs text-text-muted">
            Development only. Real access will be by invitation, and this
            screen will only show the invite instructions.
          </p>
        </div>
      ) : null}

      {!clerkConfigured() ? (
        <p className="mt-6 text-sm text-danger">Clerk isn&apos;t configured on this server.</p>
      ) : null}
    </main>
  );
}
