/**
 * Seed data for local development.
 *
 * The venues, organizers and events below are FICTIONAL — plausible-sounding
 * DTLA placeholders, not real businesses and not signed partners. Replace them
 * with real data only once agreements are actually in place.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { newTicketCode } from "../src/lib/ticket-code";
import { priceBreakdown } from "@dtlahappening/core";

const connectionString = process.env.DATABASE_URL!;

// SAFETY RAIL: this script truncates every table. Two developers sharing a
// project WILL eventually run it with a staging or production URL loaded.
// Refuse unless the target is obviously local.
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString ?? "");
if (!isLocal && process.env.ALLOW_REMOTE_SEED !== "1") {
  console.error(
    `\n  Refusing to seed a non-local database.\n` +
      `  DATABASE_URL points at: ${connectionString?.replace(/:[^:@]*@/, ":****@")}\n` +
      `  This script deletes all rows. If you are certain, re-run with ALLOW_REMOTE_SEED=1.\n`,
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ART_NIGHT = new Date("2026-10-01T00:00:00Z");
/** 2026-10-01, 18:00 Pacific = 01:00 UTC on the 2nd. */
const at = (hourPT: number, minute = 0) =>
  new Date(Date.UTC(2026, 9, 1 + (hourPT >= 24 ? 1 : 0), (hourPT % 24) + 7, minute));

