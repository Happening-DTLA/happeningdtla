# Marketplaces — vendoring and art sales

Written 10 September 2026, from the direction Logan set: DTLAHappening should
become the platform that takes a fee on three kinds of transaction —
**tickets**, **vending space**, and **art**. The moat is Dino and Michael's
connections and audience in the DTLA gallery, venue and vendor scenes.

This is a scoping document, not a plan of record. Nothing here is scheduled and
nothing here happens before 1 October.

---

> **Corrected 10 September 2026, after reading dtlaartnight.com.** The
> organisers already have a published fee model, and it is not a commission on
> sales. They charge a **$35 artist submission fee** plus a hanging fee, and a
> **$50 vendor booth fee** (shown all-in as $51.86) — while advertising, in
> their own words, *"Sell your art and keep 100% OF YOUR SALES!"*
>
> That resolves most of the hard part below. The money is in **fees to
> participate**, which are ordinary one-time payments to an organizer who
> already has a Connect account. It needs no artist payout accounts, no
> three-way splits and no fulfilment. The art-sales analysis further down still
> holds if the platform ever wants a cut of a *sale* — but that is now clearly
> the harder and less necessary path, and it would contradict the organisers'
> own marketing.
>
> The immediate gap is simpler and more urgent: **the app charges nothing.**
> There is no payment step in its submission flow, so an artist applying in the
> app pays nothing while one applying on the web pays $35.
>
> **Decided 10 September 2026.** Selling art through the app is **out of scope**
> — it may become a separate platform later, and nothing about it should be
> built here. The app's job is the Art Night product: ticketing, and every
> submission form the website offers. **Prices must match dtlaartnight.com
> exactly**, which means a published number stored per item rather than one
> computed by our own `priceBreakdown()` service fee. Their $50 booth is shown
> as $51.86 — Stripe's rate passed through, no platform margin — where our
> placeholder would have charged $53.99.

## The short version

**Vendoring fits the system that already exists.** It is the same shape as
ticketing — priced, limited inventory sold by a business that already has a
Stripe Connect account — and it inherits the oversell, idempotency and
all-in-pricing invariants unchanged. The work is mostly in the *flow* around
the money, not the money.

**Art sales do not.** Four structural facts in the schema point the other way,
and one promise currently on screen points at a business decision that has to
be made by people, not by code.

**Neither should become a tab.**

---

## What can be reused

The expensive parts are already built and tested, and they are not
ticket-specific:

- **Never overselling.** `UPDATE … WHERE quantitySold + n <= quantity` inside a
  transaction. A booth cannot be double-booked for exactly the reason a seat
  cannot be double-sold.
- **Webhook idempotency.** The Stripe event id goes into `WebhookEvent` in the
  same transaction that fulfils the order; a unique violation means "already
  handled".
- **Integer cents**, everywhere.
- **All-in pricing.** `priceBreakdown()` and California's requirement to show
  the total before checkout apply to a booth fee identically.
- **Stripe Connect.** `Organizer.stripeAccountId` and `payoutsEnabled` already
  exist, with `Order.platformFeeCents` as the application fee.

Anything new should route through these rather than around them.

---

## Vendoring

### Why it fits

A vending spot is priced, limited inventory attached to an occasion, sold by a
business we already model. The seller is an `Organizer`, which already has a
payout account. The buyer is a vendor. The fee is `platformFeeCents`. Almost
every noun already exists.

Mechanically, a booth is close to a `TicketType` — a name, a price, a quantity,
a per-order cap and a sales window. That is not a coincidence; they are the
same abstraction wearing different words.

### Where it genuinely differs

Four things, and they are all in the flow rather than the ledger:

1. **Booths are approved, not bought.** A venue vets who sells what — food
   versus art versus merch, permits, insurance, whether a vendor competes with
   the venue's own bar. Ticketing is first-come; vendoring is
   **apply → approve → pay**. That is a different state machine, and it is the
   real work.
2. **Booths are often not fungible.** A corner spot by the door is not the back
   wall. Ticketing's quantity model assumes interchangeable units; vendoring
   may need identified spots.
3. **Commitments recur.** A vendor who does well wants next month too, which
   implies renewals — something ticketing has never needed.
4. **Vendors need a profile.** What they sell, photos, permits, past events.
   Closer to `ArtistSubmission` than to a buyer.

### Rough shape

