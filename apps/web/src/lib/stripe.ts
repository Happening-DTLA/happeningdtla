import Stripe from "stripe";

/**
 * Server-side Stripe client. NEVER import this into anything the client
 * bundles — it carries the secret key.
 */
const key = process.env.STRIPE_SECRET_KEY;

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

export const stripe = new Stripe(key, {
  // Pinned so a Stripe-side API change can't alter behaviour under us.
  apiVersion: "2026-07-29.dahlia",
  appInfo: { name: "DTLAHappening", version: "0.1.0" },
});

export const isTestMode = key.startsWith("sk_test_");
