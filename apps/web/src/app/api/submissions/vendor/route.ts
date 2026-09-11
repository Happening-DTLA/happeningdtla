import { ok, fail } from "@/lib/api-response";
import { clientIp, enforceRateLimit, type RateRule } from "@/lib/rate-limit";
import {
  VendorSubmissionBody,
  VendorSubmissionError,
  createVendorSubmission,
} from "@/lib/vendor-submissions";

/**
 * Same shape and same reasoning as the artist route: applications are slow,
 * deliberate and rare, so the limits are tight compared with checkout and
 * keyed on address rather than email.
 */
const SUBMIT_RULES: RateRule[] = [
  { limit: 5, windowSeconds: 600 },
  { limit: 25, windowSeconds: 86_400 },
];

export async function POST(request: Request) {
  const limited = await enforceRateLimit("vendor-submission:ip", clientIp(request), SUBMIT_RULES);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_json", "Request body must be JSON.");
  }

  const parsed = VendorSubmissionBody.safeParse(body);
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

  try {
    const submission = await createVendorSubmission(parsed.data);
    return ok({
      id: submission.id,
      status: submission.status,
      markets: submission.markets.length,
    });
  } catch (err) {
    // Rules the applicant can actually do something about — a market that
    // closed while the form was open, or a food vendor picking a market that
    // takes none — come back as themselves rather than as a 500.
    if (err instanceof VendorSubmissionError) {
      return fail(422, err.code, err.message);
    }
    throw err;
  }
}
