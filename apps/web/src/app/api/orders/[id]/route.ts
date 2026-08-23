import type { ApiOrder } from "@dtlahappening/core";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound } from "@/lib/api-response";

/**
 * An order and its tickets.
 *
 * Requires the order's accessToken. Guest checkout means there is no session
 * to authorise against, and ticket codes are the only thing between a buyer
 * and a freeloader — an id alone must not be enough to read them.
 *
 * Returns 404 rather than 403 on a bad token, so probing can't confirm which
 * order ids exist.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return fail(401, "missing_token", "This link is missing its access token.");

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      event: { include: { venue: { select: { name: true } } } },
      tickets: { include: { ticketType: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!order || order.accessToken !== token) return notFound("order");

  const body: ApiOrder = {
    id: order.id,
    status: order.status,
    subtotalCents: order.subtotalCents,
    serviceFeeCents: order.serviceFeeCents,
    totalCents: order.totalCents,
    buyerEmail: order.buyerEmail,
    createdAt: order.createdAt.toISOString(),
    event: {
      slug: order.event.slug,
      title: order.event.title,
      startsAt: order.event.startsAt.toISOString(),
      venueName: order.event.venue.name,
    },
    // Ticket codes are only ever returned for a PAID order. A pending or
    // released order must not hand out anything scannable.
    tickets:
      order.status === "PAID"
        ? order.tickets.map((t) => ({
            id: t.id,
            code: t.code,
            tierName: t.ticketType.name,
            holderName: t.holderName,
            checkedInAt: t.checkedInAt?.toISOString() ?? null,
          }))
        : [],
  };

  return ok(body);
}
