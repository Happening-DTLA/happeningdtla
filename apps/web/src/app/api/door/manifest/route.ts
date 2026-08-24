import { doorManifest } from "@/lib/door";
import { requireDoorSession } from "@/lib/door-auth";
import { ok, withErrorBoundary } from "@/lib/api-response";

/** Downloaded before doors open so the scanner can work with no network. */
async function handleGET(request: Request): Promise<Response> {
  const auth = await requireDoorSession(request);
  if (!auth.ok) return auth.error;
  return ok(await doorManifest(auth.session.eventId));
}

export const GET = withErrorBoundary(handleGET, "door/manifest");
