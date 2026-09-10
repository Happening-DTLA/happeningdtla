import { z } from "zod";
import {
  FOOD_CATEGORY,
  MAX_VENDOR_PHOTOS,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABELS,
  formatCents,
  type VendorCategory,
} from "@dtlahappening/core";
import { prisma } from "@/lib/prisma";
import { send } from "@/lib/email";

const CATEGORY_VALUES = VENDOR_CATEGORIES.map((c) => c.value) as [VendorCategory, ...VendorCategory[]];

/**
 * Validation for a vendor application.
 *
 * Mirrors the organisers' form, including the parts that look odd out of
 * context: socials and website are required strings rather than URLs because
 * their form asks for "NA" when a vendor has neither.
 *
 * The three prose answers have real minimums. They are what curation actually
 * turns on, and a one-word "clothes" costs the organisers a follow-up email
 * they should not have to send.
 */
export const VendorSubmissionBody = z.object({
  businessName: z.string().trim().min(1).max(120),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email(),
  phone: z.string().trim().min(7).max(40),

  socials: z.string().trim().min(1).max(400),
  website: z.string().trim().min(1).max(400),

  category: z.enum(CATEGORY_VALUES),

  merchandise: z.string().trim().min(10, "Tell them what you sell.").max(2000),
  presentation: z.string().trim().min(10, "Tell them how it looks on a table.").max(2000),
  standout: z.string().trim().min(10, "Tell them why you.").max(2000),

  photos: z.array(z.url()).max(MAX_VENDOR_PHOTOS),

  marketIds: z.array(z.string().min(1)).min(1, "Pick at least one market.").max(12),

  emailConsent: z.literal(true, { message: "Consent is required to submit." }),
  smsConsent: z.boolean().optional(),
});

export type VendorSubmissionBody = z.infer<typeof VendorSubmissionBody>;

export class VendorSubmissionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Records a vendor application and tells the organisers about it.
 *
 * Guest-first, like every other entry point here — nobody creates an account
 * to apply. Applying marks an existing account as a VENDOR, because it is the
 * clearest statement of what that person is here to do.
 *
 * Note what this deliberately does NOT do: it takes no money and holds no
 * space. Their process is apply, then be approved, then pay within 72 hours.
 * A row created here is a request, and capacity is not touched until an
 * approval is paid for.
 */
export async function createVendorSubmission(input: VendorSubmissionBody) {
  // Markets are re-read rather than trusted, because the client sends ids and
  // ids are the easiest thing in the world to change in a request.
  const markets = await prisma.vendorMarket.findMany({
    where: { id: { in: input.marketIds }, isPublished: true },
    select: {
      id: true,
      name: true,
      venueName: true,
      date: true,
      priceCents: true,
      feeCents: true,
      acceptsFoodVendors: true,
    },
  });

  if (markets.length !== input.marketIds.length) {
    throw new VendorSubmissionError(
      "unknown_market",
      "One of those markets is no longer open for applications.",
    );
  }

  // The food rule is the organisers', and it is enforced here rather than only
  // in the form: a client-side check is a courtesy to the applicant, not a
  // rule about who ends up on the floor.
  if (input.category === FOOD_CATEGORY) {
    const refuses = markets.filter((m) => !m.acceptsFoodVendors);
    if (refuses.length) {
      throw new VendorSubmissionError(
        "food_not_accepted",
        `${refuses.map((m) => m.name).join(", ")} ${refuses.length === 1 ? "is" : "are"} not accepting food vendors.`,
      );
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, profileType: true },
  });

  const submission = await prisma.vendorSubmission.create({
    data: {
      userId: user?.id ?? null,
      businessName: input.businessName,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      socials: input.socials,
      website: input.website,
      category: input.category,
      merchandise: input.merchandise,
      presentation: input.presentation,
      standout: input.standout,
      photos: input.photos,
      emailConsent: input.emailConsent,
      smsConsent: input.smsConsent ?? false,
      consentAt: new Date(),
      markets: { create: markets.map((m) => ({ marketId: m.id })) },
    },
    include: { markets: { include: { market: true } } },
  });

  // An ATTENDEE who applies to vend is a vendor. Anyone already an ARTIST or a
  // VENUE keeps what they have — applying for a booth does not un-artist them.
  if (user && user.profileType === "ATTENDEE") {
    await prisma.user.update({ where: { id: user.id }, data: { profileType: "VENDOR" } });
  }

  // Told, not queried. Nobody polls a table — and when mail is failing, which
  // it currently is, /admin/submissions is the copy that always works.
  await notifyOrganisers(submission);

  return submission;
}

type VendorSubmissionWithMarkets = Awaited<ReturnType<typeof createVendorSubmission>>;

const REVIEW_INBOX = process.env.SUBMISSIONS_EMAIL?.trim() || "info@dtlaartnight.com";

async function notifyOrganisers(s: VendorSubmissionWithMarkets) {
  const marketLines = s.markets.map((m) => {
    const total = m.market.priceCents + m.market.feeCents;
    // A calendar date, so it is formatted in UTC. Rendered in Pacific, the
    // first Thursday of the month shows as a Wednesday.
    const date = m.market.date.toISOString().slice(0, 10);
    return `  - ${m.market.name} — ${date} · ${m.market.venueName} · ${formatCents(total)}`;
  });

  const text = [
    `${s.businessName} — ${VENDOR_CATEGORY_LABELS[s.category as VendorCategory]}`,
    "",
    `Contact:  ${s.firstName} ${s.lastName}`,
    `Email:    ${s.email}`,
    `Phone:    ${s.phone}`,
    `Socials:  ${s.socials}`,
    `Website:  ${s.website}`,
    "",
    "MARKETS APPLIED FOR",
    ...marketLines,
    "",
    "WHAT THEY SELL",
    s.merchandise,
    "",
    "HOW THEY PRESENT IT",
    s.presentation,
    "",
    "WHAT MAKES THEM STAND OUT",
    s.standout,
    "",
    s.photos.length ? `PHOTOS (${s.photos.length})` : "No photos attached.",
    ...s.photos,
    "",
    s.smsConsent ? "Opted in to SMS." : "Did not opt in to SMS.",
    "",
    `Submission id: ${s.id}`,
  ].join("\n");

  await send({
    to: REVIEW_INBOX,
    subject: `Vendor application — ${s.businessName} (${s.markets.length} ${s.markets.length === 1 ? "market" : "markets"})`,
    text,
    html: `<pre style="font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
  });
}
