/**
 * What this deployment is. See apps/mobile/src/features.ts for the reasoning.
 *
 * Off unless explicitly enabled, which is also the safer default while the
 * merchant-of-record question is open: with a venue not yet onboarded to
 * Connect, checkout falls back to a platform charge and the money and the
 * chargeback liability land on us rather than the venue.
 *
 * Set NEXT_PUBLIC_TICKETING=on to enable.
 */
export const TICKETING_ENABLED = process.env.NEXT_PUBLIC_TICKETING === "on";
