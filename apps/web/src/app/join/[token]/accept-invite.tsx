"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInvite({ token, organizerName }: { token: string; organizerName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/organizers/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't accept.");
      router.push("/organizer");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={accept}
        disabled={busy}
        className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-60"
      >
        {busy ? "Joining…" : `Join ${organizerName}`}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
