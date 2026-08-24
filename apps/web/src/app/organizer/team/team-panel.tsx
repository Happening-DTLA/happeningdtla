"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "OWNER" | "MANAGER" | "DOOR_STAFF";
interface Member { id: string; role: Role; name: string | null; email: string }
interface Invite { id: string; email: string; role: Role; token: string; expiresAt: string }

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  DOOR_STAFF: "Door staff",
};

export function TeamPanel({
  organizerId,
  viewerRole,
  affiliated,
  doorStaff,
  invites,
}: {
  organizerId: string;
  viewerRole: Role;
  affiliated: Member[];
  doorStaff: Member[];
  invites: Invite[];
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("DOOR_STAFF");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshLink, setFreshLink] = useState<{ link: string; emailed: boolean } | null>(null);
  const router = useRouter();

  const invite = async () => {
    setBusy(true);
    setError(null);
    setFreshLink(null);
    try {
      const res = await fetch(`/api/organizers/team?organizerId=${organizerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't send that invitation.");
      setFreshLink({ link: body.link, emailed: body.emailed });
      setEmail("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (memberId: string) => {
    const res = await fetch(`/api/organizers/team?organizerId=${organizerId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Couldn't remove them.");
      return;
    }
    router.refresh();
  };

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const Row = ({ m }: { m: Member }) => (
    <li className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
      <span>
        <span className="font-medium">{m.name ?? m.email}</span>
        {m.name ? <span className="ml-2 text-text-muted">{m.email}</span> : null}
      </span>
      <span className="flex items-center gap-3">
        <span className="text-text-muted">{ROLE_LABEL[m.role]}</span>
        <button
          type="button"
          onClick={() => remove(m.id)}
          className="text-xs text-text-muted hover:text-danger"
        >
          Remove
        </button>
      </span>
    </li>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted">
          Runs this business
        </h3>
        <ul className="space-y-2">
          {affiliated.map((m) => <Row key={m.id} m={m} />)}
        </ul>
      </section>

      {doorStaff.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted">
            Door staff
          </h3>
          {/* Kept apart deliberately: someone working one door for one night
              isn't affiliated with the venue, and listing them alongside the
              owners would overstate the relationship. */}
          <p className="text-xs text-text-muted">
            Can scan tickets. Never sees sales, payouts, or settings.
          </p>
          <ul className="space-y-2">
            {doorStaff.map((m) => <Row key={m.id} m={m} />)}
          </ul>
        </section>
      ) : null}

      {invites.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted">Pending</h3>
          <ul className="space-y-2">
            {invites.map((i) => (
              <li key={i.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{i.email}</span>
                  <span className="text-text-muted">{ROLE_LABEL[i.role]}</span>
                </div>
                <code className="mt-1 block truncate text-xs text-text-muted">
                  {`${typeof window !== "undefined" ? window.location.origin : ""}/join/${i.token}`}
                </code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 font-semibold">Invite someone</h3>
        <div className="flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="them@example.com"
            inputMode="email"
            autoCapitalize="none"
            className="min-w-[14rem] flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text"
          >
            <option value="DOOR_STAFF">Door staff</option>
            <option value="MANAGER">Manager</option>
            {/* Only an owner can create another; the server enforces it too. */}
            {viewerRole === "OWNER" ? <option value="OWNER">Owner</option> : null}
          </select>
          <button
            type="button"
            onClick={invite}
            disabled={!valid || busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:bg-surface-2 disabled:text-text-muted"
          >
            {busy ? "Inviting…" : "Invite"}
          </button>
        </div>

        {freshLink ? (
          <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
            <p className="font-medium">
              {freshLink.emailed ? "Invitation emailed." : "Invitation ready — send them this link."}
            </p>
            {/* Shown even when emailed, because email is best-effort and a link
                you can text is more reliable than one that might be in spam. */}
            <code className="mt-1 block break-all text-xs text-text-muted">{freshLink.link}</code>
          </div>
        ) : null}

        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </section>
    </div>
  );
}
