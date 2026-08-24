import { z } from "zod";
import { connectStatus, createOnboardingLink } from "@/lib/connect";
import { requireOrganizer } from "@/lib/organizer-auth";
import { ok, fail, withErrorBoundary } from "@/lib/api-response";

const Body = z.object({
  action: z.enum(["onboard"]).default("onboard"),
});

/** Where a venue stands with payouts. */
async function handleGET(request: Request): Promise<Response> {
  const auth = await requireOrganizer(request);
  if (!auth.ok) return auth.error;
  return ok(await connectStatus(auth.organizerId));
}

/** Starts (or resumes) Stripe onboarding, or opens their Stripe dashboard. */
async function handlePOST(request: Request): Promise<Response> {
  const auth = await requireOrganizer(request);
  if (!auth.ok) return auth.error;

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail(400, "invalid_request", "Unknown action.");

  try {
    const link = await createOnboardingLink(auth.organizerId);
    return ok(link);
  } catch (err) {
    const message = (err as Error).message ?? "";
    // The most likely first-run failure, and unguessable from a generic 500.
    if (/signed up for Connect/i.test(message)) {
      return fail(
        503,
        "connect_not_enabled",
        "Stripe Connect isn't enabled on the platform account yet. Enable it at dashboard.stripe.com/connect.",
      );
    }
    throw err;
  }
}

export const GET = withErrorBoundary(handleGET, "organizers/connect");
export const POST = withErrorBoundary(handlePOST, "organizers/connect");
