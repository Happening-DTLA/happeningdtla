import { redirect } from "next/navigation";
import { peekInvite } from "@/lib/team";
import { AcceptInvite } from "./accept-invite";

export const dynamic = "force-dynamic";

const ROLE_BLURB: Record<string, string> = {
  OWNER: "full access, including payouts",
  MANAGER: "create events and see sales, but not payouts",
  DOOR_STAFF: "scan tickets at the door — no sales, payouts or settings",
};

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await peekInvite(token);

  if (!invite) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">This invitation isn&apos;t valid</h1>
        <p className="mt-2 text-text-muted">
          It may have been used, revoked, or expired. Ask for a new one.
        </p>
      </main>
    );
  }

  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/join/${token}`);

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Invitation</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Join {invite.organizer.name}</h1>
      <p className="mt-3 text-text-muted">
        You&apos;ve been invited as <span className="text-text">{invite.role.replace("_", " ").toLowerCase()}</span> —{" "}
        {ROLE_BLURB[invite.role]}.
      </p>
      {/* Named plainly rather than buried: someone accepting should know what
          they're getting access to before they click. */}
      <div className="mt-6">
        <AcceptInvite token={token} organizerName={invite.organizer.name} />
      </div>
    </main>
  );
}
