import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { clientIp, enforceRateLimit, type RateRule } from "@/lib/rate-limit";

/**
 * Footfall, reported by the phone that collected it.
 *
 * This endpoint is the aggregate copy of something that already happened on a
 * device — it cannot grant a stamp and it cannot take one away. That asymmetry
 * is the point: someone walking Downtown with no signal still has a complete
 * passport, and these rows catch up whenever they can.
 *
 * Anonymous by construction. A per-install random id, a venue, a night. No
 * account, no contact detail, and no coordinates: knowing that somebody was at
 * the Biltmore is what the organisers need, and keeping a trail of where a
 * person walked all evening is not.
 */
const CHECKIN_RULES: RateRule[] = [
  // A determined crawler might stamp thirty doors in an evening, and a backlog
  // drains several at once when signal returns. Generous, then a daily ceiling
  // well above any real night.
  { limit: 40, windowSeconds: 600 },
  { limit: 200, windowSeconds: 86_400 },
];

const Body = z.object({
  deviceId: z.uuid(),
  venueId: z.string().min(1).max(60),
  nightId: z.string().min(1).max(60),
  at: z.iso.datetime().optional(),
  verified: z.boolean().optional(),
});

export async function POST(request: Request) {
  const limited = await enforceRateLimit("checkin:ip", clientIp(request), CHECKIN_RULES);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_json", "Request body must be JSON.");
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) return fail(422, "invalid_checkin", "deviceId, venueId and nightId are required.");

  const { deviceId, venueId, nightId, at, verified } = parsed.data;

  try {
    await prisma.venueCheckIn.upsert({
      // Idempotent on purpose: a phone that lost its response and retried must
      // not count the same person twice.
      where: { deviceId_venueId_nightId: { deviceId, venueId, nightId } },
      create: {
        deviceId,
        venueId,
        nightId,
        at: at ? new Date(at) : new Date(),
        verified: verified ?? false,
      },
      update: {},
    });
  } catch {
    // A venue or night that no longer exists is not the phone's problem, and
    // there is nothing useful for it to do with the error. The stamp is
    // already real on the device.
    return ok({ recorded: false });
  }

  return ok({ recorded: true });
}
