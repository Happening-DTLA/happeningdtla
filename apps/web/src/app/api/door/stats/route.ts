import { doorStats } from "@/lib/door";
import { prisma } from "@/lib/prisma";
import { requireDoorSession } from "@/lib/door-auth";
import { ok, withErrorBoundary } from "@/lib/api-response";

/** Door numbers only — sold, admitted, remaining. Never revenue. */
async function handleGET(request: Request): Promise<Response> {
  const auth = await requireDoorSession(request);
  if (!auth.ok) return auth.error;

  // Awaited, not fired and forgotten — this endpoint is polled on a relaxed
  // cadence, so one extra round trip costs nothing here.
  await prisma.doorSession
    .update({ where: { id: auth.session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return ok({
    event: {
      id: auth.session.event.id,
      title: auth.session.event.title,
      venueName: auth.session.event.venue.name,
    },
    stats: await doorStats(auth.session.eventId),
  });
}

export const GET = withErrorBoundary(handleGET, "door/stats");
