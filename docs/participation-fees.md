# Participation fees — who gets paid, and who is the merchant of record

Written 10 September 2026, to settle the question blocking fee collection: the
$35 artist submission fee and the $50 vendor booth fee are **Happening in
DTLA's revenue, not a venue's**, and ticketing's money model assumes a venue.

Nothing here is built yet. This is the decision the build waits on.

> **Decided 10 September 2026.** Happening in DTLA is a separate legal entity,
> so participation fees are **direct charges on their own Connect account** —
> they are merchant of record, the money never touches the platform's balance,
> and there is **no platform-charge fallback**. The platform takes **no fee for
> now**; the agreed rate when it is switched on is **5%**, and it is a single
> constant (`PLATFORM_FEE_PERCENT`). The advertised fee is **not** inclusive of
> processing: the applicant is grossed up so the organisers net what they
> advertise, exactly as their website already does.
>
> One correction found while implementing this: the organisers gross up at a
> round **3% + 30c**, not Stripe's 2.9%. That is the only rate reproducing
> their published $51.86 for a $50 booth — 2.9% gives $51.81. Since Stripe then
> deducts its real 2.9%, they land a few cents *above* the advertised fee
> ($50.06 on $50). `packages/core/src/participation-fees.ts` keeps the two
> rates separate for this reason, and `npm run test:fees` locks the published
> price in.

---

## How money moves today

Ticketing uses Stripe Connect **direct charges**:

```ts
stripe.paymentIntents.create(
  { amount, application_fee_amount: order.platformFeeCents, … },
  { stripeAccount: organizer.stripeAccountId },   // ← charge is ON the venue
)
```

Three consequences, all deliberate and all stated in `schema.prisma`:

- The **venue is the merchant of record** and carries chargeback liability.
- The platform takes an **application fee** off the top.
- *"We never hold their money."* It never lands in the platform's balance.

There is a fallback: with no connected account, checkout creates a **platform
charge** instead. `features.ts` names this as a reason ticketing is switched
off — the money and the liability land on us rather than the venue.

## What the fees actually are

Their published numbers, and what happens to them at Stripe's US card rate of
2.9% + 30¢:

| | Vendor booth |
| --- | --- |
| Vendor pays | **$51.86** |
| Stripe takes | $1.80 |
| Organiser nets | **$50.06** |
| Platform earns | **$0.00** |

$51.86 is almost exactly the price that nets a clean $50 — $51.80 to the cent.
So their model is **"the vendor covers processing"**, and there is no platform
margin in it at all.

That is the finding worth pausing on. **Matching dtlaartnight.com's prices
exactly, as instructed, means the platform earns nothing on vendor booths.**
That may be entirely correct — the app's job here may be to be the better front
door, with revenue coming from ticketing later. But it should be a choice
rather than a side effect.

If the platform did want, say, 5%, at the same vendor price:

| | |
| --- | --- |
| Platform earns | $2.59 |
| Organiser nets | $47.47 — **$2.59 less than today** |

Because the vendor's price is fixed, a platform fee comes out of Happening in
DTLA's side, not the vendor's. That is a conversation with Dino and Michael,
not a constant to change.

The artist fee is less certain. The site says "Submission Fee $35" plus a
hanging fee, and publishes no all-in figure. If the artist pays $35, the
organiser nets $33.68; netting a clean $35 would mean charging $36.35. **Which
of those Dino intends is an open question.**

## Recommendation

**Make Happening in DTLA an `Organizer` with its own Connect account, and
charge participation fees as direct charges on it.**

This needs no new payment architecture. It is the mechanism ticketing already
uses, pointed at a different business — the schema comment already describes
exactly this: *"Each one is a Stripe Connect account so ticket revenue lands in
THEIR bank, with the platform taking an application fee."* Set the application
fee to zero and the numbers match the website to the cent.

It also puts the liability in the right place. Happening in DTLA becomes
merchant of record for their own revenue, which is what they already are on
their website, and the platform never holds their money.

**With one deliberate difference from ticketing: no platform-charge fallback.**
If their account is not onboarded, the fee must simply not be collectable.
Falling back would make Logan the merchant of record for someone else's
revenue, carrying chargebacks on booths he has no part in — the same trap
`features.ts` flags for ticketing, but worse, because here it is not even
ambiguous whose money it is.

## What is already in place

- `Organizer` models a business with a Connect account, onboarding, and
  `chargesEnabled` / `payoutsEnabled` sync.
- `VendorMarket.organizerId` — **added 10 September 2026**. Required, mirroring
  `Event.organizerId`, because a market whose booth fee has no destination
  cannot be sold.

## What is still missing

1. **An `Organizer` row for Happening in DTLA**, onboarded through Connect.
   Nothing can be charged until `chargesEnabled` is true for it.
2. **A payment path for fees.** `Order.eventId` is required and every
   `OrderItem` points at a `TicketType`, so an order cannot represent a booth
   or a submission. Fees need their own record — a smaller, simpler one, since
   a fee has no inventory to hold, no ticket to issue and no door to scan.
3. **The 72-hour expiry sweep.** An approval that goes unpaid has to release
   its space, which is the vendor equivalent of `releaseExpiredHolds()`.
4. **Where the artist fee attaches.** A vendor booth has a market to hang a
   price on. An artist submission has nothing equivalent yet.

## Questions only Logan and the partners can answer

- Is Happening in DTLA a **separate legal entity** from whatever owns the
  platform? The recommendation assumes yes; if it is the same entity, direct
  charges are unnecessary complication.
- Does the platform take **any** fee on participation, given that matching the
  website's prices means $0 today? If yes, it comes out of the organisers'
  side.
- Is the artist's **$35 inclusive of processing**, or is $36.35 the intended
  charge?
- What is the **refund position**? The vendor terms say "No refunds", which is
  clear — but chargebacks still happen, and whoever is merchant of record
  answers them.
- Who reconciles this money, and against what? `docs/launch-readiness.md`
  already lists merchant of record and a written refund policy as open
  non-code decisions for ticketing; this is the same question arriving early.
