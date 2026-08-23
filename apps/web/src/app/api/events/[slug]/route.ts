import { getEventBySlug } from "@/lib/queries";
import { toApiEvent } from "@/lib/dto";
import { ok, notFound } from "@/lib/api-response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  // Draft and cancelled events must 404 rather than 403 — a different status
  // would confirm the slug exists to anyone probing for unannounced shows.
  if (!event || event.status !== "PUBLISHED") return notFound("event");
  return ok(toApiEvent(event));
}
