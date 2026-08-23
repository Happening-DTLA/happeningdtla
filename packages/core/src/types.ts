/**
 * The public API contract — the single source of truth for every client.
 *
 * The web app and the native app both import these. When the server changes a
 * payload, both clients fail to compile in the same commit instead of the
 * native app silently rendering undefined at a door on a Thursday night.
 *
 * Rules:
 *  - Dates are ISO 8601 strings. JSON has no date type.
 *  - Money is integer cents, matching the database.
 *  - If a field is not described here, it does not leave the server.
 */

export interface ApiOrganizer {
  id: string;
  slug: string;
  name: string;
}

export interface ApiVenue {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  zip: string;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ApiNightSummary {
  id: string;
  slug: string;
  name: string;
  /** Calendar date as YYYY-MM-DD. Deliberately not a timestamp. */
  date: string;
}

export interface ApiTicketType {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  serviceFeeCents: number;
  /** Face value plus fee. Clients display THIS, never priceCents alone. */
  allInCents: number;
  maxPerOrder: number;
  /** Display only — the purchase transaction re-checks inventory atomically. */
  remaining: number;
  soldOut: boolean;
  salesStartAt: string | null;
  salesEndAt: string | null;
}

export interface ApiEventSummary {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  doorsAt: string | null;
  startsAt: string;
  endsAt: string | null;
  minAge: number | null;
  isFree: boolean;
  fromPriceCents: number | null;
  /** Lowest all-in price across active tiers, for list rendering. */
  fromAllInCents: number | null;
  soldOut: boolean;
  venue: ApiVenue;
  organizer: ApiOrganizer;
}

export interface ApiEvent extends ApiEventSummary {
  description: string | null;
  night: ApiNightSummary | null;
  ticketTypes: ApiTicketType[];
}

export interface ApiNight extends ApiNightSummary {
  description: string | null;
  heroImageUrl: string | null;
  events: ApiEventSummary[];
}

/** Uniform error shape so clients handle failures the same way everywhere. */
export interface ApiError {
  error: { code: string; message: string };
}
