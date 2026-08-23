#!/usr/bin/env node
/**
 * One-command local database.
 *
 * `npx prisma dev` gives us a real Postgres 17 with no Docker and no Homebrew,
 * but it picks its ports dynamically, so the connection string is different on
 * every machine (and after some restarts). Hardcoding it in .env.example would
 * hand the next developer a string that doesn't work.
 *
 * So: start the server, read back whatever URL it chose, make sure our database
 * exists, and write the result into .env. Idempotent — safe to re-run any time.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = "dtlahappening";
const DB = "dtlahappening";
const SHADOW_DB = "dtlahappening_shadow";

function sh(cmd) {
  return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

console.log("→ starting local Postgres (prisma dev)…");
let out = "";
try {
  out = sh(`npx prisma dev --detach --name ${SERVER}`);
} catch (err) {
  out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
}

// Strip ANSI + terminal hyperlink escapes before matching.
const clean = out.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x07\x1b]*(\x07|\x1b\\)/g, "");
const match = clean.match(/postgres:\/\/[^\s"']+/);
if (!match) {
  console.error("Could not determine the dev database URL. Raw output:\n" + clean);
  process.exit(1);
}

const base = new URL(match[0]);
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";

const client = new pg.Client({ connectionString: adminUrl.toString() });
await client.connect();
for (const name of [DB, SHADOW_DB]) {
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (rowCount === 0) {
    // template0 avoids "source database is being accessed by other users".
    await client.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
    console.log(`→ created database ${name}`);
  }
}
await client.end();

const urlFor = (name) => {
  const u = new URL(base);
  u.pathname = `/${name}`;
  return u.toString();
};

const envPath = join(root, ".env");
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const upsert = (text, key, value) => {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(text) ? text.replace(re, line) : `${text.replace(/\n*$/, "\n")}${line}\n`;
};

let next = existing;
next = upsert(next, "DATABASE_URL", urlFor(DB));
next = upsert(next, "SHADOW_DATABASE_URL", urlFor(SHADOW_DB));
writeFileSync(envPath, next);

console.log(`→ .env updated\n   DATABASE_URL = ${urlFor(DB)}`);
console.log("\nNext:  npm run db:migrate   then   npm run db:seed");
