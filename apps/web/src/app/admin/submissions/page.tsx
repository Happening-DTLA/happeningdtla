import Image from "next/image";
import Link from "next/link";
import { formatCents, needsCustomQuote, CUSTOM_QUOTE_LIMITS } from "@dtlahappening/core";
import { listArtistSubmissions, countSubmissionsByStatus } from "@/lib/queries";

/**
 * The artist review queue.
 *
 * This page exists because a submission is currently invisible. `send()`
 * swallows its own failures so the API returns 200 whether or not the
 * notification went anywhere, and with the sending domain unverified none of
 * them go anywhere at all. That is not a temporary state worth waiting out:
 * even once mail works, a send that fails later fails exactly as quietly. The
 * database is the record; email is a convenience on top of it.
 */
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "border-accent/50 text-accent",
  IN_REVIEW: "border-border text-text-muted",
  APPROVED: "border-accent/50 text-accent",
  DECLINED: "border-danger/40 text-danger",
  WITHDRAWN: "border-border text-text-muted",
};

/**
 * Whether this URL is an image we put in our own bucket.
 *
 * `next/image` does not skip an unconfigured host, it throws — which renders
 * as a 500 for the whole route. One artwork row with an unexpected URL would
 * therefore hide every other submission in the queue, which is the opposite of
 * what a review page is for. Anything not from our storage is shown as a link
 * rather than fetched and rendered: it also means a row written outside the
 * upload path can never make this page load a stranger's server.
 */
function isStoredImage(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".supabase.co") &&
      u.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}

function Thumb({ url, alt, size }: { url: string; alt: string; size: number }) {
  if (!isStoredImage(url)) {
    return (
      <span
        style={{ height: size, width: size }}
        className="flex shrink-0 items-center justify-center rounded border border-border text-center font-mono text-[9px] leading-tight text-text-muted"
        title={url}
      >
        no
        <br />
        preview
      </span>
    );
  }
  return (
    <Image
      src={url}
      alt={alt}
      width={size}
      height={size}
      className="rounded object-cover"
      style={{ height: size, width: size }}
    />
  );
}

function inches(a: { heightIn: number | null; widthIn: number | null; depthIn: number | null }) {
  const parts = [a.heightIn, a.widthIn, a.depthIn].filter((n): n is number => typeof n === "number");
  return parts.length ? `${parts.join(" × ")} in` : "size not given";
}

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const [submissions, counts] = await Promise.all([
    listArtistSubmissions({ status }),
    countSubmissionsByStatus(),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/admin/submissions"
          className={`rounded-full border px-3 py-1 ${
            status ? "border-border text-text-muted" : "border-accent/50 text-accent"
          }`}
        >
          All {total}
        </Link>
        {Object.entries(counts).map(([key, count]) => (
          <Link
            key={key}
            href={`/admin/submissions?status=${key}`}
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
              ? "No artist submissions yet. They appear here the moment one is made — this page reads the database directly and does not depend on email."
              : "No submissions with that status."}
          </p>
        </div>
      ) : null}

      {submissions.map((s) => {
        const value = s.artworks.reduce((sum, a) => sum + a.priceCents, 0);
        const oversized = s.artworks.filter(needsCustomQuote);

        return (
          <article key={s.id} className="rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  {s.firstName} {s.lastName}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {s.artworks.length} {s.artworks.length === 1 ? "piece" : "pieces"}
                  {value > 0 ? ` · ${formatCents(value)} total` : null}
                  {s.media.length ? ` · ${s.media.join(", ")}` : null}
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
                  {s.createdAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "America/Los_Angeles",
                  })}
                </time>
              </div>
            </div>

            {/* Contact first: the point of reviewing is to reply. */}
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
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-text-muted">Address</dt>
                <dd>
                  {[s.address1, s.address2, s.city, s.state, s.zip].filter(Boolean).join(", ")}
                </dd>
              </div>
            </dl>

            {oversized.length ? (
              <p className="mt-4 rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
                {oversized.length} {oversized.length === 1 ? "piece is" : "pieces are"} over{" "}
                {CUSTOM_QUOTE_LIMITS.heightIn}in tall, {CUSTOM_QUOTE_LIMITS.widthIn}in wide or{" "}
                {CUSTOM_QUOTE_LIMITS.weightLb}lb — quote installation separately.
              </p>
            ) : null}

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {s.artworks.map((a) => (
                <li key={a.id} className="flex gap-3 rounded border border-border p-2">
                  <a href={a.imageUrl} target="_blank" rel="noreferrer" className="shrink-0">
                    <Thumb url={a.imageUrl} alt={a.title} size={72} />
                  </a>
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{a.title}</p>
                    {a.medium ? <p className="text-xs text-text-muted">{a.medium}</p> : null}
                    <p className="text-xs text-text-muted">
                      {inches(a)}
                      {a.weightLb ? ` · ${a.weightLb}lb` : null}
                    </p>
                    <p className="mt-0.5 text-xs">
                      {a.priceCents === 0 ? "NFS" : formatCents(a.priceCents)}
                      {needsCustomQuote(a) ? (
                        <span className="ml-1 text-danger">· custom quote</span>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {s.portfolioImages.length ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-text-muted hover:text-accent">
                  Portfolio ({s.portfolioImages.length})
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.portfolioImages.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <Thumb url={url} alt="Portfolio piece" size={64} />
                    </a>
                  ))}
                </div>
              </details>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
