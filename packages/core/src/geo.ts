/**
 * Distance, for people on foot.
 *
 * The whole product is a few square miles of Downtown walked between six and
 * midnight, so the only distance question that matters is "how long until I am
 * standing there" — and the honest answer is a rough one. GPS between tall
 * buildings on Spring Street is not precise, and nobody walks in a straight
 * line through a city block anyway. Everything here rounds accordingly rather
 * than implying a precision it does not have.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Metres per minute on a Downtown pavement.
 *
 * An unobstructed adult walks about 84. This is lower on purpose: the route is
 * never the straight line the distance is measured along, and Historic Core
 * blocks mean signalled crossings. A number that runs slightly long is a
 * person arriving slightly early, which is the side of wrong to be.
 */
const METRES_PER_MINUTE = 75;

/**
 * Walking minutes, to the nearest, floored at one.
 *
 * Nearest rather than rounded up, because rounding up punishes exactly the
 * distances this app is made of: the Broad and MOCA are across the street from
 * each other, and telling someone that is three minutes makes every short hop
 * on a crawl read as further than it is. "0 min" would read as a bug, so one
 * is the floor.
 */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / METRES_PER_MINUTE));
}

/**
 * Near enough that walking time stops being the useful thing to say.
 *
 * Inside this radius the answer is "it's right here", and GPS scatter in an
 * urban canyon is a good fraction of it anyway.
 */
export const HERE_METERS = 45;

/**
 * How far, in the units the audience actually uses.
 *
 * Feet below a quarter mile, miles above it — the crossover where "1,300 ft"
 * stops meaning anything to most people.
 */
export function formatDistance(meters: number): string {
  const feet = meters * 3.28084;
  if (feet < 1320) return `${Math.round(feet / 10) * 10} ft`;
  return `${(feet / 5280).toFixed(1)} mi`;
}

/** The whole answer, for a row in a list: "4 min · 0.2 mi", or "Right here". */
export function describeWalk(meters: number): string {
  if (meters <= HERE_METERS) return "Right here";
  return `${walkingMinutes(meters)} min · ${formatDistance(meters)}`;
}
