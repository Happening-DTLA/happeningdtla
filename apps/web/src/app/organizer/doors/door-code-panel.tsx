"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Existing {
  id: string;
  pairingCode: string;
  claimed: boolean;
  deviceLabel: string | null;
  lastSeenAt: string | null;
}

export function DoorCodePanel({
  eventId,
  organizerId,
  existing,
  atLimit,
}: {
  eventId: string;
  organizerId: string;
  existing: Existing[];
  atLimit: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const router = useRouter();

  const mint = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/door/sessions?organizerId=${organizerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't create a code.");
      setFresh(body.pairingCode);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {fresh ? (
        <div className="rounded-xl border border-accent bg-accent/10 p-4 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">New door code</p>
          <p className="my-2 font-mono text-4xl font-bold tracking-[0.2em]">{fresh}</p>
          <p className="text-xs text-text-muted">
            Read this to the door person. It works once, on one phone.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={mint}
        disabled={busy || atLimit}
        className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:bg-surface-2 disabled:text-text-muted"
      >
        {busy ? "Creating…" : atLimit ? "Phone limit reached" : "Create a door code"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {existing.length > 0 ? (
        <div>
          <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">
            Active phones
          </h3>
          <ul className="space-y-2">
            {existing.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="font-mono">{s.pairingCode}</span>
                <span className="text-text-muted">
                  {s.claimed ? `Paired${s.deviceLabel ? ` · ${s.deviceLabel}` : ""}` : "Not used yet"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
