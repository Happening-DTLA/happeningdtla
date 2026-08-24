import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { acceptInvite, TeamError } from "@/lib/team";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";

const Body = z.object({ token: z.string().min(10) });

/** Joins the signed-in person to a business using an invitation. */
async function handlePOST(request: Request): Promise<Response> {
  const { auth, clerkClient } = await import("@clerk/nextjs/server");
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return fail(401, "signed_out", "Sign in to accept.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_request", "Missing invitation.");

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(clerkUserId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    `${clerkUserId}@clerk.local`;

  const user = await prisma.user.upsert({
    where: { email },
    update: { clerkId: clerkUserId },
    create: {
      email,
      clerkId: clerkUserId,
      displayName: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
    },
  });

  try {
    const invite = await acceptInvite(parsed.data.token, user.id);
    return ok({ organizerId: invite.organizerId, role: invite.role });
  } catch (err) {
    if (err instanceof TeamError) return fail(err.status, err.code, err.message);
    throw err;
  }
}

export const POST = withErrorBoundary(handlePOST, "organizers/team/accept");
