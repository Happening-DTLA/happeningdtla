import { z } from "zod";
import type { CheckoutResponse } from "@dtlahappening/core";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ok, fail } from "@/lib/api-response";
import {
  CHECKOUT_PER_BUYER,
  CHECKOUT_PER_IP,
  clientIp,
  enforceRateLimit,
} from "@/lib/rate-limit";
import {
  CheckoutError,
  createPendingOrder,
  releaseExpiredHolds,
  releaseOrder,
} from "@/lib/orders";

const Body = z.object({
  eventId: z.string().min(1),
  lines: z
    .array(z.object({ ticketTypeId: z.string().min(1), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(10),
  // Guest checkout: an email is all we require. Forcing signup before purchase
  // is the single biggest conversion killer in ticketing.
  buyerEmail: z.email(),
  buyerName: z.string().trim().max(120).optional(),
  buyerPhone: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  // Per address first, before the body is even read: a flood of malformed
  // requests should be counted too, and this check is cheaper than parsing.
  const ip = clientIp(request);
  const perAddress = await enforceRateLimit("checkout:ip", ip, CHECKOUT_PER_IP);
  if (perAddress) return perAddress;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_json", "Request body must be JSON.");
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return fail(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  const input = parsed.data;

  // Counted per buyer, before anything is held or charged. Every call past
  // this point reserves inventory and creates a Stripe PaymentIntent, which is
  // what makes an unlimited endpoint expensive in seats and in Stripe bill.
  const perBuyer = await enforceRateLimit(
    "checkout:buyer",
    ip ? `${ip}|${input.buyerEmail.toLowerCase()}` : null,
    CHECKOUT_PER_BUYER,
  );
  if (perBuyer) return perBuyer;

  // Free up seats from abandoned checkouts first, so an event that only looks
  // sold out doesn't stay that way until the next scheduled sweep.
  await releaseExpiredHolds().catch(() => {});

  let created: Awaited<ReturnType<typeof createPendingOrder>>;
  try {
    created = await createPendingOrder(input);
  } catch (err) {
    if (err instanceof CheckoutError) return fail(err.status, err.code, err.message);
    throw err;
  }

  const { order, event } = created;

  // Free events still create an order, but there is nothing to charge.
  if (order.totalCents === 0) {
    return fail(400, "free_event", "This event is free — no payment is needed.");
  }

  const organizer = await prisma.organizer.findUnique({
    where: { id: event.organizerId },
    select: { stripeAccountId: true, chargesEnabled: true },
  });

  // Direct charges: the venue is the merchant of record and carries the
  // chargeback liability, with the platform taking an application fee. Falls
  // back to a platform charge while a venue is still onboarding to Connect.
  const useConnect = Boolean(organizer?.stripeAccountId && organizer.chargesEnabled);

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: order.totalCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        receipt_email: order.buyerEmail,
        // The webhook trusts this and nothing else about the payment.
        metadata: { orderId: order.id, eventId: event.id },
        description: `${event.title} — DTLAHappening`,
        ...(useConnect ? { application_fee_amount: order.platformFeeCents } : {}),
      },
      useConnect ? { stripeAccount: organizer!.stripeAccountId! } : undefined,
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: intent.id },
    });

    const response: CheckoutResponse = {
      orderId: order.id,
      accessToken: order.accessToken,
      clientSecret: intent.client_secret!,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
      subtotalCents: order.subtotalCents,
      serviceFeeCents: order.serviceFeeCents,
      totalCents: order.totalCents,
      expiresAt: order.expiresAt!.toISOString(),
      stripeAccountId: useConnect ? organizer!.stripeAccountId! : null,
    };
    return ok(response);
  } catch (err) {
    // Stripe refused to create the intent, so nobody is paying for these
    // seats — give them straight back rather than holding them for 15 minutes.
    await releaseOrder(order.id, "FAILED").catch(() => {});
    console.error("[checkout] PaymentIntent creation failed", err);
    return fail(502, "payment_setup_failed", "Couldn't start payment. Please try again.");
  }
}
