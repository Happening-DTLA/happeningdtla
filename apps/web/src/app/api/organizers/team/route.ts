import { z } from "zod";
import { requireManager, requireOrganizer } from "@/lib/organizer-auth";
import { createInvite, removeMember, TeamError } from "@/lib/team";
import { send } from "@/lib/email";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";

const InviteBody = z.object({
  email: z.email(),
  role: z.enum(["OWNER", "MANAGER", "DOOR_STAFF"]),
});

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3100").replace(/\/$/, "");
}

async function handlePOST(request: Request): Promise<Response> {
  const auth = await requireOrganizer(request);
  const denied = requireManager(auth);
  if (denied) return denied;
  if (!auth.ok) return auth.error;

  const parsed = InviteBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_request", "Check the email and role.");

  // Only an owner can mint another owner; a manager handing out ownership is a
  // privilege escalation waiting to happen.
  if (parsed.data.role === "OWNER" && auth.role !== "OWNER") {
    return fail(403, "owner_required", "Only an owner can add another owner.");
  }

  try {
    const invite = await createInvite({
      organizerId: auth.organizerId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedByUserId: auth.userId,
    });

    const link = `${appUrl()}/join/${invite.token}`;

    // Best effort. The link is returned regardless so it can be sent by text
    // or read out — email delivery is not a prerequisite for adding someone,
    // and right now it only reaches a verified address anyway.
    const { sent } = await send({
      to: invite.email,
      subject: "You've been added to a venue on DTLAHappening",
      text: `You've been invited to help run events on DTLAHappening.\n\nAccept here:\n${link}\n\nThis link expires in 14 days.`,
      html: `<p>You've been invited to help run events on DTLAHappening.</p><p><a href="${link}">Accept the invitation</a></p><p style="color:#666">This link expires in 14 days.</p>`,
    });

    return ok({ inviteId: invite.id, link, emailed: sent, expiresAt: invite.expiresAt.toISOString() });
  } catch (err) {
    if (err instanceof TeamError) return fail(err.status, err.code, err.message);
    throw err;
  }
}

const RemoveBody = z.object({ memberId: z.string().min(1) });

async function handleDELETE(request: Request): Promise<Response> {
  const auth = await requireOrganizer(request);
  const denied = requireManager(auth);
  if (denied) return denied;
  if (!auth.ok) return auth.error;

  const parsed = RemoveBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_request", "Which member?");

  try {
    await removeMember(auth.organizerId, parsed.data.memberId);
    return ok({ removed: true });
  } catch (err) {
    if (err instanceof TeamError) return fail(err.status, err.code, err.message);
    throw err;
  }
}

export const POST = withErrorBoundary(handlePOST, "organizers/team");
export const DELETE = withErrorBoundary(handleDELETE, "organizers/team");
