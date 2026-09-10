import { prisma } from "@/lib/prisma";
import { currentNightDate } from "@/lib/night-date";

/**
 * Data access. Server components call these directly; route handlers wrap them.
 * Neither fetches over HTTP from itself.
 *
 * Note the explicit `select` on organizer everywhere. `organizer: true` would
 * pull stripeAccountId, contact details and payout flags into memory, one
 * careless spread away from a public JSON response. Don't fetch what you will
 * not send.
 */

const organizerSelect = { id: true, slug: true, name: true, publiclyAttributed: true } as const;

const eventSummaryInclude = {
  venue: { include: { corridor: true } },
  organizer: { select: organizerSelect },
  ticketTypes: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
} as const;

/** The next published city-wide night that has not passed in Los Angeles. */
export async function getUpcomingNight(now: Date = new Date()) {
  return prisma.night.findFirst({
    where: {
      isPublished: true,
      date: { gte: currentNightDate(now) },
    },
    orderBy: { date: "asc" },
    include: {
      events: {
        where: { status: "PUBLISHED" },
        orderBy: [{ startsAt: "asc" }],
        include: eventSummaryInclude,
      },
    },
  });
}

/** One city-wide night and every published event inside it. */
export async function getNightBySlug(slug: string) {
  return prisma.night.findUnique({
    where: { slug },
    include: {
      events: {
        where: { status: "PUBLISHED" },
        orderBy: [{ startsAt: "asc" }],
        include: eventSummaryInclude,
      },
    },
  });
}

export async function getEventBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    include: {
      ...eventSummaryInclude,
      night: true,
    },
  });
}

/** Published events not attached to a city-wide night. */
export async function getStandaloneEvents() {
  return prisma.event.findMany({
    where: { status: "PUBLISHED", nightId: null },
    orderBy: { startsAt: "asc" },
    include: eventSummaryInclude,
    take: 12,
  });
}

/** Remaining inventory for display. Never authoritative — the purchase
 *  transaction re-checks atomically. */
export function remaining(tt: { quantity: number; quantitySold: number }) {
  return Math.max(0, tt.quantity - tt.quantitySold);
}

/**
 * Event search with combinable filters.
 *
 * Text match is a case-insensitive `contains` across title, venue and
 * organizer. That is honest for a few hundred events; when the catalogue grows
 * this wants a Postgres full-text index rather than a wider LIKE.
 */
export async function searchEvents(params: {
  q?: string;
  category?: string;
  from?: Date;
  /** Exclusive upper bound — see pacificDayRange in @dtlahappening/core. */
  toExclusive?: Date;
  freeOnly?: boolean;
  take?: number;
}) {
  // 50 was fine when a busy month held a dozen events. One ArtNight is fifty
  // free openings on a single evening, all earlier than anything ticketed —
  // so ordered by start time they filled the entire page and every paid event
  // silently vanished from search, from Explore and from the map.
  //
  // A larger page is a stoppage, not a fix: real pagination is the answer and
  // is written up in docs/launch-readiness.md. This keeps one busy night from
  // hiding the rest of the calendar in the meantime.
  const { q, category, from, toExclusive, freeOnly, take = 250 } = params;

  const where = {
    status: "PUBLISHED" as const,
    ...(category ? { category: category as never } : {}),
    ...(freeOnly ? { isFree: true } : {}),
    ...(from || toExclusive
      ? {
          startsAt: {
            ...(from ? { gte: from } : {}),
            ...(toExclusive ? { lt: toExclusive } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { venue: { name: { contains: q, mode: "insensitive" as const } } },
            { venue: { neighborhood: { contains: q, mode: "insensitive" as const } } },
            { organizer: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startsAt: "asc" },
      include: eventSummaryInclude,
      take,
    }),
    prisma.event.count({ where }),
  ]);

  return { events, total };
}

/** Everything published, soonest first — the browse feed. */
export async function getUpcomingEvents(take = 50) {
  return prisma.event.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { startsAt: "asc" },
    include: eventSummaryInclude,
    take,
  });
}

