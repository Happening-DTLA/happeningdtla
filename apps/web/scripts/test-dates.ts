/**
 * Date-filter tests for the map's presets.
 *
 * Dates are the bug this codebase has already shipped once: a UTC day boundary
 * hides every 6pm Art Night event, and a calendar date formatted in Pacific
 * renders the first Thursday as a Wednesday. The map adds "Tonight" and "This
 * weekend", which are the same trap with a clock attached — asked at 8pm, a
 * UTC "today" is already tomorrow.
 *
 * Pure functions, no database. Run: npx tsx scripts/test-dates.ts
 */
import {
  addCalendarDays,
  calendarDaysBetween,
  pacificDayRange,
  pacificToday,
  pacificWeekendRange,
  relativeEventTime,
} from "@dtlahappening/core";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};
const eq = (label: string, actual: unknown, expected: unknown) =>
  check(label, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);

console.log("\npacificToday — the UTC-day trap");
// 8:30pm Pacific on 1 Oct is already 2 Oct in UTC. This is the exact moment
// someone checks the map on their way downtown.
eq("8:30pm Pacific is still today", pacificToday(new Date("2026-10-02T03:30:00Z")), "2026-10-01");
eq("00:30 Pacific is today", pacificToday(new Date("2026-10-01T07:30:00Z")), "2026-10-01");
eq("one minute to Pacific midnight", pacificToday(new Date("2026-10-02T06:59:00Z")), "2026-10-01");
eq("Pacific midnight rolls over", pacificToday(new Date("2026-10-02T07:00:00Z")), "2026-10-02");

console.log("\npacificToday — across the DST fallback (1 Nov 2026)");
eq("01:30 PDT, before the fallback", pacificToday(new Date("2026-11-01T08:30:00Z")), "2026-11-01");
eq("01:30 PST, after the fallback", pacificToday(new Date("2026-11-01T09:30:00Z")), "2026-11-01");

console.log("\naddCalendarDays");
eq("across a month boundary", addCalendarDays("2026-08-31", 1), "2026-09-01");
eq("across the DST fallback", addCalendarDays("2026-10-31", 2), "2026-11-02");
eq("across the DST spring-forward", addCalendarDays("2026-03-07", 2), "2026-03-09");
eq("across a year boundary", addCalendarDays("2026-12-31", 1), "2027-01-01");
eq("backwards", addCalendarDays("2026-09-01", -1), "2026-08-31");

console.log("\npacificWeekendRange — noon Pacific on each weekday");
const noonPacific = (day: string) => new Date(`${day}T19:00:00Z`);
const weekend = (day: string) => pacificWeekendRange(noonPacific(day));
eq("Monday looks ahead to Friday", weekend("2026-08-24").from, "2026-08-28");
eq("Monday runs through Sunday", weekend("2026-08-24").to, "2026-08-30");
eq("Thursday looks ahead to Friday", weekend("2026-08-27").from, "2026-08-28");
eq("Friday starts today", weekend("2026-08-28").from, "2026-08-28");
eq("Friday runs through Sunday", weekend("2026-08-28").to, "2026-08-30");
eq("Saturday starts today, not next week", weekend("2026-08-29").from, "2026-08-29");
eq("Saturday runs through Sunday", weekend("2026-08-29").to, "2026-08-30");
eq("Sunday is the tail, not a new weekend", weekend("2026-08-30").from, "2026-08-30");
eq("Sunday ends today", weekend("2026-08-30").to, "2026-08-30");

console.log("\nThe Art Night regression — 6pm Pacific, 1 Oct 2026");
// The flagship event. 6pm Pacific on 1 Oct is 01:00 UTC on 2 Oct, so a naive
// UTC day filter for 1 Oct excludes the entire night.
const artNightStart = new Date("2026-10-02T01:00:00Z");
const oct1 = pacificDayRange("2026-10-01");
check("pacificDayRange parsed", oct1 !== null);
if (oct1) {
  check(
    "6pm Art Night falls inside its own date",
    artNightStart >= oct1.start && artNightStart < oct1.endExclusive,
    `${oct1.start.toISOString()} … ${oct1.endExclusive.toISOString()}`,
  );
  // Proves the filter is doing real work rather than passing by accident.
  const naiveUtcEnd = new Date("2026-10-02T00:00:00Z");
  check(
    "a naive UTC day WOULD have hidden it (why this matters)",
    artNightStart >= naiveUtcEnd,
    "confirms the bug the Pacific range prevents",
  );
}

console.log("\nTonight preset — same day used as both bounds");
const today = pacificToday(new Date("2026-10-02T03:30:00Z"));
const tonight = pacificDayRange(today);
check("covers a full Pacific day", tonight !== null && tonight.endExclusive.getTime() - tonight.start.getTime() === 24 * 3600 * 1000);

console.log("\ncalendarDaysBetween");
eq("same day", calendarDaysBetween("2026-10-01", "2026-10-01"), 0);
eq("across the DST fallback", calendarDaysBetween("2026-10-31", "2026-11-02"), 2);
eq("backwards", calendarDaysBetween("2026-10-05", "2026-10-01"), -4);

console.log("\nrelativeEventTime — Art Night doors 6pm Pacific, 1 Oct 2026");
// 6pm PDT on 1 Oct is 01:00 UTC on 2 Oct.
const start = "2026-10-02T01:00:00Z";
const at = (iso: string) => relativeEventTime(start, null, new Date(iso));

eq("an hour in", at("2026-10-02T02:00:00Z"), "Happening now");
eq("five hours in, no endsAt", at("2026-10-02T06:00:00Z"), "Ended");
eq("30 minutes out", at("2026-10-02T00:30:00Z"), "Starts in 30 min");
eq("two hours out", at("2026-10-01T23:00:00Z"), "Starts in 2 hr");
eq("same morning", at("2026-10-01T17:00:00Z"), "Tonight");
eq("the day before", at("2026-09-30T19:00:00Z"), "Tomorrow");
eq("three days out", at("2026-09-28T19:00:00Z"), "In 3 days");
eq("ten days out", at("2026-09-21T19:00:00Z"), "Next week");
eq("three weeks out", at("2026-09-10T19:00:00Z"), "In 3 weeks");

// A 2pm event on the same day is "Today", not "Tonight".
eq(
  "an afternoon event is not Tonight",
  relativeEventTime("2026-10-01T21:00:00Z", null, new Date("2026-10-01T17:00:00Z")),
  "Today",
);

// An explicit end time wins over the four-hour assumption.
eq(
  "endsAt is respected",
  relativeEventTime(start, "2026-10-02T03:00:00Z", new Date("2026-10-02T03:30:00Z")),
  "Ended",
);
check(
  "a long event is still live past four hours",
  relativeEventTime(start, "2026-10-02T09:00:00Z", new Date("2026-10-02T06:00:00Z")) ===
    "Happening now",
  "an endsAt after the default window keeps it live",
);

console.log(failures === 0 ? "\nAll date checks passed.\n" : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
