/**
 * Dates are the #1 source of subtle bugs in an events app. There are TWO kinds
 * of date value in this schema and they must be formatted differently:
 *
 *  1. TIMESTAMPS (Event.startsAt, doorsAt, endsAt) — a real instant in time.
 *     Format these in Pacific: the whole product is one city.
 *
 *  2. CALENDAR DATES (Night.date, a Postgres `date` column) — a day on a wall
 *     calendar with no time or zone. Postgres hands these back as midnight UTC,
 *     so formatting them in Pacific shifts them to 5pm the PREVIOUS day and the
 *     UI confidently shows the wrong weekday. Format these in UTC.
 *
 * Getting (2) wrong is how "first Thursday" renders as a Wednesday.
 */

const PACIFIC = "America/Los_Angeles";

export const formatTime = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: PACIFIC,
  }).format(d);

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: PACIFIC,
  }).format(d);

/** For `@db.Date` columns only — see note (2) above. */
export const formatCalendarDate = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);

export const formatTimeRange = (start: Date, end: Date | null) =>
  end ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start);