async function main() {
  console.log("→ clearing existing data…");
  await prisma.scan.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.eventInterest.deleteMany();
  await prisma.venueCheckIn.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.night.deleteMany();
  await prisma.organizerMember.deleteMany();
  await prisma.organizer.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.user.deleteMany();

  console.log("→ users…");
  const attendee = await prisma.user.create({
    data: {
      email: "demo@dtlahappening.test",
      displayName: "Demo Attendee",
      handle: "demo",
      phone: "+13105550142",
    },
  });
  const doorStaff = await prisma.user.create({
    data: { email: "door@dtlahappening.test", displayName: "Door Staff", handle: "door" },
  });

  console.log("→ organizers…");
  const nightshade = await prisma.organizer.create({
    data: {
      name: "Nightshade Hospitality",
      slug: "nightshade",
      contactEmail: "book@nightshade.test",
      bio: "Multi-venue operator across the Arts District and Historic Core.",
      // Onboarding started but not complete — which is the real state today,
      // and makes checkout fall back to a platform charge in development
      // rather than failing against a Stripe account that doesn't exist.
      chargesEnabled: false,
      payoutsEnabled: false,
      members: {
        create: [
          { userId: attendee.id, role: "OWNER" },
          { userId: doorStaff.id, role: "DOOR_STAFF" },
        ],
      },
    },
  });
  const galleryRow = await prisma.organizer.create({
    data: {
      name: "Gallery Row Collective",
      slug: "gallery-row",
      contactEmail: "hello@galleryrow.test",
      bio: "Artist-run spaces along Spring and Main.",
      chargesEnabled: false,
      payoutsEnabled: false,
    },
  });
  const littleTokyo = await prisma.organizer.create({
    data: {
      name: "Little Tokyo Arts Council",
      slug: "little-tokyo-arts",
      contactEmail: "info@ltarts.test",
      bio: "Community programming in Little Tokyo.",
    },
  });

  console.log("→ venues…");
  const v = async (data: Parameters<typeof prisma.venue.create>[0]["data"]) =>
    prisma.venue.create({ data });

  const foundry = await v({
    organizerId: nightshade.id, name: "Foundry 8", slug: "foundry-8",
    address1: "800 E 4th St", zip: "90013", neighborhood: "Arts District",
    lat: 34.0447, lng: -118.2359, capacity: 320,
    description: "Converted metal shop with a 30-foot main hall.",
  });
  const alameda = await v({
    organizerId: nightshade.id, name: "Alameda Underground", slug: "alameda-underground",
    address1: "1100 S Alameda St", zip: "90021", neighborhood: "Arts District",
    lat: 34.0313, lng: -118.2361, capacity: 180,
    description: "Below-grade room with a proper sound system.",
  });
  const rooftop = await v({
    organizerId: nightshade.id, name: "Pacific Electric Rooftop", slug: "pe-rooftop",
    address1: "610 S Main St", zip: "90014", neighborhood: "Historic Core",
    lat: 34.0447, lng: -118.2489, capacity: 400,
    description: "Open-air rooftop overlooking Main Street.",
  });
  const vault = await v({
    organizerId: galleryRow.id, name: "The Broadway Vault", slug: "broadway-vault",
    address1: "541 S Broadway", zip: "90013", neighborhood: "Gallery Row",
    lat: 34.0459, lng: -118.2510, capacity: 150,
    description: "Former bank vault, now a projection space.",
  });
  const springSt = await v({
    organizerId: galleryRow.id, name: "Spring Street Salon", slug: "spring-street-salon",
    address1: "453 S Spring St", zip: "90013", neighborhood: "Historic Core",
    lat: 34.0470, lng: -118.2497, capacity: 90,
  });
  const mikado = await v({
    organizerId: littleTokyo.id, name: "Mikado Room", slug: "mikado-room",
    address1: "244 S San Pedro St", zip: "90012", neighborhood: "Little Tokyo",
    lat: 34.0470, lng: -118.2400, capacity: 120,
  });

  console.log("→ the night…");
  const night = await prisma.night.create({
    data: {
      name: "Art Night DTLA — October 2026",
      slug: "art-night-2026-10",
      date: ART_NIGHT,
      isPublished: true,
      description:
        "First Thursday. Galleries, studios and rooftops across Downtown open their doors from 6pm until late.",
    },
  });

  console.log("→ events + ticket types…");
  type TT = { name: string; priceCents: number; quantity: number; description?: string; sortOrder?: number };
  type Category =
    | "ART" | "MUSIC" | "NIGHTLIFE" | "FOOD_DRINK"
    | "PERFORMANCE" | "MARKET" | "WORKSHOP" | "OTHER";

  const makeEvent = async (
    args: {
      organizerId: string; venueId: string; nightId: string | null; title: string; slug: string;
      description: string; startsAt: Date; endsAt: Date; doorsAt?: Date; minAge?: number;
      category: Category; tiers: TT[];
    },
  ) => {
    const { tiers, ...rest } = args;
    const isFree = tiers.every((t) => t.priceCents === 0);
    return prisma.event.create({
      data: {
        ...rest,
        status: "PUBLISHED",
        isFree,
        fromPriceCents: Math.min(...tiers.map((t) => t.priceCents)),
        ticketTypes: { create: tiers.map((t, i) => ({ sortOrder: i, ...t })) },
      },
      include: { ticketTypes: true },
    });
  };

  const inkAndIron = await makeEvent({
    organizerId: nightshade.id, venueId: foundry.id, nightId: night.id,
    title: "Ink & Iron: Opening Night", slug: "ink-and-iron-opening",
    category: "ART",
    description: "Twelve printmakers and metalworkers show new work in the main hall.",
    doorsAt: at(18), startsAt: at(18, 30), endsAt: at(23),
    tiers: [
      { name: "General Admission", priceCents: 1500, quantity: 250 },
      { name: "VIP — early entry + artist talk", priceCents: 4000, quantity: 40, description: "5:30pm entry, meet the artists before doors." },
    ],
  });

  await makeEvent({
    organizerId: nightshade.id, venueId: alameda.id, nightId: night.id,
    title: "Basement Sessions: Live Set", slug: "basement-sessions-oct",
    category: "MUSIC",
    description: "Three acts, one long set, no phones on stage.",
    doorsAt: at(20), startsAt: at(20, 30), endsAt: at(24), minAge: 21,
    tiers: [{ name: "General Admission", priceCents: 2000, quantity: 160 }],
  });

  await makeEvent({
    organizerId: nightshade.id, venueId: rooftop.id, nightId: night.id,
    title: "Rooftop Afterparty", slug: "rooftop-afterparty-oct",
    category: "NIGHTLIFE",
    description: "The night ends up here. Open air, DJ until 2.",
    doorsAt: at(22), startsAt: at(22), endsAt: at(26), minAge: 21,
    tiers: [
      { name: "Early Bird", priceCents: 2500, quantity: 100, description: "Limited — goes up at the door." },
      { name: "General Admission", priceCents: 3500, quantity: 250 },
    ],
  });

  await makeEvent({
    organizerId: galleryRow.id, venueId: vault.id, nightId: night.id,
    title: "Vault Projections", slug: "vault-projections-oct",
    category: "ART",
    description: "Looping video work inside the old bank vault. Walk in, walk out.",
    startsAt: at(18), endsAt: at(23),
    tiers: [{ name: "Free entry", priceCents: 0, quantity: 150 }],
  });

  await makeEvent({
    organizerId: galleryRow.id, venueId: springSt.id, nightId: night.id,
    title: "Portrait Marathon", slug: "portrait-marathon-oct",
    category: "WORKSHOP",
    description: "Sit for a 10-minute portrait. Take it home.",
    startsAt: at(18), endsAt: at(22),
    tiers: [{ name: "Sitting", priceCents: 1000, quantity: 60 }],
  });

  await makeEvent({
    organizerId: littleTokyo.id, venueId: mikado.id, nightId: night.id,
    title: "Sumi-e Live Demo", slug: "sumi-e-demo-oct",
    category: "WORKSHOP",
    description: "Brush painting demonstration and open practice table.",
    startsAt: at(18), endsAt: at(21),
    tiers: [{ name: "Free entry", priceCents: 0, quantity: 120 }],
  });

  // A standalone event with no Night — proves the nullable nightId path.
  await makeEvent({
    organizerId: nightshade.id, venueId: foundry.id, nightId: null,
    title: "Saturday Warehouse Market", slug: "warehouse-market-oct-10",
    category: "MARKET",
    description: "Vintage, ceramics and records. Every other Saturday.",
    startsAt: new Date(Date.UTC(2026, 9, 10, 18)), endsAt: new Date(Date.UTC(2026, 9, 11, 1)),
    tiers: [{ name: "Free entry", priceCents: 0, quantity: 500 }],
  });

  // A wider spread of dates and categories, so browse/search/filter have
  // something realistic to work against rather than one night's worth of rows.
  // Pacific wall-clock -> UTC. Date.UTC rolls an hour >= 24 into the next day
  // on its own, which is exactly the behaviour we want and far easier to get
  // right than a hand-written day adjustment. (The first version of this had
  // the rollover ternary inverted and shifted every event by a day.)
  const d = (day: number, hourPT: number) =>
    new Date(Date.UTC(2026, 9, day, hourPT + 7));

  await makeEvent({
    organizerId: nightshade.id, venueId: rooftop.id, nightId: null,
    title: "Sunset Natural Wine Tasting", slug: "sunset-wine-oct-3",
    category: "FOOD_DRINK",
    description: "Twelve pours from small California producers, on the roof.",
    startsAt: d(3, 17), endsAt: d(3, 20), minAge: 21,
    tiers: [{ name: "Tasting flight", priceCents: 4500, quantity: 60 }],
  });

  await makeEvent({
    organizerId: galleryRow.id, venueId: vault.id, nightId: null,
    title: "One-Act Nights", slug: "one-act-nights-oct-8",
    category: "PERFORMANCE",
    description: "Four new one-acts from Downtown playwrights, forty minutes each.",
    doorsAt: d(8, 18), startsAt: d(8, 19), endsAt: d(8, 22),
    tiers: [
      { name: "General Admission", priceCents: 2200, quantity: 120 },
      { name: "Student / Artist", priceCents: 1200, quantity: 30, description: "ID at the door." },
    ],
  });

  await makeEvent({
    organizerId: nightshade.id, venueId: alameda.id, nightId: null,
    title: "Low End Theory Revival", slug: "low-end-revival-oct-17",
    category: "MUSIC",
    description: "Bass music all night. Six DJs, no headliner.",
    doorsAt: d(17, 21), startsAt: d(17, 22), endsAt: d(18, 2), minAge: 21,
    tiers: [
      { name: "Early Bird", priceCents: 1800, quantity: 80 },
      { name: "General Admission", priceCents: 2800, quantity: 220 },
    ],
  });

  await makeEvent({
    organizerId: littleTokyo.id, venueId: mikado.id, nightId: null,
    title: "Ramen & Records Sunday", slug: "ramen-records-oct-11",
    category: "FOOD_DRINK",
    description: "Bowls from three shops, vinyl from three shops. Family friendly.",
    startsAt: d(11, 12), endsAt: d(11, 17),
    tiers: [{ name: "Free entry", priceCents: 0, quantity: 300 }],
  });

  await makeEvent({
    organizerId: galleryRow.id, venueId: springSt.id, nightId: null,
    title: "Screenprinting Workshop", slug: "screenprint-workshop-oct-24",
    category: "WORKSHOP",
    description: "Two hours, one shirt, all materials included. No experience needed.",
    startsAt: d(24, 13), endsAt: d(24, 15),
    tiers: [{ name: "Seat", priceCents: 6500, quantity: 14, description: "Small class — 14 seats." }],
  });

  await makeEvent({
    organizerId: nightshade.id, venueId: foundry.id, nightId: null,
    title: "Warehouse Comedy", slug: "warehouse-comedy-oct-29",
    category: "PERFORMANCE",
    description: "Stand-up in the main hall. Loose, loud, cheap.",
    doorsAt: d(29, 19), startsAt: d(29, 20), endsAt: d(29, 22), minAge: 18,
    tiers: [{ name: "General Admission", priceCents: 1500, quantity: 200 }],
  });

  console.log("→ a paid order with scannable tickets…");
  const ga = inkAndIron.ticketTypes.find((t) => t.name === "General Admission")!;
  const qty = 2;
  const { subtotalCents, serviceFeeCents, totalCents } = priceBreakdown(ga.priceCents * qty);

  const order = await prisma.order.create({
    data: {
      userId: attendee.id,
      eventId: inkAndIron.id,
      status: "PAID",
      subtotalCents,
      serviceFeeCents,
      totalCents,
      platformFeeCents: serviceFeeCents,
      buyerName: "Demo Attendee",
      buyerEmail: attendee.email,
      stripePaymentIntentId: "pi_TEST_seed_0001",
      paidAt: new Date(),
      tickets: {
        create: Array.from({ length: qty }, () => ({
          ticketTypeId: ga.id,
          eventId: inkAndIron.id,
          code: newTicketCode(),
          unitPriceCents: ga.priceCents,
          ownerUserId: attendee.id,
          holderEmail: attendee.email,
        })),
      },
    },
    include: { tickets: true },
  });
  await prisma.ticketType.update({
    where: { id: ga.id },
    data: { quantitySold: { increment: qty } },
  });

  console.log("\n✓ Seed complete.");
  console.log(`  Night:   ${night.name}`);
  console.log(`  Venues:  6   Events: 13   Organizers: 3`);
  console.log(`  Demo login email: ${attendee.email}`);
  console.log(`  Scannable ticket codes:`);
  for (const t of order.tickets) console.log(`    ${t.code}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
