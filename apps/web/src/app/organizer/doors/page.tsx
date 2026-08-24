import { prisma } from "@/lib/prisma";
import { getOrganizerContext } from "@/lib/organizer-context";
import { doorWindowFor, MAX_DOOR_SESSIONS_PER_EVENT } from "@/lib/door";
import { formatDate, formatTime } from "@dtlahappening/core";
import { DoorCodePanel } from "./door-code-panel";

export const dynamic = "force-dynamic";

export default async function DoorsPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { eventId } = await searchParams;
  const ctx = await getOrganizerContext();
  if (!ctx) return <p className="text-text-muted">Sign in to manage door codes.</p>;
  if (ctx.role === "DOOR_STAFF") {
    return <p className="text-text-muted">Door staff can&apos;t create door codes.</p>;
  }

  const events = await prisma.event.findMany({
    where: { organizerId: ctx.organizerId, status: "PUBLISHED" },
    orderBy: { startsAt: "asc" },
    include: { venue: { select: { name: true } } },
  });

  const selected = eventId ? events.find((e) => e.id === eventId) : events[0];
  if (!selected) return <p className="text-text-muted">No published events yet.</p>;

  const sessions = await prisma.doorSession.findMany({
    where: { eventId: selected.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, pairingCode: true, claimedAt: true, deviceLabel: true, lastSeenAt: true },
  });

  const window = doorWindowFor(selected);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Door codes</h2>
        <p className="max-w-prose text-sm leading-relaxed text-text-muted">
          Each code pairs one phone to one event. Read it out to whoever is
          working the door — they type it once and never need an account.
        </p>
      </div>

      {events.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {events.map((e) => (
            <a
              key={e.id}
              href={`/organizer/doors?eventId=${e.id}`}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                e.id === selected.id
                  ? "border-accent text-accent"
                  : "border-border text-text-muted hover:border-accent/60"
              }`}
            >
              {e.title}
            </a>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-semibold">{selected.title}</h3>
        <p className="text-sm text-text-muted">
          {selected.venue.name} · {formatDate(selected.startsAt)} at {formatTime(selected.startsAt)}
        </p>
        {/* The window is the security model, so it's stated plainly rather than
            left for someone to discover when a code mysteriously fails. */}
        <p className="mt-3 font-mono text-xs text-text-muted">
          Doors can pair from {formatTime(window.activeFrom)} until{" "}
          {formatTime(window.activeUntil)} · {sessions.length} of{" "}
          {MAX_DOOR_SESSIONS_PER_EVENT} phones
        </p>
      </div>

      <DoorCodePanel
        eventId={selected.id}
        organizerId={ctx.organizerId}
        existing={sessions.map((s) => ({
          id: s.id,
          pairingCode: s.pairingCode,
          claimed: Boolean(s.claimedAt),
          deviceLabel: s.deviceLabel,
          lastSeenAt: s.lastSeenAt?.toISOString() ?? null,
        }))}
        atLimit={sessions.length >= MAX_DOOR_SESSIONS_PER_EVENT}
      />
    </div>
  );
}
