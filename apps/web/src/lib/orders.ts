import { prisma } from "@/lib/prisma";
import { send } from "@/lib/email";
import { orderConfirmationEmail } from "@/lib/emails/order-confirmation";
import { priceBreakdown } from "@dtlahappening/core";
import { newTicketCode } from "@/lib/ticket-code";
import type { Prisma } from "@/generated/prisma/client";

/** How long a PENDING order holds its seats before they go back on sale. */
export const HOLD_MINUTES = 15;

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
    /** True when the caller can sensibly try the exact same request again. */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

/**
 * Under a heavy on-sale, transactions can fail to acquire a connection (P2028)
 * or lose a serialization race (P2034). Neither means the buyer did anything
 * wrong and neither means they got a ticket — surface both as "try again"
 * rather than leaking a database error into a checkout screen.
 */
function asCheckoutError(err: unknown): CheckoutError {
  if (err instanceof CheckoutError) return err;
  const code = (err as { code?: string })?.code;
  // P2028 no free connection · P2034 lost a serialization race
  // P1017 the server hung up mid-transaction, typically pool exhaustion
  if (code === "P2028" || code === "P2034" || code === "P1017") {
    return new CheckoutError(
      "We're handling a lot of orders right now. Try again in a moment.",
      "busy",
      503,
      true,
    );
  }
  throw err;
}

export interface CheckoutLine {
  ticketTypeId: string;
  quantity: number;
}

/**
 * Atomically commit inventory for one tier.
 *
 * This is a raw statement on purpose. Prisma's `updateMany` cannot express a
 * column-to-column predicate (`quantitySold + n <= quantity`), and the obvious
 * read-then-write alternative is a race: two buyers both read 1 seat left, both
 * see room, both write. At a door that means turning someone away who is
 * holding a ticket they paid for.
 *
 * Postgres evaluates the WHERE and the SET in one statement under a row lock,
 * so exactly one of two concurrent callers can win. A zero-row result means
 * "not enough left", never "maybe".
 */
async function commitInventory(
  tx: Prisma.TransactionClient,
  ticketTypeId: string,
  quantity: number,
): Promise<boolean> {
  const rows = await tx.$executeRaw`
    UPDATE "TicketType"
    SET "quantitySold" = "quantitySold" + ${quantity}
    WHERE id = ${ticketTypeId}
      AND "isActive" = true
      AND "quantitySold" + ${quantity} <= quantity
  `;
  return rows === 1;
}

/** Give seats back — an expired hold, a failed payment, a cancellation. */
export async function releaseInventory(
  tx: Prisma.TransactionClient,
  ticketTypeId: string,
  quantity: number,
): Promise<void> {
  // GREATEST guards against ever driving the counter negative, which would
  // silently create free inventory out of a double-release bug.
  await tx.$executeRaw`
    UPDATE "TicketType"
    SET "quantitySold" = GREATEST(0, "quantitySold" - ${quantity})
    WHERE id = ${ticketTypeId}
  `;
}

/**
 * Creates a PENDING order holding its inventory.
 *
 * Prices are recomputed from the database. The client sends quantities and
 * nothing else — a client that can name its own price will eventually be asked
 * to.
 */
export async function createPendingOrder(input: {
  eventId: string;
  lines: CheckoutLine[];
  buyerEmail: string;
  buyerName?: string;
  buyerPhone?: string;
  userId?: string;
}) {
  const { eventId, lines, buyerEmail, buyerName, buyerPhone, userId } = input;

  if (lines.length === 0) throw new CheckoutError("No tickets selected.", "empty_order");
  if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) {
    throw new CheckoutError("Ticket quantities must be whole numbers.", "bad_quantity");
  }

  try {
    return await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { ticketTypes: true },
    });

    if (!event || event.status !== "PUBLISHED") {
      throw new CheckoutError("This event is not on sale.", "event_unavailable", 404);
    }

    const now = new Date();
    let subtotalCents = 0;
    const committed: { ticketTypeId: string; quantity: number; unitPriceCents: number }[] = [];

    for (const line of lines) {
      const tier = event.ticketTypes.find((t) => t.id === line.ticketTypeId);
      if (!tier) throw new CheckoutError("Unknown ticket type.", "unknown_tier", 404);
      if (!tier.isActive) throw new CheckoutError(`${tier.name} is no longer on sale.`, "tier_inactive");
      if (tier.salesStartAt && tier.salesStartAt > now) {
        throw new CheckoutError(`${tier.name} is not on sale yet.`, "sales_not_started");
      }
      if (tier.salesEndAt && tier.salesEndAt < now) {
        throw new CheckoutError(`${tier.name} is no longer on sale.`, "sales_ended");
      }
      if (line.quantity > tier.maxPerOrder) {
        throw new CheckoutError(
          `You can buy at most ${tier.maxPerOrder} ${tier.name} tickets per order.`,
          "over_max_per_order",
        );
      }

      const won = await commitInventory(tx, tier.id, line.quantity);
      if (!won) {
        // The transaction rolls back, so anything already committed above is
        // released automatically — no partial hold left behind.
        const left = Math.max(0, tier.quantity - tier.quantitySold);
        throw new CheckoutError(
          left === 0
            ? `${tier.name} just sold out.`
            : `Only ${left} ${tier.name} left.`,
          "insufficient_inventory",
          409,
        );
      }

      subtotalCents += tier.priceCents * line.quantity;
      committed.push({
        ticketTypeId: tier.id,
        quantity: line.quantity,
        unitPriceCents: tier.priceCents,
      });
    }

    const { serviceFeeCents, totalCents } = priceBreakdown(subtotalCents);

    const order = await tx.order.create({
      data: {
        userId,
        eventId,
        status: "PENDING",
        subtotalCents,
        serviceFeeCents,
        totalCents,
        platformFeeCents: serviceFeeCents,
        buyerEmail,
        buyerName,
        buyerPhone,
        expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
        // Recorded now so fulfilment knows what to issue without trusting
        // anything the client sends back later.
        items: { create: committed },
      },
      include: { items: true },
    });

    return { order, committed, event };
    },
    {
      // Defaults are tuned for ordinary requests, not a ticket drop. Waiting
      // longer for a connection beats failing a buyer who is holding a phone.
      maxWait: 10_000,
      timeout: 15_000,
    });
  } catch (err) {
    throw asCheckoutError(err);
  }
}

