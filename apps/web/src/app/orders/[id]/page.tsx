import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCents, formatDate, formatTicketCode, formatTime } from "@dtlahappening/core";

export const dynamic = "force-dynamic";

/**
 * A buyer's tickets on the web.
 *
 * This is what the confirmation email links to, and it is the reason guest
 * checkout is safe: the tickets are recoverable from any device, not only the
 * phone that bought them.
 *
 * Access is by the order's token — the same rule as the API. A wrong token
 * 404s rather than 403s, so the page can't be used to confirm which order ids
 * exist.
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      event: { include: { venue: true } },
      tickets: { include: { ticketType: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!order || order.accessToken !== token) notFound();

  // Rendered server-side as inline SVG: no client JavaScript, and the codes
  // stay visible if the page is saved or printed.
  const qrs = await Promise.all(
    order.tickets.map((t) =>
      QRCode.toString(t.code, {
        type: "svg",
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      }),
    ),
  );

  const paid = order.status === "PAID";

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">
        {paid ? "Your tickets" : `Order ${order.status.toLowerCase()}`}
      </p>
      <h1 className="text-3xl font-bold leading-tight tracking-tight">{order.event.title}</h1>
      <p className="mt-2 text-text-muted">
        {formatDate(order.event.startsAt)} · {formatTime(order.event.startsAt)}
      </p>
      <p className="text-text-muted">
        {order.event.venue.name} · {order.event.venue.address1}
      </p>

      {!paid ? (
        <div className="mt-8 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-text-muted">
            {order.status === "PENDING"
              ? "This order hasn't been paid yet. If you just paid, refresh in a moment."
              : "This order was cancelled, so it has no tickets."}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-8 space-y-5">
            {order.tickets.map((ticket, i) => (
              <li
                key={ticket.id}
                className={`rounded-2xl border bg-surface p-5 ${
                  ticket.checkedInAt ? "border-border opacity-60" : "border-accent"
                }`}
              >
                <div className="mb-4 flex items-baseline justify-between">
                  <span className="font-semibold">{ticket.ticketType.name}</span>
                  <span className="text-xs text-text-muted">
                    {i + 1} of {order.tickets.length}
                  </span>
                </div>

                {/* White plate: scanners need the quiet zone and the contrast. */}
                <div
                  className="mx-auto w-full max-w-[240px] rounded-lg bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qrs[i] }}
                />

                {/* Printed too, so a dim or cracked screen can still be read out. */}
                <p className="mt-3 text-center font-mono text-sm tracking-widest text-text-muted">
                  {formatTicketCode(ticket.code)}
                </p>

                {ticket.checkedInAt ? (
                  <p className="mt-2 text-center text-xs font-semibold text-text-muted">
                    Checked in at {formatTime(ticket.checkedInAt)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex justify-between text-text-muted">
              <span>Tickets</span>
              <span className="font-mono">{formatCents(order.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Service fee</span>
              <span className="font-mono">{formatCents(order.serviceFeeCents)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
              <span>Paid</span>
              <span className="font-mono">{formatCents(order.totalCents)}</span>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-text-muted">
            Keep this link — it&apos;s how you get back to these tickets on any device.
          </p>
        </>
      )}
    </main>
  );
}
