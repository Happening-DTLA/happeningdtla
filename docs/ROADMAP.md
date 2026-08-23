# Roadmap — to Art Night, Thursday 1 October 2026

Written 22 August 2026. **40 days.**

## The one thing that matters

A person buys a ticket on their phone, and a door person scans it and it turns
green. Discovery, profiles and social features are wrappers around that moment.
If the transaction wobbles at 9pm on a Thursday with thousands of people in
DTLA and congested LTE, the venues go back to Eventbrite and there is no second
chance with them.

So we ship a **narrow vertical slice through the money** first, and we ship it
for **1–3 venues**, not all of Art Night.

## Sequencing, and why this order

The long pole is **not** the code. It's Stripe Connect verification: every venue
has to submit an EIN, a bank account and an ID, and approval takes days per
account and can bounce back for corrections. Start that in week one, in
parallel with everything else, or it becomes the thing that misses the date.

### Now → 29 Aug — unblock the money
- [ ] Stripe account created; Connect enabled in **test mode**
- [ ] Decide merchant of record (see Open questions) and write it down
- [ ] Refund policy written before a single ticket is sold
- [ ] Send Connect onboarding links to the first 1–3 venues
- [ ] Checkout skeleton: PaymentIntent → webhook → tickets issued

### 3 Sep — Art Night, as field research
Do **not** try to launch on this one. Go with a notebook. Specifically watch:
- How does each door actually work today? Wristbands? A list? Cash?
- Where do lines form, and what is the bottleneck?
- Is there usable cell service *inside* each venue? Test it, don't assume.
- What do the venues currently pay Eventbrite, and what do they hate about it?
- How many people are actually walking between venues vs. staying at one?

That last one decides how much the passport/crawl feature is worth.

### 30 Aug → 13 Sep — buy a ticket
- [ ] Guest checkout (email + phone, no account required — forcing signup
      before purchase is the single biggest conversion killer in ticketing)
- [ ] Oversell prevention: conditional `UPDATE … WHERE quantitySold + n <= quantity`
      inside one transaction. Never read-then-write.
- [ ] Webhook idempotency via the `WebhookEvent` table. Stripe delivers at least
      once and retries; without dedupe a retry issues a second set of tickets.
- [ ] Ticket delivery by email + a claim link that works without an account
- [ ] Ticket wallet page with QR

### 14 Sep → 20 Sep — get through the door
- [ ] Scanner PWA for door staff (`DOOR_STAFF` role sees no revenue)
- [ ] **Offline-first**: cache the event's valid codes to the device before
      doors, validate locally, queue scans, sync when signal returns. A scanner
      that needs a network round-trip per person will fail in a basement.
- [ ] First-scan-wins via `UPDATE … WHERE checkedInAt IS NULL`; second scan
      reports when and where the first happened
- [ ] Manual code entry fallback for cracked/dim screens
- [ ] Organizer dashboard: sold, scanned, remaining — live

### 21 Sep → 27 Sep — make it real
- [ ] Switch to Stripe **live** keys; a real $1 test purchase and refund
- [ ] Dry run at one venue with staff actually holding phones
- [ ] Load-check: what happens when 300 people scan in 20 minutes?
- [ ] Support plan for the night — who answers the phone at 9pm?

### 28 Sep → 1 Oct — launch
Freeze features. Fix only what breaks.

## Explicitly NOT in v1

Cut on purpose, to be built once ticketing is proven:
the passport/route map, friends and following, in-app chat, venue capacity and
wait times, push notifications, artist profiles, native apps.

The passport is the real long-term moat — Eventbrite structurally cannot model
a crawl — which is exactly why it deserves to be built on top of a ticketing
system that already works, not instead of one. The schema already carries
`Night` and `VenueCheckIn` so this doesn't require a migration later.

## Open questions — these are Logan's, not the code's

1. **Merchant of record.** Recommended: the venue, via Stripe Connect
   destination charges, with the platform taking an application fee. That keeps
   refund liability and sales-tax exposure with the business that actually
   provided the service. The alternative (platform as MoR) means *we* are on the
   hook when an event is cancelled. This is a real decision with real liability
   attached — worth ten minutes with a lawyer, not a guess.
2. **What happens when an event is cancelled?** Who refunds, out of whose
   balance, and how fast? Write it down before selling.
3. **California all-in pricing.** CA now requires the total including fees to be
   shown up front. The app already does this everywhere — confirm the exact
   current requirement with counsel rather than taking this file's word for it.
4. **The exclusivity arrangement.** "Tickets only on the app" needs to be in
   writing with each venue, including what happens if we have an outage.
5. **Fee level.** Currently 6% + $0.99 (`src/lib/money.ts`). Eventbrite is
   roughly 3.7% + $1.79 plus payment processing. Undercutting them visibly is a
   selling point to venues; make it a deliberate number.
