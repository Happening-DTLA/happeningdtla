/**
 * Pulls ArtNight's venues from the organisers' own live map.
 *
 * They already curate this in a tool they use every month, and it is more
 * current than anything transcribed by hand — the printed map for September
 * was missing seven venues that were live on it. So this app follows that
 * source rather than competing with it.
 *
 * Every venue arrives with a real street address and real coordinates, which
 * is what the seeded poster data could not give us: 37 of its 50 venues had no
 * position, and guessing them would have put pins on the wrong blocks.
 *
 * Corridors are NOT in their data. They are derived here instead, by finding
 * the corridor whose street a venue actually sits closest to — so the poster's
 * organising idea survives without anyone hand-maintaining a mapping that
 * would drift the moment a venue is added.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   npx tsx scripts/sync-artnight.ts
 *   npx tsx scripts/sync-artnight.ts --apply
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const TOPIC = "685057f00ac0f15d5b002028";
const KEY = "lcA64dIm0IEXUAgeoGD1PGzqLIQVDX";
const POINTS = `https://maps.dtlaartnight.com/api/topics/${TOPIC}/points?topic_key=${KEY}&use_cache=true&limit=500&offset=0`;

/** Their category ids, from the topic definition. */
const CATEGORY: Record<string, { label: string; category: Category; landmark?: boolean }> = {
  "6850580ea7e282cc78599529": { label: "Art Galleries", category: "ART" },
  "6850580ea7e282cc7859952d": { label: "Food and Drink", category: "FOOD_DRINK" },
  "685058d9a7e282cc78599530": { label: "Highlights", category: "ART", landmark: true },
  "6a0b7ded65980fd58224e835": { label: "Museums", category: "ART", landmark: true },
  "68505997a7e282cc78599531": { label: "Special Events", category: "PERFORMANCE" },
  "6a0b7a4865980fd58224e7de": { label: "Transportation", category: "OTHER" },
  "6850580ea7e282cc7859952e": { label: "Shopping", category: "MARKET" },
  "6a0b7cbb65980fd58224e82a": { label: "Performance", category: "PERFORMANCE" },
};

type Category =
  | "ART" | "MUSIC" | "NIGHTLIFE" | "FOOD_DRINK"
  | "PERFORMANCE" | "MARKET" | "WORKSHOP" | "OTHER";

type Point = {
  name: string;
  description?: string | null;
  url?: string | null;
  location?: { search?: string };
  geojson?: { coordinates?: [number, number] };
  topic_category_id?: { $oid?: string };
  tag_info?: { user_tags?: { _id?: { $oid?: string } }[] };
  custom_information?: { custom_field_entries?: { field_id?: { $oid?: string }; field_value?: unknown }[] };
  active?: boolean;
};

/** The organisers' curated flags, by their id in the map. */
const TAGS: Record<string, string> = {
  "68644c6c40fb09540156ce5b": "After Party",
  "68644c1440fb09540156ce5a": "Rooftop Lounge",
  "6851b1a6fcbc822c2f8bda0b": "21+",
  "6851bf4fd4ff3aa79862b2a9": "Kid Friendly",
};

/** Custom fields we understand. Anything else is ignored rather than guessed at. */
const FIELD_WEBSITE = "6a1dfc4d6964911bfea5fb47";

const slugify = (s: string) =>
  "an-" +
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Metres between two coordinates, near enough at this scale. */
function metres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = (aLat - bLat) * 111_320;
  const dLng = (aLng - bLng) * 111_320 * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/** Shortest distance from a point to a polyline. */