/**
 * Artist submissions, newest first — the platform-admin review queue.
 *
 * Fields are listed rather than spread for the usual reason, which bites
 * harder here than anywhere else in this file: these rows hold a person's home
 * address. Anything added to the model later has to be named here before it
 * can leave the database, and `userId` is deliberately not among them — who an
 * artist is in our user table is not part of reviewing their work.
 *
 * Artworks come back in submission order because the artist chose it, and a
 * reviewer reading a proposal should see the pieces the way they were offered.
 */
export async function listArtistSubmissions(params: { status?: string; take?: number } = {}) {
  const { status, take = 100 } = params;

  return prisma.artistSubmission.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      address1: true,
      address2: true,
      city: true,
      state: true,
      zip: true,
      socials: true,
      website: true,
      media: true,
      portfolioImages: true,
      status: true,
      consentAt: true,
      reviewedAt: true,
      reviewerNote: true,
      resubmitBy: true,
      createdAt: true,
      artworks: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          medium: true,
          heightIn: true,
          widthIn: true,
          depthIn: true,
          weightLb: true,
          priceCents: true,
          imageUrl: true,
        },
      },
    },
  });
}

/** How many submissions sit in each status — the queue counts. */
export async function countSubmissionsByStatus() {
  const rows = await prisma.artistSubmission.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Record<string, number>;
}

/**
 * Vendor markets open for applications, soonest first.
 *
 * `spacesLeft` counts CONFIRMED rows only. An APPROVED-but-unpaid application
 * is holding nothing — their rule is that a space is secured by payment within
 * 72 hours — so counting it would quietly shrink a market that still has room.
 * This number is for display and is never authoritative: the transaction that
 * confirms a booth must re-check capacity atomically, the way checkout
 * re-checks inventory.
 */
export async function listVendorMarkets(params: { from?: Date } = {}) {
  const { from = new Date() } = params;
  // Compare on the LA calendar date, represented as UTC for the `date` column
  // — the same lower bound /api/nights/upcoming uses, and for the same reason.
  const { currentNightDate } = await import("@/lib/night-date");

  return prisma.vendorMarket.findMany({
    where: { isPublished: true, date: { gte: currentNightDate(from) } },
    orderBy: { date: "asc" },
    select: {
      id: true,
      name: true,
      venueName: true,
      address: true,
      date: true,
      hours: true,
      priceCents: true,
      capacity: true,
      acceptsFoodVendors: true,
      _count: { select: { submissions: { where: { status: "CONFIRMED" } } } },
    },
  });
}

/**
 * Vendor applications, newest first — the platform-admin review queue.
 *
 * Fields listed rather than spread, for the reason at the top of this file.
 * These rows hold less than an artist submission does — a business address is
 * not collected — but they are still somebody's phone number, and `userId` is
 * left out because who a vendor is in our user table is not part of judging
 * whether their table will look good in an arcade.
 */
export async function listVendorSubmissions(params: { status?: string; take?: number } = {}) {
  const { status, take = 100 } = params;

  return prisma.vendorSubmission.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      businessName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      socials: true,
      website: true,
      category: true,
      merchandise: true,
      presentation: true,
      standout: true,
      photos: true,
      status: true,
      emailConsent: true,
      smsConsent: true,
      consentAt: true,
      approvedAt: true,
      payBy: true,
      reviewedAt: true,
      reviewerNote: true,
      createdAt: true,
      markets: {
        select: {
          id: true,
          status: true,
          market: {
            select: { id: true, name: true, venueName: true, date: true, priceCents: true },
          },
        },
      },
    },
  });
}

/** How many vendor applications sit in each status. */
export async function countVendorSubmissionsByStatus() {
  const rows = await prisma.vendorSubmission.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Record<string, number>;
}
