import { ok } from "@/lib/api-response";

/**
 * Public client configuration.
 *
 * The Stripe publishable key is safe to expose — that is its purpose — but
 * serving it here rather than duplicating it into the mobile app's own .env
 * keeps one source of truth. Two copies of a key is two chances to have a test
 * key in one place and a live key in the other.
 */
export async function GET() {
  return ok({
    // Blank means unset, not a usable key.
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null,
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || null,
  });
}
