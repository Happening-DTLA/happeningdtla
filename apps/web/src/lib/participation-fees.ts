import {
  participationFee,
  vendorBoothFee,
  artistSubmissionFee,
  VENDOR_PAYMENT_WINDOW_HOURS,
  formatCents,
} from "@dtlahappening/core";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { send } from "@/lib/email";

/**
 * Money owed for taking part, and the charge that settles it.
 *
 * The rules this file exists to keep, all of which have an expensive failure
 * mode:
 *
 *   - **One charge per thing owed.** The unique constraints on
 *     `artistSubmissionId` and `vendorSubmissionMarketId` mean a second call
 *     returns the existing fee rather than creating a second one. Charging an
 *     artist twice for one submission is the kind of mistake that ends a
 *     relationship with the people this whole product depends on.
 *   - **The organisers are merchant of record.** Every charge is created ON
 *     their connected account. There is deliberately NO platform-charge
 *     fallback — see `chargeParticipationFee`.
 *   - **A fee is settled by the webhook, never by the client.** The client
 *     saying "payment succeeded" is a claim; `payment_intent.succeeded` is a
 *     fact.
 */

/**
 * The business that collects participation fees — Happening in DTLA.
 *
 * Looked up by slug rather than stored as an id, because an id in an env var
 * is unreadable and silently wrong after a database reset, while a slug says
 * what it means. Configurable so a test or a second city does not have to
 * share one hardcoded row.
 *
 * Throws rather than falling back to "the first organizer we find". Guessing
 * a payee is how money reaches the wrong bank account.
 */
export const ARTNIGHT_ORGANIZER_SLUG = process.env.ARTNIGHT_ORGANIZER_SLUG?.trim() || "dtla-artnight";

export async function feeCollectingOrganizer() {
  const organizer = await prisma.organizer.findUnique({
    where: { slug: ARTNIGHT_ORGANIZER_SLUG },
    select: { id: true, name: true, stripeAccountId: true, chargesEnabled: true },
  });
  if (!organizer) {
    throw new FeeError(
      "no_fee_organizer",
      `No organizer with slug "${ARTNIGHT_ORGANIZER_SLUG}". Set ARTNIGHT_ORGANIZER_SLUG or create that business.`,
    );
  }
  return organizer;
}

export class FeeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * The fee for a vendor booth, created when an application is approved.
 *
 * Approval is what creates a bill — before that there is nothing owed, which
 * is why applying is free. `payBy` is stamped here rather than computed later
 * so the deadline a vendor is told matches the one the sweep enforces, even if
 * the constant changes afterwards.
 */
export async function createBoothFee(vendorSubmissionMarketId: string) {
  const link = await prisma.vendorSubmissionMarket.findUnique({
    where: { id: vendorSubmissionMarketId },
    select: {
      id: true,
      submissionId: true,
      fee: { select: { id: true } },
      market: { select: { organizerId: true, priceCents: true, name: true } },
      submission: { select: { firstName: true, lastName: true, email: true, businessName: true } },
    },
  });
  if (!link) throw new FeeError("unknown_application", "No such application.");
  // Already billed. Returning the existing fee makes approving twice harmless.
  if (link.fee) return prisma.participationFee.findUniqueOrThrow({ where: { id: link.fee.id } });

  const breakdown = vendorBoothFee(link.market.priceCents);
  const payBy = new Date(Date.now() + VENDOR_PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);

  // Approving and billing are one act, in one transaction. Split apart they
  // can half-happen: an application marked approved with no bill is a vendor
  // told yes who is never asked for money, and a bill against an application
  // still marked SUBMITTED is a charge nobody authorised.
  return prisma.$transaction(async (tx) => {
    const fee = await tx.participationFee.create({
      data: {
        kind: "VENDOR_BOOTH",
        organizerId: link.market.organizerId,
        vendorSubmissionMarketId: link.id,
        advertisedCents: breakdown.advertisedCents,
        processingCents: breakdown.processingCents,
        platformFeeCents: breakdown.platformFeeCents,
        totalCents: breakdown.totalCents,
        payerEmail: link.submission.email,
        payerName: link.submission.businessName,
        payBy,
      },
    });

    await tx.vendorSubmissionMarket.update({
      where: { id: link.id },
      data: { status: "APPROVED" },
    });

    // The parent carries the deadline too, so a reviewer looking at the
    // application sees it without joining to the fee.
    await tx.vendorSubmission.update({
      where: { id: link.submissionId },
      data: { status: "APPROVED", approvedAt: new Date(), payBy },
    });

    return fee;
  });
}

