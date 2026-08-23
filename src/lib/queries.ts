import { prisma } from "@/lib/prisma";

/**
 * Data access lives here rather than inline in pages, so the same query can be
 * reused by a page, a route handler and the seed without drifting.
 */

/** The next city-wide night that hasn't happened yet. */
export async function getUpcomingNight() {
  return prisma.night.findFirst({
    where: { isPublished: true },
    orderBy: { date: "asc" },
    include: {
      events: {
        where: { status: "PUBLISHED" },
        orderBy: [{ startsAt: "asc" }],
        include: {
          venue: true,
          organizer: { select: { name: true, slug: true } },
          ticketTypes: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
}

export async function getEventBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    include: {
      venue: true,
      organizer: true,
      night: true,
      ticketTypes: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/** Events not attached to a city-wide night. */
export async function getStandaloneEvents() {
  return prisma.event.findMany({
    where: { status: "PUBLISHED", nightId: null, startsAt: { gte: new Date("2026-01-01") } },
    orderBy: { startsAt: "asc" },
    include: { venue: true, organizer: { select: { name: true, slug: true } } },
    take: 12,
  });
}

/** Remaining inventory for a tier. Never trust this for the actual sale —
 *  the purchase transaction re-checks it atomically. This is for display only. */
export function remaining(tt: { quantity: number; quantitySold: number }) {
  return Math.max(0, tt.quantity - tt.quantitySold);
}