/**
 * Turns a paid order into tickets. Safe to call more than once — Stripe
 * delivers webhooks at least once and retries on any non-2xx.
 *
 * Returns false when the order was already fulfilled, so the caller can ack
 * the duplicate and move on.
 */
export async function fulfillOrder(input: {
  orderId: string;
  stripeChargeId?: string;
}): Promise<boolean> {
  const { orderId, stripeChargeId } = input;

  return prisma.$transaction(async (tx) => {
    // Conditional claim: only a PENDING order becomes PAID. A redelivered
    // webhook matches zero rows, so it issues nothing and we ack it.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: {
        status: "PAID",
        paidAt: new Date(),
        expiresAt: null,
        ...(stripeChargeId ? { stripeChargeId } : {}),
      },
    });
    if (claimed.count === 0) return false;

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    // Inventory was committed when the hold was placed, so issuing tickets
    // realises seats we already hold — no second inventory check needed.
    await tx.ticket.createMany({
      data: order.items.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          orderId: order.id,
          ticketTypeId: item.ticketTypeId,
          eventId: order.eventId,
          code: newTicketCode(),
          unitPriceCents: item.unitPriceCents,
          ownerUserId: order.userId,
          holderEmail: order.buyerEmail,
          holderName: order.buyerName,
        })),
      ),
    });

    return true;
  });
}

/**
 * Releases a hold that was never paid for — an expired checkout, a declined
 * card, an abandoned session. Puts the seats back on sale.
 *
 * Safe to call repeatedly: only a PENDING order transitions, so a second call
 * cannot double-release and manufacture free inventory.
 */
export async function releaseOrder(
  orderId: string,
  status: "CANCELLED" | "FAILED" = "CANCELLED",
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status, expiresAt: null },
    });
    if (claimed.count === 0) return false;

    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await releaseInventory(tx, item.ticketTypeId, item.quantity);
    }
    return true;
  });
}

/**
 * Reaps holds whose time ran out. Intended for a scheduled job; also called
 * opportunistically before a checkout so a sold-out-looking event frees up
 * without waiting for the next cron tick.
 */
export async function releaseExpiredHolds(): Promise<number> {
  const expired = await prisma.order.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });

  let released = 0;
  for (const { id } of expired) {
    if (await releaseOrder(id, "CANCELLED")) released += 1;
  }
  return released;
}

/**
 * Emails a paid order's tickets to the buyer.
 *
 * Called AFTER fulfilment commits, never inside the transaction. Sending mail
 * over the network from inside a database transaction holds a connection open
 * on a third party's latency, and a provider outage would roll back tickets
 * that were genuinely paid for. Tickets first; email is best-effort.
 *
 * Returns whether it sent, for logging. Never throws.
 */
export async function sendOrderConfirmation(orderId: string): Promise<boolean> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: { include: { venue: true } },
        tickets: { include: { ticketType: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!order || order.status !== "PAID" || order.tickets.length === 0) return false;

    const message = orderConfirmationEmail(
      {
        orderId: order.id,
        accessToken: order.accessToken,
        buyerEmail: order.buyerEmail,
        buyerName: order.buyerName,
        eventTitle: order.event.title,
        eventStartsAt: order.event.startsAt,
        venueName: order.event.venue.name,
        venueAddress: order.event.venue.address1,
        totalCents: order.totalCents,
        tickets: order.tickets.map((t) => ({ code: t.code, tierName: t.ticketType.name })),
      },
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100",
    );

    const { sent, reason } = await send(message);
    if (!sent && reason !== "no_api_key") {
      // Worth surfacing: the buyer has tickets but no way to find them from
      // another device. Retry logic belongs here once there's a job runner.
      console.error(`[email] confirmation for order ${orderId} failed: ${reason}`);
    }
    return sent;
  } catch (err) {
    console.error(`[email] confirmation for order ${orderId} threw`, err);
    return false;
  }
}