/**
 * The fee for an artist submission, created with the submission itself.
 *
 * No `payBy`: their form charges to submit rather than on acceptance, so there
 * is no window to miss and nothing to expire.
 */
export async function createSubmissionFee(artistSubmissionId: string, organizerId: string) {
  const submission = await prisma.artistSubmission.findUnique({
    where: { id: artistSubmissionId },
    select: { id: true, firstName: true, lastName: true, email: true, fee: { select: { id: true } } },
  });
  if (!submission) throw new FeeError("unknown_submission", "No such submission.");
  if (submission.fee) {
    return prisma.participationFee.findUniqueOrThrow({ where: { id: submission.fee.id } });
  }

  const breakdown = artistSubmissionFee();
  return prisma.participationFee.create({
    data: {
      kind: "ARTIST_SUBMISSION",
      organizerId,
      artistSubmissionId: submission.id,
      advertisedCents: breakdown.advertisedCents,
      processingCents: breakdown.processingCents,
      platformFeeCents: breakdown.platformFeeCents,
      totalCents: breakdown.totalCents,
      payerEmail: submission.email,
      payerName: `${submission.firstName} ${submission.lastName}`,
    },
  });
}

/**
 * Starts payment for a fee, returning what the client needs to complete it.
 *
 * Idempotent by reuse: a fee that already has a PaymentIntent gets the same
 * one back rather than a second. Two intents for one fee is two ways to pay
 * the same bill, and both can succeed.
 */
export async function chargeParticipationFee(feeId: string, accessToken: string) {
  const fee = await prisma.participationFee.findUnique({
    where: { id: feeId },
    select: {
      id: true,
      accessToken: true,
      status: true,
      totalCents: true,
      platformFeeCents: true,
      payBy: true,
      payerEmail: true,
      stripePaymentIntentId: true,
      kind: true,
      organizer: {
        select: { id: true, name: true, stripeAccountId: true, chargesEnabled: true },
      },
    },
  });

  if (!fee || fee.accessToken !== accessToken) {
    throw new FeeError("not_found", "That payment link isn't valid.");
  }
  if (fee.status === "PAID") throw new FeeError("already_paid", "This has already been paid.");
  if (fee.status === "EXPIRED") {
    throw new FeeError("expired", "This space was released because payment wasn't received in time.");
  }
  if (fee.payBy && fee.payBy.getTime() < Date.now()) {
    throw new FeeError("expired", "The payment window for this space has closed.");
  }

  /**
   * No platform-charge fallback, unlike checkout.
   *
   * Checkout falls back to charging on the platform account when a venue is
   * mid-onboarding. Doing that here would make us merchant of record for
   * Happening in DTLA's own revenue and put their chargebacks on us — for a
   * booth we had no part in selling. Better that an un-onboarded account
   * simply cannot collect, loudly.
   */
  const account = fee.organizer.stripeAccountId;
  if (!account || !fee.organizer.chargesEnabled) {
    throw new FeeError(
      "organizer_not_ready",
      `${fee.organizer.name} can't take payments yet. Their Stripe onboarding isn't finished.`,
    );
  }

  if (fee.stripePaymentIntentId) {
    // Options are the THIRD argument here, not merged into params — a direct
    // charge is only retrievable on the account it was created on.
    const existing = await stripe.paymentIntents.retrieve(
      fee.stripePaymentIntentId,
      {},
      { stripeAccount: account },
    );
    if (existing.status !== "canceled") {
      return { clientSecret: existing.client_secret!, stripeAccountId: account, fee };
    }
  }

  const intent = await stripe.paymentIntents.create(
    {
      amount: fee.totalCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      receipt_email: fee.payerEmail,
      // The webhook trusts this and nothing else about the payment.
      metadata: { participationFeeId: fee.id, kind: fee.kind },
      description:
        fee.kind === "VENDOR_BOOTH"
          ? "Vendor booth — DTLA Art Night"
          : "Artist submission — DTLA Art Night",
      ...(fee.platformFeeCents > 0 ? { application_fee_amount: fee.platformFeeCents } : {}),
    },
    { stripeAccount: account },
  );

  await prisma.participationFee.update({
    where: { id: fee.id },
    data: { stripePaymentIntentId: intent.id, stripeAccountId: account },
  });

  return { clientSecret: intent.client_secret!, stripeAccountId: account, fee };
}

/**
 * Marks a fee paid and confirms whatever it was for.
 *
 * Conditional on still being unpaid, so a redelivered webhook is a no-op
 * rather than a second confirmation. Returns whether this call is the one that
 * settled it, which is what decides if a receipt goes out.
 */
