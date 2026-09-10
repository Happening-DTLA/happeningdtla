import { z } from "zod";
import {
  ENTERTAINER_FEE_PREFERENCES,
  ENTERTAINER_FEE_LABELS,
  VOLUNTEER_ROLES,
  VOLUNTEER_ROLE_LABELS,
  VOLUNTEER_MIN_AGE,
  type EntertainerFeePreference,
  type VolunteerRole,
} from "@dtlahappening/core";
import { prisma } from "@/lib/prisma";
import { send } from "@/lib/email";

const FEE_VALUES = ENTERTAINER_FEE_PREFERENCES.map((f) => f.value) as [
  EntertainerFeePreference,
  ...EntertainerFeePreference[],
];
const ROLE_VALUES = VOLUNTEER_ROLES.map((r) => r.value) as [VolunteerRole, ...VolunteerRole[]];

const REVIEW_INBOX = process.env.SUBMISSIONS_EMAIL?.trim() || "info@dtlaartnight.com";

/** Shared shape: both forms open with the same four contact fields. */
const contact = {
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email(),
  phone: z.string().trim().min(7).max(40),
};

// ---------------------------------------------------------------------------
// Entertainment
// ---------------------------------------------------------------------------

export const EntertainmentSubmissionBody = z.object({
  ...contact,
  actName: z.string().trim().min(1).max(120),
  performanceType: z.string().trim().max(200).optional().nullable(),
  // Free text rather than a URL: their form's own label is "Instagram, you
  // tube or other", and people answer it with a handle.
  links: z.string().trim().min(1).max(400),
  promoImageUrl: z.url(),
  feePreference: z.enum(FEE_VALUES),
  feeNote: z.string().trim().max(500).optional().nullable(),
  consent: z.literal(true, { message: "Consent is required to submit." }),
});

export type EntertainmentSubmissionBody = z.infer<typeof EntertainmentSubmissionBody>;

export async function createEntertainmentSubmission(input: EntertainmentSubmissionBody) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  const submission = await prisma.entertainmentSubmission.create({
    data: {
      userId: user?.id ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      actName: input.actName,
      performanceType: input.performanceType ?? null,
      links: input.links,
      promoImageUrl: input.promoImageUrl,
      feePreference: input.feePreference,
      // Only kept when it means something. Storing a note against "Volunteer"
      // would put an answer on the record that nobody gave.
      feeNote: input.feePreference === "OTHER" ? (input.feeNote ?? null) : null,
      consentAt: new Date(),
    },
  });

  // Deliberately NOT changed to a performer profile type. There is no
  // PERFORMER type, and quietly turning somebody into an ARTIST because they
  // play the trumpet would show them the wrong module.
  await send({
    to: REVIEW_INBOX,
    subject: `Entertainment submission — ${submission.actName}`,
    ...body([
      `${submission.actName} — ${ENTERTAINER_FEE_LABELS[submission.feePreference as EntertainerFeePreference]}`,
      "",
      `Contact:  ${submission.firstName} ${submission.lastName}`,
      `Email:    ${submission.email}`,
      `Phone:    ${submission.phone}`,
      `Links:    ${submission.links}`,
      `Performs: ${submission.performanceType || "not given"}`,
      submission.feeNote ? `Fee note: ${submission.feeNote}` : "",
      "",
      `Promo photo: ${submission.promoImageUrl}`,
      "",
      `Submission id: ${submission.id}`,
    ]),
  });

  return submission;
}

// ---------------------------------------------------------------------------
// Volunteers
// ---------------------------------------------------------------------------

export const VolunteerSubmissionBody = z.object({
  ...contact,
  bestTimeToReach: z.string().trim().min(1).max(200),
  roles: z.array(z.enum(ROLE_VALUES)).min(1, "Pick at least one role."),
  // Their form establishes this with a photo of a government ID. We ask
  // instead — see VOLUNTEER_ID_NOTE in core. A literal rather than a boolean:
  // "false" is not a volunteer application, it is a decline.
  isAdult: z.literal(true, { message: `Volunteers must be ${VOLUNTEER_MIN_AGE} or over.` }),
  consent: z.literal(true, { message: "Consent is required to submit." }),
});

export type VolunteerSubmissionBody = z.infer<typeof VolunteerSubmissionBody>;

export async function createVolunteerSubmission(input: VolunteerSubmissionBody) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  const submission = await prisma.volunteerSubmission.create({
    data: {
      userId: user?.id ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      bestTimeToReach: input.bestTimeToReach,
      roles: input.roles,
      isAdult: input.isAdult,
      consentAt: new Date(),
    },
  });

  await send({
    to: REVIEW_INBOX,
    subject: `Volunteer sign-up — ${submission.firstName} ${submission.lastName}`,
    ...body([
      `${submission.firstName} ${submission.lastName}`,
      "",
      `Email:    ${submission.email}`,
      `Phone:    ${submission.phone}`,
      `Best time to reach: ${submission.bestTimeToReach}`,
      "",
      "ROLES",
      ...submission.roles.map((r) => `  - ${VOLUNTEER_ROLE_LABELS[r as VolunteerRole]}`),
      "",
      `Confirmed ${VOLUNTEER_MIN_AGE} or over. ID is checked in person on the night — the app does not collect one.`,
      "",
      `Submission id: ${submission.id}`,
    ]),
  });

  return submission;
}

/** Plain text and an escaped <pre>, the same shape the other notifications use. */
function body(lines: string[]): { text: string; html: string } {
  const text = lines.filter((l) => l !== "").join("\n");
  return {
    text,
    html: `<pre style="font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
  };
}
