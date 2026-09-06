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
 * A target date is required so a new month cannot accidentally update the
 * previous month's historical record. Dry run by default. Pass --apply to
 * write. `--move-non-artnight-to-demo` is the one-time safe conversion for a
 * Night that began life with ticketing fixtures: their event ids, orders and
 * tickets stay intact, but they move under a separate unpublished demo Night.
 *
 *   npx tsx scripts/sync-artnight.ts --date=2026-10-01
 *   npx tsx scripts/sync-artnight.ts --date=2026-10-01 --apply
 */
import "dotenv/config";
import { pacificDayRange } from "@dtlahappening/core";

// The sync targets the DEPLOYED database, not the local one. Without this the
// command would quietly update a laptop's copy and look like it worked.
if (!process.env.DATABASE_URL?.includes("supabase") && process.env.SUPABASE_DIRECT_URL) {
  process.env.DATABASE_URL = process.env.SUPABASE_DIRECT_URL;
}

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
  custom_information?: {
    custom_field_entries?: {
      field_id?: { $oid?: string };
      field_value?: unknown;
      field_value_json?: { url?: string; images?: { url?: string }[] };
    }[];
  };
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
/** A single cover shot. Duplicates the first gallery image where both exist. */
const FIELD_COVER = "6a1dfc4d6964911bfea5fb4a";
/** The gallery — where most of the photographs are. */
const FIELD_PHOTOS = "6a1dfc4d6964911bfea5fb4b";

/**
 * Where the map's relative image paths resolve to.
 *
 * The paths arrive as "/i/<id>.png" and redirect to Proxi's CDN, which is the
 * platform the organisers' map is built on. Resolved here rather than at read
 * time so a stored URL is complete and this is the only place that knows.
 */
const IMAGE_BASE = "https://maps.dtlaartnight.com";

