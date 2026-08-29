import type { ApiCorridor, ApiEventSummary } from "@dtlahappening/core";

/**
 * A corridor, with the destinations open on it tonight.
 *
 * The unit the printed map is organised around, and the unit people actually
 * walk: you pick a stretch of Downtown and work along it. Grouping by corridor
 * rather than by category is what makes the app agree with the poster someone
 * is holding.
 */
export type CorridorGroup = {
  corridor: ApiCorridor;
  events: ApiEventSummary[];
  /** How many of these can be put on the map. */
  pinned: number;
};

/** Events whose venue has no corridor — kept, never dropped. */
export const UNSORTED: ApiCorridor = {
  slug: "__unsorted",
  name: "Elsewhere in Downtown",
  color: "#a1a1aa",
  along: null,
  sortOrder: 999,
};

/**
 * Groups a night's events by corridor, in the poster's own order.
 *
 * Venues without a corridor fall into "Elsewhere" rather than vanishing. A
 * venue that quietly disappears from a crawl guide is worse than one filed
 * under a vague heading — someone walks past a door that was open.
 */
export function groupByCorridor(events: ApiEventSummary[]): CorridorGroup[] {
  const groups = new Map<string, CorridorGroup>();

  for (const event of events) {
    const corridor = event.venue.corridor ?? UNSORTED;
    const existing = groups.get(corridor.slug);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(corridor.slug, { corridor, events: [event], pinned: 0 });
    }
  }

  for (const group of groups.values()) {
    // Alphabetical by venue, not by time. On a night where fifty doors open at
    // once, "what is on this street" is the question; sorting by start time
    // would list them in an order that means nothing.
    group.events.sort((a, b) => a.venue.name.localeCompare(b.venue.name));
    group.pinned = new Set(
      group.events
        .filter((e) => e.venue.lat !== null && e.venue.lng !== null)
        .map((e) => e.venue.id),
    ).size;
  }

  return [...groups.values()].sort(
    (a, b) => a.corridor.sortOrder - b.corridor.sortOrder,
  );
}

/** Distinct venues in a set of events — the destination count, not the event count. */
export const countVenues = (events: ApiEventSummary[]) =>
  new Set(events.map((e) => e.venue.id)).size;
