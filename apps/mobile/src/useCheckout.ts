import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { useRouter } from "expo-router";
import { api, ApiRequestError } from "@/api";
import { saveOrder } from "@/orders-store";

/**
 * What a purchase needs to know.
 *
 * Kept in sync by hand with useCheckout.web.ts — Metro picks that file for
 * `platform: web` and TypeScript only ever resolves this one, so nothing
 * cross-checks the two. Same arrangement as EventMap.tsx / EventMap.web.tsx.
 * `eventSlug` and `eventTitle` are unused here; the web variant needs them to
 * name the event and build its URL.
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
 * The purchase, end to end.
 *
 * The server holds the seats and creates the PaymentIntent; this presents
 * Stripe's native sheet against the returned client secret. The same secret
 * would drive Apple Pay or a web Payment Element — the server contract does
 * not change with the front end.
 */
export function useCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const buy = useCallback(
    async (args: CheckoutArgs) => {
      if (busy) return;
      setBusy(true);
      try {
        const checkout = await api.checkout({
          eventId: args.eventId,
          lines: [{ ticketTypeId: args.ticketTypeId, quantity: args.quantity }],
          buyerEmail: args.buyerEmail,
        });

        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: "DTLAHappening",
          paymentIntentClientSecret: checkout.clientSecret,
          returnURL: "dtlahappening://checkout",
          defaultBillingDetails: { email: args.buyerEmail },
        });
        if (initError) throw new Error(initError.message);

        const { error: sheetError } = await presentPaymentSheet();

        if (sheetError) {
          // Canceled is a normal outcome, not a failure to report. The seats
          // stay held until the order expires, so a change of mind followed by
          // a retry still works.
          if (sheetError.code !== "Canceled") {
            Alert.alert("Payment failed", sheetError.message);
          }
          return;
        }

        // Paid. Remember the order on this device — with guest checkout the
        // access token is the only way back to these tickets.
        await saveOrder({ orderId: checkout.orderId, accessToken: checkout.accessToken });
        router.push({ pathname: "/tickets", params: { celebrate: "1" } });
      } catch (err) {
        const message =
          err instanceof ApiRequestError || err instanceof Error
            ? err.message
            : "Something went wrong.";
        Alert.alert("Couldn't complete checkout", message);
      } finally {
        setBusy(false);
      }
    },
    [busy, initPaymentSheet, presentPaymentSheet, router],
  );

  // Annotated rather than inferred: a literal `true` would narrow away the
  // web branch in every caller, and the web variant is the whole point.
  /** Whether this platform can take the payment itself. */
  const canPayHere: boolean = true;

  return { buy, busy, canPayHere };
}
