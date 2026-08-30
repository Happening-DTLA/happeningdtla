import Stripe from "stripe";

/**
 * Server-side Stripe client. NEVER import this into anything the client
 * bundles — it carries the secret key.
 *
 * Constructed on first use rather than at module load, and that is not a
 * style choice. `next build` imports every route to collect page data, so a
 * module-scope throw makes the whole app unbuildable whenever the key is
 * absent — which is every CI run, every preview deploy on a fork, and every
 * clone by a new developer who has not been handed secrets yet. The build
 * failure also names the wrong culprit: it reads as a broken route rather
 * than a missing variable.
 *
 * Every check below still runs, and still refuses. It refuses on the first
 * request that actually needs Stripe, which is where a missing payment
 * credential is a real problem rather than a hypothetical one.
 */
let client: Stripe | null = null;

function create(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Copy apps/web/.env.example and add your test keys.",
    );
  }

  // A live key in development is how real cards get charged by accident.
  if (process.env.NODE_ENV !== "production" && key.startsWith("sk_live_")) {
    throw new Error(
      "Refusing to start: a LIVE Stripe key is set outside production. Use sk_test_… locally.",
    );
  }

  return new Stripe(key, {
    // Pinned so a Stripe-side API change can't alter behaviour under us.
    apiVersion: "2026-07-29.dahlia",
    appInfo: { name: "DTLAHappening", version: "0.1.0" },
  });
}

/**
 * Proxied so callers keep writing `stripe.paymentIntents.create(...)`. The
 * alternative — exporting a getter and changing every call site — would put
 * the burden of remembering on whoever adds the next one.
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    client ??= create();
    return Reflect.get(client, prop, receiver === undefined ? client : client);
  },
});

/** Whether the configured key is a test key. Throws if none is set. */
export function isTestMode(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  return key.startsWith("sk_test_");
}
