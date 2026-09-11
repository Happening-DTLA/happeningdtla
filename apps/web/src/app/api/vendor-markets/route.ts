import { ok } from "@/lib/api-response";
import { listVendorMarkets } from "@/lib/queries";
import { toApiVendorMarket } from "@/lib/dto";

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
  const markets = await listVendorMarkets();
  return ok(markets.map(toApiVendorMarket));
}