function targetFor(args: string[]) {
  const day = args.find((arg) => arg.startsWith("--date="))?.slice("--date=".length);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Pass the Art Night calendar date explicitly, e.g. --date=2026-10-01");
  }

  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
    throw new Error(`Invalid Art Night date: ${day}`);
  }

  const range = pacificDayRange(day);
  if (!range) throw new Error(`Invalid Art Night date: ${day}`);

  const yearMonth = day.slice(0, 7);
  const monthYear = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const calendarLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);

  return {
    day,
    date,
    yearMonth,
    monthYear,
    calendarLabel,
    nightSlug: `art-night-${yearMonth}`,
    // Art Night is 6pm–11pm Pacific. The event is never on a DST transition
    // day (those are Sundays), so adding wall-clock hours to Pacific midnight
    // produces the exact instants without a hardcoded UTC offset.
    opens: new Date(range.start.getTime() + 18 * 60 * 60 * 1000),
    closes: new Date(range.start.getTime() + 23 * 60 * 60 * 1000),
  };
}

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
  const moveNonArtNight = process.argv.includes("--move-non-artnight-to-demo");
  const targetNight = targetFor(process.argv.slice(2));
  const target = (process.env.DATABASE_URL ?? "").replace(/:\/\/[^@]*@/, "://****@");
  console.log(`target: ${target.split("?")[0] || "(unset)"}\n`);
  console.log(`night:  ${targetNight.nightSlug} (${targetNight.day})\n`);

  const res = await fetch(POINTS, { headers: { "user-agent": "DTLAHappening/0.1" } });
  if (!res.ok) throw new Error(`map returned ${res.status}`);
  const points = (await res.json()) as Point[];
  const live = points.filter((p) => p.active !== false && p.geojson?.coordinates && p.name);
  console.log(`fetched ${points.length} points, ${live.length} usable\n`);

  const corridors = await prisma.corridor.findMany({ orderBy: { sortOrder: "asc" } });
  let night = await prisma.night.findUnique({ where: { slug: targetNight.nightSlug } });
  const organizer = await prisma.organizer.findUnique({ where: { slug: "dtla-artnight" } });
  if (!organizer) throw new Error("organizer dtla-artnight not found — run the seed first");

  const nightData = {
    name: `DTLA ArtNight — ${targetNight.monthYear}`,
    date: targetNight.date,
    description:
      "Explore galleries, restaurants, bars, performance spaces and cultural destinations across Downtown LA. Doors open at 6pm and stay open late.",
  };
  if (apply) {
    night = await prisma.night.upsert({
      where: { slug: targetNight.nightSlug },
      create: { slug: targetNight.nightSlug, ...nightData, isPublished: false },
      update: nightData,
    });
  } else if (!night) {
    console.log(`would create ${nightData.name}\n`);
  }

  // Far enough that a venue on a corridor's street is caught, close enough
  // that one three blocks away is not filed under it.
  const CORRIDOR_RADIUS = 140;

  const targetEventSlugs = live.map((point) => `${slugify(point.name)}-${targetNight.yearMonth}`);
  const existingEvents = new Map(
    (await prisma.event.findMany({
      where: { slug: { in: targetEventSlugs } },
      select: { id: true, slug: true },
    })).map((event) => [event.slug, event]),
  );

  let created = 0, updated = 0, eventsCreated = 0, eventsUpdated = 0, pinned = 0, unassigned = 0;
  const tagged = new Map<string, number>();
  let withSite = 0, withBlurb = 0, withPhotos = 0, photoCount = 0;
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

    /**
     * Photographs, cover first.
     *
     * Two fields carry them and they overlap — the cover is usually the first
     * gallery image again — so this dedupes rather than showing the same shot
     * twice at the top of a venue page.
     */
    const entries = p.custom_information?.custom_field_entries ?? [];
    const photoUrls: string[] = [];
    for (const id of [FIELD_COVER, FIELD_PHOTOS]) {
      for (const e of entries.filter((e) => e.field_id?.$oid === id)) {
        const v = e.field_value_json;
        for (const raw of [v?.url, ...(v?.images ?? []).map((i) => i?.url)]) {
          if (typeof raw !== "string" || !raw.trim()) continue;
          const url = raw.startsWith("http") ? raw : `${IMAGE_BASE}${raw}`;
          if (!photoUrls.includes(url)) photoUrls.push(url);
        }
      }
    }

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
      photos: photoUrls,
      description: typeof p.description === "string" && p.description.trim() ? p.description.trim() : null,
    };

    const existing = await prisma.venue.findUnique({ where: { slug } });
    const eventSlug = `${slug}-${targetNight.yearMonth}`;
    const event = existingEvents.get(eventSlug);
    if (event) eventsUpdated++;
    else eventsCreated++;
    if (apply) {
      const venue = existing
        ? await prisma.venue.update({ where: { slug }, data })
        : await prisma.venue.create({ data: { ...data, slug } });
      if (!event) {
        await prisma.event.create({
          data: {
            organizerId: organizer.id, venueId: venue.id, nightId: night!.id,
            title: `${p.name} — ArtNight`, slug: eventSlug,
            description: `Open for DTLA ArtNight on ${targetNight.calendarLabel}, 6pm until late.`,
            startsAt: targetNight.opens,
            endsAt: targetNight.closes,
            status: "PUBLISHED", category: meta.category, isFree: true, fromPriceCents: 0,
            ticketTypes: { create: [{ name: "Free entry", priceCents: 0, quantity: 1000, sortOrder: 0 }] },
          },
        });
      } else {
        await prisma.event.update({
          where: { slug: eventSlug },
          data: {
            organizerId: organizer.id,
            venueId: venue.id,
            nightId: night!.id,
            title: `${p.name} — ArtNight`,
            description: `Open for DTLA ArtNight on ${targetNight.calendarLabel}, 6pm until late.`,
            startsAt: targetNight.opens,
            endsAt: targetNight.closes,
            status: "PUBLISHED",
            category: meta.category,
            isFree: true,
            fromPriceCents: 0,
          },
        });
      }
    }
    if (existing) updated++;
    else created++;
    pinned++;
    if (website) withSite++;
    if (photoUrls.length) { withPhotos++; photoCount += photoUrls.length; }
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
  const stale = night
    ? await prisma.event.findMany({
        where: {
          nightId: night.id,
          status: "PUBLISHED",
          venue: { organizerId: organizer.id, slug: { notIn: [...liveSlugs] } },
        },
        select: { id: true, slug: true, venue: { select: { name: true } } },
      })
    : [];

  // The October production row began life as a ticketing demo. Moving those
  // fixtures is explicit. The events themselves are not unpublished or
  // recreated: preserving their ids keeps every existing order and ticket
  // valid while removing them from the public Art Night directory.
  const nonArtNight = moveNonArtNight && night
    ? await prisma.event.findMany({
        where: {
          nightId: night.id,
          status: "PUBLISHED",
          organizerId: { not: organizer.id },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          _count: { select: { orders: true } },
        },
      })
    : [];

  if (apply && stale.length) {
    await prisma.event.updateMany({
      where: { id: { in: stale.map((e) => e.id) } },
      data: { status: "DRAFT" },
    });
  }
  if (apply && nonArtNight.length) {
    const demoNight = await prisma.night.upsert({
      where: { slug: `ticketing-demo-${targetNight.yearMonth}` },
      create: {
        slug: `ticketing-demo-${targetNight.yearMonth}`,
        name: `Ticketing Demo — ${targetNight.monthYear}`,
        date: targetNight.date,
        description: "Unpublished fixtures for exercising checkout, fulfilment and door scanning.",
        isPublished: false,
      },
      update: { isPublished: false },
    });
    await prisma.event.updateMany({
      where: { id: { in: nonArtNight.map((event) => event.id) } },
      data: { nightId: demoNight.id },
    });
  }
  if (apply) {
    await prisma.night.update({
      where: { id: night!.id },
      data: { isPublished: true },
    });
  }

  console.log(`${apply ? "APPLIED" : "DRY RUN — nothing written"}`);
  if (stale.length) {
    console.log(`  unpublished (no longer on the map): ${stale.length}`);
    for (const e of stale) console.log(`    ${e.venue.name}`);
  }
  if (nonArtNight.length) {
    console.log(`  moved to unpublished demo night: ${nonArtNight.length}`);
    for (const event of nonArtNight) {
      console.log(`    ${event.title} (${event._count.orders} order${event._count.orders === 1 ? "" : "s"})`);
    }
  }
  console.log(`  venues created  ${created}`);
  console.log(`  venues updated  ${updated}`);
  console.log(`  events created  ${eventsCreated}`);
  console.log(`  events updated  ${eventsUpdated}`);
  console.log(`  all with coordinates: ${pinned}`);
  console.log(`  outside every corridor (>${CORRIDOR_RADIUS}m): ${unassigned}`);
  console.log(`  with a website  ${withSite}`);
  console.log(`  with photos     ${withPhotos} venues, ${photoCount} images`);
  console.log(`  with a blurb    ${withBlurb}`);
  for (const [t, n] of [...tagged].sort((a, b) => b[1] - a[1])) console.log(`  tagged ${t.padEnd(14)} ${n}`);
  if (!apply) console.log(`\nre-run with --apply to write.`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
