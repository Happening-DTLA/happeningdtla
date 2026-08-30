# Launch readiness audit

24 August 2026. Target: first live ticketed event **Thursday 1 October 2026**.

Findings from reading the code and running the test suites, ranked by what
actually stops the night happening. Every claim here was checked against the
code or a run, not assumed.

---

## What is genuinely solid

Verified by running the suites against the local database, not by reading:

| Area | Evidence |
| --- | --- |
| Oversell prevention | 40 simultaneous buyers against 10 seats; counter never exceeded capacity, every loser got an actionable error, no raw database errors leaked |
| Hold lifecycle | Holds release, double-release is a no-op, expired holds reap, per-order limits enforced, a failed line rolls back the whole order |
| Door scanning | First-scan-wins, every attempt logged, revoked devices refused, offline manifest carries no plaintext codes, offline sync preserves the door timestamp and reports duplicates |
| Team and invitations | Unguessable tokens, single use, re-invite supersedes, cannot orphan a business by removing its last owner |
| Dates | 37 checks including both DST boundaries and the 6pm Art Night regression |
| Webhook idempotency | Dedupe on Stripe event id inside the fulfilment transaction |
| Auth model | Dev secret hard-stopped in production; every organizer route resolves through `requireOrganizer` |
| CORS | Wildcards only in development; production requires explicit `ALLOWED_ORIGINS` |
| SQL | The oversell update is a parameterised tagged template. No injection surface |
| Secrets | No `.env` ever committed; full history scanned clean |

This is a well-built core. Nearly everything below is missing scaffolding
around it, not defects inside it.

---

## Blocking 1 October

### 1. Venues cannot create events

There is no event creation or editing UI anywhere. `apps/web/src/app/organizer`
has doors, payouts, settings and team — and no way to list an event. Every
event currently exists because it was written into `prisma/seed.ts`.

This is the largest single gap. A venue partner cannot put their own night on
the platform, which means either you enter all of it by hand or there is
nothing to sell.

### 2. Email only reaches you

Resend has no verified sending domain, so ticket emails deliver to the account
address and nowhere else. On the web — now the likely launch surface — **email
is the ticket**. A buyer on 1 October would pay and receive nothing.

Only one template exists (`order-confirmation`). Notably, **team invitations
send no email at all**: the row and token are created and nothing delivers
them, so an invited person never learns they were invited.

### 3. Nothing is deployed

The app runs on one laptop against a local `prisma dev` database. Launch needs
hosted Postgres, migrations, a deploy, and `NEXT_PUBLIC_APP_URL` pointing at
the real origin or every ticket link points at localhost.

### 4. Production webhooks

`stripe listen` is a development tool. Production needs a webhook endpoint
registered in the Stripe dashboard, its signing secret in the environment, and
live keys. **This audit caught the failure mode**: the checkout end-to-end test
failed with the payment succeeded and zero tickets issued, purely because
`stripe listen` had stopped. In production that same silence means people pay
and get nothing.

### 5. No privacy policy or terms

Neither exists. Both are required to take payments, and required before any
app store will approve a listing. California's CCPA applies to a consumer app
collecting emails and location.

### 6. Non-code, and yours

The legal entity and the merchant-of-record decision. Note what the code
currently does: `useConnect` in `api/checkout/route.ts` falls back to a
**platform charge** whenever a venue has not completed Connect onboarding — so
for those venues the money lands on your account and you carry the chargeback,
not them.

---

## Will break under load

### 7. No rate limiting anywhere — FIXED 25 Aug 2026

`POST /api/checkout` is unauthenticated by design, and each call writes an
order and creates a Stripe PaymentIntent. Nothing limits how often anyone can
call it.

A script can therefore hold **every seat of every event** for the full hold
window, repeatedly. The oversell invariant holds perfectly — the seats are
legitimately held — and the event shows as sold out to real buyers. No login,
no payment, no cost to the attacker.

It is also a Stripe bill: every call creates a PaymentIntent.

**Now closed.** `lib/rate-limit.ts` counts requests in Postgres — not in
memory, which protects nothing once the app runs as more than one instance.
Checkout is limited per buyer (address + email, tight) and per address
(loose, because a venue's wifi is one NAT and a tight per-address limit would
turn away real buyers standing at the door). Door pairing is limited too,
since a correct guess admits people free.

The counter is a single atomic upsert with the window in the key, so there is
no read-then-write and no stale window to reset. `test:ratelimit` fires 40
simultaneous requests at a limit of 10 and asserts exactly 10 pass — a
read-then-write counter fails that.

It fails OPEN: if the counter itself errors the request proceeds, per the house
rule that turning away a paying customer is the worst thing this system can do.

**What it does not do.** Limiting by address raises the cost of holding
inventory and stops the trivial attack. It does not stop someone willing to
rotate addresses. The complete fix is a cap on concurrently held seats per
identity, which guest checkout has no way to establish today.

### 8. Failure is silent

