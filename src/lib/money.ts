/**
 * All money is integer cents. Never floats — 0.1 + 0.2 problems become real
 * refund disputes.
 */

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** What DTLAHappening charges the buyer on top of face value. */
export const SERVICE_FEE_PERCENT = 0.06;
export const SERVICE_FEE_FIXED_CENTS = 99;

export function serviceFeeFor(subtotalCents: number): number {
  if (subtotalCents === 0) return 0;
  return Math.round(subtotalCents * SERVICE_FEE_PERCENT) + SERVICE_FEE_FIXED_CENTS;
}

/**
 * California requires the all-in total to be shown before checkout, and hiding
 * fees until the final step is the most-complained-about thing about Eventbrite.
 * Every price surface should call this and show `totalCents`, not `subtotalCents`.
 */
export function priceBreakdown(subtotalCents: number) {
  const serviceFeeCents = serviceFeeFor(subtotalCents);
  return {
    subtotalCents,
    serviceFeeCents,
    totalCents: subtotalCents + serviceFeeCents,
  };
}
