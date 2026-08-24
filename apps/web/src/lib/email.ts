import { Resend } from "resend";

/**
 * Transactional email.
 *
 * Degrades on purpose: with no RESEND_API_KEY set, emails are logged to the
 * server console instead of sent — including the ticket link, so local
 * development works without anyone signing up for a provider. The moment a key
 * exists, real mail goes out with no code change.
 *
 * Provider-agnostic by design; `send` is the only function that knows about
 * Resend, so swapping to Postmark or SES touches one place.
 */
const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

/**
 * `onboarding@resend.dev` works with no domain setup but can only deliver to
 * the address that owns the Resend account — fine for testing, useless for
 * real buyers. Set EMAIL_FROM to an address on a verified domain before
 * selling anything.
 */
// `??` is wrong here. A commented-out or blank env var is an EMPTY STRING,
// not undefined, so it sails past a nullish check and the provider rejects
// "The domain is invalid" — which reads like a config problem somewhere else
// entirely. Treat blank as unset.
const FROM = process.env.EMAIL_FROM?.trim() || "DTLAHappening <onboarding@resend.dev>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function send(message: EmailMessage): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) {
    console.log(
      [
        "",
        "──────── EMAIL (not sent — RESEND_API_KEY is not set) ────────",
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "──────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { sent: false, reason: "no_api_key" };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) {
      // The most common misconfiguration by far: pointing EMAIL_FROM at an
      // address on a domain you don't control. Gmail and the like will always
      // be refused — sending as someone else's domain is what spam does.
      if (/domain is not verified/i.test(error.message ?? "")) {
        console.error(
          `[email] ${error.message}\n` +
            `        EMAIL_FROM is "${FROM}". Either leave EMAIL_FROM empty to use\n` +
            `        Resend's shared sender (delivers only to your account address),\n` +
            `        or verify a domain you own and send from that.`,
        );
      } else {
        console.error("[email] provider rejected the message", error);
      }
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send threw", err);
    return { sent: false, reason: (err as Error).message };
  }
}