export async function settleParticipationFee(params: {
  feeId: string;
  stripeChargeId?: string;
}): Promise<boolean> {
  const { feeId, stripeChargeId } = params;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.participationFee.updateMany({
      // The condition IS the idempotency. Reading first and then writing would
      // let two deliveries both see PENDING and both confirm.
      where: { id: feeId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PAID", paidAt: new Date(), stripeChargeId: stripeChargeId ?? null },
    });
    if (updated.count === 0) return false;

    const fee = await tx.participationFee.findUniqueOrThrow({
      where: { id: feeId },
      select: { vendorSubmissionMarketId: true },
    });

    // A paid booth is a confirmed booth. This is the only status that occupies
    // capacity for good — see VendorMarket.capacity.
    if (fee.vendorSubmissionMarketId) {
      await tx.vendorSubmissionMarket.update({
        where: { id: fee.vendorSubmissionMarketId },
        data: { status: "CONFIRMED" },
      });
    }
    return true;
  });
}

/**
 * Releases booths whose payment window closed unpaid.
 *
 * The vendor equivalent of `releaseExpiredHolds()`. Their published rule is 72
 * hours from approval, and a space that is never released is a space nobody
 * else can have — the market looks full while standing half empty.
 *
 * Artist fees have no `payBy` and are therefore never swept.
 */
export async function expireUnpaidFees(): Promise<number> {
  const due = await prisma.participationFee.findMany({
    where: { status: "PENDING", payBy: { lt: new Date() } },
    select: { id: true, vendorSubmissionMarketId: true },
    take: 100,
  });

  let expired = 0;
  for (const fee of due) {
    const done = await prisma.$transaction(async (tx) => {
      const updated = await tx.participationFee.updateMany({
        where: { id: fee.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      if (updated.count === 0) return false;
      if (fee.vendorSubmissionMarketId) {
        await tx.vendorSubmissionMarket.update({
          where: { id: fee.vendorSubmissionMarketId },
          data: { status: "EXPIRED" },
        });
      }
      return true;
    });
    if (done) expired += 1;
  }
  return expired;
}

/** Tells someone what they owe and how to pay it. Best-effort, never throws. */
export async function sendFeeRequest(feeId: string): Promise<boolean> {
  const fee = await prisma.participationFee.findUnique({
    where: { id: feeId },
    select: {
      id: true,
      kind: true,
      accessToken: true,
      totalCents: true,
      advertisedCents: true,
      payBy: true,
      payerEmail: true,
      payerName: true,
      vendorSubmissionMarket: {
        select: { market: { select: { name: true, venueName: true, date: true } } },
      },
    },
  });
  if (!fee) return false;

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const link = `${base}/pay/${fee.id}?token=${fee.accessToken}`;
  const market = fee.vendorSubmissionMarket?.market;

  const lines = [
    `Hi${fee.payerName ? ` ${fee.payerName}` : ""},`,
    "",
    fee.kind === "VENDOR_BOOTH"
      ? "Good news — your application was approved."
      : "Thanks for your submission.",
    "",
    market
      ? // A calendar date, so formatted in UTC. In Pacific the first Thursday
        // of the month renders as a Wednesday.
        `${market.name} — ${market.date.toISOString().slice(0, 10)} · ${market.venueName}`
      : "Artist submission — DTLA Art Night",
    `Amount due: ${formatCents(fee.totalCents)}`,
    "",
    fee.payBy
      ? `Please pay by ${fee.payBy.toISOString().slice(0, 10)}. Your space isn't held until payment arrives.`
      : "",
    "",
    link,
  ];

  const text = lines.filter((l) => l !== "").join("\n");
  const result = await send({
    to: fee.payerEmail,
    subject:
      fee.kind === "VENDOR_BOOTH"
        ? `Approved — ${formatCents(fee.totalCents)} to confirm your space`
        : `${formatCents(fee.totalCents)} to complete your submission`,
    text,
    html: `<pre style="font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
  });
  return result.sent;
}

/** What a fee looks like to the person paying it. Fields picked by hand. */
export function toApiFee(fee: {
  id: string;
  kind: string;
  status: string;
  advertisedCents: number;
  processingCents: number;
  totalCents: number;
  payBy: Date | null;
}) {
  return {
    id: fee.id,
    kind: fee.kind,
    status: fee.status,
    advertisedCents: fee.advertisedCents,
    processingCents: fee.processingCents,
    totalCents: fee.totalCents,
    payBy: fee.payBy ? fee.payBy.toISOString() : null,
  };
}

/** Re-exported so callers price things through one door. */
export { participationFee };
