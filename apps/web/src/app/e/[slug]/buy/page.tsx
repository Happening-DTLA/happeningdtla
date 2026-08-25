import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug, remaining } from "@/lib/queries";
import {
  formatCents,
  formatDate,
  formatTimeRange,
  priceBreakdown,
} from "@dtlahappening/core";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

/**
 * Buying a ticket in a browser.
 *
 * This is the path that needs no app store and no install: a link in a text
 * message opens here and ends with tickets in an inbox. Server-rendered down
 * to the payment field so the price, the fee and the remaining count are
 * computed where the database is, not asserted by the client.
 */
export default async function BuyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  const { slug } = await params;
  const { tier: tierId } = await searchParams;

  const event = await getEventBySlug(slug);
  if (!event || event.status !== "PUBLISHED") notFound();

  const tier = event.ticketTypes.find((t) => t.id === tierId && t.isActive);
  if (!tier) notFound();

  const left = remaining(tier);
  const { subtotalCents, serviceFeeCents, totalCents } = priceBreakdown(tier.priceCents);
  const free = tier.priceCents === 0;

  return (
    <article className="mx-auto max-w-lg py-8">
      <Link href={`/e/${event.slug}`} className="font-mono text-xs uppercase tracking-widest text-accent">
        ← {event.title}
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">{tier.name}</h1>
      <p className="mt-1 text-sm text-text-muted">
        {formatDate(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}
      </p>
      <p className="text-sm text-text-muted">{event.venue.name}</p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        {free ? (
          // The checkout endpoint refuses a zero-total order on purpose, so
          // sending someone here would be a dead end. Say the true thing.
          <div className="text-center">
            <p className="text-lg font-semibold text-accent">Free entry</p>
            <p className="mt-1 text-sm text-text-muted">
              No ticket needed — just turn up on the night.
            </p>
            <Link
              href={`/e/${event.slug}`}
              className="mt-4 inline-block text-sm text-accent underline"
            >
              Back to the event
            </Link>
          </div>
        ) : left === 0 ? (
          <div className="text-center">
            <p className="text-lg font-semibold text-danger">Sold out</p>
            <p className="mt-1 text-sm text-text-muted">
              This tier has gone. Other tiers may still be available.
            </p>
            <Link
              href={`/e/${event.slug}`}
              className="mt-4 inline-block text-sm text-accent underline"
            >
              Back to the event
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="font-mono text-xs text-text-muted">
                  {formatCents(subtotalCents)} + {formatCents(serviceFeeCents)} fee
                </p>
                {tier.description && (
                  <p className="mt-1 text-sm text-text-muted">{tier.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className="font-mono text-xl font-bold text-accent">
                  {formatCents(totalCents)}
                </span>
                <span className="block text-[10px] text-text-muted">all-in, each</span>
              </div>
            </div>

            <CheckoutForm
              event={{ id: event.id, slug: event.slug, title: event.title }}
              tier={{
                id: tier.id,
                name: tier.name,
                description: tier.description,
                priceCents: tier.priceCents,
                serviceFeeCents,
                allInCents: totalCents,
                maxPerOrder: tier.maxPerOrder,
                remaining: left,
              }}
            />
          </>
        )}
      </div>
    </article>
  );
}
