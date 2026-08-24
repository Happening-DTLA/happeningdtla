import type { ReactNode } from "react";

/**
 * Web stand-in for the Stripe provider: there is nothing to provide.
 *
 * @stripe/stripe-react-native is native-only and throws at module load on web,
 * and this one was imported from the ROOT layout — so it broke every route in
 * the web bundle, not just checkout. Nothing on web reads the publishable key
 * either: useCheckout.web.ts hands the buyer to the website rather than
 * collecting a card here.
 */
export function PaymentProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
