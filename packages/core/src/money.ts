/**
 * All money is integer cents. Never floats — 0.1 + 0.2 becomes a refund dispute.
 */

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * Placeholder pricing. See docs/payments-brief.html — worked against Stripe's
 * rate, this charges the buyer MORE and pays the venue LESS than a fee sized so
 * venues net full face value. Replace once the partners decide.
 */
export const SERVICE_FEE_PERCENT = 0.06;
export const SERVICE_FEE_FIXED_CENTS = 99;

export function serviceFeeFor(subtotalCents: number): number {
  if (subtotalCents === 0) return 0;
  return Math.round(subtotalCents * SERVICE_FEE_PERCENT) + SERVICE_FEE_FIXED_CENTS;
}

/**
 * California requires the all-in total before checkout, and buried fees are the
 * loudest complaint about Eventbrite. Every price surface shows `totalCents`.
 */
export function priceBreakdown(subtotalCents: number) {
  const serviceFeeCents = serviceFeeFor(subtotalCents);
  return { subtotalCents, serviceFeeCents, totalCents: subtotalCents + serviceFeeCents };
}
