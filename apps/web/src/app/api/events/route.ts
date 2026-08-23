import { getStandaloneEvents } from "@/lib/queries";
import { toApiEventSummary } from "@/lib/dto";
import { ok } from "@/lib/api-response";

/** Published events that aren't part of a city-wide night. */
export async function GET() {
  const events = await getStandaloneEvents();
  return ok({ events: events.map(toApiEventSummary) });
}
