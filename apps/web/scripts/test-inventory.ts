/**
 * Concurrency test for the inventory hold.
 *
 * The oversell race is invisible in normal use and catastrophic at a door, so
 * it gets an explicit test rather than a careful read of the code. Fires many
 * simultaneous checkouts at a tier with deliberately scarce inventory and
 * asserts that the counter never exceeds capacity.
 *
 * Run: npx tsx scripts/test-inventory.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { createPendingOrder, releaseOrder, releaseExpiredHolds, CheckoutError } from "../src/lib/orders";

const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error("Refusing to run against a non-local database.");
  process.exit(1);
}

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

async function scratchTier(capacity: number, maxPerOrder = 10) {
  const event = await prisma.event.findFirstOrThrow({ where: { status: "PUBLISHED" } });
  return prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: `TEST tier ${Date.now()}`,
      priceCents: 1000,
      quantity: capacity,
      maxPerOrder,
    },
  });
}

const buy = (eventId: string, ticketTypeId: string, quantity: number) =>
  createPendingOrder({
    eventId,
    lines: [{ ticketTypeId, quantity }],
    buyerEmail: "race@dtlahappening.test",
  });

async function main() {
  console.log("\n— concurrent buyers cannot oversell —");
  {
    const CAPACITY = 10;
    const BUYERS = 40;
    const tier = await scratchTier(CAPACITY);
    const results = await Promise.allSettled(
      Array.from({ length: BUYERS }, () => buy(tier.eventId, tier.id, 1)),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const reasons = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r.reason as CheckoutError)?.code ?? "unknown");
    const soldOut = reasons.filter((c) => c === "insufficient_inventory").length;
    const busy = reasons.filter((c) => c === "busy").length;
    const unexpected = reasons.filter((c) => c !== "insufficient_inventory" && c !== "busy");
    const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: tier.id } });

    check(`${BUYERS} simultaneous buyers, capacity ${CAPACITY}`, ok === CAPACITY, `${ok} succeeded`);
    check("counter never exceeds capacity", after.quantitySold <= CAPACITY, `quantitySold=${after.quantitySold}`);
    check(
      "every loser got an actionable error",
      soldOut + busy === BUYERS - CAPACITY,
      `${soldOut} sold-out, ${busy} busy/retryable`,
    );
    check(
      "no raw database errors leaked to the buyer",
      unexpected.length === 0,
      unexpected.length ? `leaked: ${[...new Set(unexpected)].join(", ")}` : "none",
    );
  }

  console.log("\n— multi-quantity orders respect the boundary —");
  {
    const tier = await scratchTier(10);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => buy(tier.eventId, tier.id, 3)),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: tier.id } });
    check("3-at-a-time against capacity 10", ok === 3, `${ok} orders of 3 = ${ok * 3} seats`);
    check("no partial oversell", after.quantitySold <= 10, `quantitySold=${after.quantitySold}`);
  }

  console.log("\n— a failed line rolls back the whole order —");
  {
    const plenty = await scratchTier(100);
    const scarce = await scratchTier(1);
    const before = (await prisma.ticketType.findUniqueOrThrow({ where: { id: plenty.id } })).quantitySold;
    try {
      await createPendingOrder({
        eventId: plenty.eventId,
        lines: [
          { ticketTypeId: plenty.id, quantity: 5 },
          { ticketTypeId: scarce.id, quantity: 5 }, // must fail
        ],
        buyerEmail: "rollback@dtlahappening.test",
      });
      check("order rejected", false, "it succeeded, which is wrong");
    } catch (e) {
      check("order rejected", (e as CheckoutError).code === "insufficient_inventory");
    }
    const after = (await prisma.ticketType.findUniqueOrThrow({ where: { id: plenty.id } })).quantitySold;
    check("the good line was rolled back, not left held", after === before, `${before} -> ${after}`);
  }

  console.log("\n— releasing a hold puts seats back —");
  {
    const tier = await scratchTier(5);
    const { order } = await buy(tier.eventId, tier.id, 5);
    const held = (await prisma.ticketType.findUniqueOrThrow({ where: { id: tier.id } })).quantitySold;
    check("all 5 held", held === 5);

    await releaseOrder(order.id);
    const freed = (await prisma.ticketType.findUniqueOrThrow({ where: { id: tier.id } })).quantitySold;
    check("all 5 released", freed === 0, `quantitySold=${freed}`);

    const again = await releaseOrder(order.id);
    const afterDouble = (await prisma.ticketType.findUniqueOrThrow({ where: { id: tier.id } })).quantitySold;
    check("double-release is a no-op", again === false && afterDouble === 0, `quantitySold=${afterDouble}`);
  }

  console.log("\n— expired holds are reaped —");
  {
    const tier = await scratchTier(4);
    const { order } = await buy(tier.eventId, tier.id, 4);
    await prisma.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const reaped = await releaseExpiredHolds();
    const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: tier.id } });
    check("expired hold released", reaped >= 1 && after.quantitySold === 0, `quantitySold=${after.quantitySold}`);
  }

  console.log("\n— per-order limit is enforced —");
  {
    const tier = await scratchTier(100, 4);
    try {
      await buy(tier.eventId, tier.id, 5);
      check("rejects more than maxPerOrder", false, "it allowed 5 with a limit of 4");
    } catch (e) {
      check("rejects more than maxPerOrder", (e as CheckoutError).code === "over_max_per_order");
    }
  }

  // Clean up scratch rows so the seed data stays as seeded.
  await prisma.order.deleteMany({ where: { buyerEmail: { contains: "@dtlahappening.test" }, status: { not: "PAID" } } });
  await prisma.ticketType.deleteMany({ where: { name: { startsWith: "TEST tier " } } });

  console.log(failures === 0 ? "\nAll inventory checks passed.\n" : `\n${failures} CHECK(S) FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
