/**
 * Rate limiter tests.
 *
 * The counter is the thing standing between an unauthenticated checkout and a
 * script holding every seat of an event, so it gets the same treatment as the
 * inventory hold: fired at concurrently and checked, rather than read and
 * assumed correct. A limiter that lets ten simultaneous requests all see
 * "count = 1" is worse than none, because it looks like protection.
 *
 * Run: npx tsx scripts/test-rate-limit.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { enforceRateLimit, clientIp, sweepRateLimits } from "../src/lib/rate-limit";

const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error("Refusing to run against a non-local database.");
  process.exit(1);
}

// The suites set this so repeated local runs don't trip a real limit. This
// test is about the limiter itself, so it has to be off.
delete process.env.RATE_LIMIT_DISABLED;

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};
const eq = (label: string, actual: unknown, expected: unknown) =>
  check(label, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);

const run = (subject: string, limit: number, windowSeconds = 600) =>
  enforceRateLimit("test", subject, [{ limit, windowSeconds }]);

async function main() {
  const stamp = Date.now();

  console.log("\n— the limit is the limit —");
  const a = `subject-a-${stamp}`;
  let allowed = 0;
  let denied = 0;
  for (let i = 0; i < 7; i++) {
    const res = await run(a, 5);
    res === null ? allowed++ : denied++;
  }
  eq("exactly 5 allowed", allowed, 5);
  eq("the rest refused", denied, 2);

  console.log("\n— a refusal says when to come back —");
  const res = await run(a, 5);
  check("refused with 429", res?.status === 429, `status ${res?.status}`);
  const retry = Number(res?.headers.get("Retry-After") ?? 0);
  check("Retry-After is a usable number of seconds", retry > 0 && retry <= 600, `${retry}s`);
  const body = res ? await res.json() : null;
  eq("machine-readable code", body?.error?.code, "rate_limited");

  console.log("\n— subjects don't share a bucket —");
  const b = `subject-b-${stamp}`;
  eq("a different subject starts fresh", await run(b, 5), null);

  console.log("\n— windows are independent —");
  // Same subject, a one-second window: the previous window's count must not
  // carry into this one, which is what putting the window in the key buys.
  const c = `subject-c-${stamp}`;
  await run(c, 1, 1);
  check("first window exhausted", (await run(c, 1, 1)) !== null);
  await new Promise((r) => setTimeout(r, 1100));
  eq("next window starts clean", await run(c, 1, 1), null);

  console.log("\n— simultaneous requests cannot all win —");
  // The real test. A read-then-write counter lets every one of these see the
  // same value and pass; only an atomic increment holds the line.
  const d = `subject-d-${stamp}`;
  const LIMIT = 10;
  const results = await Promise.all(Array.from({ length: 40 }, () => run(d, LIMIT)));
  const passed = results.filter((r) => r === null).length;
  eq(`exactly ${LIMIT} of 40 concurrent requests allowed`, passed, LIMIT);

  console.log("\n— an unidentifiable client is not everyone —");
  // Bucketing unknown clients together would let one script exhaust the limit
  // for every buyer at once, which is the outage this prevents.
  eq("null subject is allowed through", await run(null as unknown as string, 1), null);
  eq("still allowed on the second call", await run(null as unknown as string, 1), null);

  console.log("\n— reading the client address —");
  const withXff = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" } });
  eq("takes the first hop", clientIp(withXff), "203.0.113.7");
  eq("falls back to x-real-ip", clientIp(new Request("http://x", { headers: { "x-real-ip": "203.0.113.9" } })), "203.0.113.9");
  eq("null when absent", clientIp(new Request("http://x")), null);

  console.log("\n— spent counters are swept —");
  await prisma.rateLimit.create({
    data: { key: `expired-${stamp}`, count: 1, expiresAt: new Date(Date.now() - 60_000) },
  });
  const swept = await sweepRateLimits();
  check("expired rows deleted", swept >= 1, `${swept} removed`);
  const stillThere = await prisma.rateLimit.findUnique({ where: { key: `expired-${stamp}` } });
  eq("the expired row is gone", stillThere, null);
  const live = await prisma.rateLimit.findFirst({ where: { key: { startsWith: `test:${a}` } } });
  check("a live counter survived the sweep", live !== null);

  // Leave no litter behind.
  await prisma.rateLimit.deleteMany({ where: { key: { contains: String(stamp) } } });

  console.log(failures === 0 ? "\nRate limiting holds.\n" : `\n${failures} FAILED\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main();
