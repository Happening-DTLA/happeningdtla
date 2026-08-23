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
  // connection. Providers needing a custom CA should supply it here explicitly.
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const adapter = new PrismaPg({
    connectionString,
    ...(isLocal ? {} : { ssl: true }),
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
