import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";

const Body = z.object({ organizerId: z.string().min(1) });

/**
 * Attaches the signed-in Clerk user to a venue as its owner.
 *
 * DEVELOPMENT ONLY. Without it there is no way to create the first organizer
 * account — every real path is by invitation, and invitations need an existing
 * owner to send them. Refused outright in production.
 */
async function handlePOST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return fail(403, "not_available", "Venue access is by invitation.");
  }

  const { auth, clerkClient } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return fail(401, "signed_out", "Sign in first.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_request", "Pick a venue.");

  const organizer = await prisma.organizer.findUnique({
    where: { id: parsed.data.organizerId },
    select: { id: true },
  });
  if (!organizer) return fail(404, "not_found", "No such venue.");

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    `${userId}@clerk.local`;

  // The User row may already exist from a guest ticket purchase under the same
  // address — link it rather than colliding on the unique email.
  const user = await prisma.user.upsert({
    where: { email },
    update: { clerkId: userId },
    create: {
      email,
      clerkId: userId,
      displayName: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
    },
  });

  await prisma.organizerMember.upsert({
    where: { organizerId_userId: { organizerId: organizer.id, userId: user.id } },
    update: { role: "OWNER" },
    create: { organizerId: organizer.id, userId: user.id, role: "OWNER" },
  });

  return ok({ organizerId: organizer.id });
}

export const POST = withErrorBoundary(handlePOST, "organizers/link");
