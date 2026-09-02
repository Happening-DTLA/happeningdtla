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


/** A map viewport, in the shape react-native-maps reports it. */
export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/**
 * Which pins get to carry their name.
 *
 * Fifty-six labelled pills over a few square miles is not a map, it is a wall
 * of text with streets somewhere behind it — and on a screen whose entire job
 * is helping someone walk, the streets are the content. So the label is a
 * privilege rather than a default: pins are dots, and a name is granted only
 * where it fits without landing on top of one already granted.
 *
 * This is the standard greedy de-collision every mapping product uses. Pins
 * are sorted by how much they deserve a label, projected into screen space,
 * and each is kept only if its box clears every box already placed. The result
 * changes as the map moves — which is correct, and is why zooming in reveals
 * more names rather than the same crowd drawn smaller.
 *
 * Projection is equirectangular. Over a few kilometres of Downtown the error
 * is well under a pixel, and the alternative — asking the native map to
 * project every point on every pan — is a bridge crossing per pin per frame.
 */
export function placeLabels({
  pins,
  region,
  size,
  selectedVenueId,
  max = 16,
}: {
  pins: VenuePin[];
  region: MapRegion;
  size: { width: number; height: number };
  selectedVenueId: string | null;
  max?: number;
}): Set<string> {
  const placed = new Set<string>();
  if (size.width <= 0 || size.height <= 0) return placed;
  if (region.latitudeDelta <= 0 || region.longitudeDelta <= 0) return placed;

  const project = (lat: number, lng: number) => ({
    x: ((lng - region.longitude) / region.longitudeDelta + 0.5) * size.width,
    y: ((region.latitude - lat) / region.latitudeDelta + 0.5) * size.height,
  });

  // Roughly what the pill measures once Archivo has set it. Deliberately a
  // little generous: a label that overlaps by three pixels still reads as a
  // collision to the eye, and the cost of being wrong the other way is a gap.
  const boxOf = (pin: VenuePin) => {
    const { x, y } = project(pin.venue.lat, pin.venue.lng);
    const width = Math.min(178, 40 + pin.venue.name.length * 6.7);
    return { x0: x - width / 2, x1: x + width / 2, y0: y - 15, y1: y + 15 };
  };

  const priority = (pin: VenuePin) => {
    if (pin.venue.id === selectedVenueId) return 1e6;
    // A landmark is what someone navigates by — the Broad, the Biltmore — so
    // it outranks a gallery even where the gallery has more on.
    return (pin.venue.isLandmark ? 1000 : 0) + pin.events.length;
  };

  /**
   * How much of the city is on screen decides who is even eligible.
   *
   * Greedy placement alone gives the slots to whoever happens not to collide,
   * which at full-Downtown zoom meant naming two small galleries while leaving
   * the Broad and the Biltmore as anonymous dots. Real maps do not do that:
   * they name the things you navigate by first and reveal the rest as you come
   * in. So the bar starts high and drops as the viewport tightens.
   */
  const span = Math.max(region.latitudeDelta, region.longitudeDelta);
  // Two tiers rather than three. Almost every venue runs exactly one thing, so
  // a middle tier keyed on "more than one event" was landmarks again by
  // another name — three labels on a view of a few blocks, which reads as
  // broken rather than restrained. Above roughly a mile across, landmarks
  // only; below it, everything competes and collision does the deciding.
  const bar = span > 0.018 ? 1000 : 0;

  const ranked = pins
    .filter((p) => p.venue.id === selectedVenueId || priority(p) >= bar)
    .sort((a, b) => {
      const d = priority(b) - priority(a);
      // Ties broken by id, never by array order: the same viewport has to make
      // the same choices twice or labels flicker as the list is refetched.
      return d !== 0 ? d : a.venue.id.localeCompare(b.venue.id);
    });

  const taken: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const GAP = 4;

  for (const pin of ranked) {
    if (placed.size >= max) break;
    const box = boxOf(pin);

    // Off-screen labels would spend the budget on names nobody can read.
    const margin = 60;
    if (
      box.x1 < -margin || box.x0 > size.width + margin ||
      box.y1 < -margin || box.y0 > size.height + margin
    ) {
      continue;
    }

    const clashes = taken.some(
      (t) =>
        box.x0 < t.x1 + GAP && box.x1 > t.x0 - GAP &&
        box.y0 < t.y1 + GAP && box.y1 > t.y0 - GAP,
    );
    if (clashes) continue;

    taken.push(box);
    placed.add(pin.venue.id);
  }

  return placed;
}
