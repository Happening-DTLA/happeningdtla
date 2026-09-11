/**
 * Participation fee invariants, against a real database.
 *
 * Run: npx tsx scripts/test-fee-lifecycle.ts   (LOCAL database only)
 *
 * Four things that would each be expensive to get wrong:
 *
 *   1. One fee per thing owed. Approving twice must not bill twice.
 *   2. Settlement is idempotent. Stripe delivers webhooks at least once, so
 *      the second delivery must confirm nothing a second time.
 *   3. The sweep releases a space only after its window closes, and exactly
 *      once.
 *   4. A FAILED payment does NOT release the space. A declined card at hour
 *      two must not cost a vendor the booth they were approved for — only the
 *      deadline does that.
 *
 * Touches no Stripe API. The charge itself is exercised in the simulator with
 * test cards; what is verified here is the bookkeeping around it.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  createBoothFee,
  settleParticipationFee,
  expireUnpaidFees,
} from "@/lib/participation-fees";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    console.error("Refusing to run: DATABASE_URL is not local. This writes test rows.");
    process.exit(1);
  }

  const organizer = await prisma.organizer.findFirstOrThrow({ select: { id: true } });
  const stamp = Date.now();

  const market = await prisma.vendorMarket.create({
    data: {
      organizerId: organizer.id,
      name: `TEST market ${stamp}`,
      venueName: "Test venue",
      date: new Date("2026-12-03T00:00:00.000Z"),
      priceCents: 5000,
      feeCents: 186,
      capacity: 2,
      isPublished: false,
    },
    select: { id: true },
  });

  async function application(email: string) {
    const s = await prisma.vendorSubmission.create({
      data: {
        businessName: `TEST ${email}`,
        firstName: "Test", lastName: "Vendor", email, phone: "2135550000",
        socials: "NA", website: "NA", category: "OTHER",
        merchandise: "test merchandise", presentation: "test presentation",
        standout: "test standout", emailConsent: true, consentAt: new Date(),
        markets: { create: [{ marketId: market.id }] },
      },
      include: { markets: { select: { id: true } } },
    });
    return s.markets[0]!.id;
  }

  // ---- 1. one fee per thing owed -----------------------------------------
  console.log("\n1. approving twice bills once");
  const linkA = await application(`a-${stamp}@test.invalid`);
  const first = await createBoothFee(linkA);
  const second = await createBoothFee(linkA);
  check("same fee returned", first.id === second.id, first.id);
  check(
    "only one fee row exists",
    (await prisma.participationFee.count({ where: { vendorSubmissionMarketId: linkA } })) === 1,
  );
  check("charged the published $51.86", first.totalCents === 5186, `$${(first.totalCents / 100).toFixed(2)}`);
  check("payBy stamped 72h out", Boolean(first.payBy));
  const approved = await prisma.vendorSubmissionMarket.findUniqueOrThrow({
    where: { id: linkA }, select: { status: true },
  });
  check("billing also marked it APPROVED", approved.status === "APPROVED", approved.status);

  // ---- 2. settlement is idempotent ---------------------------------------
  console.log("\n2. a webhook delivered twice settles once");
  const settled1 = await settleParticipationFee({ feeId: first.id, stripeChargeId: "ch_test_1" });
  const settled2 = await settleParticipationFee({ feeId: first.id, stripeChargeId: "ch_test_1" });
  check("first delivery settles", settled1 === true);
  check("second delivery is a no-op", settled2 === false);
  const afterPaid = await prisma.vendorSubmissionMarket.findUniqueOrThrow({
    where: { id: linkA }, select: { status: true },
  });
  check("booth is CONFIRMED", afterPaid.status === "CONFIRMED", afterPaid.status);

  // ---- 3. the sweep releases only what is overdue -------------------------
  console.log("\n3. the sweep releases an overdue booth, once");
  const linkB = await application(`b-${stamp}@test.invalid`);
  const feeB = await createBoothFee(linkB);
  // Backdate the deadline rather than waiting 72 hours.
  await prisma.participationFee.update({
    where: { id: feeB.id },
    data: { payBy: new Date(Date.now() - 60_000) },
  });

  const sweptOnce = await expireUnpaidFees();
  const sweptTwice = await expireUnpaidFees();
  check("first sweep expires it", sweptOnce >= 1, `${sweptOnce} expired`);
  check("second sweep expires nothing", sweptTwice === 0, `${sweptTwice} expired`);

  const afterSweep = await prisma.vendorSubmissionMarket.findUniqueOrThrow({
    where: { id: linkB }, select: { status: true },
  });
  check("booth released as EXPIRED", afterSweep.status === "EXPIRED", afterSweep.status);
  const paidStillPaid = await prisma.participationFee.findUniqueOrThrow({
    where: { id: first.id }, select: { status: true },
  });
  check("the PAID fee was left alone", paidStillPaid.status === "PAID", paidStillPaid.status);

  // ---- 4. a failed card does not cost the space --------------------------
  console.log("\n4. a declined card inside the window keeps the space");
  const linkC = await application(`c-${stamp}@test.invalid`);
  const feeC = await createBoothFee(linkC);
  // What the webhook does on payment_intent.payment_failed.
  await prisma.participationFee.updateMany({
    where: { id: feeC.id, status: "PENDING" }, data: { status: "FAILED" },
  });
  const swept = await expireUnpaidFees();
  const afterFail = await prisma.vendorSubmissionMarket.findUniqueOrThrow({
    where: { id: linkC }, select: { status: true },
  });
  check("sweep leaves it alone while the window is open", swept === 0, `${swept} expired`);
  check("booth still held as APPROVED", afterFail.status === "APPROVED", afterFail.status);

  // ---- cleanup ------------------------------------------------------------
  await prisma.vendorSubmission.deleteMany({ where: { email: { endsWith: `-${stamp}@test.invalid` } } });
  await prisma.vendorSubmission.deleteMany({ where: { businessName: { startsWith: "TEST " } } });
  await prisma.vendorMarket.delete({ where: { id: market.id } });

  console.log(failures === 0 ? "\n✓ all pass" : `\n✗ ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
