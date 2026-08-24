import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * Stripe Connect onboarding.
 *
 * Venues complete everything — EIN, bank account, ID, beneficial owners — on
 * Stripe's own hosted pages. We create an empty account, hand them a one-time
 * link, and learn the outcome from a webhook.
 *
 * We deliberately never collect those details ourselves. Stripe's API would
 * accept them, but submitting someone's SSN and bank number through our
 * servers would put a two-person team in scope for handling sensitive personal
 * data and identity verification. Hosted onboarding makes that Stripe's
 * problem, which is where it belongs.
 */

export type ConnectAccountType = "standard" | "express";

/**
 * Standard by default.
 *
 * Several DTLA venues already run Stripe for their POS, and a Standard account
 * lets them connect the one they have instead of creating a second. It also
 * puts the venue in a direct relationship with Stripe for disputes and
 * payouts, which matches the merchant-of-record decision in the partner brief.
 *
 * Express exists for venues with no Stripe presence who want a lighter setup.
 */
export const DEFAULT_ACCOUNT_TYPE: ConnectAccountType = "standard";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3100").replace(/\/$/, "");
}

/** Creates the connected account if this organizer doesn't have one yet. */
export async function ensureConnectedAccount(
  organizerId: string,
  type: ConnectAccountType = DEFAULT_ACCOUNT_TYPE,
) {
  const organizer = await prisma.organizer.findUniqueOrThrow({
    where: { id: organizerId },
    select: { id: true, name: true, contactEmail: true, stripeAccountId: true },
  });

  if (organizer.stripeAccountId) return organizer.stripeAccountId;

  const account = await stripe.accounts.create({
    type,
    email: organizer.contactEmail,
    business_profile: {
      name: organizer.name,
      // Tells Stripe's risk review what this account actually does. Ticketing
      // is reviewed as future-delivery, so describing it accurately up front
      // avoids a payout freeze later.
      product_description: "Admission tickets to live events in Downtown Los Angeles",
      mcc: "7922", // theatrical producers / ticket agencies
    },
    metadata: { organizerId: organizer.id },
  });

  await prisma.organizer.update({
    where: { id: organizer.id },
    data: { stripeAccountId: account.id },
  });

  return account.id;
}

/**
 * A single-use URL to Stripe's onboarding.
 *
 * Account Links expire in minutes and can only be used once, so they are
 * generated on demand rather than stored — a stale one sends the venue to an
 * error page, which reads like the platform is broken.
 */
export async function createOnboardingLink(organizerId: string) {
  const accountId = await ensureConnectedAccount(organizerId);
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/organizer/payouts?refresh=1`,
    return_url: `${appUrl()}/organizer/payouts?done=1`,
    collection_options: { fields: "eventually_due" },
  });
  return { url: link.url, accountId, expiresAt: new Date(link.expires_at * 1000).toISOString() };
}

/** A link into Stripe's dashboard for an already-onboarded Express account. */
export async function createDashboardLink(accountId: string) {
  const login = await stripe.accounts.createLoginLink(accountId);
  return login.url;
}

/**
 * Copies Stripe's view of an account onto our record.
 *
 * Called from the account.updated webhook, and on demand when a venue returns
 * from onboarding — the webhook usually arrives first, but not always, and a
 * venue staring at "not connected" after finishing will just do it again.
 */
export async function syncAccountStatus(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);

  const updated = await prisma.organizer.updateMany({
    where: { stripeAccountId: accountId },
    data: {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    },
  });

  return {
    matched: updated.count > 0,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: {
      currentlyDue: account.requirements?.currently_due ?? [],
      pastDue: account.requirements?.past_due ?? [],
      disabledReason: account.requirements?.disabled_reason ?? null,
    },
  };
}

/** What an organizer sees on their payouts page. */
export async function connectStatus(organizerId: string) {
  const organizer = await prisma.organizer.findUniqueOrThrow({
    where: { id: organizerId },
    select: { id: true, name: true, stripeAccountId: true, chargesEnabled: true, payoutsEnabled: true },
  });

  if (!organizer.stripeAccountId) {
    return { connected: false as const, organizer, requirements: null, detailsSubmitted: false };
  }

  const status = await syncAccountStatus(organizer.stripeAccountId);
  return {
    connected: true as const,
    organizer: { ...organizer, chargesEnabled: status.chargesEnabled, payoutsEnabled: status.payoutsEnabled },
    requirements: status.requirements,
    detailsSubmitted: status.detailsSubmitted,
  };
}
