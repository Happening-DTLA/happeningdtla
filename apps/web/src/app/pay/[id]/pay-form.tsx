"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { formatCents } from "@dtlahappening/core";

export type FeeView = {
  id: string;
  kind: string;
  status: string;
  advertisedCents: number;
  processingCents: number;
  totalCents: number;
  payBy: string | null;
};

/**
 * Paying a participation fee.
 *
 * The charge lives on the organisers' connected account, so Stripe.js has to
 * be told which account the client secret belongs to or it cannot resolve it
 * at all — the same reason checkout-form.tsx passes `stripeAccount`.
 *
 * Nothing here decides whether the fee is paid. The webhook does that. This
 * screen's job ends at "the card went through"; if the browser closes between
 * the two, `payment_intent.succeeded` still settles it.
 */
export function PayForm({ fee, token }: { fee: FeeView; token: string }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const appearance = useMemo(
    () =>
      ({
        theme: "night" as const,
        variables: {
          colorPrimary: "#bef264",
          colorBackground: "#141419",
          colorText: "#f4f4f5",
          borderRadius: "2px",
        },
      }) as const,
    [],
  );

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/fees/${fee.id}?token=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't start payment.");
      setClientSecret(body.clientSecret);
      setStripePromise(
        loadStripe(
          body.publishableKey,
          body.stripeAccountId ? { stripeAccount: body.stripeAccountId } : undefined,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [fee.id, token]);

  if (fee.status === "PAID") {
    return <Done title="Already paid" body="Nothing more to do — this is settled." />;
  }
  if (fee.status === "EXPIRED") {
    return (
      <Done
        title="This window closed"
        body="The space was released because payment wasn't received in time. Get in touch if you'd still like to take part."
      />
    );
  }

  if (clientSecret && stripePromise) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
        <CardForm total={fee.totalCents} />
      </Elements>
    );
  }

  return (
    <div className="space-y-4">
      <Breakdown fee={fee} />
      {error ? (
        <p className="rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>
      ) : null}
      <button
        onClick={start}
        disabled={busy}
        className="w-full rounded-sm bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-50"
      >
        {busy ? "Starting…" : `Pay ${formatCents(fee.totalCents)}`}
      </button>
    </div>
  );
}

function Breakdown({ fee }: { fee: FeeView }) {
  /**
   * What the payer is charged on top — NOT `fee.processingCents`.
   *
   * Those are different numbers and both are correct. `processingCents` is
   * what Stripe will deduct, at its real 2.9%, and it is what reconciliation
   * needs. The charge itself was grossed up at the organisers' round 3%, so
   * the two differ by a few cents — which on a printed breakdown means
   * $35 + $1.36 shown against $36.40 charged. A payer who adds up the column
   * and gets a different answer than the button has been given a reason to
   * distrust the whole page over four cents.
   */
  const chargedOnTop = fee.totalCents - fee.advertisedCents;

  return (
    <dl className="rounded border border-border bg-surface p-4 text-sm">
      <div className="flex justify-between py-1">
        <dt className="text-text-muted">
          {fee.kind === "VENDOR_BOOTH" ? "Booth fee" : "Submission fee"}
        </dt>
        <dd>{formatCents(fee.advertisedCents)}</dd>
      </div>
      <div className="flex justify-between py-1">
        <dt className="text-text-muted">Card processing</dt>
        <dd>{formatCents(chargedOnTop)}</dd>
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
        <dt>Total</dt>
        <dd>{formatCents(fee.totalCents)}</dd>
      </div>
    </dl>
  );
}

function CardForm({ total }: { total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${window.location.pathname}?paid=1` },
    });

    // Only card errors and validation land here; anything else redirects.
    if (stripeError) {
      setError(stripeError.message ?? "That payment didn't go through.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {error ? (
        <p className="rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={!stripe || busy}
        className="w-full rounded-sm bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-50"
      >
        {busy ? "Paying…" : `Pay ${formatCents(total)}`}
      </button>
    </form>
  );
}

function Done({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-border bg-surface p-6 text-center">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-text-muted">{body}</p>
    </div>
  );
}