No error tracking, no monitoring, no alerting — no Sentry, no log aggregation,
nothing. If webhook fulfilment breaks in production, orders sit `PENDING`,
tickets are never issued, and **nobody finds out until a buyer complains at a
door**. There is no alert on a paid PaymentIntent whose order is still pending,
which is precisely the condition that means someone paid for nothing.

### 9. Expired holds are only swept on checkout

`releaseExpiredHolds()` runs at the top of `/api/checkout` and nowhere else —
there is no cron, despite a comment in `orders.ts` referring to "the next cron
tick". The failure is self-reinforcing: abandoned carts make an event look sold
out, so nobody attempts a checkout, so the sweep never runs, so it stays
looking sold out.

### 10. Search cannot use an index

`searchEvents` matches with `contains` + `mode: "insensitive"` across five
fields including two joins, which compiles to `ILIKE '%q%'` — a sequential scan
per field, plus a second full scan for the `count()` on every request. Fine at
13 events; not at a few thousand with concurrent searching. The fix is Postgres
full-text search (`tsvector` + GIN) or `pg_trgm`.

### 11. No pagination — and it has already bitten

`take: 50` with no cursor or offset. This stopped being theoretical the day
ArtNight was seeded: fifty free openings on one evening, all earlier than
anything ticketed, filled the entire page — so every paid event silently
disappeared from search, from Explore and from the map, while sitting
untouched in the database.

Raised to 250 with a bounded `limit` parameter, which buys time and is not a
fix. The next busy night puts it back. Real cursor pagination is still owed.

### 12. Connection pooling assumes a long-lived server

The pool defaults to `max: 6` with `DATABASE_POOL_MAX` to raise it. On a
serverless host every instance gets its **own** pool, so the effective
connection count is `max × instances` and Postgres's ceiling arrives quickly. A
serverless deploy needs pgBouncer, Prisma Accelerate, or an equivalent.

### 13. Nothing is cached

Every browse hits the database. Event listings and night pages are highly
cacheable and currently are not.

Related: the handoff already notes that local burst behaviour is an artifact of
the `prisma dev` proxy. **Re-run the door and inventory tests against real
Postgres before the night** — that is still outstanding.

---

## Real gaps, not blocking

- **No refund flow.** The door correctly refuses a `REFUNDED_TICKET`, but
  nothing in the product can issue a refund. On a cancelled event this is
  manual Stripe dashboard work against a spreadsheet.
- **No image upload.** `imageUrl` can only be set by hand, and no seeded event
  has one — so the flyer treatment on the event page has nothing to show. For
  an art and music audience the flyer is the listing.
- **No security headers.** No CSP, HSTS or frame options configured.
- **No mobile auth.** Clerk was reverted for needing a development build.
  Everything per-account on the phone is blocked behind it, including syncing
  saved events across devices.
- **No push notifications**, despite the roadmap naming them a core native
  justification.
- **No ticket transfer.** `Ticket.ownerUserId` exists and is unused.
- **No backups or restore plan.** Untested backups are not backups.
- **Accessibility unaudited.** Contrast, labels and dynamic type have not been
  checked on either surface.

---

## Owed: 37 venue addresses

The single highest-value thing that is not code.

ArtNight's fifty venues are all in the app, correctly grouped into the eight
corridors from the organisers' printed map. Only **13 have coordinates** —
those resolved against OpenStreetMap and survived a check that they fall in
their own corridor's latitude band. The other 37 are small galleries and
studios that are not in any public map database, and their positions were NOT
guessed: the poster is a schematic, and a pin on the wrong block looks correct
while sending someone to the wrong door.

Those 37 appear everywhere — under their corridor on the night screen, and in
the corridor sheet on the map — with the street they sit on. What they cannot
do is show as a pin.

**What is needed:** a street address for each. From dtlaartnight.com, the
organisers directly, or the venues themselves. With addresses they geocode in
minutes and light up on the map with no code change; `ART_NIGHT_VENUES` in
`apps/web/prisma/art-night-2026-09.ts` already has the shape, and every
`lat: null` there is a venue waiting for one.

Worth asking for at the same time: where each corridor's coloured line is
meant to start and end. Two are currently clipped short because the streets do
not reach the poster's cross-streets in the map data.

## Suggested order

Sequenced by what unblocks the most, given five weeks:

1. ~~**Rate limit `/api/checkout`**~~ — done, 25 Aug.
2. **Verify the Resend domain** — external dependency, start it today.
3. **Event creation UI** — the largest build, and nothing sells without it.
4. **Deploy** — hosted Postgres, real webhook endpoint, real origin.
5. **Error tracking plus an alert on paid-but-pending orders** — so a silent
   failure stops being silent.
6. **Privacy policy and terms.**
7. **Cron for expired holds.**
8. **Re-run the suites against real Postgres.**

Search, pagination and caching are not 1 October problems. One night with a
handful of venues will not strain them. They become urgent at the point the
catalogue grows past a few hundred events, which is a good problem and a later
one.
