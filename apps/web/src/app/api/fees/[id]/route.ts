import { ok, fail } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import {
  chargeParticipationFee,
  FeeError,
  toApiFee,
} from "@/lib/participation-fees";

/**
 * One fee: what is owed, and how to pay it.
 *
 * The access token is required on both verbs. A cuid id is unguessable enough
 * to be a primary key and not enough to be a credential, and this endpoint
 * both reveals an amount owed and starts a payment — the same reasoning that
 * put an accessToken on Order.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return fail(401, "token_required", "This link is incomplete.");

  const fee = await prisma.participationFee.findUnique({
    where: { id },
    select: {
      id: true, kind: true, status: true, accessToken: true,
      advertisedCents: true, processingCents: true, totalCents: true, payBy: true,
    },
  });

  // Same answer for "no such fee" and "wrong token", so this cannot be used to
  // discover which ids exist.
  if (!fee || fee.accessToken !== token) {
    return fail(404, "not_found", "That payment link isn't valid.");
  }
  return ok(toApiFee(fee));
}

/** Starts payment. Returns a client secret for Stripe's sheet. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return fail(401, "token_required", "This link is incomplete.");

  try {
    const { clientSecret, stripeAccountId } = await chargeParticipationFee(id, token);
    return ok({
      clientSecret,
      stripeAccountId,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    });
  } catch (err) {
    if (err instanceof FeeError) {
      const status = err.code === "not_found" ? 404 : err.code === "organizer_not_ready" ? 503 : 409;
      return fail(status, err.code, err.message);
    }
    throw err;
  }
}
