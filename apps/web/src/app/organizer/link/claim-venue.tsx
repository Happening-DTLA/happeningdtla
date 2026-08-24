"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimVenue({ venues }: { venues: { id: string; name: string }[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const claim = async (organizerId: string) => {
    setBusy(organizerId);
    setError(null);
    try {
      const res = await fetch("/api/organizers/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't link this account.");
      router.push("/organizer");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      {venues.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => claim(v.id)}
          disabled={busy !== null}
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-left hover:border-accent disabled:opacity-60"
        >
          <span className="font-semibold">{v.name}</span>
          {busy === v.id ? <span className="ml-2 text-sm text-text-muted">linking…</span> : null}
        </button>
      ))}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
