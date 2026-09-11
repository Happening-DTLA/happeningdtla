import Link from "next/link";
import {
  formatCents,
  VENDOR_CATEGORY_LABELS,
  VENDOR_PAYMENT_WINDOW_HOURS,
  type VendorCategory,
} from "@dtlahappening/core";
import { listVendorSubmissions, countVendorSubmissionsByStatus } from "@/lib/queries";

/**
 * The vendor review queue.
 *
 * Same reason the artist queue exists: a submission that only announces itself
 * by email is invisible whenever email is failing, which is currently always.
 *
 * The three prose answers are shown in full rather than truncated. They are
 * the entire basis for a decision — what you sell, how it looks on a table,
 * why you rather than the next applicant — and a review page that hides them
 * behind "read more" is a review page nobody reviews on.
 */
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "border-accent/50 text-accent",
  IN_REVIEW: "border-border text-text-muted",
  APPROVED: "border-accent/50 text-accent",
  CONFIRMED: "border-accent/50 text-accent",
  DECLINED: "border-danger/40 text-danger",
  WITHDRAWN: "border-border text-text-muted",
  EXPIRED: "border-danger/40 text-danger",
};

const laDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });

/** Market dates are calendar dates — format in UTC or the Thursday slips a day. */
const marketDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const [submissions, counts] = await Promise.all([
    listVendorSubmissions({ status }),
    countVendorSubmissionsByStatus(),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/admin/vendors"
          className={`rounded-full border px-3 py-1 ${
            status ? "border-border text-text-muted" : "border-accent/50 text-accent"
          }`}
        >
          All {total}
        </Link>
        {Object.entries(counts).map(([key, count]) => (
          <Link
            key={key}
            href={`/admin/vendors?status=${key}`}
            className={`rounded-full border px-3 py-1 ${
              status === key ? "border-accent/50 text-accent" : "border-border text-text-muted"
            }`}
          >
            {key.replace("_", " ").toLowerCase()} {count}
          </Link>
        ))}
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            {total === 0
              ? "No vendor applications yet. They appear here the moment one is made — this page reads the database directly and does not depend on email."
              : "No applications with that status."}
          </p>
        </div>
      ) : null}

      {submissions.map((s) => (
        <article key={s.id} className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">{s.businessName}</h2>
              <p className="mt-1 text-sm text-text-muted">
                {VENDOR_CATEGORY_LABELS[s.category as VendorCategory]} · {s.firstName} {s.lastName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${
                  STATUS_STYLES[s.status] ?? "border-border text-text-muted"
                }`}
              >
                {s.status.replace("_", " ").toLowerCase()}
              </span>
              <time
                dateTime={s.createdAt.toISOString()}
                className="text-xs text-text-muted"
                suppressHydrationWarning
              >
                {laDate(s.createdAt)}
              </time>
            </div>
          </div>

          {/* An approval that is not paid for holds nothing. Surfaced here so
              the deadline is visible to the person who set it running. */}
          {s.status === "APPROVED" && s.payBy ? (
            <p className="mt-3 rounded border border-accent/40 bg-accent/10 p-2 text-xs text-accent">
              Approved — payment due by {laDate(s.payBy)} (
              {VENDOR_PAYMENT_WINDOW_HOURS}h window). The space is not held until it is paid.
            </p>
          ) : null}

          <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-text-muted">Email</dt>
              <dd>
                <a href={`mailto:${s.email}`} className="text-accent hover:underline">
                  {s.email}
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-muted">Phone</dt>
              <dd>
                <a href={`tel:${s.phone}`} className="text-accent hover:underline">
                  {s.phone}
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-muted">Socials</dt>
              <dd className="break-all">{s.socials}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-muted">Website</dt>
              <dd className="break-all">{s.website}</dd>
            </div>
          </dl>

          <ul className="mt-4 space-y-1">
            {s.markets.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2 text-sm"
              >
                <span>
                  {m.market.name}{" "}
                  <span className="text-text-muted">· {m.market.venueName}</span>
                </span>
                <span className="text-text-muted">
                  {marketDate(m.market.date)} ·{" "}
                  {formatCents(m.market.priceCents + m.market.feeCents)} ·{" "}
                  {m.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
                What they sell
              </p>
              <p className="mt-1 whitespace-pre-wrap">{s.merchandise}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
                How they present it
              </p>
              <p className="mt-1 whitespace-pre-wrap">{s.presentation}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
                What makes them stand out
              </p>
              <p className="mt-1 whitespace-pre-wrap">{s.standout}</p>
            </div>
          </div>

          {s.photos.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {s.photos.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-border px-2 py-1 text-xs text-accent hover:underline"
                >
                  Photo
                </a>
              ))}
            </div>
          ) : null}

          <p className="mt-4 text-xs text-text-muted">
            Consented {laDate(s.consentAt)} · {s.smsConsent ? "opted in to SMS" : "no SMS"}
          </p>
        </article>
      ))}
    </div>
  );
}
