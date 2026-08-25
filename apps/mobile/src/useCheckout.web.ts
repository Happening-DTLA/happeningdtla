import { useCallback } from "react";
import { API_BASE_URL } from "@/api";

/**
 * Kept in sync by hand with useCheckout.ts. See the note there.
 */
export type CheckoutArgs = {
  eventId: string;
  eventSlug: string;
  ticketTypeId: string;
  quantity: number;
  buyerEmail: string;
  eventTitle: string;
};

/**
 * Web stand-in for the native payment sheet.
 *
 * @stripe/stripe-react-native is native-only — its spec files import
 * react-native internals, which throws at module load on web. Because
 * expo-router's require.context pulls every route into the graph, that single
 * import took down the ENTIRE web bundle, not just the buy screen. Metro picks
 * this file for `platform: web`, so the native module is never referenced
 * there at all.
 *
 * What it does instead: hands the buyer to the website. It deliberately does
 * NOT call `api.checkout()` first — that would create a PENDING order and hold
 * seats against a purchase this platform cannot finish, and held seats are
 * inventory nobody else can buy until the hold lapses.
 *
 * `/e/[slug]` on apps/web now sells tickets, so this lands the buyer somewhere
 * that actually completes a purchase — no change to this file was needed when
 * web checkout shipped, which was the point of sending them to the site rather
 * than failing here.
 *
 * Never use `Alert` as the fallback. react-native-web ships `Alert.alert` as
 * an empty function, so it fails silently — the exact behaviour this is
 * written to avoid.
 */
export function useCheckout() {
  const buy = useCallback(async (args: CheckoutArgs) => {
    // API_BASE_URL is the web app's origin: apps/web serves the API and the
    // public event pages from the same Next process. If those are ever split
    // across hosts, this needs its own base URL.
    const url = `${API_BASE_URL}/e/${encodeURIComponent(args.eventSlug)}`;

    // A new tab keeps whatever the person was doing in this one. Popup
    // blockers return null rather than throwing, so fall back to navigating
    // in place — being sent to the site is fine; being sent nowhere is not.
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(url);
  }, []);

  return { buy, busy: false, canPayHere: false };
}
