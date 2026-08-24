import { formatCents, formatDate, formatTicketCode, formatTime } from "@dtlahappening/core";
import type { EmailMessage } from "@/lib/email";

export interface OrderConfirmationData {
  orderId: string;
  accessToken: string;
  buyerEmail: string;
  buyerName: string | null;
  eventTitle: string;
  eventStartsAt: Date;
  venueName: string;
  venueAddress: string;
  totalCents: number;
  tickets: { code: string; tierName: string }[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The email that makes guest checkout safe.
 *
 * Without it, tickets exist only on the device that bought them — lose the
 * phone, lose the tickets, with no way to look them up. The link carries the
 * order's access token, so it is the recovery path from any device.
 *
 * Codes are included as text as well as behind the link, because a buyer at a
 * door with no signal can still read one aloud.
 */
export function orderConfirmationEmail(
  data: OrderConfirmationData,
  appUrl: string,
): EmailMessage {
  const link = `${appUrl.replace(/\/$/, "")}/orders/${data.orderId}?token=${data.accessToken}`;
  const when = `${formatDate(data.eventStartsAt)} at ${formatTime(data.eventStartsAt)}`;
  const count = data.tickets.length;
  const noun = count === 1 ? "ticket" : "tickets";
  const greeting = data.buyerName ? `Hi ${data.buyerName},` : "Hi,";

  const text = [
    greeting,
    "",
    `You're going to ${data.eventTitle}.`,
    "",
    when,
    `${data.venueName}, ${data.venueAddress}`,
    "",
    `View your ${noun}:`,
    link,
    "",
    `Your ${noun}:`,
    ...data.tickets.map((t) => `  ${t.tierName} — ${formatTicketCode(t.code)}`),
    "",
    `Total paid: ${formatCents(data.totalCents)}`,
    "",
    "Keep this email. The link above is how you get back to your tickets on any",
    "device, and the codes work at the door even if your phone has no signal.",
    "",
    "— DTLAHappening",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0a0c;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <p style="margin:0 0 24px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#bef264">You're going</p>
    <h1 style="margin:0 0 8px;font-size:26px;line-height:1.2;color:#f4f4f5">${esc(data.eventTitle)}</h1>
    <p style="margin:0;color:#a1a1aa;font-size:15px">${esc(when)}</p>
    <p style="margin:2px 0 28px;color:#a1a1aa;font-size:15px">${esc(data.venueName)}, ${esc(data.venueAddress)}</p>

    <a href="${esc(link)}" style="display:block;background:#bef264;color:#0a0a0c;text-decoration:none;text-align:center;padding:15px;border-radius:10px;font-weight:700;font-size:16px">View your ${count} ${noun}</a>

    <div style="margin:28px 0;border:1px solid #2a2a34;border-radius:12px;padding:16px;background:#141419">
      <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#a1a1aa">Your ${noun}</p>
      ${data.tickets
        .map(
          (t) =>
            `<p style="margin:0 0 6px;font-size:14px;color:#f4f4f5">${esc(t.tierName)} <span style="font-family:ui-monospace,Menlo,monospace;color:#a1a1aa;letter-spacing:1px">${esc(formatTicketCode(t.code))}</span></p>`,
        )
        .join("")}
      <p style="margin:12px 0 0;padding-top:10px;border-top:1px solid #2a2a34;font-size:14px;color:#a1a1aa">Total paid <span style="float:right;color:#f4f4f5">${formatCents(data.totalCents)}</span></p>
    </div>

    <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.6">Keep this email. The link is how you get back to your tickets on any device, and the codes work at the door even if your phone has no signal.</p>
    <p style="margin:24px 0 0;color:#52525b;font-size:12px">DTLAHappening · Downtown Los Angeles</p>
  </div>
</body></html>`;

  return { to: data.buyerEmail, subject: `Your ${noun} for ${data.eventTitle}`, html, text };
}
