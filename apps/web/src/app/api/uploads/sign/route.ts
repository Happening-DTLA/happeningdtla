import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { clientIp, enforceRateLimit, type RateRule } from "@/lib/rate-limit";
import { signUpload, storageConfigured } from "@/lib/storage";

/**
 * Loose enough for an artist attaching twenty photographs in one sitting,
 * tight enough that the bucket is not a free file host. Each signed URL is
 * good for one object and expires in half an hour.
 */
const SIGN_RULES: RateRule[] = [
  { limit: 60, windowSeconds: 600 },
  { limit: 300, windowSeconds: 86_400 },
];

const Body = z.object({
  folder: z.enum(["portfolio", "artwork"]),
  contentType: z.string().min(3).max(80),
});

export async function POST(request: Request) {
  const limited = await enforceRateLimit("upload:ip", clientIp(request), SIGN_RULES);
  if (limited) return limited;

  if (!storageConfigured()) {
    return fail(
      503,
      "storage_unconfigured",
      "Image uploads are not set up yet. SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_json", "Request body must be JSON.");
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) return fail(422, "invalid_request", "folder and contentType are required.");

  try {
    return ok(await signUpload(parsed.data.folder, parsed.data.contentType));
  } catch (error) {
    return fail(400, "cannot_sign", error instanceof Error ? error.message : "Upload could not be prepared.");
  }
}
