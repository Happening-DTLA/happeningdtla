import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { fulfillOrder, releaseOrder } from "@/lib/orders";

/**
 * Stripe webhook receiver — this is what turns a payment into tickets.
 *
 * Three rules this endpoint lives by:
 *
 * 1. VERIFY THE SIGNATURE. This route is public. Without verification anyone
 *    who can reach it could POST a fake "payment succeeded" and mint tickets.
 *    Verification needs the RAW body, so we read text() and never json().
 *
 * 2. DEDUPE. Stripe guarantees at-least-once delivery and retries on any
 *    non-2xx. The event id is inserted into WebhookEvent, and a unique
 *    violation means we already handled it — ack and move on. Without this a
 *    retry issues a second set of tickets for one payment.
 *
 * 3. ALWAYS 2xx ONCE HANDLED. A 500 makes Stripe retry, so real failures must
 *    be distinguished from "already done".
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    // A bad signature is either a misconfigured secret or someone probing.
    // 400 tells Stripe not to retry; a genuine event would have verified.
    console.error("[webhook] signature verification failed", (err as Error).message);
    return new Response("Invalid signature", { status: 400 });
  }

  // Claim the event before doing any work. The unique constraint on
  // stripeEventId is what makes redelivery a no-op.
  try {
    await prisma.webhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    });
  } catch {
    console.log(`[webhook] ${event.id} (${event.type}) already handled — acking`);
    return Response.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata?.orderId;
        if (!orderId) {
          console.warn(`[webhook] ${intent.id} has no orderId in metadata`);
          break;
        }
        const issued = await fulfillOrder({
          orderId,
          stripeChargeId: typeof intent.latest_charge === "string" ? intent.latest_charge : undefined,
        });
        console.log(
          issued
            ? `[webhook] order ${orderId} fulfilled`
            : `[webhook] order ${orderId} was already fulfilled`,
        );
        break;
      }

      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata?.orderId;
        if (orderId) {
          // Nobody paid, so the seats go back on sale immediately rather than
          // sitting held until the hold expires.
          await releaseOrder(orderId, event.type === "payment_intent.canceled" ? "CANCELLED" : "FAILED");
          console.log(`[webhook] order ${orderId} released after ${event.type}`);
        }
        break;
      }

      default:
        // Everything else is acked and ignored on purpose — subscribing to a
        // type we don't handle shouldn't look like a failure.
        break;
    }

    return Response.json({ received: true });
  } catch (err) {
    // Real failure. Remove the dedupe claim so Stripe's retry can try again,
    // otherwise this payment would never produce tickets.
    await prisma.webhookEvent
      .delete({ where: { stripeEventId: event.id } })
      .catch(() => {});
    console.error(`[webhook] handler failed for ${event.id}`, err);
    return new Response("Handler error", { status: 500 });
  }
}
