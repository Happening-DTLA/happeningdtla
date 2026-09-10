import Link from "next/link";
import { getAdminContext } from "@/lib/admin-auth";

/**
 * Platform admin — Art Night itself, not a venue.
 *
 * Separate from /organizer on purpose. The venue dashboard is scoped to one
 * organizer and everything under it filters by that id; the things here belong
 * to the network as a whole and have no organizer to scope to. Mixing them
 * would mean a venue owner's session could reach network-wide data by URL.
 *
 * The guard sits here rather than in proxy.ts for the same reason the
 * organizer guard does: a matcher that routes differently than expected fails
 * open, and this page shows people's home addresses.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();

  if (ctx.status === "denied") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-danger">Not available</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Platform admin</h1>
        <p className="mt-4 text-sm text-text-muted">
          {ctx.reason === "signed-out"
            ? "Sign in with an Art Night organiser account to review submissions."
            : ctx.reason === "unconfigured"
              ? "No platform administrators are configured. Set ADMIN_EMAILS in the environment to a comma-separated list of organiser email addresses."
              : "This account isn't a platform administrator."}
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-accent hover:underline">
          Back to the site
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 border-b border-border pb-5">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Platform admin</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">DTLA Art Night</h1>
        <nav className="mt-4 flex gap-4 text-sm">
          <Link href="/admin/submissions" className="text-text-muted hover:text-accent">
            Artist submissions
          </Link>
          <Link href="/organizer" className="text-text-muted hover:text-accent">
            Venue dashboard
          </Link>
        </nav>
      </header>

      {ctx.unauthenticated ? (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          Development mode — no sign-in required. Set the Clerk keys and
          <code className="mx-1 font-mono">ADMIN_EMAILS</code>
          in <code className="mx-1 font-mono">apps/web/.env</code> before deploying this route.
        </div>
      ) : null}

      {children}
    </div>
  );
}
