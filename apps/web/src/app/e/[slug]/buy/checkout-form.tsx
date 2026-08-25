"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { formatCents, type CheckoutResponse } from "@dtlahappening/core";

export type BuyTier = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  serviceFeeCents: number;
  allInCents: number;
  maxPerOrder: number;
  remaining: number;
};

export type BuyEvent = { id: string; slug: string; title: string };

/** Stripe's own dark theme, pulled toward ours so the card field isn't a white box. */
const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#bef264",
    colorBackground: "#141419",
    colorText: "#f4f4f5",
    colorTextSecondary: "#a1a1aa",
    colorDanger: "#f87171",
    borderRadius: "10px",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
};

/**
 * Guest checkout on the web.
 *
 * Deliberately drives the SAME /api/checkout the phone does. That endpoint
 * already holds the seats with the conditional update that prevents an
 * oversell, records the hold expiry, and hands back a PaymentIntent client
 * secret; the Stripe webhook already fulfils the order idempotently. So the
 * web needs no new server code and, more importantly, no second
 * implementation of the invariants that must not be got wrong twice.
 *
 * Two steps rather than one form: seats are not held until the buyer commits
 * to a quantity, so collecting the email first means an abandoned card form
 * releases inventory on the existing 15-minute expiry rather than never
 * having taken it.
 */
export function CheckoutForm({ event, tier }: { event: BuyEvent; tier: BuyTier }) {
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxQuantity = Math.max(1, Math.min(tier.maxPerOrder, tier.remaining));

  async function startCheckout(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          lines: [{ ticketTypeId: tier.id, quantity }],
          buyerEmail: email.trim(),
          ...(name.trim() ? { buyerName: name.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Couldn't start checkout.");
      }
      const data = json as CheckoutResponse;
      setCheckout(data);
      // Connect direct charges put the PaymentIntent on the VENUE's account,
      // so Stripe.js has to be told which account the client secret belongs
      // to or it cannot resolve it at all.
      setStripePromise(
        loadStripe(
          data.publishableKey,
          data.stripeAccountId ? { stripeAccount: data.stripeAccountId } : undefined,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (checkout && stripePromise) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret: checkout.clientSecret, appearance }}>
        <PayStep checkout={checkout} event={event} quantity={quantity} tier={tier} />
      </Elements>
    );
  }

  return (
    <form onSubmit={startCheckout} className="space-y-5">
      <div>
        <label htmlFor="quantity" className="mb-2 block text-sm font-medium">
          How many?
        </label>
        <select
          id="quantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text"
        >
          {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "ticket" : "tickets"} — {formatCents(tier.allInCents * n)}
            </option>
          ))}
        </select>
        {tier.remaining < 25 && (
          <p className="mt-2 text-xs text-text-muted">{tier.remaining} left at this price</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text placeholder:text-text-muted"
        />
        {/* Says why, because an email box with no explanation reads as a
            mailing-list signup and this one is how the tickets arrive. */}
        <p className="mt-2 text-xs text-text-muted">
          Your tickets are sent here. No account needed.
        </p>
      </div>

      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium">
          Name <span className="text-text-muted">(optional)</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-60"
      >
        {busy ? "Holding your seats…" : `Continue — ${formatCents(tier.allInCents * quantity)}`}
      </button>
      <p className="text-center text-xs text-text-muted">
        Total shown includes all fees. Nothing is added at the end.
      </p>
    </form>
  );
}

function PayStep({
  checkout,
  event,
  tier,
  quantity,
}: {
  checkout: CheckoutResponse;
  event: BuyEvent;
  tier: BuyTier;
  quantity: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ticketsUrl = useMemo(
    () => `/orders/${checkout.orderId}?token=${encodeURIComponent(checkout.accessToken)}`,
    [checkout],
  );

  // The seats are held, not bought. Showing the clock is the honest version of
  // urgency: it is a real deadline the buyer can act on, unlike "few tickets
  // left" with no number behind it.
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((Date.parse(checkout.expiresAt) - Date.now()) / 1000)),
  );
  useEffect(() => {
    const t = setInterval(
      () => setSecondsLeft(Math.max(0, Math.floor((Date.parse(checkout.expiresAt) - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(t);
  }, [checkout.expiresAt]);

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      // Wallets and bank redirects leave the page and come back here; cards
      // resolve in place, which `if_required` keeps on this tab.
      confirmParams: { return_url: `${window.location.origin}${ticketsUrl}` },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "That payment didn't go through.");
      setBusy(false);
      return;
    }

    // Paid. The webhook issues the tickets; the order page reads them back by
    // token, which is the only credential a guest buyer has.
    router.push(ticketsUrl);
  }

  const expired = secondsLeft === 0;

  return (
    <form onSubmit={pay} className="space-y-5">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-text-muted">
            {quantity} × {tier.name}
          </span>
          <span className="font-mono font-bold text-accent">
            {formatCents(checkout.totalCents)}
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-text-muted">
          {formatCents(checkout.subtotalCents)} + {formatCents(checkout.serviceFeeCents)} fee ·{" "}
          {event.title}
        </p>
      </div>

      <p className={`text-center font-mono text-xs ${expired ? "text-danger" : "text-text-muted"}`}>
        {expired
          ? "Your hold expired — these seats are back on sale."
          : `Seats held for ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
      </p>

      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || busy || expired}
        className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-60"
      >
        {busy ? "Paying…" : expired ? "Hold expired" : `Pay ${formatCents(checkout.totalCents)}`}
      </button>

      {expired && (
        <a
          href={`/e/${event.slug}`}
          className="block text-center text-sm text-accent underline"
        >
          Start again
        </a>
      )}
    </form>
  );
}
