import { z } from "zod";
import {
  ART_MEDIA,
  MAX_ARTWORKS,
  MAX_PORTFOLIO_IMAGES,
  needsCustomQuote,
} from "@dtlahappening/core";
import { prisma } from "@/lib/prisma";
import { send } from "@/lib/email";

/**
 * Validation for an artist application.
 *
 * Mirrors the organisers' form, including the parts that look odd out of
 * context: socials and website are required strings rather than URLs because
 * their form asks for "NA" when the artist has none, and rejecting that would
 * turn a deliberate answer into an error.
 */
export const ArtistSubmissionBody = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email(),
  phone: z.string().trim().min(7).max(40),

  address1: z.string().trim().min(1).max(160),
  address2: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(2).max(40),
  zip: z.string().trim().min(3).max(12),

  socials: z.string().trim().min(1).max(400),
  website: z.string().trim().min(1).max(400),

  media: z.array(z.enum(ART_MEDIA)).min(1, "Pick at least one medium."),

  portfolioImages: z.array(z.url()).max(MAX_PORTFOLIO_IMAGES),

  artworks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        medium: z.string().trim().max(80).optional().nullable(),
        heightIn: z.number().positive().max(600).optional().nullable(),
        widthIn: z.number().positive().max(600).optional().nullable(),
        depthIn: z.number().positive().max(600).optional().nullable(),
        weightLb: z.number().positive().max(5000).optional().nullable(),
        // Zero is allowed: not-for-sale is a real answer, and forcing a
        // number would put a fictional price on the wall.
        priceCents: z.number().int().min(0).max(100_000_00),
        imageUrl: z.url(),
      }),
    )
    // At least one, because the invoice is per piece and a submission with
    // nothing in it is not an application.
    .min(1, "Add at least one piece.")
    .max(MAX_ARTWORKS),

  consent: z.literal(true, { message: "Consent is required to submit." }),
});

export type ArtistSubmissionBody = z.infer<typeof ArtistSubmissionBody>;

/**
 * Records an application and tells the organisers about it.
 *
 * Linked to a user account when the email already belongs to one, and left
 * unlinked otherwise — the same guest-first path checkout uses, so an artist
 * is never made to create an account before they can apply. Submitting also
 * marks that account as an artist, because applying is the clearest possible
 * statement of what someone is here to do.
 */
export async function createArtistSubmission(body: ArtistSubmissionBody) {
  const email = body.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, profileType: true } });

  const submission = await prisma.artistSubmission.create({
    data: {
      userId: user?.id ?? null,
      firstName: body.firstName,
      lastName: body.lastName,
      email,
      phone: body.phone,
      address1: body.address1,
      address2: body.address2 ?? null,
      city: body.city,
      state: body.state,
      zip: body.zip,
      socials: body.socials,
      website: body.website,
      media: body.media,
      portfolioImages: body.portfolioImages,
      consentAt: new Date(),
      artworks: {
        create: body.artworks.map((a, position) => ({
          title: a.title,
          medium: a.medium ?? null,
          heightIn: a.heightIn ?? null,
          widthIn: a.widthIn ?? null,
          depthIn: a.depthIn ?? null,
          weightLb: a.weightLb ?? null,
          priceCents: a.priceCents,
          imageUrl: a.imageUrl,
          position,
        })),
      },
    },
    include: { artworks: { orderBy: { position: "asc" } } },
  });

  if (user && user.profileType === "ATTENDEE") {
    await prisma.user.update({ where: { id: user.id }, data: { profileType: "ARTIST" } });
  }

  // Told, not queried. Nobody is going to poll a table, and a submission the
  // organisers never hear about is the same as one that was never made.
  await notifyOrganisers(submission);

  return submission;
}

type SubmissionWithArtworks = Awaited<ReturnType<typeof createArtistSubmission>>;

const REVIEW_INBOX = process.env.SUBMISSIONS_EMAIL?.trim() || "info@dtlaartnight.com";

async function notifyOrganisers(s: SubmissionWithArtworks) {
  const money = (cents: number) =>
    cents === 0 ? "NFS" : `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const size = (a: SubmissionWithArtworks["artworks"][number]) => {
    const parts = [a.heightIn, a.widthIn, a.depthIn].filter((n): n is number => typeof n === "number");
    return parts.length ? `${parts.join(" × ")} in` : "not given";
  };

  const oversized = s.artworks.filter(needsCustomQuote);
  const lines = s.artworks.map(
    (a, i) =>
      `${i + 1}. ${a.title}${a.medium ? ` — ${a.medium}` : ""}\n` +
      `   ${size(a)} · ${money(a.priceCents)}${needsCustomQuote(a) ? " · NEEDS CUSTOM QUOTE" : ""}\n` +
      `   ${a.imageUrl}`,
  );

  const text = [
    `${s.firstName} ${s.lastName} — ${s.artworks.length} ${s.artworks.length === 1 ? "piece" : "pieces"}`,
    "",
    `Email:    ${s.email}`,
    `Phone:    ${s.phone}`,
    `Address:  ${[s.address1, s.address2, s.city, s.state, s.zip].filter(Boolean).join(", ")}`,
    `Socials:  ${s.socials}`,
    `Website:  ${s.website}`,
    `Media:    ${s.media.join(", ")}`,
    "",
    oversized.length
      ? `${oversized.length} piece${oversized.length === 1 ? "" : "s"} over 4ft tall, 3ft wide or 50lb — quote installation separately.`
      : "No pieces over the standard placement limits.",
    "",
    "SUBMITTED WORK",
    ...lines,
    "",
    `PORTFOLIO (${s.portfolioImages.length})`,
    ...s.portfolioImages,
    "",
    `Submission id: ${s.id}`,
  ].join("\n");

  await send({
    to: REVIEW_INBOX,
    subject: `Artist submission — ${s.firstName} ${s.lastName} (${s.artworks.length} ${s.artworks.length === 1 ? "piece" : "pieces"})`,
    text,
    html: `<pre style="font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
  });
}
