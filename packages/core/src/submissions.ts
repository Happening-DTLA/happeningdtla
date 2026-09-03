/**
 * Artist submissions.
 *
 * Shaped to the organisers' own form at dtlaartnight.com/artist-submission so
 * an application made in the app is one their curatorial process already knows
 * how to read. Lives in core because the mobile form and the API have to agree
 * on it exactly — a field the client thinks is optional and the server thinks
 * is required is a submission someone loses after typing for ten minutes.
 */

/** Their labels, in their order. Multi-select. */
export const ART_MEDIA = [
  "Paintings",
  "Drawings",
  "Sculpture",
  "Mixed Media",
  "Print Making",
  "Other",
] as const;
export type ArtMedium = (typeof ART_MEDIA)[number];

export const SUBMISSION_STATUSES = [
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "DECLINED",
  "WITHDRAWN",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Their form's limits, so the client can stop someone before the server does. */
export const MAX_PORTFOLIO_IMAGES = 10;
export const MAX_ARTWORKS = 20;

/**
 * Beyond these, the organisers quote installation separately rather than
 * pricing by the standard placement tiers. Published on their submission page;
 * encoded here so an artist is told at the point of entry instead of finding
 * out in a follow-up email a week later.
 */
export const CUSTOM_QUOTE_LIMITS = { heightIn: 48, widthIn: 36, weightLb: 50 } as const;

export interface ArtworkInput {
  title: string;
  medium?: string | null;
  /** Inches, INCLUDING THE FRAME — which is what a wall has to accommodate. */
  heightIn?: number | null;
  widthIn?: number | null;
  depthIn?: number | null;
  weightLb?: number | null;
  /** Asking price in cents. Artists keep 100% of sales. */
  priceCents: number;
  imageUrl: string;
}

export interface ArtistSubmissionInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string | null;
  city: string;
  state: string;
  zip: string;
  /** Their form requires this and accepts the literal "NA". */
  socials: string;
  website: string;
  media: string[];
  portfolioImages: string[];
  artworks: ArtworkInput[];
  /** Must be true. Stored with a timestamp, because "when" is the question. */
  consent: boolean;
}

/**
 * Whether a piece needs a custom installation quote.
 *
 * Deliberately treats unknown dimensions as "no": an artist who has not
 * measured yet should not be told their work is oversized. The organisers see
 * the numbers either way and can ask.
 */
export function needsCustomQuote(art: {
  heightIn?: number | null;
  widthIn?: number | null;
  weightLb?: number | null;
}): boolean {
  return (
    (art.heightIn ?? 0) > CUSTOM_QUOTE_LIMITS.heightIn ||
    (art.widthIn ?? 0) > CUSTOM_QUOTE_LIMITS.widthIn ||
    (art.weightLb ?? 0) > CUSTOM_QUOTE_LIMITS.weightLb
  );
}

/** Days an artist has to resubmit at no charge after a decline. Their promise. */
export const RESUBMIT_WINDOW_DAYS = 5;
