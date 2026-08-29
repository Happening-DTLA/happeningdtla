import {
  EVENT_CATEGORIES,
  pacificDayRange,
  type EventCategory,
} from "@dtlahappening/core";
import { searchEvents } from "@/lib/queries";
import { toApiEventSummary } from "@/lib/dto";
import { ok, fail } from "@/lib/api-response";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");

  // Reject an unknown category rather than silently returning everything —
  // a typo that quietly "works" is how a broken filter ships.
  if (category && !EVENT_CATEGORIES.includes(category as EventCategory)) {
    return fail(400, "invalid_category", `Unknown category "${category}".`);
  }

  // `from`/`to` are calendar days in Los Angeles, not UTC. Art Night starts
  // 6pm Pacific, which is 01:00 UTC the NEXT day — treating the filter as a UTC
  // day hides the flagship event from a search for its own date.
  const fromDay = url.searchParams.get("from");
  const toDay = url.searchParams.get("to");
  const fromRange = fromDay ? pacificDayRange(fromDay) : null;
  const toRange = toDay ? pacificDayRange(toDay) : null;

  if ((fromDay && !fromRange) || (toDay && !toRange)) {
    return fail(400, "invalid_date", "Dates must be formatted YYYY-MM-DD.");
  }

  const { events, total } = await searchEvents({
    q: url.searchParams.get("q")?.trim() || undefined,
    category: category ?? undefined,
    from: fromRange?.start,
    toExclusive: toRange?.endExclusive,
    freeOnly: url.searchParams.get("freeOnly") === "true",
    // Bounded: a client cannot ask the database for everything.
    take: Math.min(Math.max(Number(url.searchParams.get("limit")?.trim() || 250), 1), 250),
  });

  return ok({ events: events.map(toApiEventSummary), total });
}
