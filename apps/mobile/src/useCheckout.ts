import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { useRouter } from "expo-router";
import { api, ApiRequestError } from "@/api";
import { saveOrder } from "@/orders-store";

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
    async (args: {
      eventId: string;
      ticketTypeId: string;
      quantity: number;
      buyerEmail: string;
      eventTitle: string;
    }) => {
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
        router.push("/tickets");
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

  return { buy, busy };
}
