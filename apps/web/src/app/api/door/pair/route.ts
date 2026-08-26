import { z } from "zod";
import { claimDoorSession } from "@/lib/door";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";
import { DOOR_PAIR_RULES, clientIp, enforceRateLimit } from "@/lib/rate-limit";

const Body = z.object({
  pairingCode: z.string().trim().min(4).max(12),
  deviceLabel: z.string().trim().max(60).optional(),
});

/** Door staff action: trade the spoken code for this device's token. */
async function handlePOST(request: Request): Promise<Response> {
  // A correct guess admits people through a door for free, so guesses are
  // counted. Loose enough that staff can mistype on a cold sidewalk.
  const limited = await enforceRateLimit("door:pair", clientIp(request), DOOR_PAIR_RULES);
  if (limited) return limited;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_request", "Enter the pairing code.");

  const session = await claimDoorSession(parsed.data.pairingCode, parsed.data.deviceLabel);

  // One message for every failure mode — wrong, expired, already used. Telling
  // a stranger which one it was just helps them guess.
  if (!session?.token) {
    return fail(401, "pairing_failed", "That code isn't valid. Ask for a new one.");
  }

  return ok({
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    event: {
      id: session.event.id,
      title: session.event.title,
      venueName: session.event.venue.name,
      startsAt: session.event.startsAt.toISOString(),
    },
  });
}

export const POST = withErrorBoundary(handlePOST, "door/pair");
