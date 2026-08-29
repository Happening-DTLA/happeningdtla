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


/**
 * A map region that frames a set of pins, with breathing room.
 *
 * Used when someone picks a corridor: the map should go to that stretch of
 * Downtown rather than leaving them to find it. Returns null for an empty set
 * so a caller can leave the map where it is instead of flying to nowhere.
 */
export function boundsOf(
  pins: VenuePin[],
): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null {
  if (pins.length === 0) return null;

  const lats = pins.map((p) => p.venue.lat);
  const lngs = pins.map((p) => p.venue.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // A floor on the span, or a single pin zooms to street level and the person
  // loses all sense of where it sits in Downtown.
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.006),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.006),
  };
}
