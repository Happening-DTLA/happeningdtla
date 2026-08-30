import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Run `npm run db:start` for a local database.");
  }

  // The local dev server speaks plaintext; hosted Postgres (Supabase, Neon, RDS)
  // requires TLS. Note we do NOT blanket-disable certificate verification — on a
  // payments app that would silently accept a man-in-the-middle on the database
  // connection. Providers needing a custom CA supply it through
  // DATABASE_CA_CERT, as a PEM.
  //
  // Supabase needs this: its Postgres is served under a private root ("Supabase
  // Root 2021 CA") that is not in any public trust store, so verification fails
  // with "self-signed certificate in certificate chain" until the root is
  // provided. Download it from the project's Database settings. It is a public
  // certificate, not a secret — but it belongs in configuration rather than in
  // the source, because it is per-provider and it expires.
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const ca = process.env.DATABASE_CA_CERT?.trim() || undefined;

  if (!isLocal && !ca && process.env.NODE_ENV === "production") {
    // Loud rather than silent: without a CA this either fails to connect or,
    // worse, someone "fixes" it by turning verification off.
    console.warn(
      "[prisma] DATABASE_CA_CERT is not set. A hosted database with a private " +
        "root will refuse to verify. Set it to the provider's CA in PEM form.",
    );
  }
  const adapter = new PrismaPg({
    connectionString,
    // A ticket on-sale is a thundering herd: hundreds of people tap Buy in the
    // same few seconds, and the pool becomes the bottleneck long before the
    // database does.
    //
    // The default is deliberately low because local development runs behind
    // the `prisma dev` proxy, which is fragile under concurrency: past a
    // handful of connections it closes them (P1017) and can corrupt protocol
    // state (08P01 "bind message supplies N parameters"). The Postgres behind
    // it allows 100. Raise DATABASE_POOL_MAX in production, where the ceiling
    // is the real database or its pgBouncer rather than this proxy.
    // `||` not `??`: a blank env var is an empty string, and Number("") is 0,
    // which would configure a pool that can never hand out a connection.
    max: Number(process.env.DATABASE_POOL_MAX?.trim() || 6),
    // `ssl: true` means verify against the system trust store. With a CA it
    // verifies against that instead. Neither path accepts an unverified cert.
    ...(isLocal ? {} : { ssl: ca ? { ca } : true }),
  });

  return new PrismaClient({ adapter });
}

/**
 * Built on first query rather than at module load, for the same reason as the
 * Stripe client: `next build` imports every route to collect page data, so a
 * throw at module scope makes the app unbuildable whenever DATABASE_URL is
 * absent — every CI run, every preview deploy, every fresh clone. The missing
 * variable is a runtime problem, and it should announce itself at runtime.
 *
 * The development-time cache on globalThis is kept: without it, hot reload
 * opens a new pool on every edit until Postgres refuses connections.
 */
function resolveClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const created = createPrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = created;
  return created;
}

let client: PrismaClient | null = null;

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    client ??= resolveClient();
    return Reflect.get(client, prop, client);
  },
});
