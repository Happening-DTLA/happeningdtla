import { z } from "zod";
import { InconclusiveScanError, scanTicket } from "@/lib/door";
import { requireDoorSession } from "@/lib/door-auth";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";

const Body = z.object({
  code: z.string().trim().min(1).max(200),
  /** True when this scan happened offline and is being synced afterwards. */
  syncedFromOffline: z.boolean().optional(),
});

async function handlePOST(request: Request): Promise<Response> {
  const auth = await requireDoorSession(request);
  if (!auth.ok) return auth.error;
  const { session } = auth;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_request", "No code supplied.");

  let outcome;
  try {
    outcome = await scanTicket({
      rawCode: parsed.data.code,
      sessionId: session.id,
      eventId: session.eventId,
      venueId: session.event.venueId,
      syncedFromOffline: parsed.data.syncedFromOffline,
    });
  } catch (err) {
    if (err instanceof InconclusiveScanError) {
      // Retryable, and explicitly NOT a rejection. The scanner shows "try
      // again" or decides from its offline manifest.
      return fail(503, "scan_failed", "Couldn't read that ticket. Scan it again.");
    }
    // Never let a door see an empty response body. A scanner that gets
    // unparseable output has no way to tell "let them in" from "don't", and
    // the person on the door has to decide with no information.
    console.error("[door] scan failed", err);
    return fail(503, "scan_failed", "Couldn't reach the ticket system. Try the scan again.");
  }

  // Deliberately NOT returning stats here. Counting sold and admitted on every
  // scan added two queries to the hottest path in the app, for a number that
  // changes by one and is only glanced at. The scanner polls /api/door/stats
  // on its own cadence, and that endpoint records lastSeenAt.
  //
  // There is also NO fire-and-forget write here, deliberately. An un-awaited
  // query in a request/response runtime keeps a pooled connection checked out
  // past the response; when the request context is torn down mid-query the
  // connection goes back to the pool in a broken state, and the NEXT request
  // to grab it dies with a Postgres protocol desync (08P01, "bind message
  // supplies N parameters"). That is precisely the failure this endpoint was
  // producing under concurrent scans.
  return ok(outcome);
}

export const POST = withErrorBoundary(handlePOST, "door/scan");
