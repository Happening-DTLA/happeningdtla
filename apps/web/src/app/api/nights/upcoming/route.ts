import { getUpcomingNight } from "@/lib/queries";
import { toApiNight } from "@/lib/dto";
import { ok, notFound } from "@/lib/api-response";

/** The home screen of the mobile app: the next city-wide night and its events. */
export async function GET() {
  const night = await getUpcomingNight();
  if (!night) return notFound("upcoming night");
  return ok(toApiNight(night));
}
