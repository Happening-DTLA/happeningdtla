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

/**
 * A named stretch of Downtown, as the night's organisers group it.
 *
 * The colour comes from the server rather than a lookup table in each client,
 * so the app, the web page and the poster on the wall cannot drift apart when
 * the organisers change one.
 */
export interface ApiCorridor {
  slug: string;
  name: string;
  /** Hex, from the printed map's key. */
  color: string;
  /** The street it runs along. Null for a district. */
  along: string | null;
  sortOrder: number;
  /**
   * The street's real geometry, as [[lat, lng], ...] runs — what lets a client
   * draw the poster's coloured route over a real map. Null for a district,
   * which has no single street to trace.
   */
  path: number[][][] | null;
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
  corridor: ApiCorridor | null;
  /** Named on the map instead of shown as a dot. */
  isLandmark: boolean;
  /** The venue's own site, when the organisers have one on file. */
  website: string | null;
  /** The organisers' own classification: "Art Galleries", "Food and Drink", … */
  kind: string | null;
  /** Curated flags: "21+", "Kid Friendly", "After Party", "Rooftop Lounge". */
  tags: string[];
}

/** The flags a visitor filters by on the night, in the order they matter. */
export const VENUE_TAGS = ["Kid Friendly", "21+", "After Party", "Rooftop Lounge"] as const;

/**
 * A night's name without its month suffix.
 *
 * Nights are stored as "Art Night DTLA — October 2026" so an organizer picking
 * one from a list is never guessing which month. Every surface that shows the
 * name also shows the date directly beneath it, so repeating the month there
 * reads as a stutter. Kept here rather than inlined at each call site because
 * three screens already split this string by hand.
 */
export const shortNightName = (name: string) => name.split("—")[0].trim();

/**
 * The second line under a destination's name.
 *
 * The organisers' feed carries a street address for only a third of the
 * venues; for the rest the address field just repeats the venue's own name, so
 * rendering it produced rows reading "The Last Bookstore / The Last Bookstore"
 * — which reads as a bug in the app rather than a gap in the data. Where there
 * is no real address, the venue's kind is the useful thing to say instead, and
 * where there is neither, saying nothing beats saying the name twice.
 */
const KIND_LABELS: Record<string, string> = {
  "Art Galleries": "Gallery",
  "Food and Drink": "Food & drink",
  Museums: "Museum",
  Shopping: "Shopping",
  "Special Events": "Special event",
  Transportation: "Getting around",
  Highlights: "Highlight",
};

export function venueSubtitle(venue: {
  name: string;
  address1: string | null;
  kind: string | null;
}): string | null {
  // Compared on letters and digits alone, so "Emerging gallery" against
  // "Emerging Gallery" and "The Broad." against "The Broad" both count as the
  // same string rather than sneaking through on punctuation.
  const key = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const address = venue.address1?.trim();
  if (address) {
    const a = key(address);
    const n = key(venue.name);
    const echoes = a === n || (a.length > 0 && (n.includes(a) || a.includes(n)));
    if (!echoes) return address;
  }
  if (!venue.kind) return null;
  return KIND_LABELS[venue.kind] ?? venue.kind;
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
  /** Null when the business has chosen not to be named publicly. */
  organizer: ApiOrganizer | null;
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
  /** Bearer secret for this order. Store it; it is how the device proves
   *  ownership later, since guest checkout has no login to authorise against. */
  accessToken: string;
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

// ---- Door -----------------------------------------------------------------

export const SCAN_RESULTS = [
  "ADMITTED",
  "DUPLICATE",
  "INVALID_CODE",
  "WRONG_EVENT",
  "REFUNDED_TICKET",
  "NOT_YET_VALID",
] as const;

export type ScanResultCode = (typeof SCAN_RESULTS)[number];

export interface ApiDoorPairing {
  token: string;
  expiresAt: string;
  event: { id: string; title: string; venueName: string; startsAt: string };
}

export interface ApiScanResponse {
  result: ScanResultCode;
  /** Short enough to read at a glance in a dark doorway. */
  message: string;
  ticket?: {
    code: string;
    tierName: string;
    holderName: string | null;
    checkedInAt: string;
  };
  firstScannedAt?: string;
}

export interface ApiDoorStats {
  event: { id: string; title: string; venueName: string };
  stats: { sold: number; admitted: number; remaining: number };
}

/** Uniform error shape so clients handle failures the same way everywhere. */
export interface ApiError {
  error: { code: string; message: string };
}
