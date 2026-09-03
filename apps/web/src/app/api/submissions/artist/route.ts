import { ok, fail } from "@/lib/api-response";
import { clientIp, enforceRateLimit, type RateRule } from "@/lib/rate-limit";
import { ArtistSubmissionBody, createArtistSubmission } from "@/lib/submissions";

/**
 * Applications are slow, deliberate and rare — an artist fills this in once a
 * month, not once a minute. So the limits are tight compared with checkout,
 * and per address rather than per email: an address is what an abusive script
 * cannot trivially vary, and a shared gallery wifi still leaves plenty of room
 * for the handful of real applications an evening.
 */
const SUBMIT_RULES: RateRule[] = [
  { limit: 5, windowSeconds: 600 },
  { limit: 25, windowSeconds: 86_400 },
];

export async function POST(request: Request) {
  const limited = await enforceRateLimit("submission:ip", clientIp(request), SUBMIT_RULES);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_json", "Request body must be JSON.");
  }

  const parsed = ArtistSubmissionBody.safeParse(body);
  if (!parsed.success) {
    // The first problem, named. A wall of validation errors is not something
    // anyone reads on a phone, and the form highlights fields itself.
    const first = parsed.error.issues[0];
    return fail(
      422,
      "invalid_submission",
      `${first?.path.join(".") || "submission"}: ${first?.message ?? "is invalid"}`,
    );
  }

  const submission = await createArtistSubmission(parsed.data);
  return ok({ id: submission.id, status: submission.status, artworks: submission.artworks.length });
}