function toPath(lat: number, lng: number, path: number[][][]): number {
  let best = Infinity;
  for (const run of path) {
    for (let i = 0; i < run.length - 1; i++) {
      const [aLat, aLng] = run[i]!;
      const [bLat, bLng] = run[i + 1]!;
      const dx = bLat - aLat, dy = bLng - aLng;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((lat - aLat) * dx + (lng - aLng) * dy) / len2));
      best = Math.min(best, metres(lat, lng, aLat + t * dx, aLng + t * dy));
    }
  }
  return best;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const res = await fetch(POINTS, { headers: { "user-agent": "DTLAHappening/0.1" } });
  if (!res.ok) throw new Error(`map returned ${res.status}`);
  const points = (await res.json()) as Point[];
  const live = points.filter((p) => p.active !== false && p.geojson?.coordinates && p.name);
  console.log(`fetched ${points.length} points, ${live.length} usable\n`);

  const corridors = await prisma.corridor.findMany({ orderBy: { sortOrder: "asc" } });
  const night = await prisma.night.findUnique({ where: { slug: "art-night-2026-09" } });
  if (!night) throw new Error("night art-night-2026-09 not found — run the seed first");
  const organizer = await prisma.organizer.findUnique({ where: { slug: "dtla-artnight" } });
  if (!organizer) throw new Error("organizer dtla-artnight not found — run the seed first");

  // Far enough that a venue on a corridor's street is caught, close enough
  // that one three blocks away is not filed under it.
  const CORRIDOR_RADIUS = 140;

  let created = 0, updated = 0, pinned = 0, unassigned = 0;
  const tagged = new Map<string, number>();
  let withSite = 0, withBlurb = 0;
  for (const p of live) {
    const [lng, lat] = p.geojson!.coordinates!;
    const meta = CATEGORY[p.topic_category_id?.$oid ?? ""] ?? { label: "Other", category: "OTHER" as Category };

    let corridorId: string | null = null;
    let bestDistance = Infinity;
    for (const c of corridors) {
      const path = Array.isArray(c.path) ? (c.path as unknown as number[][][]) : null;
      if (!path) continue;
      const d = toPath(lat, lng, path);
      if (d < bestDistance) { bestDistance = d; corridorId = c.id; }
    }
    if (bestDistance > CORRIDOR_RADIUS) { corridorId = null; unassigned++; }

    const tags = ((p.tag_info?.user_tags ?? [])
      .map((t) => TAGS[t._id?.$oid ?? ""])
      .filter(Boolean) as string[]);

    // A website is on the point itself for some venues and in a custom field
    // for others, depending on how it was entered. Take whichever is there.
    const customWebsite = (p.custom_information?.custom_field_entries ?? [])
      .find((e) => e.field_id?.$oid === FIELD_WEBSITE)?.field_value;
    const website =
      (typeof p.url === "string" && p.url.trim()) ||
      (typeof customWebsite === "string" && customWebsite.trim()) ||
      null;

    const slug = slugify(p.name);
    const data = {
      organizerId: organizer.id,
      corridorId,
      name: p.name,
      address1: p.location?.search?.split(",")[0]?.trim() || "Downtown Los Angeles",
      zip: "90013",
      lat, lng,
      isLandmark: Boolean(meta.landmark),
      website,
      kind: meta.label,
      tags,
      description: typeof p.description === "string" && p.description.trim() ? p.description.trim() : null,
    };

    const existing = await prisma.venue.findUnique({ where: { slug } });
    if (apply) {
      const venue = existing
        ? await prisma.venue.update({ where: { slug }, data })
        : await prisma.venue.create({ data: { ...data, slug } });
      const eventSlug = `${slug}-2026-09`;
      const event = await prisma.event.findUnique({ where: { slug: eventSlug } });
      if (!event) {
        await prisma.event.create({
          data: {
            organizerId: organizer.id, venueId: venue.id, nightId: night.id,
            title: `${p.name} — ArtNight`, slug: eventSlug,
            description: "Open for DTLA ArtNight, 6pm until late.",
            startsAt: new Date("2026-09-04T01:00:00Z"),
            endsAt: new Date("2026-09-04T06:00:00Z"),
            status: "PUBLISHED", category: meta.category, isFree: true, fromPriceCents: 0,
            ticketTypes: { create: [{ name: "Free entry", priceCents: 0, quantity: 1000, sortOrder: 0 }] },
          },
        });
      } else {
        await prisma.event.update({ where: { slug: eventSlug }, data: { category: meta.category, venueId: venue.id } });
      }
    }
    existing ? updated++ : created++;
    pinned++;
    if (website) withSite++;
    if (data.description) withBlurb++;
    for (const t of tags) tagged.set(t, (tagged.get(t) ?? 0) + 1);
  }

  // Reconcile removals. A venue the organisers have dropped from this month's
  // map should stop appearing, or the app slowly fills with places that are
  // not open — the exact failure the printed map has, where seven venues were
  // already out of date the day it was published.
  //
  // Unpublished rather than deleted. The venue may return next month, someone
  // may hold a ticket to something there, and a sync that deletes rows is one
  // upstream outage away from emptying the app.
  const liveSlugs = new Set(live.map((p) => slugify(p.name)));
  const stale = await prisma.event.findMany({
    where: {
      nightId: night.id,
      status: "PUBLISHED",
      venue: { organizerId: organizer.id, slug: { notIn: [...liveSlugs] } },
    },
    select: { id: true, slug: true, venue: { select: { name: true } } },
  });

  if (apply && stale.length) {
    await prisma.event.updateMany({
      where: { id: { in: stale.map((e) => e.id) } },
      data: { status: "DRAFT" },
    });
  }

  console.log(`${apply ? "APPLIED" : "DRY RUN — nothing written"}`);
  if (stale.length) {
    console.log(`  unpublished (no longer on the map): ${stale.length}`);
    for (const e of stale) console.log(`    ${e.venue.name}`);
  }
  console.log(`  venues created  ${created}`);
  console.log(`  venues updated  ${updated}`);
  console.log(`  all with coordinates: ${pinned}`);
  console.log(`  outside every corridor (>${CORRIDOR_RADIUS}m): ${unassigned}`);
  console.log(`  with a website  ${withSite}`);
  console.log(`  with a blurb    ${withBlurb}`);
  for (const [t, n] of [...tagged].sort((a, b) => b[1] - a[1])) console.log(`  tagged ${t.padEnd(14)} ${n}`);
  if (!apply) console.log(`\nre-run with --apply to write.`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
