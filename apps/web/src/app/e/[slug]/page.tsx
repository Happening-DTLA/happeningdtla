import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug, remaining } from "@/lib/queries";
import {
  formatCents,
  priceBreakdown,
  formatDate,
  formatTime,
  formatTimeRange,
} from "@dtlahappening/core";

export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event || event.status !== "PUBLISHED") notFound();

  const mapQuery = encodeURIComponent(
    `${event.venue.address1}, ${event.venue.city}, ${event.venue.state} ${event.venue.zip}`,
  );

  return (
    <article className="py-8">
      {event.night && (
        <Link
          href="/"
          className="mb-4 inline-block font-mono text-xs uppercase tracking-widest text-accent"
        >
          ← Part of {event.night.name.split("—")[0].trim()}
        </Link>
      )}

      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {event.title}
      </h1>

      <div className="mt-4 space-y-1 text-text-muted">
        <p className="font-medium text-text">{formatDate(event.startsAt)}</p>
        <p className="font-mono text-sm">
          {event.doorsAt && `Doors ${formatTime(event.doorsAt)} · `}
          {formatTimeRange(event.startsAt, event.endsAt)}
          {event.minAge ? ` · ${event.minAge}+` : ""}
        </p>
      </div>

      {event.description && (
        <p className="mt-6 leading-relaxed text-text-muted">{event.description}</p>
      )}

      <section className="mt-8 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">{event.venue.name}</h2>
        <p className="mt-1 text-sm text-text-muted">
          {event.venue.address1}
          {event.venue.neighborhood ? ` · ${event.venue.neighborhood}` : ""}
        </p>
        {event.organizer ? (
          <p className="mt-1 text-xs text-text-muted">Presented by {event.organizer.name}</p>
        ) : null}
        <a
          href={`https://maps.apple.com/?q=${mapQuery}`}
          className="mt-3 inline-block font-mono text-xs text-accent underline underline-offset-4"
        >
          Open in Maps
        </a>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-text-muted">
          Tickets
        </h2>
        <ul className="space-y-3">
          {event.ticketTypes.map((tier) => {
            const left = remaining(tier);
            const { subtotalCents, serviceFeeCents, totalCents } = priceBreakdown(tier.priceCents);
            const free = tier.priceCents === 0;

            return (
              <li
                key={tier.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{tier.name}</h3>
                    {tier.description && (
                      <p className="mt-1 text-sm text-text-muted">{tier.description}</p>
                    )}
                    {/* The fee is stated plainly, next to the price, before any
                        commitment. This is both a legal requirement in CA and the
                        single loudest complaint people have about Eventbrite. */}
                    {!free && (
                      <p className="mt-2 font-mono text-xs text-text-muted">
                        {formatCents(subtotalCents)} + {formatCents(serviceFeeCents)} fee
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-mono text-lg font-bold text-accent">
                      {free ? "Free" : formatCents(totalCents)}
                    </span>
                    <span className="block text-[10px] text-text-muted">
                      {free ? "no ticket needed" : "all-in"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={left === 0}
                  className="mt-4 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-accent-ink transition-opacity disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-muted"
                >
                  {left === 0 ? "Sold out" : free ? "RSVP" : "Get tickets"}
                </button>

                {left > 0 && left < 25 && (
                  <p className="mt-2 text-center text-xs text-text-muted">
                    {left} left
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-center text-xs text-text-muted">
          Checkout is not wired up yet — see docs/ROADMAP.md
        </p>
      </section>
    </article>
  );
}
