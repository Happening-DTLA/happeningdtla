import { useEffect, useState, type ReactNode } from "react";
import { StripeProvider } from "@stripe/stripe-react-native";
import { api } from "@/api";

/**
 * Puts Stripe in scope for the payment sheet.
 *
 * This lives in its own module — rather than inline in app/_layout.tsx —
 * purely so it can have a web counterpart. Metro resolves platform-specific
 * files for anything imported, but a route file has to keep its one copy of
 * the Stack config, so the native-only dependency moves out here instead. See
 * PaymentProvider.web.tsx.
 */
export function PaymentProvider({ children }: { children: ReactNode }) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);

  // Fetched rather than baked into a second .env, so there is one source of
  // truth for the key and no chance of test/live drifting between them.
  useEffect(() => {
    let alive = true;
    api
      .config()
      .then((c) => alive && setPublishableKey(c.stripePublishableKey))
      .catch(() => {
        // Browsing must still work when the API is unreachable; only paying
        // needs Stripe, and that surfaces its own error.
      });
    return () => {
      alive = false;
    };
  }, []);

  // The fragment is load-bearing: StripeProvider types its children as
  // ReactElement | ReactElement[], not ReactNode, so a bare {children} does
  // not typecheck. Wrapping gives it the single element it asks for.
  return (
    <StripeProvider publishableKey={publishableKey ?? ""}>
      <>{children}</>
    </StripeProvider>
  );
}
