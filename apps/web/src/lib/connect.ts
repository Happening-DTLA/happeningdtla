import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * Stripe Connect onboarding, on the Accounts v2 API.
 *
 * Venues complete everything — EIN, bank account, ID, beneficial owners — on
 * Stripe's own hosted pages. We create an account shell, hand them a
 * single-use link, and read the outcome back from Stripe.
 *
 * We deliberately never collect those details ourselves. The API would accept
 * them, but putting someone's SSN and bank number through our servers would
 * place a two-person team in scope for handling sensitive personal data and
 * identity verification. Hosted onboarding leaves that with Stripe.
 *
 * NOTE: this uses /v2/core/accounts, not the v1 `stripe.accounts` API. Stripe
 * now refuses v1 account creation for new Connect integrations. The shapes are
 * quite different — capabilities replace `charges_enabled`, and a
 * dashboard/liability pair replaces the old `standard` vs `express` type.
 */

export type VenueSetup = "full" | "express";

/**
 * "full" is the v1 Standard equivalent: the venue gets a real Stripe dashboard
 * and Stripe collects fees and bears losses directly from them.
 *
 * Several DTLA venues already run Stripe for their POS, so a full account is
 * familiar, and it puts the venue in a direct relationship with Stripe for
 * disputes and payouts — matching the merchant-of-record decision in the
 * partner brief.
 *
 * "express" is a lighter setup, but Stripe requires the PLATFORM to collect
 * fees and absorb losses for express dashboards, which is exactly the
 * liability we decided not to take on.
 */
export const DEFAULT_SETUP: VenueSetup = "full";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3100").replace(/\/$/, "");
}

/** Fields we ask Stripe to return so status can be read without a second call. */
const INCLUDE = ["configuration.merchant", "identity", "requirements"] as const;

export async function ensureConnectedAccount(
  organizerId: string,
  setup: VenueSetup = DEFAULT_SETUP,
) {
  const organizer = await prisma.organizer.findUniqueOrThrow({
    where: { id: organizerId },
    select: { id: true, name: true, contactEmail: true, stripeAccountId: true },
  });

  if (organizer.stripeAccountId) return organizer.stripeAccountId;

  // Express dashboards force the platform to collect fees and absorb losses;
  // full dashboards leave both with Stripe and the venue. See DEFAULT_SETUP.
  const responsibilities =
    setup === "express"
      ? { fees_collector: "application" as const, losses_collector: "application" as const }
      : { fees_collector: "stripe" as const, losses_collector: "stripe" as const };

  const account = await stripe.v2.core.accounts.create({
    contact_email: organizer.contactEmail,
    display_name: organizer.name,
    identity: { country: "us" },
    configuration: {
      merchant: {
        // Ticketing is reviewed as future-delivery risk. Declaring it honestly
        // up front is what avoids a payout freeze on the night.
        mcc: "7922",
        capabilities: { card_payments: { requested: true } },
      },
    },
    defaults: { responsibilities },
    dashboard: setup,
    include: [...INCLUDE],
    metadata: { organizerId: organizer.id },
  });

  await prisma.organizer.update({
    where: { id: organizer.id },
    data: { stripeAccountId: account.id },
  });

  return account.id;
}

/**
 * A single-use URL into Stripe's onboarding.
 *
 * Links expire in minutes and work once, so they are generated on demand
 * rather than stored — a stale one drops the venue on an error page, which
 * reads like the platform is broken.
 */
export async function createOnboardingLink(organizerId: string) {
  const accountId = await ensureConnectedAccount(organizerId);
  const link = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["merchant"],
        return_url: `${appUrl()}/organizer/payouts?done=1`,
        refresh_url: `${appUrl()}/organizer/payouts?refresh=1`,
      },
    },
  });
  return { url: link.url, accountId, expiresAt: link.expires_at };
}

interface RequirementEntry {
  awaiting_action_from?: string;
  description?: string;
  impact?: { restricts_capabilities?: unknown[] };
}
interface RequirementsShape {
  entries?: RequirementEntry[];
}

/**
 * Turns Stripe's requirement field paths into something a venue owner can read.
 *
 * v2 returns `description` values like
 * "configuration.merchant.statement_descriptor.descriptor" — a field path, not
 * a sentence. There were 14 of them on a fresh account. Dumping those on a
 * venue owner is useless; hiding them entirely leaves them unable to judge how
 * much is left.
 *
 * So: keep only what THEY have to act on, prefer the ones actually blocking a
 * capability, and humanise the path rather than maintaining a translation
 * table against an API that just changed shape.
 */
