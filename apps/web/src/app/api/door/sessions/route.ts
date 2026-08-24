import { z } from "zod";
import { createDoorSession, doorWindowFor, DoorWindowError } from "@/lib/door";
import { requireAdmin } from "@/lib/door-auth";
import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";

const Body = z.object({
  eventId: z.string().min(1),
  /**
   * Which business is opening this door. Today it is supplied and checked
   * against the event's owner; once organizer accounts exist it comes from the
   * session instead, and the shape of the check does not change.
   */
  organizerId: z.string().min(1).optional(),
  deviceLabel: z.string().trim().max(60).optional(),
  /** Overrides for a soundcheck door, a multi-day run, or testing. */
  activeFrom: z.iso.datetime().optional(),
  activeUntil: z.iso.datetime().optional(),
});

/** Organizer action: mint a pairing code for one of your own events. */
async function handlePOST(request: Request): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  const event = await prisma.event.findUnique({
    where: { id: parsed.data.eventId },
    select: { id: true, title: true, startsAt: true, endsAt: true, organizerId: true },
  });
  if (!event) return fail(404, "not_found", "No such event.");

  // Until organizer accounts land, an omitted organizerId means "the event's
  // own owner". Explicit and checked once auth exists.
  const organizerId = parsed.data.organizerId ?? event.organizerId;

  try {
    const session = await createDoorSession({
      eventId: event.id,
      organizerId,
      deviceLabel: parsed.data.deviceLabel,
      activeFrom: parsed.data.activeFrom ? new Date(parsed.data.activeFrom) : undefined,
      activeUntil: parsed.data.activeUntil ? new Date(parsed.data.activeUntil) : undefined,
    });

    const window = doorWindowFor(event);
    return ok({
      sessionId: session.id,
      pairingCode: session.pairingCode,
      activeFrom: session.activeFrom.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      /** True when staff can pair right now; false means it's too early. */
      pairableNow: session.activeFrom <= new Date(),
      defaultWindow: {
        activeFrom: window.activeFrom.toISOString(),
        activeUntil: window.activeUntil.toISOString(),
      },
      event: { id: event.id, title: event.title },
    });
  } catch (err) {
    if (err instanceof DoorWindowError) {
      return fail(err.code === "too_many_doors" ? 409 : 400, err.code, err.message);
    }
    throw err;
  }
}

export const POST = withErrorBoundary(handlePOST, "door/sessions");
