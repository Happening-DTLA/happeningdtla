import Link from "next/link";
import { getUpcomingNight, getStandaloneEvents, remaining } from "@/lib/queries";
import {
  formatCents,
  priceBreakdown,
  formatCalendarDate,
  formatDate,
  formatTimeRange,
} from "@dtlahappening/core";

/**
 * Rendered per request, never prerendered.
 *
 * This page lists what is on tonight. Statically generated it would freeze the
 * listing at build time and keep serving it — an events app showing last
 * week's events, refreshed only when someone happens to deploy.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const night = await getUpcomingNight();
  const standalone = await getStandaloneEvents();

  if (!night) {
    return (
      <p className="py-20 text-center text-text-muted">
        Nothing scheduled yet. Run <code className="font-mono">npm run db:seed</code>.
      </p>
    );
  }

  const byNeighborhood = new Map<string, typeof night.events>();
  for (const event of night.events) {
    const key = event.venue.neighborhood ?? "Downtown";
    byNeighborhood.set(key, [...(byNeighborhood.get(key) ?? []), event]);
  }

  return (
    <div className="py-8">
      {/* The night itself is the hero — not a search box. Eventbrite makes you
          hunt; here the answer to "what's happening" is the first thing you see. */}
      <section className="mb-10">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">
          Next city-wide night
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          {night.name.split("—")[0].trim()}
        </h1>
        <p className="mt-2 text-lg text-text-muted">{formatCalendarDate(night.date)}</p>
        {night.description && (
          <p className="mt-4 max-w-xl text-balance leading-relaxed text-text-muted">
            {night.description}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-surface px-3 py-1.5 text-text-muted">
            {night.events.length} events
          </span>
          <span className="rounded-full bg-surface px-3 py-1.5 text-text-muted">
            {byNeighborhood.size} neighborhoods
          </span>
        </div>
      </section>

      {[...byNeighborhood.entries()].map(([neighborhood, events]) => (
        <section key={neighborhood} className="mb-10">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-text-muted">
            {neighborhood}
          </h2>
          <ul className="space-y-3">
            {events.map((event) => {
              const cheapest = event.ticketTypes[0];
              const soldOut =
                event.ticketTypes.length > 0 &&
                event.ticketTypes.every((t) => remaining(t) === 0);
              const allIn =
                event.fromPriceCents && event.fromPriceCents > 0
                  ? priceBreakdown(event.fromPriceCents).totalCents
                  : 0;

              return (
                <li key={event.id}>
                  <Link
                    href={`/e/${event.slug}`}
                    className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/60 active:bg-surface-2"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug">{event.title}</h3>
                        <p className="mt-1 truncate text-sm text-text-muted">
                          {event.venue.name}
                        </p>
                        <p className="mt-1.5 font-mono text-xs text-text-muted">
                          {formatTimeRange(event.startsAt, event.endsAt)}
                          {event.minAge ? ` · ${event.minAge}+` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {soldOut ? (
                          <span className="font-mono text-xs text-danger">Sold out</span>
                        ) : event.isFree ? (
                          <span className="font-mono text-sm font-bold text-accent">Free</span>
                        ) : (
                          <>
                            <span className="font-mono text-sm font-bold text-accent">
                              {formatCents(allIn)}
                            </span>
                            {/* All-in from the very first surface. No fee reveal at checkout. */}
                            <span className="block text-[10px] text-text-muted">
                              all-in{event.ticketTypes.length > 1 ? " · from" : ""}
                            </span>
                          </>
                        )}
                        {cheapest && !soldOut && remaining(cheapest) < 25 && (
                          <span className="mt-1 block text-[10px] text-text-muted">
                            {remaining(cheapest)} left
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {standalone.length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-text-muted">
            Also happening
          </h2>
          <ul className="space-y-3">
            {standalone.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/e/${event.slug}`}
                  className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/60"
                >
                  <h3 className="font-semibold leading-snug">{event.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">
                    {event.venue.name} · {formatDate(event.startsAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