/**
 * Ordered longest-suffix-first so specific paths win over general ones. Several
 * map to the SAME label on purpose — Stripe asks for date of birth as three
 * separate fields, and terms acceptance as a date plus an IP, which would
 * otherwise read as five separate chores.
 */
const KNOWN: [suffix: string, label: string][] = [
  ["statement_descriptor.descriptor", "How your venue appears on card statements"],
  ["profile.business_url", "Your website or social page"],
  ["profile.business_website", "Your website or social page"],
  ["profile.product_description", "A description of what you sell"],
  ["profile.mcc", "What kind of business you are"],
  ["support.phone", "A support phone number"],
  ["support.email", "A support email address"],
  ["support.url", "A support or contact page"],
  ["external_account", "A bank account for payouts"],
  ["bank_accounts", "A bank account for payouts"],
  ["date_of_birth.day", "Your date of birth"],
  ["date_of_birth.month", "Your date of birth"],
  ["date_of_birth.year", "Your date of birth"],
  ["date_of_birth", "Your date of birth"],
  ["given_name", "Your name"],
  ["surname", "Your name"],
  ["representative.email", "A contact email for you"],
  ["entity_type", "Whether you're a company or a sole proprietor"],
  ["registered_name", "Your registered business name"],
  ["id_numbers", "Your EIN"],
  ["id_number", "Your SSN or EIN"],
  ["tos_acceptance.date", "Accepting Stripe's terms"],
  ["tos_acceptance.ip", "Accepting Stripe's terms"],
  ["account.date", "Accepting Stripe's terms"],
  ["account.ip", "Accepting Stripe's terms"],
  ["address", "Your business address"],
];

function humanise(path: string): string {
  for (const [suffix, label] of KNOWN) {
    if (path.endsWith(suffix)) return label;
  }
  // Fall back to the last two segments, de-snaked. Not beautiful, but it beats
  // "configuration.merchant.support.phone".
  const words = path.split(".").slice(-2).join(" ").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function outstandingForUser(requirements?: RequirementsShape): string[] {
  const entries = requirements?.entries ?? [];
  const mine = entries.filter((e) => e.awaiting_action_from === "user" && e.description);
  // Blocking items first — those are what actually stop money moving.
  const blocking = mine.filter((e) => (e.impact?.restricts_capabilities?.length ?? 0) > 0);
  const chosen = (blocking.length ? blocking : mine).map((e) => humanise(e.description!));
  return [...new Set(chosen)];
}

type MerchantConfig = {
  capabilities?: {
    card_payments?: { status?: string };
    stripe_balance?: { payouts?: { status?: string } };
  };
};

/** Reads Stripe's view of an account and copies it onto our record. */
export async function syncAccountStatus(accountId: string) {
  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: [...INCLUDE] });

  // v2 reports per-capability status rather than v1's charges_enabled /
  // payouts_enabled booleans.
  const merchant = (account.configuration?.merchant ?? {}) as MerchantConfig;
  const chargesEnabled = merchant.capabilities?.card_payments?.status === "active";
  const payoutsEnabled = merchant.capabilities?.stripe_balance?.payouts?.status === "active";

  const requirements = account.requirements as RequirementsShape | undefined;

  const updated = await prisma.organizer.updateMany({
    where: { stripeAccountId: accountId },
    data: { chargesEnabled, payoutsEnabled },
  });

  return {
    matched: updated.count > 0,
    chargesEnabled,
    payoutsEnabled,
    outstanding: outstandingForUser(requirements),
  };
}

/** What an organizer sees on their payouts page. */
export async function connectStatus(organizerId: string) {
  const organizer = await prisma.organizer.findUniqueOrThrow({
    where: { id: organizerId },
    select: { id: true, name: true, stripeAccountId: true, chargesEnabled: true, payoutsEnabled: true },
  });

  if (!organizer.stripeAccountId) {
    return { connected: false as const, organizer, outstanding: [] as string[] };
  }

  const status = await syncAccountStatus(organizer.stripeAccountId);
  return {
    connected: true as const,
    organizer: { ...organizer, chargesEnabled: status.chargesEnabled, payoutsEnabled: status.payoutsEnabled },
    outstanding: status.outstanding,
  };
}
