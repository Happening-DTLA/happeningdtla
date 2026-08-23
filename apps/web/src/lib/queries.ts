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

const organizerSelect = { id: true, slug: true, name: true } as const;

const eventSummaryInclude = {
  venue: true,
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
