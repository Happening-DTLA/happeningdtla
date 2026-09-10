import Link from "next/link";
import { formatCents } from "@dtlahappening/core";
import { prisma } from "@/lib/prisma";
import { PayForm } from "./pay-form";

/**
 * Where a payment link lands.
 *
 * The token is required and the answer for a bad token is identical to the
 * answer for a missing fee — otherwise this page tells anybody with a guessed
 * id whether it exists, and how much somebody owes.
 *
 * The fee is read server-side rather than fetched, so the amount is on the
 * page before any JavaScript runs. Somebody opening a payment link on a phone
 * in bad signal should at least see what they owe.
 */
export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; paid?: string }>;
}) {
  const { id } = await params;
  const { token, paid } = await searchParams;

  const fee = token
    ? await prisma.participationFee.findUnique({
        where: { id },
        select: {
          id: true,
          kind: true,
          status: true,
          accessToken: true,
          advertisedCents: true,
          processingCents: true,
          totalCents: true,
          payBy: true,
          vendorSubmissionMarket: {
            select: { market: { select: { name: true, venueName: true, date: true } } },
          },
        },
      })
    : null;

  if (!fee || fee.accessToken !== token) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-danger">Not available</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">This link isn&apos;t valid</h1>
        <p className="mt-4 text-sm text-text-muted">
          It may have been mistyped, or the link may have been replaced by a newer one. Check the
          most recent email, or get in touch.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-accent hover:underline">
          Back to the site
        </Link>
      </main>
    );
  }

  const market = fee.vendorSubmissionMarket?.market;

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        {fee.kind === "VENDOR_BOOTH" ? "Vendor booth" : "Artist submission"}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">
        {market ? market.name : "DTLA Art Night"}
      </h1>
      {market ? (
        <p className="mt-1 text-sm text-text-muted">
          {/* A calendar date — formatted in UTC, or the first Thursday of the
              month renders as a Wednesday. */}
          {market.date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })}{" "}
          · {market.venueName}
        </p>
      ) : null}

      {/* Stripe redirects back here after a successful card. The webhook is
          what actually settles the fee, and it may not have landed yet — so
          this says "we've got it", not "you're confirmed". */}
      {paid && fee.status !== "PAID" ? (
        <p className="mt-6 rounded border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
          Payment received — we&apos;re confirming it now. You&apos;ll get an email shortly. It&apos;s
          safe to close this page.
        </p>
      ) : null}

      {fee.payBy && fee.status === "PENDING" ? (
        <p className="mt-6 text-sm text-text-muted">
          Due by{" "}
          {fee.payBy.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "America/Los_Angeles",
          })}
          . Your space isn&apos;t held until payment arrives.
        </p>
      ) : null}

      <div className="mt-6">
        <PayForm
          fee={{
            id: fee.id,
            kind: fee.kind,
            status: fee.status,
            advertisedCents: fee.advertisedCents,
            processingCents: fee.processingCents,
            totalCents: fee.totalCents,
            payBy: fee.payBy ? fee.payBy.toISOString() : null,
          }}
          token={token!}
        />
      </div>

      <p className="mt-8 text-center text-xs text-text-muted">
        {formatCents(fee.advertisedCents)} goes to the organisers; the rest is card processing.
      </p>
    </main>
  );
}
