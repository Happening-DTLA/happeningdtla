import { ok, fail } from "@/lib/api-response";
import { clientIp, enforceRateLimit, type RateRule } from "@/lib/rate-limit";
import { VolunteerSubmissionBody, createVolunteerSubmission } from "@/lib/participation-submissions";

/**
 * Same limits and same reasoning as the artist and vendor routes: sign-ups are
 * slow, deliberate and rare, so they are tight compared with checkout and keyed
 * on address rather than email.
 */
const SUBMIT_RULES: RateRule[] = [
  { limit: 5, windowSeconds: 600 },
  { limit: 25, windowSeconds: 86_400 },
];

export async function POST(request: Request) {
  const limited = await enforceRateLimit("volunteer-submission:ip", clientIp(request), SUBMIT_RULES);
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "bad_json", "Request body must be JSON.");
  }

  const parsed = VolunteerSubmissionBody.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(
      422,
      "invalid_submission",
      `${first?.path.join(".") || "submission"}: ${first?.message ?? "is invalid"}`,
    );
  }

  const submission = await createVolunteerSubmission(parsed.data);
  return ok({ id: submission.id, status: submission.status, roles: submission.roles.length, });
}
