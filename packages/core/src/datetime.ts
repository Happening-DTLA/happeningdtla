/**
 * Two kinds of date value exist in this system and they format differently:
 *
 *  1. TIMESTAMPS (event start, doors, end) — a real instant. Format in Pacific;
 *     the whole product is one city.
 *  2. CALENDAR DATES (a night's date) — a wall-calendar day with no zone.
 *     Postgres returns these as midnight UTC, so formatting them in Pacific
 *     shifts them to 5pm the PREVIOUS day and the UI shows the wrong weekday.
 *     Format these in UTC.
 *
 * Getting (2) wrong is how "first Thursday" renders as a Wednesday. It already
 * happened once.
 *
 * These accept `Date | string` because the server holds Date objects and API
 * clients receive ISO strings.
 */

const PACIFIC = "America/Los_Angeles";

type DateLike = Date | string;
const toDate = (d: DateLike): Date => (typeof d === "string" ? new Date(d) : d);

export const formatTime = (d: DateLike) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: PACIFIC,
  }).format(toDate(d));

export const formatDate = (d: DateLike) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: PACIFIC,
  }).format(toDate(d));

/** For calendar dates only — see note (2) above. */
export const formatCalendarDate = (d: DateLike) => {
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T00:00:00Z`)
    : toDate(d);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
};

export const formatTimeRange = (start: DateLike, end: DateLike | null) =>
  end ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start);

/**
 * Converts a Los Angeles wall-clock time to the real UTC instant.
 *
 * Needed because "October 1" in a filter means October 1 *in Los Angeles*, and
 * an Art Night event starting 6pm Pacific is 01:00 UTC on October 2. Treating
 * the filter as a UTC day silently hides the flagship event.
 *
 * The offset is derived from the zone at that moment rather than hardcoded, so
 * this stays correct across the DST change in early November.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const f: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") f[p.type] = Number(p.value);

  const asIfUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour % 24, f.minute, f.second);
  return asIfUtc - instant.getTime();
}

function pacificWallClockToUtc(
  y: number, mo: number, d: number,
  h: number, mi: number, s: number, ms: number,
): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  // First pass uses the offset at the naive instant; the second corrects for
  // the case where that instant lands on the other side of a DST boundary.
  let result = new Date(naive - zoneOffsetMs(new Date(naive), PACIFIC));
  result = new Date(naive - zoneOffsetMs(result, PACIFIC));
  return result;
}

/**
 * UTC bounds for a YYYY-MM-DD calendar day in Los Angeles.
 *
 * `start` is inclusive, `endExclusive` is the start of the following day —
 * query with `gte: start, lt: endExclusive`. An exclusive bound is exact,
 * whereas an "end of day" value inherits millisecond slop from the offset
 * calculation, which only resolves to seconds.
 *
 * Correctly spans the 25-hour day when DST ends. Returns null for malformed
 * input rather than a silently wrong range.
 */
export function pacificDayRange(
  day: string,
): { start: Date; endExclusive: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return {
    start: pacificWallClockToUtc(y, mo, d, 0, 0, 0, 0),
    endExclusive: pacificWallClockToUtc(y, mo, d + 1, 0, 0, 0, 0),
  };
}
