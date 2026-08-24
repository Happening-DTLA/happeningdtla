import { z } from "zod";
import { createDoorSession, doorWindowFor, DoorWindowError } from "@/lib/door";
import { requireManager, requireOrganizer } from "@/lib/organizer-auth";
import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";

const Body = z.object({
  eventId: z.string().min(1),
  deviceLabel: z.string().trim().max(60).optional(),
  /** Overrides for a soundcheck door, a multi-day run, or testing. */
  activeFrom: z.iso.datetime().optional(),
  activeUntil: z.iso.datetime().optional(),
});

/** Organizer action: mint a pairing code for one of your own events. */
async function handlePOST(request: Request): Promise<Response> {
  // Door codes are venue settings, so this is owner/manager work. Door staff
  // scanning at a door must never be able to mint more scanners.
  const auth = await requireOrganizer(request);
  const denied = requireManager(auth);
  if (denied) return denied;
  if (!auth.ok) return auth.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  const event = await prisma.event.findUnique({
    where: { id: parsed.data.eventId },
    select: { id: true, title: true, startsAt: true, endsAt: true, organizerId: true },
  });
  if (!event) return fail(404, "not_found", "No such event.");

  // The organizer comes from WHO IS SIGNED IN, never from the request body.
  // Letting a caller name their own organizer id is how you open someone
  // else's door. createDoorSession still verifies the event belongs to them.
  const organizerId = auth.organizerId;

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
