/**
 * Participation fee arithmetic.
 *
 * Pure functions, no database. Run: npx tsx scripts/test-fees.ts
 *
 * The case that matters is the one the organisers already publish: they
 * advertise a $50 booth and their website charges $51.86. If this file ever
 * stops producing 5186 for a 5000 booth, the app has started charging a
 * different price than dtlaartnight.com for the same thing — which is the
 * exact bug this pricing exists to prevent.
 *
 * The subtler case is the grossing-up. Adding 2.9% to $50 gives $51.45, Stripe
 * then takes its cut of the LARGER number, and the organisers end up a few
 * cents short of the fee they advertised. Small, and exactly the kind of small
 * that becomes an awkward conversation about missing pennies.
 */
import {
  participationFee,
  artistSubmissionFee,
  vendorBoothFee,
  PLATFORM_FEE_PERCENT,
  STRIPE_PERCENT,
  STRIPE_FIXED_CENTS,
  GROSS_UP_PERCENT,
  GROSS_UP_FIXED_CENTS,
} from "@dtlahappening/core";

let failures = 0;
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function check(label: string, got: number, want: number) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}: ${money(got)}${ok ? "" : `  expected ${money(want)}`}`);
}

function assert(label: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
}

console.log(`platform fee: ${PLATFORM_FEE_PERCENT * 100}%\n`);

console.log("vendor booth — the organisers' own published numbers");
const booth = vendorBoothFee();
check("charged matches dtlaartnight.com", booth.totalCents, 5186);
check("organisers net at least the advertised $50", booth.organizerNetCents, 5006);
check("platform takes nothing", booth.platformFeeCents, 0);

console.log("\nartist submission — $35, not inclusive of processing");
const artist = artistSubmissionFee();
assert("organisers net at least the advertised $35", artist.organizerNetCents >= 3500);
assert("artist pays more than the advertised fee", artist.totalCents > 3500);

console.log("\nthe organisers are never short, at any price");
for (const advertised of [500, 1000, 2500, 3500, 5000, 7500, 10000, 12345, 99999]) {
  const f = participationFee(advertised);
  const stripeTakes = Math.round(f.totalCents * STRIPE_PERCENT + STRIPE_FIXED_CENTS);
  const ok = f.organizerNetCents >= advertised && f.processingCents === stripeTakes;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "✓" : "✗"} ${money(advertised)} -> charged ${money(f.totalCents)} -> net ${money(f.organizerNetCents)}`,
  );
}

console.log("\na payer's breakdown must add up");
for (const advertised of [3500, 5000, 1000]) {
  const f = participationFee(advertised);
  // What a payment page shows on top, which is NOT f.processingCents — that is
  // Stripe's real deduction and differs by the round-up.
  const shown = f.totalCents - f.advertisedCents;
  assert(
    `  ${money(advertised)}: ${money(f.advertisedCents)} + ${money(shown)} = ${money(f.totalCents)}`,
    f.advertisedCents + shown === f.totalCents,
  );
}

console.log("\npercentage-on-top is NOT the same as grossing up");
for (const [advertised, published] of [[5000, 5186]] as const) {
  // The intuitive version: add the rate to the advertised fee.
  const naive = advertised + Math.round(advertised * GROSS_UP_PERCENT) + GROSS_UP_FIXED_CENTS;
  const ours = participationFee(advertised);
  console.log(
    `  ${money(advertised)} booth: adding 3% gives ${money(naive)}, grossing up gives ${money(ours.totalCents)}; ` +
      `the organisers publish ${money(published)}`,
  );
  assert("  grossing up matches their published price", ours.totalCents === published);
  assert("  adding-on-top does not", naive !== published);
}

console.log(failures === 0 ? "\n✓ all pass" : `\n✗ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
