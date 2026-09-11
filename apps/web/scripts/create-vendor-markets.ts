/**
 * Creates the vendor markets from dtlaartnight.com/vendor-submission.
 *
 *   npx tsx scripts/create-vendor-markets.ts
 *   npx tsx scripts/create-vendor-markets.ts --apply
 *   npx tsx scripts/create-vendor-markets.ts --apply --capacity=24
 *
 * WHY THIS EXISTS RATHER THAN THE SEED
 *
 * `prisma/seed.ts` begins with deleteMany() across venues, nights, corridors
 * and organizers. Run against production it would erase the 56 synced Art Night
 * venues. It is a fixture builder for a laptop and must never point at the
 * deployed database. This does one additive thing instead.
 *
 * Idempotent: markets are matched on name + date, so re-running updates rather
 * than duplicating.
 *
 * CREATED UNPUBLISHED ON PURPOSE. `capacity` — how many booths each market
 * actually holds — is the one number here nobody has confirmed with the
 * organisers, and it is the number that decides when a market reports itself
 * full. Nothing is visible to vendors until someone sets it correctly and
 * flips isPublished, which is a decision for a person, not a default.
 *
 * Dry run unless --apply.
 */
import "dotenv/config";

if (!process.env.DATABASE_URL?.includes("supabase") && process.env.SUPABASE_DIRECT_URL) {
  process.env.DATABASE_URL = process.env.SUPABASE_DIRECT_URL;
}

import { vendorBoothFee, VENDOR_BOOTH_FEE_CENTS } from "@dtlahappening/core";
import { prisma } from "../src/lib/prisma";

function arg(name: string) {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

/** A calendar date at UTC midnight — see Night.date and src/lib/datetime.ts. */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const SPRING_ARCADE = {
  name: "Spring Street Arcade Vendor Market",
  venueName: "Spring Arcade Building",
  address: "540 S. Spring St, Los Angeles, CA 90013",
  hours: "4pm–10pm · setup 2:30–3:45pm · covered, no canopy needed",
  // Their rule, verbatim: "Currently, we are not accepting food vendors for
  // this location."
  acceptsFoodVendors: false,
};

const MARKETS = [
  { ...SPRING_ARCADE, date: "2026-10-01" },
  { ...SPRING_ARCADE, date: "2026-11-05" },
  { ...SPRING_ARCADE, date: "2026-12-03" },
  {
    name: "The Great Rock N Roll Holiday Flea Market",
    venueName: "The Regent Theater",
    address: "448 Main St, Los Angeles, CA",
    hours: "One-day holiday market · setup details shared closer to the date",
    date: "2026-11-30",
    // Subject to review rather than refused: pre-made, no-cook, self-contained
    // items only.
    acceptsFoodVendors: true,
  },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const capacity = Number(arg("capacity") ?? 30);
  const slug = arg("slug") ?? "dtla-artnight";

  if (!Number.isInteger(capacity) || capacity <= 0) {
    console.error("--capacity must be a positive whole number");
    process.exit(1);
  }

  const target = (process.env.DATABASE_URL ?? "").includes("supabase") ? "PRODUCTION" : "local";
  const breakdown = vendorBoothFee(VENDOR_BOOTH_FEE_CENTS);
  const feeCents = breakdown.totalCents - breakdown.advertisedCents;

  console.log(`Database: ${target}`);
  console.log(`Payee:    ${slug}`);
  console.log(`Capacity: ${capacity} per market${arg("capacity") ? "" : "  (default — CONFIRM WITH DINO)"}`);
  console.log(
    `Price:    $${(breakdown.advertisedCents / 100).toFixed(2)} booth + $${(feeCents / 100).toFixed(2)} = $${(breakdown.totalCents / 100).toFixed(2)}  (their published figure)`,
  );
  console.log(apply ? "Mode:     APPLY\n" : "Mode:     dry run (pass --apply to write)\n");

  const organizer = await prisma.organizer.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!organizer) {
    console.error(`No organizer with slug "${slug}" — that is who gets paid. Aborting.`);
    process.exit(1);
  }

  // Link Art Night markets to the night they belong to, when one exists.
  const nights = await prisma.night.findMany({
    where: { slug: { startsWith: "art-night-" } },
    select: { id: true, slug: true, date: true },
  });

  for (const m of MARKETS) {
    const date = day(m.date);
    const night = nights.find((n) => n.date.toISOString().slice(0, 10) === m.date);
    const existing = await prisma.vendorMarket.findFirst({
      where: { name: m.name, date },
      select: { id: true, isPublished: true, capacity: true },
    });

    const label = `${m.date}  ${m.name}`;
    if (existing) {
      console.log(`  = ${label}  (exists — capacity ${existing.capacity}, published ${existing.isPublished})`);
      continue;
    }
    console.log(`  + ${label}${night ? `  → night ${night.slug}` : ""}`);

    if (apply) {
      await prisma.vendorMarket.create({
        data: {
          organizerId: organizer.id,
          nightId: night?.id ?? null,
          name: m.name,
          venueName: m.venueName,
          address: m.address,
          hours: m.hours,
          date,
          priceCents: breakdown.advertisedCents,
          feeCents,
          capacity,
          acceptsFoodVendors: m.acceptsFoodVendors,
          // Deliberately hidden until capacity is confirmed and a human
          // publishes it.
          isPublished: false,
        },
      });
    }
  }

  console.log(
    apply
      ? "\n✓ Done. They are UNPUBLISHED — confirm capacity with Dino, then publish."
      : "\nDry run. Re-run with --apply.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
