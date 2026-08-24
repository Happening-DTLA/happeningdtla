import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  contactEmail: z.email(),
  publiclyAttributed: z.boolean().default(true),
});

/** URL-safe, readable, and stable enough to appear in links. */
function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Creates a business and makes the signed-in person its owner.
 *
 * This is how a venue gets onto the platform without us doing it for them. The
 * creator becomes OWNER because someone has to be able to invite the rest, and
 * an ownerless business is unreachable.
 */
async function handlePOST(request: Request): Promise<Response> {
  const { auth, clerkClient } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return fail(401, "signed_out", "Sign in first.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "invalid_request", parsed.error.issues[0]?.message ?? "Check the details.");
  }
  const { name, contactEmail, publiclyAttributed } = parsed.data;

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    `${userId}@clerk.local`;

  // May already exist from a guest ticket purchase under the same address.
  const user = await prisma.user.upsert({
    where: { email },
    update: { clerkId: userId },
    create: {
      email,
      clerkId: userId,
      displayName: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
    },
  });

  // Slugs are unique and people pick similar names; suffix rather than fail.
  const base = slugify(name) || "venue";
  let slug = base;
  for (let i = 2; await prisma.organizer.findUnique({ where: { slug }, select: { id: true } }); i++) {
    slug = `${base}-${i}`;
    if (i > 50) return fail(409, "slug_exhausted", "Try a slightly different name.");
  }

  const organizer = await prisma.organizer.create({
    data: {
      name,
      slug,
      contactEmail,
      publiclyAttributed,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  return ok({ organizerId: organizer.id, slug: organizer.slug });
}

const PatchBody = z.object({ publiclyAttributed: z.boolean() });

/** Updates the signed-in person's own business. */
async function handlePATCH(request: Request): Promise<Response> {
  const { requireOrganizer, requireManager } = await import("@/lib/organizer-auth");
  const auth = await requireOrganizer(request);
  const denied = requireManager(auth);
  if (denied) return denied;
  if (!auth.ok) return auth.error;

  const parsed = PatchBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_request", "Nothing to change.");

  // Scoped by the authenticated organizer id, never one from the body.
  await prisma.organizer.update({
    where: { id: auth.organizerId },
    data: { publiclyAttributed: parsed.data.publiclyAttributed },
  });

  return ok({ publiclyAttributed: parsed.data.publiclyAttributed });
}

export const POST = withErrorBoundary(handlePOST, "organizers");
export const PATCH = withErrorBoundary(handlePATCH, "organizers");
