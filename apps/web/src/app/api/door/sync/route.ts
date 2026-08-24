import { z } from "zod";
import { syncOfflineScans } from "@/lib/door";
import { requireDoorSession } from "@/lib/door-auth";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";

const Body = z.object({
  scans: z
    .array(z.object({ code: z.string().min(1).max(200), scannedAt: z.iso.datetime() }))
    .max(500),
});

/** Uploads scans captured while the device had no network. */
async function handlePOST(request: Request): Promise<Response> {
  const auth = await requireDoorSession(request);
  if (!auth.ok) return auth.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_request", "Bad sync payload.");

  const results = await syncOfflineScans({
    sessionId: auth.session.id,
    eventId: auth.session.eventId,
    venueId: auth.session.event.venueId,
    scans: parsed.data.scans,
  });

  return ok({ results });
}

export const POST = withErrorBoundary(handlePOST, "door/sync");
