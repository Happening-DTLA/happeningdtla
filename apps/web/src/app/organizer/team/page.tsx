import { getOrganizerContext } from "@/lib/organizer-context";
import { listTeam } from "@/lib/team";
import { TeamPanel } from "./team-panel";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await getOrganizerContext();
  if (ctx.status !== "ok") return null;
  if (ctx.role === "DOOR_STAFF") {
    return <p className="text-text-muted">Door staff can&apos;t manage the team.</p>;
  }

  const { affiliated, doorStaff, invites } = await listTeam(ctx.organizerId);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Team</h2>
        <p className="max-w-prose text-sm leading-relaxed text-text-muted">
          People who run {ctx.organizerName}. Door staff are listed separately —
          they can scan tickets on the night, and nothing else.
        </p>
      </div>

      <TeamPanel
        organizerId={ctx.organizerId}
        viewerRole={ctx.role}
        affiliated={affiliated.map((m) => ({
          id: m.id,
          role: m.role,
          name: m.user.displayName,
          email: m.user.email,
        }))}
        doorStaff={doorStaff.map((m) => ({
          id: m.id,
          role: m.role,
          name: m.user.displayName,
          email: m.user.email,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          token: i.token,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
