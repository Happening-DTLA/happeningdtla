import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * Is this deployment actually working?
 *
 * Exists because the audit's finding 8 is that failure here is silent: without
 * something to ask, a broken database connection looks identical to a broken
 * app, and both look like a blank 500 to whoever is holding the phone.
 *
 * Reports the SHAPE of configuration, never its contents. Knowing that
 * DATABASE_CA_CERT is present and looks like a PEM is exactly as useful for
 * debugging as seeing the certificate, and safe to leave reachable.
 */
function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/** Strips anything credential-shaped out of a driver error before returning it. */
function safeMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/:\/\/[^@\s]+@/g, "://****@") // user:pass in a connection string
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

export async function GET() {
  const config = {
    DATABASE_URL: present("DATABASE_URL"),
    DATABASE_CA_CERT: present("DATABASE_CA_CERT"),
    DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX?.trim() || null,
    STRIPE_SECRET_KEY: present("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: present("STRIPE_WEBHOOK_SECRET"),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL?.trim() || null,
    CLERK_SECRET_KEY: present("CLERK_SECRET_KEY"),
    RESEND_API_KEY: present("RESEND_API_KEY"),
  };

  // A PEM that arrived with quotes around it, or with its newlines eaten, is
  // the most common way this is misconfigured — and it looks "set" either way.
  const pem = process.env.DATABASE_CA_CERT?.trim() ?? "";
  const cert = pem
    ? {
        startsCorrectly: pem.startsWith("-----BEGIN CERTIFICATE-----"),
        endsCorrectly: pem.endsWith("-----END CERTIFICATE-----"),
        hasNewlines: pem.includes("\n"),
        lines: pem.split("\n").length,
        length: pem.length,
      }
    : null;

  let database: { ok: boolean; ms?: number; error?: string };
  const started = Date.now();
  try {
    await prisma.$queryRaw`select 1`;
    database = { ok: true, ms: Date.now() - started };
  } catch (err) {
    database = { ok: false, ms: Date.now() - started, error: safeMessage(err) };
  }

  return ok({
    ok: database.ok,
    region: process.env.VERCEL_REGION ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    database,
    cert,
    config,
  });
}
