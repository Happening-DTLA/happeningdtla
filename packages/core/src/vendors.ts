/**
 * Vendor submissions.
 *
 * Shaped to the organisers' own form at dtlaartnight.com/vendor-submission so
 * an application made in the app reads exactly like one made on the website.
 * Lives in core for the same reason artist submissions do: the mobile form and
 * the API have to agree on the shape precisely, or somebody loses an
 * application after typing for ten minutes.
 */

/** Their categories, in their order. Single-select on the form. */
export const VENDOR_CATEGORIES = [
  { value: "FASHION_APPAREL", label: "Fashion & Apparel" },
  { value: "ACCESSORIES", label: "Accessories" },
  { value: "BEAUTY_WELLNESS", label: "Beauty & Wellness" },
  { value: "ART_ARTISAN_GOODS", label: "Art & Artisan Goods" },
  { value: "HOME_LIFESTYLE", label: "Home & Lifestyle" },
  { value: "PLANTS_GARDEN", label: "Plants & Garden" },
  { value: "PET_PRODUCTS", label: "Pet Products" },
  { value: "KIDS_FAMILY", label: "Kids & Family" },
  { value: "DIGITAL_CREATIVE_SERVICES", label: "Digital & Creative Services" },
  { value: "VINTAGE_ANTIQUES", label: "Vintage & Antiques" },
  { value: "CULTURAL_METAPHYSICAL", label: "Cultural & Metaphysical" },
  { value: "SERVICES_EXPERIENCES", label: "Services & Experiences" },
  { value: "FOOD_BEVERAGE", label: "Food & Beverage" },
  { value: "OTHER", label: "Others" },
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number]["value"];

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = Object.fromEntries(
  VENDOR_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<VendorCategory, string>;

/**
 * Food is a category and also a gate.
 *
 * Spring Arcade takes no food vendors at all and the Regent takes them subject
 * to review, so the category decides which markets an applicant may even pick.
 * Checked on the client so nobody selects a market they cannot have, and again
 * on the server because a client check is a courtesy, not a rule.
 */
export const FOOD_CATEGORY: VendorCategory = "FOOD_BEVERAGE";

export const VENDOR_SUBMISSION_STATUSES = [
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "CONFIRMED",
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
] as const;
export type VendorSubmissionStatus = (typeof VENDOR_SUBMISSION_STATUSES)[number];

/** Their form's limit. Booth photos, not a portfolio. */
export const MAX_VENDOR_PHOTOS = 5;

/**
 * Hours to pay after approval before the space is released.
 *
 * Published on their form — "Once approved, payment must be received within 72
 * hours to secure your space." Encoded here rather than left in a paragraph
 * because the sweep that expires unpaid approvals has to agree with what the
 * vendor was told.
 */
export const VENDOR_PAYMENT_WINDOW_HOURS = 72;

/** Business days the organisers ask for to process an application. */
export const VENDOR_REVIEW_DAYS = "2–3 business days";

/**
 * What they will and will not take, verbatim from the form.
 *
 * Shown at the top of the app's form for the same reason it is shown on
 * theirs: it is cheaper for everyone if somebody selling marijuana products
 * reads this than if they fill in nine fields and get declined.
 */
export const VENDOR_PRODUCTS_WANTED =
  "Clothing, vintage items, jewelry & accessories, plants, candles and home goods, " +
  "furniture, apothecary & skincare, collectibles, unique goods, food & drink.";

export const VENDOR_PRODUCTS_NOT_WANTED =
  "Alcoholic beverages, marijuana or marijuana products, illegal substances, " +
  "service marketing, intimacy products, offensive and discriminatory items.";

/** The rules a vendor agrees to by submitting. Theirs, condensed but not softened. */
export const VENDOR_ACKNOWLEDGEMENTS = [
  "Vendors are expected to stay for the whole event. Tearing down early may mean not being invited back.",
  "Vendors provide their own table and display unless otherwise noted.",
  `Once approved, payment must be received within ${VENDOR_PAYMENT_WINDOW_HOURS} hours to secure your space.`,
  "Cancelling within 24 hours means finding someone to cover your spot or forfeiting it.",
  "Space assignments, load-in and parking details go out 24 hours before the event.",
  "No refunds.",
] as const;

export interface VendorSubmissionInput {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Required on their form and accepts the literal "NA". */
  socials: string;
  website: string;
  category: VendorCategory;
  merchandise: string;
  presentation: string;
  standout: string;
  photos: string[];
  /** Market ids being applied for. At least one. */
  marketIds: string[];
  /** Must be true. Stored with a timestamp, because "when" is the question. */
  emailConsent: boolean;
  /** Genuinely optional — a separate legal ask, and not a condition of applying. */
  smsConsent?: boolean;
}

/** A market as the app shows it. Price is already all-in. */
export interface ApiVendorMarket {
  id: string;
  name: string;
  venueName: string;
  address: string | null;
  /** ISO calendar date, "2026-10-01". Format it in UTC — see datetime.ts. */
  date: string;
  hours: string | null;
  priceCents: number;
  /** What a vendor actually pays, fee included. Show this one. */
  totalCents: number;
  acceptsFoodVendors: boolean;
  /** Null when the organisers would rather not publish remaining capacity. */
  spacesLeft: number | null;
}

/**
 * Whether this applicant may apply to this market.
 *
 * The only rule today is food, and it is the organisers' rule rather than
 * ours. Returns the reason rather than a bare false so the form can say why a
 * market is greyed out instead of silently omitting it, which reads as a bug.
 */
export function vendorMarketBlockedReason(
  market: Pick<ApiVendorMarket, "acceptsFoodVendors" | "spacesLeft">,
  category: VendorCategory,
): string | null {
  if (category === FOOD_CATEGORY && !market.acceptsFoodVendors) {
    return "This market isn't taking food vendors";
  }
  if (market.spacesLeft !== null && market.spacesLeft <= 0) {
    return "Fully booked";
  }
  return null;
}

/**
 * When payment is due for an approval made now.
 *
 * A function rather than a constant because the deadline is stored on the row:
 * a vendor approved on Friday evening should not discover on Monday that the
 * clock ran while nobody was reading email.
 */
export function vendorPaymentDeadline(approvedAt: Date): Date {
  return new Date(approvedAt.getTime() + VENDOR_PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);
}
