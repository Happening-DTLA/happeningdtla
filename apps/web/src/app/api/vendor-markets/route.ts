import { ok } from "@/lib/api-response";
import { listVendorMarkets } from "@/lib/queries";
import { toApiVendorMarket } from "@/lib/dto";
import { expireUnpaidFees } from "@/lib/participation-fees";

/**
 * Markets a vendor can apply to.
 *
 * Public and unauthenticated, like the event listings — someone deciding
 * whether to apply should not have to identify themselves first. Past markets
 * are excluded on the Los Angeles calendar date rather than on a timestamp,
 * so a market running until 10pm is still listed at 9pm on the night.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  /**
   * Release overdue booths before counting what is left.
   *
   * The same move checkout makes with `releaseExpiredHolds()`, and for the
   * same reason: a market that only LOOKS full should not stay that way until
   * the next scheduled sweep. That matters more here than there, because the
   * scheduled sweep is daily — Vercel's Hobby plan permits no more than one
   * cron run per day — so without this a booth released at hour 72 could sit
   * invisible for most of a day while somebody else is told the market is
   * fully booked.
   *
   * Best-effort. Listing markets must not fail because a sweep did.
   */
  await expireUnpaidFees().catch(() => {});

  const markets = await listVendorMarkets();
  return ok(markets.map(toApiVendorMarket));
}
