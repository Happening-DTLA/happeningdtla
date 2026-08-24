"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateBusiness() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [attributed, setAttributed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/organizers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contactEmail: contactEmail.trim(), publiclyAttributed: attributed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't create the business.");
      router.push("/organizer");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
      >
        Set up a business
      </button>
    );
  }

  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim());

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="text-text-muted">Business or venue name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nightshade Hospitality"
          className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text"
        />
      </label>
      <label className="block text-sm">
        <span className="text-text-muted">Contact email</span>
        <input
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="bookings@yourvenue.com"
          inputMode="email"
          autoCapitalize="none"
          className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text"
        />
      </label>

      {/* The "if they want that to be known" case — some venues host under a
          promoter's brand and would rather not be named. */}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={attributed}
          onChange={(e) => setAttributed(e.target.checked)}
          className="mt-1"
        />
        <span className="text-text-muted">
          Show <span className="text-text">&quot;Presented by {name.trim() || "your business"}&quot;</span> on
          your events. Turn this off to stay unnamed publicly.
        </span>
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={!valid || busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:bg-surface-2 disabled:text-text-muted"
      >
        {busy ? "Creating…" : "Create business"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
