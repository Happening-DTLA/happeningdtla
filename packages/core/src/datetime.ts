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
