/**
 * What it costs to take part, and who ends up with the money.
 *
 * Separate from `money.ts` on purpose. That file prices TICKETS, where the
 * platform's service fee is a placeholder awaiting a partner decision and the
 * buyer pays it on top. Participation fees are a different arrangement that
 * the organisers already publish and already run:
 *
 *   the applicant covers card processing, the organisers net the fee they
 *   advertise, and the platform currently takes nothing.
 *
 * dtlaartnight.com advertises a $50 booth and charges $51.86. That is not a
 * markup — it is the booth fee grossed up so Happening in DTLA is not left
 * paying to be paid. Every number here reproduces that arithmetic exactly.
 *
 * Decided 10 September 2026, recorded in docs/participation-fees.md.
 */

/**
 * The rate the ORGANISERS gross up at — a round 3% plus 30c.
 *
 * Not a guess. dtlaartnight.com charges $51.86 for a $50 booth, and 3% + 30c
 * is the only rate that reproduces that to the cent; 2.9% gives $51.81 and is
 * wrong by a nickel. They round up, which is sensible of them: it covers
 * Stripe's actual rate with a little to spare rather than landing a hair
 * short.
 *
 * Use THIS to decide what to charge.
 */
export const GROSS_UP_PERCENT = 0.03;
export const GROSS_UP_FIXED_CENTS = 30;

/**
 * What Stripe actually deducts. Use THIS to work out what really lands.
 *
 * Deliberately a separate pair of numbers from the two above. Because the
 * organisers round up and Stripe does not, they net slightly MORE than they
 * advertise — $50.06 on a $50 booth. Collapsing these into one rate would
 * either misreport what they receive or change what applicants are charged.
 */
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_CENTS = 30;

/**
 * The platform's cut of a participation fee. **Zero, deliberately.**
 *
 * Both alternatives were worse while the app is establishing itself. Charging
 * the applicant would mean a booth costs more in the app than on the website,
 * which is the same unfairness as the app not charging at all, only pointed the
 * other way. Charging the organisers would make an application worth less to
 * them when it arrives through the app than through their own site — a quiet
 * incentive to send people back to the website, which would undercut the thing
 * this app is for.
 *
 * The agreed rate when it is switched on is **5%**. Changing this constant is
 * all that is required; nothing else assumes it is zero.
 */
export const PLATFORM_FEE_PERCENT = 0;
export const PLATFORM_FEE_PERCENT_WHEN_ENABLED = 0.05;

/** What the organisers advertise, in integer cents. Their published numbers. */
export const ARTIST_SUBMISSION_FEE_CENTS = 3500;
export const VENDOR_BOOTH_FEE_CENTS = 5000;

export interface FeeBreakdown {
  /** The number the organisers advertise — "$50 booth", "$35 submission". */
  advertisedCents: number;
  /** What Stripe will actually deduct from the charge. */
  processingCents: number;
  /** The platform's cut. Zero today. */
  platformFeeCents: number;
  /** What the applicant is actually charged. Show THIS one. */
  totalCents: number;
  /** What lands with the organisers after Stripe and the platform. */
  organizerNetCents: number;
}

/**
 * Gross up an advertised fee so the seller nets it in full.
 *
 * Solving `total - (total * rate + fixed) - platformFee = advertised` for
 * total, which is why it divides rather than multiplying. Adding 3% to $50 and
 * charging $51.80 looks equivalent and is not: it misses the organisers'
 * published $51.86 by six cents, so the app would quietly charge a different
 * price than their own website for the identical booth.
 */
export function participationFee(advertisedCents: number): FeeBreakdown {
  const platformFeeCents = Math.round(advertisedCents * PLATFORM_FEE_PERCENT);
  const target = advertisedCents + platformFeeCents;

  // Grossed up at the organisers' rate, so the charge matches their website.
  const totalCents = Math.ceil((target + GROSS_UP_FIXED_CENTS) / (1 - GROSS_UP_PERCENT));

  // Deducted at Stripe's actual rate, so the net is what really arrives.
  const processingCents = Math.round(totalCents * STRIPE_PERCENT + STRIPE_FIXED_CENTS);

  return {
    advertisedCents,
    processingCents,
    platformFeeCents,
    totalCents,
    organizerNetCents: totalCents - processingCents - platformFeeCents,
  };
}

/** The artist submission fee, all in. */
export const artistSubmissionFee = () => participationFee(ARTIST_SUBMISSION_FEE_CENTS);

/** A booth fee, all in. Takes the advertised price because markets differ. */
export const vendorBoothFee = (advertisedCents = VENDOR_BOOTH_FEE_CENTS) =>
  participationFee(advertisedCents);
