import type { ApiError } from "@dtlahappening/core";
import { prisma } from "@/lib/prisma";

/**
 * Request rate limiting, in Postgres.
 *
 * The gap this closes: /api/checkout is unauthenticated by design — forcing
 * signup before purchase is the biggest conversion killer in ticketing — and
 * every call holds inventory and creates a Stripe PaymentIntent. Unlimited,
 * a script can hold every seat of every event for the full hold window,
 * repeatedly and for free. The oversell invariant holds perfectly the whole
 * time; the seats really are held, and the event really does read as sold out
 * to people trying to buy.
 *
 * Postgres rather than memory because an in-process counter protects nothing
 * once the app runs as more than one instance: each serverless invocation
 * starts its own count and the limit silently becomes limit × instances.
 */

export type RateRule = {
  limit: number;
  windowSeconds: number;
};

/**
 * One buyer, retrying. Tight — nobody legitimately starts five checkouts in
 * ten minutes, and this is the limit that catches a person hammering the
 * button or a script that has not bothered to vary its details.
 */
export const CHECKOUT_PER_BUYER: RateRule[] = [
  { limit: envInt("CHECKOUT_RATE_PER_BUYER_10MIN", 5), windowSeconds: 600 },
  { limit: envInt("CHECKOUT_RATE_PER_BUYER_HOUR", 15), windowSeconds: 3600 },
];

/**
 * One address, everyone behind it. Deliberately loose, because a venue's wifi
 * is a single NAT: at a busy door dozens of real buyers share one address, and
 * a tight per-IP limit would turn away paying customers standing in front of
 * the venue. Raise CHECKOUT_RATE_PER_IP_10MIN on a big night rather than
 * discovering this at the door.
 *
 * Honest about what this is: rate limiting by address raises the cost of
 * holding inventory and stops the trivial version of the attack. It does not
 * stop someone willing to rotate addresses. The complete fix is a cap on
 * concurrently held seats per identity, which needs a way to identify a buyer
 * that guest checkout does not currently have.
 */
export const CHECKOUT_PER_IP: RateRule[] = [
  { limit: envInt("CHECKOUT_RATE_PER_IP_10MIN", 40), windowSeconds: 600 },
];

/**
 * Pairing codes are six characters from a 27-character alphabet. That is a
 * large space, but a successful guess admits people through a door for free,
 * so it does not get unlimited attempts. Loose enough that staff can mistype
 * on a cold sidewalk.
 */
export const DOOR_PAIR_RULES: RateRule[] = [
  { limit: envInt("DOOR_PAIR_RATE_PER_10MIN", 15), windowSeconds: 600 },
];

function envInt(name: string, fallback: number): number {
  // `||` not `??`: a blank env var is an empty string and Number("") is 0,
  // which would configure a limit that rejects every request.
  return Number(process.env[name]?.trim() || fallback);
}

/**
 * Off only outside production, and only when asked.
 *
 * Running the test suites repeatedly in one window would otherwise trip a
 * limit and fail for a reason unrelated to what they test. Same rule as
 * ADMIN_API_SECRET: the escape hatch cannot exist in production.
 */
function disabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.RATE_LIMIT_DISABLED?.trim() === "true";
}

/**
 * Who is being limited.
 *
 * `x-forwarded-for` is only trustworthy behind a proxy that sets it — Vercel,
 * Cloudflare, a load balancer. Exposed directly to the internet it is
 * attacker-controlled and this becomes decorative, so terminate TLS behind
 * something that overwrites the header.
 *
 * Returns null when there is no usable address rather than bucketing everyone
 * together under a placeholder, which would let one script exhaust the limit
 * for every buyer at once — the outage it is supposed to prevent.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || null;
}

function tooMany(retryAfterSeconds: number): Response {
  const body: ApiError = {
    error: {
      code: "rate_limited",
      message: "Too many attempts. Wait a moment and try again.",
    },
  };
  return Response.json(body, {
    status: 429,
    headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
  });
}

/**
 * Counts one request against every rule, and returns a 429 if any is exceeded.
 * Null means carry on.
 *
 * FAILS OPEN. If the counter itself errors, the request proceeds. This is the
 * house rule from the schema comments — never reject on an ambiguous read,
 * because turning away a paying customer is the worst thing this system can
 * do — and it applies with more force here: a rate limiter that takes the
 * checkout down when the database hiccups has caused a worse outage than the
 * abuse it prevents.
 */
export async function enforceRateLimit(
  bucket: string,
  subject: string | null,
  rules: RateRule[],
): Promise<Response | null> {
  if (disabled() || !subject) return null;

  try {
    const now = Date.now();

    for (const rule of rules) {
      const windowMs = rule.windowSeconds * 1000;
      const windowStart = Math.floor(now / windowMs) * windowMs;
      // The window is part of the key, so a new window is a new row. A stale
      // counter can never be incremented, and no read-then-write is needed to
      // decide whether to reset one.
      const key = `${bucket}:${subject}:${Math.floor(windowStart / 1000)}`;
      const expiresAt = new Date(windowStart + windowMs);

      // One statement: insert or increment, returning the new value. Prisma's
      // upsert can compile to a select followed by a write, which two
      // simultaneous requests can both pass.
      const rows = await prisma.$queryRaw<{ count: number }[]>`
        INSERT INTO "RateLimit" ("key", "count", "expiresAt")
        VALUES (${key}, 1, ${expiresAt})
        ON CONFLICT ("key")
        DO UPDATE SET "count" = "RateLimit"."count" + 1
        RETURNING "count"
      `;

      const count = Number(rows[0]?.count ?? 0);
      if (count > rule.limit) {
        return tooMany(Math.ceil((windowStart + windowMs - now) / 1000));
      }
    }

    // Spent rows are dead weight. Swept here rather than on a schedule so the
    // table cannot grow unbounded before a cron exists, and rarely enough that
    // it costs nothing on the hot path.
    if (Math.random() < 0.01) void sweepRateLimits().catch(() => {});

    return null;
  } catch (err) {
    console.error(`[rate-limit] counter failed for ${bucket}; allowing request`, err);
    return null;
  }
}

/** Deletes counters whose window has closed. Safe to call any time. */
export async function sweepRateLimits(): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
