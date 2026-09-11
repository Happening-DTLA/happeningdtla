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

/**
 * Accepts either secret.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`, which is set in the
 * Vercel dashboard and is not the same value as ADMIN_API_SECRET. Rather than
 * make one impersonate the other, both are accepted — a scheduled run and a
 * manual one are the same operation and neither should need the other's key.
 */
function authorised(request: Request): boolean {
  const presented = bearerToken(request);
  if (!presented) return false;
  const allowed = [process.env.CRON_SECRET, process.env.ADMIN_API_SECRET]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));
  return allowed.includes(presented);
}

async function sweep(request: Request) {
  if (!authorised(request)) {
    return fail(401, "unauthorized", "This endpoint needs the cron or admin secret.");
  }
  const expired = await expireUnpaidFees();
  console.log(`[fees] swept ${expired} expired booth${expired === 1 ? "" : "s"}`);
  return ok({ expired });
}

/**
 * GET as well as POST, because Vercel Cron only issues GET.
 *
 * A GET that mutates is not something to do casually, and this one is
 * defensible on two counts: it is authenticated, and it is idempotent — every
 * expiry is a conditional update, so a crawler or a double-fire changes
 * nothing the first call did not already change.
 */
export const GET = sweep;
export const POST = sweep;
