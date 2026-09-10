import { ok, fail } from "@/lib/api-response";
import { bearerToken } from "@/lib/door-auth";
import { expireUnpaidFees } from "@/lib/participation-fees";

/**
 * Releases booths whose 72-hour payment window closed unpaid.
 *
 * Meant for a scheduled call. Guarded by ADMIN_API_SECRET rather than left
 * open: it is cheap, but an endpoint that mutates status on a timer is not
 * something to leave for anyone to trigger.
 *
 * Idempotent — each expiry is a conditional update, so running it twice in the
 * same minute expires nothing twice.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.ADMIN_API_SECRET?.trim();
  if (!expected || bearerToken(request) !== expected) {
    return fail(401, "unauthorized", "This endpoint needs the admin secret.");
  }
  const expired = await expireUnpaidFees();
  console.log(`[fees] swept ${expired} expired booth${expired === 1 ? "" : "s"}`);
  return ok({ expired });
}
