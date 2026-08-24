import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { listTeam, createInvite, acceptInvite, peekInvite, removeMember, TeamError } from "../src/lib/team";

let failures = 0;
const check = (l: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? ` — ${d}` : ""}`);
  if (!ok) failures++;
};

async function main() {
  const org = await prisma.organizer.findFirstOrThrow({ where: { members: { some: {} } } });
  console.log(`\n  ${org.name}\n`);

  console.log("— door staff are not counted as affiliated —");
  const before = await listTeam(org.id);
  check("team splits into affiliated vs door staff",
        Array.isArray(before.affiliated) && Array.isArray(before.doorStaff),
        `${before.affiliated.length} affiliated, ${before.doorStaff.length} door`);
  check("no DOOR_STAFF appears as affiliated",
        before.affiliated.every((m) => m.role !== "DOOR_STAFF"));
  check("door staff still listed, just separately",
        before.doorStaff.every((m) => m.role === "DOOR_STAFF"));

  console.log("\n— invitations —");
  const invite = await createInvite({ organizerId: org.id, email: "New.Person@Example.com", role: "MANAGER" });
  check("invite created with an unguessable token", invite.token.length >= 32);
  check("email normalised", invite.email === "new.person@example.com", invite.email);

  const peeked = await peekInvite(invite.token);
  check("invite readable before acceptance", peeked?.organizer.name === org.name);

  const dupe = await createInvite({ organizerId: org.id, email: "new.person@example.com", role: "DOOR_STAFF" });
  const stale = await peekInvite(invite.token);
  check("re-inviting supersedes the old link", stale === null && dupe.token !== invite.token);

  const user = await prisma.user.create({
    data: { email: `invitee-${Date.now()}@dtlahappening.test`, displayName: "Invitee" },
  });
  const accepted = await acceptInvite(dupe.token, user.id);
  check("accepting joins the business", accepted.organizerId === org.id);

  const member = await prisma.organizerMember.findFirstOrThrow({ where: { organizerId: org.id, userId: user.id } });
  check("joined with the invited role", member.role === "DOOR_STAFF", member.role);

  const after = await listTeam(org.id);
  check("new door staff does NOT appear as affiliated",
        after.affiliated.length === before.affiliated.length,
        `${after.affiliated.length} affiliated`);
  check("they do appear under door staff", after.doorStaff.length === before.doorStaff.length + 1);

  try {
    await acceptInvite(dupe.token, user.id);
    check("an invite works only once", false, "it was accepted twice");
  } catch (e) {
    check("an invite works only once", (e as TeamError).code === "invite_invalid");
  }

  console.log("\n— you can't orphan a business —");
  const owners = await prisma.organizerMember.findMany({ where: { organizerId: org.id, role: "OWNER" } });
  if (owners.length === 1) {
    try {
      await removeMember(org.id, owners[0].id);
      check("refuses to remove the last owner", false, "it removed them");
    } catch (e) {
      check("refuses to remove the last owner", (e as TeamError).code === "last_owner");
    }
  } else {
    check("refuses to remove the last owner", true, `(${owners.length} owners — skipped)`);
  }

  await prisma.organizerMember.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organizerInvite.deleteMany({ where: { email: "new.person@example.com" } });

  console.log(failures === 0 ? "\n  Team and invitations work.\n" : `\n  ${failures} FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
}
main().finally(() => prisma.$disconnect());
