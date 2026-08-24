"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AttributionToggle({
  organizerId,
  name,
  initial,
}: {
  organizerId: string;
  name: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const change = async (next: boolean) => {
    setOn(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizers?organizerId=${organizerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publiclyAttributed: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Couldn't save.");
      }
      router.refresh();
    } catch (err) {
      setOn(!next); // put the switch back rather than lie about the state
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={(e) => change(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="font-semibold">Show who&apos;s presenting</span>
          <span className="mt-1 block text-sm text-text-muted">
            {on
              ? `Your events show "Presented by ${name}".`
              : "Your events won't name your business publicly."}
          </span>
        </span>
      </label>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
