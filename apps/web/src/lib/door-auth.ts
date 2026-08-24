import { authenticateDoor } from "@/lib/door";
import { fail } from "@/lib/api-response";

/** Reads the device token from `Authorization: Bearer …`. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

type DoorSessionWithEvent = NonNullable<Awaited<ReturnType<typeof authenticateDoor>>>;

/**
 * Guards every door endpoint. A discriminated union rather than an optional
 * field, so a handler physically cannot continue past a failed check — the
 * session is only reachable on the `ok: true` branch.
 */
export type DoorAuthResult =
  | { ok: false; error: Response }
  | { ok: true; session: DoorSessionWithEvent };

export async function requireDoorSession(request: Request): Promise<DoorAuthResult> {
  const token = bearerToken(request);
  if (!token) {
    return { ok: false, error: fail(401, "no_door_session", "This device isn't paired to a door.") };
  }
  const session = await authenticateDoor(token);
  if (!session) {
    return {
      ok: false,
      error: fail(
        401,
        "door_session_invalid",
        "This device's door access has expired or been revoked. Ask for a new pairing code.",
      ),
    };
  }
  return { ok: true, session };
}

/**
 * Guards organizer-only actions.
 *
 * PLACEHOLDER. Real organizer accounts (Clerk, with the OrganizerRole the
 * schema already defines) replace this. Until then a single shared secret
 * gates creating door sessions, which is honest for a two-person team and
 * obviously not something to ship to venue partners.
 */
export function requireAdmin(request: Request) {
  const expected = process.env.ADMIN_API_SECRET;
  if (!expected) {
    return fail(503, "admin_not_configured", "ADMIN_API_SECRET is not set on the server.");
  }
  if (bearerToken(request) !== expected) {
    return fail(401, "unauthorized", "Not authorised.");
  }
  return null;
}
