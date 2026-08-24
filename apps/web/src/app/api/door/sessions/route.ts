import { z } from "zod";
import { createDoorSession, PAIRING_CODE_TTL_MINUTES } from "@/lib/door";
import { requireAdmin } from "@/lib/door-auth";
import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";

const Body = z.object({
  eventId: z.string().min(1),
  deviceLabel: z.string().trim().max(60).optional(),
  /** Defaults to 12 hours after the event starts — long enough for a late
   *  night, short enough that a token doesn't outlive its usefulness. */
  expiresAt: z.iso.datetime().optional(),
});

/** Organizer action: mint a pairing code to read out to door staff. */
async function handlePOST(request: Request): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  const event = await prisma.event.findUnique({
    where: { id: parsed.data.eventId },
    select: { id: true, title: true, startsAt: true },
  });
  if (!event) return fail(404, "not_found", "No such event.");

  const session = await createDoorSession({
    eventId: event.id,
    deviceLabel: parsed.data.deviceLabel,
    expiresAt: parsed.data.expiresAt
      ? new Date(parsed.data.expiresAt)
      : new Date(event.startsAt.getTime() + 12 * 60 * 60_000),
  });

  return ok({
    sessionId: session.id,
    pairingCode: session.pairingCode,
    pairingCodeExpiresInMinutes: PAIRING_CODE_TTL_MINUTES,
    expiresAt: session.expiresAt.toISOString(),
    event: { id: event.id, title: event.title },
  });
}

export const POST = withErrorBoundary(handlePOST, "door/sessions");
