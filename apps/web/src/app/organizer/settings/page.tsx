import { prisma } from "@/lib/prisma";
import { getOrganizerContext } from "@/lib/organizer-context";
import { AttributionToggle } from "./attribution-toggle";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getOrganizerContext();
  if (ctx.status !== "ok") return null;
  if (ctx.role === "DOOR_STAFF") {
    return <p className="text-text-muted">Door staff can&apos;t change venue settings.</p>;
  }

  const org = await prisma.organizer.findUniqueOrThrow({
    where: { id: ctx.organizerId },
    select: { name: true, contactEmail: true, publiclyAttributed: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Venue settings</h2>
        <p className="text-sm text-text-muted">{org.contactEmail}</p>
      </div>
      <AttributionToggle
        organizerId={ctx.organizerId}
        name={org.name}
        initial={org.publiclyAttributed}
      />
    </div>
  );
}
