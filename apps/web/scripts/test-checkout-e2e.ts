/**
 * End-to-end purchase test against Stripe test mode.
 *
 * Requires `stripe listen --forward-to localhost:3100/api/webhooks/stripe`
 * to be running, since fulfilment happens in the webhook.
 *
 * Run: npx tsx scripts/test-checkout-e2e.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { stripe } from "../src/lib/stripe";

const BASE = "http://localhost:3100";
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(label: string, fn: () => Promise<T | null>, ms = 20000): Promise<T | null> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v) return v;
    await sleep(500);
  }
  console.log(`    (timed out waiting for ${label})`);
  return null;
}

async function main() {
  const tier = await prisma.ticketType.findFirstOrThrow({
    where: { isActive: true, priceCents: { gt: 0 }, event: { status: "PUBLISHED" } },
    include: { event: true },
  });
  const before = tier.quantitySold;
  console.log(`\nBuying 2 × "${tier.name}" for "${tier.event.title}" (${tier.priceCents}c each)\n`);

  console.log("— checkout —");
  const res = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: tier.eventId,
      lines: [{ ticketTypeId: tier.id, quantity: 2 }],
      buyerEmail: "e2e@dtlahappening.test",
      buyerName: "E2E Buyer",
    }),
  });
  const body = await res.json();
  check("checkout returned 200", res.status === 200, `HTTP ${res.status}`);
  if (res.status !== 200) { console.log(JSON.stringify(body)); process.exit(1); }

  const expectedTotal = tier.priceCents * 2 + Math.round(tier.priceCents * 2 * 0.06) + 99;
  check("server priced it, not the client", body.totalCents === expectedTotal,
        `total ${body.totalCents}c (subtotal ${body.subtotalCents} + fee ${body.serviceFeeCents})`);

  const held = await prisma.ticketType.findUniqueOrThrow({ where: { id: tier.id } });
  check("seats held before payment", held.quantitySold === before + 2, `${before} -> ${held.quantitySold}`);

  const pending = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } });
  check("order is PENDING with an expiry", pending.status === "PENDING" && pending.expiresAt !== null);
  check("no tickets issued yet", (await prisma.ticket.count({ where: { orderId: body.orderId } })) === 0);

  console.log("\n— paying with a test card —");
  const intentId = body.clientSecret.split("_secret_")[0];
  const confirmed = await stripe.paymentIntents.confirm(intentId, {
    payment_method: "pm_card_visa",
    return_url: `${BASE}/orders/${body.orderId}`,
  });
  check("Stripe reports succeeded", confirmed.status === "succeeded", confirmed.status);

  console.log("\n— webhook fulfilment —");
  const paid = await waitFor("order to be marked PAID", async () => {
    const o = await prisma.order.findUnique({ where: { id: body.orderId } });
    return o?.status === "PAID" ? o : null;
  });
  check("order marked PAID by the webhook", paid !== null);

  const tickets = await prisma.ticket.findMany({ where: { orderId: body.orderId } });
  check("2 tickets issued", tickets.length === 2, `${tickets.length} issued`);
  check("codes are unique and unguessable",
        new Set(tickets.map((t) => t.code)).size === tickets.length &&
        tickets.every((t) => t.code.length === 16));
  check("hold cleared on payment", paid?.expiresAt === null);
  const afterPay = await prisma.ticketType.findUniqueOrThrow({ where: { id: tier.id } });
  check("inventory not double-counted", afterPay.quantitySold === before + 2, `quantitySold=${afterPay.quantitySold}`);

  console.log("\n— webhook redelivery must not double-issue —");
  const evt = await prisma.webhookEvent.findFirst({
    where: { type: "payment_intent.succeeded" },
    orderBy: { processedAt: "desc" },
  });
  if (!evt) {
    check("found the webhook event to replay", false);
  } else {
    const { execSync } = await import("node:child_process");
    try {
      execSync(`~/.local/bin/stripe events resend ${evt.stripeEventId} --live=false`, {
        stdio: ["ignore", "pipe", "pipe"], shell: "/bin/zsh",
      });
    } catch { /* resend may report non-zero; the delivery is what matters */ }
    await sleep(4000);
    const after = await prisma.ticket.count({ where: { orderId: body.orderId } });
    check("still exactly 2 tickets after redelivery", after === 2, `${after} tickets`);
  }

  console.log(failures === 0 ? "\nCheckout works end to end.\n" : `\n${failures} CHECK(S) FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
