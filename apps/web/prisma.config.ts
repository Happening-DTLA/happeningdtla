import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // Prisma needs a scratch database to diff migrations against. Locally this
    // is created for us by scripts/dev-db.mjs; on hosted Postgres where the app
    // user can't CREATE DATABASE, set it explicitly.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
