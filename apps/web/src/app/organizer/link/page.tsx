import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrganizerContext, clerkConfigured } from "@/lib/organizer-context";
import { CreateBusiness } from "./create-business";
import { ClaimVenue } from "./claim-venue";

export const dynamic = "force-dynamic";

/**
 * Signed in, but not attached to a business.
 *
 * Three shapes of person land here and they want different things:
 *   - someone who just wants to go to events (an account is optional for that)
 *   - someone whose venue already exists here and needs to be added to it
 *   - someone setting their business up for the first time
 *
 * Presenting one path would make the other two feel like errors.
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
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Your account</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">What brings you here?</h1>
      <p className="mt-3 text-text-muted">
        Your account is ready. You don&apos;t need a business to buy tickets — this
        is only if you put on events.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold">I&apos;m here for the events</h2>
          <p className="mt-1 text-sm text-text-muted">
            Nothing more to do. Your tickets follow this account across devices.
          </p>
          <Link
            href="/"
            className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
          >
            Browse what&apos;s on
          </Link>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold">I run a venue or put on events</h2>
          <p className="mt-1 text-sm text-text-muted">
            Set up a business to publish events, take payments and run doors.
          </p>
          <div className="mt-3">
            <CreateBusiness />
          </div>
        </section>

        {canClaim && venues.length > 0 ? (
          <section className="rounded-xl border border-danger/40 bg-danger/5 p-4">
            <h2 className="font-semibold">Join an existing venue</h2>
            <p className="mt-1 text-sm text-text-muted">
              Development only — real access is by invitation from an existing
              owner. This exists so the first account can get in.
            </p>
            <div className="mt-3">
              <ClaimVenue venues={venues} />
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">My venue is already here</h2>
            <p className="mt-1 text-sm text-text-muted">
              Ask whoever set it up to invite you from their dashboard.
            </p>
          </section>
        )}
      </div>

      {!clerkConfigured() ? (
        <p className="mt-6 text-sm text-danger">Clerk isn&apos;t configured on this server.</p>
      ) : null}
    </main>
  );
}