Reuse the money machinery; add the approval flow. A `VendorSpace` alongside
`TicketType` rather than a flag on it, because the approval state, the identified
spot and the renewal have nowhere to live on `TicketType` and bolting them there
would make ticketing worse to read.

`ArtistSubmission` is the closer precedent for the application half, and it is
already proven.

---

## Art sales

### The four structural problems

1. **`Order` is welded to `Event`.** `Order.eventId` is required and
   non-nullable, and every `OrderItem` points at a `TicketType`, which points at
   an `Event`. An artwork sold three weeks after Art Night belongs to no event.
   Either `Order` becomes polymorphic — which touches checkout, the webhook,
   refunds, the door, and every query that assumes an order has an event — or
   art sales get their own order table and the reporting story fragments.
   Neither is small.

2. **The seller is a third party with no payout account.** Only `Organizer` has
   `stripeAccountId`. An artist has none. Paying one means Connect onboarding
   and KYC for somebody who, in the current product, filled in a form once and
   has no account at all. That is a real drop-off cliff in front of the exact
   people the moat depends on.

3. **Physical fulfilment.** Unique items, shipping or collection, condition,
   insurance, returns, and who is liable when a canvas arrives damaged. Tickets
   have none of this. `SubmissionArtwork` already stores dimensions and weight
   *because placement needs them* — the same fields would need to mean shipping,
   which is a different question about the same numbers.

4. **A sale is at least three-way.** The art hangs on somebody's wall. A gallery
   that placed a piece will expect its cut, the artist expects theirs, and the
   platform wants a fee. Stripe supports multi-party splits, but separate
   charges and transfers are a materially harder integration than the single
   destination charge ticketing uses.

### The promise already on screen

`apps/mobile/app/submit/artist.tsx` tells every artist, at the top of the
submission form:

> Artists keep 100% of sales.

`SubmissionArtwork.priceCents` says the same thing in the schema: *"this is what
the piece is listed at, not a figure anyone takes a cut of."*

Every artist who has submitted did so under that statement. Taking a cut is a
legitimate business decision, but it is a **reversal of a published promise**,
and it lands on precisely the relationship the moat is made of. It should be
decided with Dino and Michael, applied forward-only to new submissions, and
never quietly changed in a commit.

There are gentler options worth weighing: a fee paid by the **buyer** rather
than deducted from the artist, a fee on **placement** rather than on sale, or a
listing fee. Those keep the sentence true.

---

## Navigation

The app has five tabs, one hidden, so effectively four. Adding two marketplaces
as tabs would wreck the thing that currently works.

**Use the seam that already exists.** `profile-type.tsx` models ATTENDEE /
ARTIST / VENUE, and the established rule is that profile type *"reveals a
module; it grants nothing, and the server validates everything independently."*
An attendee never sees booth booking. A vendor sees "find space". A venue sees
"list space". Same four tabs, a different app depending on who you are.

### The tension nobody has named yet

**Art Night is episodic. Marketplaces are continuous.**

The whole app is *tonight*-shaped: a directory you read while walking, a map
that recentres on you, a passport that fills up over one evening. A vendor
looking for space five weeks out does not fit that frame, and neither does
somebody browsing art in February.

This matters more than any schema decision. The honest options are to keep the
night product pure and let the marketplaces live behind profile type, or to
accept that the app becomes two products sharing a shell and design the shell
deliberately. Drifting into the second without deciding is how the tab bar ends
up with six icons and the night gets worse.

---

## Suggested sequencing

Front-load the learning, defer the hard parts.

1. **Vendor applications, no money.** Apply, approve, decline — mirroring the
   artist flow that already works. Proves there is demand on both sides, needs
   no payment work, and cannot oversell anything because nothing is sold.
2. **Vendor payments.** Attach the existing money machinery to approved
   applications. This is also the natural moment ticketing comes back, since it
   is the same code path and the same production checklist in
   `docs/launch-readiness.md`.
3. **Art sales.** Only after the payout, fulfilment and commission questions
   have real answers — and only after the 100% conversation has happened.

## Open questions

These need people, not code:

- Does the platform fee on art come from the artist, the buyer, or the
  placement — and who tells the artists?
- When a gallery placed the piece, what is the split, and who owes whom?
- Who is merchant of record for a booth fee, and what is the refund policy when
  an event is rained out?
- Does a vendor booking a booth need insurance or a permit on file, and who
  checks?
- Is vending space sold per night, or as a season?
