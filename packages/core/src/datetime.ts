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

/**
 * Today's calendar date in Los Angeles, as YYYY-MM-DD.
 *
 * Deliberately NOT `new Date().toISOString().slice(0, 10)`. That is the UTC
 * day, which from 5pm Pacific onward is already tomorrow — so "what's on
 * tonight", asked at 8pm on the way downtown, would quietly answer with
 * tomorrow's events and show an empty map.
 */
export function pacificToday(now: DateLike = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: PACIFIC,
  }).formatToParts(toDate(now));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Whole-day arithmetic on a calendar date.
 *
 * Doing this in UTC is correct precisely BECAUSE the input carries no zone —
 * a YYYY-MM-DD is a wall-calendar day, so stepping from its UTC midnight can
 * never land mid-DST-transition the way adding 24h to a Pacific instant can.
 * This is the same reasoning as formatting calendar dates in UTC; see note (2)
 * at the top of this file.
 */
export function addCalendarDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The weekend people actually mean by "this weekend" — Friday through Sunday,
 * as inclusive calendar bounds for a search.
 *
 * Asked DURING the weekend it starts today rather than pointing at next
 * Friday. Someone opening the map on a Saturday night wants tonight, and a
 * filter that answers with events six days away reads as broken.
 */
export function pacificWeekendRange(now: DateLike = new Date()): {
  from: string;
  to: string;
} {
  const today = pacificToday(now);
  // Safe in UTC for the reason given on addCalendarDays.
  const dayOfWeek = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat

  // Sunday is the tail of the weekend already underway, not the start of one.
  if (dayOfWeek === 0) return { from: today, to: today };

  // Friday or Saturday: from now through Sunday.
  if (dayOfWeek >= 5) {
    return { from: today, to: addCalendarDays(today, 7 - dayOfWeek) };
  }

  // Monday–Thursday: the weekend that hasn't started yet.
  return {
    from: addCalendarDays(today, 5 - dayOfWeek),
    to: addCalendarDays(today, 7 - dayOfWeek),
  };
}

/** Whole days from one calendar date to another. Negative when `to` is earlier. */
export function calendarDaysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Hour of the day in Los Angeles, 0–23. */
function pacificHour(d: DateLike): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: PACIFIC,
  }).formatToParts(toDate(d));
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

/**
 * When this is, said the way a person would say it.
 *
 * "Sunday, September 20" tells you the date but not whether to leave the
 * house. Nightlife is decided on a horizon of hours, so the top of an event
 * page should answer "is this now?" before it answers "what date is this?".
 *
 * Deliberately blunt at the edges: an event underway says so, and one that has
 * finished says so rather than showing a stale countdown next to a live Get
 * Tickets button.
 *
 * `endsAt` is optional because most events do not set one; without it an event
 * is treated as over four hours after it starts, which is a normal night out
 * and errs toward still showing "happening now" rather than hiding a live show.
 */
export function relativeEventTime(
  startsAt: DateLike,
  endsAt: DateLike | null,
  now: DateLike = new Date(),
): string {
  const start = toDate(startsAt).getTime();
  const nowMs = toDate(now).getTime();
  const end = endsAt ? toDate(endsAt).getTime() : start + 4 * 3_600_000;

  if (nowMs >= end) return "Ended";
  if (nowMs >= start) return "Happening now";

  const days = calendarDaysBetween(pacificToday(now), pacificToday(startsAt));

  if (days <= 0) {
    // Same calendar day. Under three hours, count down — that is the window
    // where the number changes someone's plans.
    const hours = Math.floor((start - nowMs) / 3_600_000);
    if (hours < 1) return `Starts in ${Math.max(1, Math.round((start - nowMs) / 60_000))} min`;
    if (hours < 3) return `Starts in ${hours} hr`;
    return pacificHour(startsAt) >= 17 ? "Tonight" : "Today";
  }
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 14) return "Next week";
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}
