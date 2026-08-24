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
const FROM = process.env.EMAIL_FROM ?? "DTLAHappening <onboarding@resend.dev>";

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
      console.error("[email] provider rejected the message", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send threw", err);
    return { sent: false, reason: (err as Error).message };
  }
}
