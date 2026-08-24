import { getNightBySlug } from "@/lib/queries";
import { toApiNight } from "@/lib/dto";
import { ok, notFound } from "@/lib/api-response";

/** One night and its events — the crawl, as a single addressable thing. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const night = await getNightBySlug(slug);
  // An unpublished night 404s rather than 403s, for the same reason a draft
  // event does: a different status confirms the slug exists to anyone probing
  // for nights that haven't been announced.
  if (!night || !night.isPublished) return notFound("night");
  return ok(toApiNight(night));
}
