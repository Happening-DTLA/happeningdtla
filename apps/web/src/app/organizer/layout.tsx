import Link from "next/link";
import { getOrganizerContext } from "@/lib/organizer-context";

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrganizerContext();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 border-b border-border pb-5">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Venue dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {ctx?.organizerName ?? "Not signed in"}
        </h1>
        <nav className="mt-4 flex gap-4 text-sm">
          <Link href="/organizer" className="text-text-muted hover:text-accent">Events</Link>
          <Link href="/organizer/payouts" className="text-text-muted hover:text-accent">Payouts</Link>
          <Link href="/organizer/doors" className="text-text-muted hover:text-accent">Door codes</Link>
        </nav>
      </header>

      {ctx?.unauthenticated ? (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          Development mode — no sign-in required. Add the Clerk keys to
          <code className="mx-1 font-mono">apps/web/.env</code> to turn on real accounts.
        </div>
      ) : null}

      {children}
    </div>
  );
}
