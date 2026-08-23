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

/** Browse categories. Mirrors the EventCategory enum in the Prisma schema. */
export const EVENT_CATEGORIES = [
  "ART",
  "MUSIC",
  "NIGHTLIFE",
  "FOOD_DRINK",
  "PERFORMANCE",
  "MARKET",
  "WORKSHOP",
  "OTHER",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** Human labels, kept next to the values so clients can't drift apart. */
export const CATEGORY_LABELS: Record<EventCategory, string> = {
  ART: "Art",
  MUSIC: "Music",
  NIGHTLIFE: "Nightlife",
  FOOD_DRINK: "Food & Drink",
  PERFORMANCE: "Performance",
  MARKET: "Markets",
  WORKSHOP: "Workshops",
  OTHER: "Other",
};

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
  category: EventCategory;
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

/** Filters accepted by the search endpoint. All optional and combinable. */
export interface EventSearchParams {
  q?: string;
  category?: EventCategory;
  /** Inclusive calendar-date bounds, YYYY-MM-DD. */
  from?: string;
  to?: string;
  freeOnly?: boolean;
}

export interface ApiSearchResults {
  events: ApiEventSummary[];
  total: number;
}

/** What the client sends to start a purchase. Quantities only — prices are
 *  recomputed server-side, because a client that can name its own price will
 *  eventually be asked to. */
export interface CheckoutRequest {
  eventId: string;
  lines: { ticketTypeId: string; quantity: number }[];
  buyerEmail: string;
  buyerName?: string;
  buyerPhone?: string;
}

export interface CheckoutResponse {
  orderId: string;
  /** Passed to the Stripe payment sheet to confirm the payment. */
  clientSecret: string;
  publishableKey: string;
  subtotalCents: number;
  serviceFeeCents: number;
  totalCents: number;
  /** When the seat hold lapses, ISO 8601. */
  expiresAt: string;
  /** Set when charging a venue's connected account rather than the platform. */
  stripeAccountId: string | null;
}

export type OrderState = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED";

export interface ApiOrderTicket {
  id: string;
  code: string;
  tierName: string;
  holderName: string | null;
  checkedInAt: string | null;
}

export interface ApiOrder {
  id: string;
  status: OrderState;
  subtotalCents: number;
  serviceFeeCents: number;
  totalCents: number;
  buyerEmail: string;
  createdAt: string;
  event: { slug: string; title: string; startsAt: string; venueName: string };
  tickets: ApiOrderTicket[];
}

/** Uniform error shape so clients handle failures the same way everywhere. */
export interface ApiError {
  error: { code: string; message: string };
}
