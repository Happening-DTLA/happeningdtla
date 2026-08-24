import type {
  ApiEvent,
  ApiEventSummary,
  ApiNight,
  ApiTicketType,
  ApiVenue,
} from "@dtlahappening/core";
import { priceBreakdown } from "@dtlahappening/core";
import type { getEventBySlug, getUpcomingNight, getStandaloneEvents } from "@/lib/queries";
import { remaining } from "@/lib/queries";

/**
 * The boundary between database rows and anything a client can see.
 *
 * Every mapper picks fields EXPLICITLY. Never spread a Prisma object into a
 * response — the day someone adds a column holding a payout account or an
 * internal note, a spread publishes it and nothing fails a test.
 *
 * Types are derived from the query functions, so changing an `include` in
 * queries.ts surfaces here as a compile error instead of a runtime undefined.
 */

type NightRow = NonNullable<Awaited<ReturnType<typeof getUpcomingNight>>>;
type EventRow = NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>;
type EventSummaryRow = NightRow["events"][number] | Awaited<ReturnType<typeof getStandaloneEvents>>[number];
type TicketTypeRow = EventRow["ticketTypes"][number];
type VenueRow = EventRow["venue"];

const iso = (d: Date | null) => (d ? d.toISOString() : null);
/** Calendar dates serialise as YYYY-MM-DD, never a timestamp. */
const calendarDate = (d: Date) => d.toISOString().slice(0, 10);

export function toApiVenue(v: VenueRow): ApiVenue {
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    description: v.description,
    address1: v.address1,
    address2: v.address2,
    city: v.city,
    state: v.state,
    zip: v.zip,
    neighborhood: v.neighborhood,
    lat: v.lat,
    lng: v.lng,
  };
}

export function toApiTicketType(t: TicketTypeRow): ApiTicketType {
  const left = remaining(t);
  const { serviceFeeCents, totalCents } = priceBreakdown(t.priceCents);
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    priceCents: t.priceCents,
    serviceFeeCents,
    allInCents: totalCents,
    maxPerOrder: t.maxPerOrder,
    remaining: left,
    soldOut: left === 0,
    salesStartAt: iso(t.salesStartAt),
    salesEndAt: iso(t.salesEndAt),
  };
}

export function toApiEventSummary(e: EventSummaryRow): ApiEventSummary {
  const tiers = e.ticketTypes ?? [];
  const soldOut = tiers.length > 0 && tiers.every((t) => remaining(t) === 0);
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    imageUrl: e.imageUrl,
    doorsAt: iso(e.doorsAt),
    startsAt: e.startsAt.toISOString(),
    endsAt: iso(e.endsAt),
    minAge: e.minAge,
    category: e.category,
    isFree: e.isFree,
    fromPriceCents: e.fromPriceCents,
    fromAllInCents:
      e.fromPriceCents === null
        ? null
        : priceBreakdown(e.fromPriceCents).totalCents,
    soldOut,
    venue: toApiVenue(e.venue),
    // Withheld entirely rather than blanked, so a client cannot render an
    // empty "Presented by" line for a business that asked not to be named.
    organizer: e.organizer.publiclyAttributed
      ? { id: e.organizer.id, slug: e.organizer.slug, name: e.organizer.name }
      : null,
  };
}

export function toApiEvent(e: EventRow): ApiEvent {
  return {
    ...toApiEventSummary(e),
    description: e.description,
    night: e.night
      ? {
          id: e.night.id,
          slug: e.night.slug,
          name: e.night.name,
          date: calendarDate(e.night.date),
        }
      : null,
    ticketTypes: e.ticketTypes.map(toApiTicketType),
  };
}

export function toApiNight(n: NightRow): ApiNight {
  return {
    id: n.id,
    slug: n.slug,
    name: n.name,
    date: calendarDate(n.date),
    description: n.description,
    heroImageUrl: n.heroImageUrl,
    events: n.events.map(toApiEventSummary),
  };
}
