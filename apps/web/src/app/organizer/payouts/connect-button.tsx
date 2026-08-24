"use client";

import { useState } from "react";

/**
 * Account Links are single-use and expire in minutes, so the URL is fetched on
 * click rather than rendered into the page — a link generated at page load is
 * often dead by the time someone presses it.
 */
export function ConnectButton({
  connected,
  live,
  organizerId,
}: {
  connected: boolean;
  live: boolean;
  organizerId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizers/connect?organizerId=${organizerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "onboard" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't start onboarding.");
      window.location.href = body.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-60"
      >
        {busy ? "Opening Stripe…" : live ? "Update details on Stripe" : connected ? "Finish setting up" : "Connect payouts"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
