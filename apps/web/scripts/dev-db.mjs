#!/usr/bin/env node
/**
 * One-command local database.
 *
 * `npx prisma dev` gives us a real Postgres 17 with no Docker and no Homebrew,
 * but it picks its ports dynamically, so the connection string differs per
 * machine and after some restarts. Hardcoding it in .env.example would hand the
 * next developer a string that doesn't work.
 *
 * IMPORTANT: `prisma dev` runs TWO servers — a main database and a separate
 * shadow database on another port — and its TCP endpoints IGNORE the database
 * name in the connection string, always serving `template1`. So you cannot make
 * a shadow database by changing the path; pointing both at the same port gives
 * you one database wearing two names, and `prisma migrate dev` then fails with
 * P3005 ("schema is not empty") because it finds tables in its own shadow.
 *
 * Both real URLs are encoded in the api_key that `prisma dev ls` prints, so we
 * decode them from there rather than guessing ports.
 *
 * Idempotent — safe to re-run any time.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = "dtlahappening";

const sh = (cmd) => {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    return `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
};

const stripAnsi = (s) =>
  s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x07\x1b]*(\x07|\x1b\\)/g, "");

console.log("→ starting local Postgres (prisma dev)…");
sh(`npx prisma dev --detach --name ${SERVER}`);

// The listing prints the api_key twice: once in full inside an OSC-8 terminal
// hyperlink, and once truncated ("eyJk...AifQ") as the visible label. Match on
// the RAW output before stripping escapes, and keep the longest hit — stripping
// first throws away the only complete copy.
const rawListing = sh("npx prisma dev ls");
const apiKey = [...rawListing.matchAll(/api_key=([A-Za-z0-9_-]+)/g)]
  .map((m) => m[1])
  .sort((a, b) => b.length - a.length)[0];

if (!apiKey || apiKey.length < 40) {
  console.error("Could not read the dev server listing. Raw output:\n" + stripAnsi(rawListing));
  process.exit(1);
}

const padded = apiKey + "=".repeat((4 - (apiKey.length % 4)) % 4);
const decoded = JSON.parse(Buffer.from(padded, "base64url").toString("utf8"));

// Strip the tuning query string; keep just the connection.
const clean = (u) => (u ? u.split("?")[0] + "?sslmode=disable" : undefined);
const databaseUrl = clean(decoded.databaseUrl);
const shadowDatabaseUrl = clean(decoded.shadowDatabaseUrl);

if (!databaseUrl || !shadowDatabaseUrl) {
  console.error("Dev server did not report both a database and a shadow database URL.");
  process.exit(1);
}

const envPath = join(root, ".env");
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const upsert = (text, key, value) => {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(text) ? text.replace(re, line) : `${text.replace(/\n*$/, "\n")}${line}\n`;
};

let next = existing;
next = upsert(next, "DATABASE_URL", databaseUrl);
next = upsert(next, "SHADOW_DATABASE_URL", shadowDatabaseUrl);
writeFileSync(envPath, next);

console.log(`→ .env updated`);
console.log(`   DATABASE_URL        = ${databaseUrl}`);
console.log(`   SHADOW_DATABASE_URL = ${shadowDatabaseUrl}`);
console.log("\nNext:  npm run db:migrate   then   npm run db:seed");
