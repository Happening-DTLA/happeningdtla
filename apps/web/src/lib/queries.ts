import { prisma } from "@/lib/prisma";

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

/** The next published city-wide night. */
export async function getUpcomingNight() {
  return prisma.night.findFirst({
    where: { isPublished: true },
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
