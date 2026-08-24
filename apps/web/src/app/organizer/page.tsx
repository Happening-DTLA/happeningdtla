import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOrganizerContext } from "@/lib/organizer-context";
import { formatCents, formatDate, formatTime } from "@dtlahappening/core";

export const dynamic = "force-dynamic";

export default async function OrganizerHome() {
  const ctx = await getOrganizerContext();
  if (!ctx) return <p className="text-text-muted">Sign in to manage your venue.</p>;

  const events = await prisma.event.findMany({
    where: { organizerId: ctx.organizerId },
    orderBy: { startsAt: "asc" },
    include: {
      venue: { select: { name: true } },
      _count: { select: { tickets: true } },
    },
  });

  // Revenue is owner/manager information. Door staff never reach this page,
  // but the role check is here rather than assumed.
  const canSeeMoney = ctx.role !== "DOOR_STAFF";

  const sold = await prisma.ticket.groupBy({
    by: ["eventId"],
    where: { event: { organizerId: ctx.organizerId }, order: { status: "PAID" } },
    _count: { _all: true },
    _sum: { unitPriceCents: true },
  });
  const byEvent = new Map(sold.map((s) => [s.eventId, s]));

  return (
    <div>
      <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-text-muted">
        Your events
      </h2>
      {events.length === 0 ? (
        <p className="text-text-muted">No events yet.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const s = byEvent.get(event.id);
            const admitted = event._count.tickets;
            return (
              <li key={event.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{event.title}</h3>
                    <p className="text-sm text-text-muted">
                      {event.venue.name} · {formatDate(event.startsAt)} at {formatTime(event.startsAt)}
                    </p>
                    <p className="mt-1 font-mono text-xs text-text-muted">
                      {s?._count._all ?? 0} sold
                      {canSeeMoney && s?._sum.unitPriceCents
                        ? ` · ${formatCents(s._sum.unitPriceCents)} face value`
                        : ""}
                    </p>
                  </div>
                  <Link
                    href={`/organizer/doors?eventId=${event.id}`}
                    className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:border-accent hover:text-accent"
                  >
                    Door codes
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
