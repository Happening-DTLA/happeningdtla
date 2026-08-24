import type { ApiEventSummary, ApiVenue } from "@dtlahappening/core";

/** A venue that has coordinates, plus the events there matching the filters. */
export type VenuePin = {
  venue: ApiVenue & { lat: number; lng: number };
  events: ApiEventSummary[];
};

/**
 * One pin per VENUE, not per event.
 *
 * A venue runs several things in an evening and they all share an address, so
 * a pin per event stacks them into a pile you cannot tap apart — in the seed
 * data alone, two venues sit about 50m from each other. Grouping is also the
 * shape the passport/crawl feature needs later: the venue is the place you
 * arrive at, the events are what is on when you get there.
 *
 * Venues without coordinates are dropped, not defaulted. A missing lat/lng
 * placed at (0, 0) is a pin in the Atlantic, and one nudged to the city centre
 * is worse — it looks correct and sends someone to the wrong building.
 */
export function groupEventsByVenue(events: ApiEventSummary[]): VenuePin[] {
  const byVenue = new Map<string, VenuePin>();

  for (const event of events) {
    const { venue } = event;
    if (venue.lat === null || venue.lng === null) continue;

    const existing = byVenue.get(venue.id);
    if (existing) {
      existing.events.push(event);
    } else {
      byVenue.set(venue.id, {
        venue: { ...venue, lat: venue.lat, lng: venue.lng },
        events: [event],
      });
    }
  }

  // Earliest first, so the badge, the sheet and "starts next" all agree.
  for (const pin of byVenue.values()) {
    pin.events.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }

  return [...byVenue.values()];
}

/** How many events the map is actually showing, for the empty state. */
export const countEvents = (pins: VenuePin[]) =>
  pins.reduce((n, pin) => n + pin.events.length, 0);
