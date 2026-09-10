/**
 * Makes somebody an OWNER of a business — the one-time bootstrap.
 *
 *   npx tsx scripts/grant-organizer-access.ts --email=dino@example.com
 *   npx tsx scripts/grant-organizer-access.ts --email=dino@example.com --apply
 *
 * WHY THIS EXISTS
 *
 * In production every route into a business is by invitation, and an
 * invitation needs an existing member to send it. Claiming is refused outright
 * (`/api/organizers/link` returns 403 there) and the ADMIN_API_SECRET fallback
 * in organizer-auth.ts is disabled outside development. All correct, and
 * together they mean the FIRST member of a business cannot be created through
 * the app at all.
 *
 * Which blocks everything downstream: no member means nobody can open
 * /organizer/payouts, so Stripe Connect onboarding can never be started, so no
 * participation fee can ever be collected.
 *
 * This is that first member, done deliberately from a terminal by someone with
 * the production credentials, rather than by adding a bootstrap route that
 * would sit there afterwards as a way in. Everyone after the first is invited
 * through the app.
 *
 * The person must have signed in to the app at least once first, so that a
 * Clerk account exists to attach to.
 *
 * Dry run unless --apply is passed.
 */
import "dotenv/config";

// Targets the DEPLOYED database, like sync-artnight. Without this the command
// quietly grants access on a laptop's copy and looks like it worked.
if (!process.env.DATABASE_URL?.includes("supabase") && process.env.SUPABASE_DIRECT_URL) {
  process.env.DATABASE_URL = process.env.SUPABASE_DIRECT_URL;
}

import { prisma } from "../src/lib/prisma";

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const slug = arg("slug")?.trim() || "dtla-artnight";
  const apply = process.argv.includes("--apply");

  if (!email) {
    console.error("Usage: --email=someone@example.com [--slug=dtla-artnight] [--apply]");
    process.exit(1);
  }

  const target = (process.env.DATABASE_URL ?? "").includes("supabase") ? "PRODUCTION" : "local";
  const clerkKey = process.env.CLERK_SECRET_KEY ?? "";
  const clerkEnv = clerkKey.startsWith("sk_live_") ? "live" : clerkKey ? "test" : "missing";

  /**
   * The database and Clerk must be the same environment.
   *
   * This script reads the PRODUCTION database (via SUPABASE_DIRECT_URL) but
   * whichever Clerk keys are in the local .env — which are test keys. A Clerk
   * test instance holds different people with different ids than the live one,
   * so granting access from here would write a clerkId that no production
   * sign-in will ever match: the person stays locked out and the row looks
   * correct, which is the worst combination.
   *
   * Refuses rather than warns. Restoring access afterwards means finding a
   * stale membership row nobody remembers creating.
   */
  console.log(`Database: ${target}`);
  console.log(`Clerk:    ${clerkEnv}`);
  if (target === "PRODUCTION" && clerkEnv !== "live") {
    console.error(
      `\nRefusing: the production database with ${clerkEnv} Clerk keys.\n` +
        "Run this with production's CLERK_SECRET_KEY in the environment, e.g.\n" +
        "  CLERK_SECRET_KEY=sk_live_… npx tsx scripts/grant-organizer-access.ts --email=…\n" +
        "If production genuinely still uses test keys, this check is what tells\n" +
        "you that — and the answer is to look, not to bypass it.",
    );
    process.exit(1);
  }
  console.log(`Business: ${slug}`);
  console.log(`Person:   ${email}`);
  console.log(apply ? "Mode:     APPLY\n" : "Mode:     dry run (pass --apply to write)\n");

  const organizer = await prisma.organizer.findUnique({
    where: { slug },
    select: { id: true, name: true, stripeAccountId: true, chargesEnabled: true },
  });
  if (!organizer) {
    console.error(`No business with slug "${slug}".`);
    process.exit(1);
  }

  const existing = await prisma.organizerMember.findMany({
    where: { organizerId: organizer.id },
    select: { role: true, user: { select: { email: true } } },
  });
  console.log(`${organizer.name} currently has ${existing.length} member(s):`);
  for (const m of existing) console.log(`  - ${m.user.email} (${m.role})`);
  if (existing.length > 0) {
    console.log(
      "\nNote: this business already has members, so the invite flow in the app\n" +
        "should be used instead. Continuing anyway if --apply was passed.",
    );
  }

  // Clerk is the source of truth for who has actually signed in. Looking the
  // person up there rather than trusting the email on the command line means
  // access cannot be granted to somebody who has never created an account.
  // Via @clerk/nextjs/server, which is what the rest of the app imports.
  // @clerk/backend is only present transitively and would be a fragile thing
  // for a script to depend on.
  const { clerkClient } = await import("@clerk/nextjs/server");
  const clerk = await clerkClient();
  const found = await clerk.users.getUserList({ emailAddress: [email] });
  const clerkUser = found.data[0];

  if (!clerkUser) {
    console.error(
      `\nNo Clerk account for ${email}.\n` +
        "They need to sign in to the app once first — that is what creates the\n" +
        "account this attaches to. Ask them to visit /sign-in, then re-run this.",
    );
    process.exit(1);
  }
  console.log(`\nClerk account found: ${clerkUser.id}`);

  if (!apply) {
    console.log("\nDry run. Would:");
    console.log(`  - upsert a User row for ${email} linked to ${clerkUser.id}`);
    console.log(`  - make them OWNER of ${organizer.name}`);
    console.log("\nRe-run with --apply to do it.");
    return;
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { clerkId: clerkUser.id },
    create: {
      email,
      clerkId: clerkUser.id,
      displayName: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
    },
    select: { id: true },
  });

  await prisma.organizerMember.upsert({
    where: { organizerId_userId: { organizerId: organizer.id, userId: user.id } },
    update: { role: "OWNER" },
    create: { organizerId: organizer.id, userId: user.id, role: "OWNER" },
  });

  console.log(`\n✓ ${email} is now an OWNER of ${organizer.name}.`);
  console.log(
    organizer.stripeAccountId
      ? `  Stripe account already attached (${organizer.stripeAccountId}); charges enabled: ${organizer.chargesEnabled}`
      : "  Next: they sign in and open /organizer/payouts to start Stripe onboarding.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
