import { distanceMeters, type LatLng } from "./geo";

/**
 * The passport.
 *
 * A crawl is a thing you do with your feet, and the app's job on the night is
 * to be a record of that rather than a listing you consult once. Stamps are
 * the record: one per door, collected as you walk, in the colour of the street
 * you were on.
 *
 * The unit that matters is the corridor, not the count. Visiting nine venues
 * scattered across Downtown is a pleasant evening; walking the whole of Spring
 * Street is an achievement, and it is the one the printed map is organised
 * around. So completion is measured per corridor and the total is secondary.
 */

/**
 * How close counts as "there".
 *
 * Deliberately loose. Between the buildings of the Historic Core a phone can
 * be a hundred metres out with a clear view of the sky and worse inside a
 * ground-floor gallery, so a tight radius would refuse people who are standing
 * in the room. Being mildly cheatable costs nothing here — this is a souvenir,
 * not a competition — while refusing someone who actually walked there is the
 * one failure that would make them close the app.
 */
export const CHECK_IN_RADIUS_M = 150;

export type Stamp = {
  venueId: string;
  nightId: string;
  /** When they stamped it, ISO. */
  at: string;
  /**
   * Whether we could see them near the door at the time. False means they
   * stamped it anyway, which is allowed — see CHECK_IN_RADIUS_M.
   */
  verified: boolean;
};

export function isNear(here: LatLng | null, venue: LatLng | null): boolean {
  if (!here || !venue) return false;
  return distanceMeters(here, venue) <= CHECK_IN_RADIUS_M;
}

export interface CorridorProgress {
  slug: string;
  name: string;
  color: string;
  total: number;
  stamped: number;
  complete: boolean;
}

export interface PassportProgress {
  stamped: number;
  total: number;
  corridors: CorridorProgress[];
  corridorsComplete: number;
  /** The one still worth finishing: closest to done without being done. */
  nearestToComplete: CorridorProgress | null;
}

/**
 * What the card says.
 *
 * Takes the night's venues already grouped, so this stays pure and the app and
 * any future web view compute the same numbers from the same rules.
 */
export function summarise(
  corridors: { slug: string; name: string; color: string; venueIds: string[] }[],
  stampedVenueIds: ReadonlySet<string>,
): PassportProgress {
  const rows: CorridorProgress[] = corridors.map((c) => {
    const stamped = c.venueIds.filter((id) => stampedVenueIds.has(id)).length;
    return {
      slug: c.slug,
      name: c.name,
      color: c.color,
      total: c.venueIds.length,
      stamped,
      complete: c.venueIds.length > 0 && stamped === c.venueIds.length,
    };
  });

  // The one to nudge someone towards: most stamped among the unfinished. A
  // corridor with one door left is a five-minute walk and a real reward;
  // pointing at an untouched one would just be a list of everything left.
  const unfinished = rows.filter((r) => !r.complete && r.stamped > 0);
  const nearestToComplete =
    unfinished.sort((a, b) => b.stamped / b.total - a.stamped / a.total)[0] ?? null;

  return {
    stamped: rows.reduce((n, r) => n + r.stamped, 0),
    total: rows.reduce((n, r) => n + r.total, 0),
    corridors: rows,
    corridorsComplete: rows.filter((r) => r.complete).length,
    nearestToComplete,
  };
}
