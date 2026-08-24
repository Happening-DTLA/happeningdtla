import { getOrganizerContext } from "@/lib/organizer-context";
import { connectStatus } from "@/lib/connect";
import { ConnectButton } from "./connect-button";

export const dynamic = "force-dynamic";

/** Turns Stripe's requirement keys into something a venue owner can act on. */
const REQUIREMENT_LABELS: Record<string, string> = {
  "business_profile.url": "A website or social page for the venue",
  "business_profile.mcc": "What kind of business this is",
  "external_account": "A bank account for payouts",
  "individual.verification.document": "A photo of your ID",
  "company.verification.document": "A business verification document",
  "company.tax_id": "Your EIN",
  "individual.id_number": "Your SSN or ITIN",
  "tos_acceptance.date": "Accepting Stripe's terms",
};

export default async function PayoutsPage() {
  const ctx = await getOrganizerContext();
  if (!ctx) return <p className="text-text-muted">Sign in to manage payouts.</p>;
  if (ctx.role === "DOOR_STAFF") {
    return <p className="text-text-muted">Door staff can&apos;t manage payouts.</p>;
  }

  let status: Awaited<ReturnType<typeof connectStatus>> | null = null;
  let error: string | null = null;
  try {
    status = await connectStatus(ctx.organizerId);
  } catch (err) {
    error = (err as Error).message;
  }

  const live = status?.connected && status.organizer.chargesEnabled;
  const outstanding = status?.requirements?.currentlyDue ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Getting paid</h2>
        <p className="max-w-prose text-sm leading-relaxed text-text-muted">
          Ticket money goes straight into your own Stripe account, minus the
          service fee. We never hold it. You&apos;ll enter your business details on
          Stripe&apos;s own pages — they don&apos;t pass through us.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              live ? "bg-accent" : status?.connected ? "bg-yellow-500" : "bg-text-muted"
            }`}
          />
          <span className="font-semibold">
            {live
              ? "Connected — you're taking payments"
              : status?.connected
                ? "Started, not finished"
                : "Not connected"}
          </span>
        </div>

        {!live ? (
          <p className="mt-2 text-sm text-text-muted">
            {status?.connected
              ? "Stripe still needs a few things before money can move."
              : "Until this is done, ticket sales for your events are handled by the platform account rather than paid to you directly."}
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            Payouts {status?.organizer.payoutsEnabled ? "are enabled" : "are not enabled yet"}.
          </p>
        )}

        {outstanding.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-text-muted">
            {outstanding.map((r) => (
              <li key={r}>• {REQUIREMENT_LABELS[r] ?? r}</li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-danger">
            {/^.*signed up for Connect.*$/i.test(error)
              ? "Stripe Connect isn't enabled on the platform account yet. Enable it at dashboard.stripe.com/connect."
              : error}
          </p>
        ) : null}

        <div className="mt-4">
          <ConnectButton connected={Boolean(status?.connected)} live={Boolean(live)} organizerId={ctx.organizerId} />
        </div>
      </div>

      <p className="max-w-prose text-xs leading-relaxed text-text-muted">
        Stripe verifies every business before releasing money, which takes days
        and occasionally asks for more. Event tickets are also treated as
        higher risk than ordinary retail, because people pay weeks before the
        night — so Stripe may hold a reserve or delay payouts until after the
        event. Worth starting early.
      </p>
    </div>
  );
}
