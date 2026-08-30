# DTLAHappening — handoff

Written 24 August 2026. Read this first in a fresh session, then
`AGENTS.md` for the code-level rules.

---

## What this is

An event-discovery and ticketing app for Downtown Los Angeles. The anchor is
**Art Night DTLA**, the first Thursday of every month. Logan's friend owns
several DTLA venues and has the connections to bring on others. Per agreement
with those venue owners, tickets are sold **only in this app, not Eventbrite**.

**Target: first live ticketed event Thursday 1 October 2026.**

The differentiator vs Eventbrite: Art Night is a *crawl* — one night, many
venues, people moving between them. Eventbrite models one event = one venue =
one ticket and structurally cannot represent that. `Night` and `VenueCheckIn`
exist in the schema from day one so the passport/route feature needs no
migration later. It is deliberately **not built yet** — ticketing had to work
first.

**Team:** Logan plus one other developer (remote, writes code) and a partner
with financial backing.

---

## State: the whole ticketing loop works

- **Buyer** — browse by night and neighborhood, search and filter by category,
  buy with the native Stripe payment sheet, tickets in the app wallet, by
  email, and on the web.
- **Door** — pairing codes scoped to one event and one organizer, first-scan-
  wins admission, full audit log, works offline and syncs afterwards.
- **Venue** — sign in, connect their own Stripe, invite their team, generate
  door codes, choose whether to be publicly named.

29 commits on `main`, pushed to a **private** repo at
`Happening-DTLA/happeningdtla`. `main` is the trunk and the default branch;
branch off it and open a PR. The old `feat/native-monorepo` branch was
fast-forwarded into `main` and is gone.

---

## Repo

Monorepo, npm workspaces, at `/Users/logantierno/development/dtlahappening`.

```
apps/web      Next.js 16 — API, public event pages, venue dashboard. Owns the
              database and every secret.
apps/mobile   Expo SDK 54 / React Native 0.81, expo-router. The store client.
packages/core Shared pure TypeScript: API types, money, datetime, ticket codes.
              Runs in Hermes — no Node or DOM APIs, ever.
```

**Completely unrelated to `~/development/arteon`.** Do not conflate them.

### Running it

```bash
cd /Users/logantierno/development/dtlahappening
npm run dev      # web + API on :3100
npm run mobile   # Expo, scan with Expo Go
```

Database is local via `npx prisma dev` — no Docker, no Homebrew.
`npm run setup` boots it, migrates and seeds.

Also needs, in its own terminal, for payments to become tickets:
```bash
stripe listen --forward-to localhost:3100/api/webhooks/stripe
```

### Tests — run these after touching anything in their area

```bash
cd apps/web
npm run test:inventory   # oversell race, holds, expiry
npm run test:door        # pairing, scanning, offline sync
npm run test:team        # invitations, roles, affiliation
npm run test:checkout    # full Stripe purchase (needs stripe listen)
```

Every one of these has caught a real bug that reading the code did not.

---

## Invariants that must not be broken

Documented in `apps/web/prisma/schema.prisma` comments too.

- **Never oversell.** Inventory commits via a raw conditional
  `UPDATE ... WHERE quantitySold + n <= quantity`. Never read-then-write.
- **Webhooks are at-least-once.** Dedupe on the Stripe event id in the same
  transaction that fulfils the order, or one payment issues two sets of tickets.
- **First scan wins.** `UPDATE ... WHERE checkedInAt IS NULL`. Log every
  attempt, including duplicates and unknown codes.
- **Money is integer cents.** Never float.
- **Ticket codes must be unguessable.** `newTicketCode()`.
- **All-in pricing everywhere.** California requires it and it is the loudest
  complaint about Eventbrite.
- **A `Ticket` row means someone paid.** That is why `OrderItem` exists — so no
  scan has to remember to check order status.
- **Never reject on an ambiguous read.** A null lookup under contention can
  mean "couldn't check", not "doesn't exist". Turning away a paying customer
  is the worst thing this system can do.

---

## Gotchas found the hard way — do not rediscover these

**Dates come in two kinds.** `Event.startsAt` is an instant (format Pacific).
`Night.date` is a Postgres `date` returned as midnight UTC — format it in
**UTC** or the first Thursday renders as a Wednesday. Helpers in
`packages/core/src/datetime.ts`. Date filters must use `pacificDayRange`; a
UTC day boundary hides the 6pm Art Night events entirely.

**No fire-and-forget database writes in a request handler.** An un-awaited
query keeps a pooled connection checked out past the response; torn down
mid-query it returns to the pool broken, and the *next* request dies with a
Postgres protocol desync (`08P01`, `34000`). The symptom appears on a different
request than the cause.

**Blank env vars are empty strings, not undefined.** `??` does not catch them.
`Number("")` is 0, which once configured a connection pool that could never
hand out a connection. Use `?.trim() ||`.

**Expo Go's bundled module list is not a compatibility check.** `expo-crypto`
is bundled but its AES submodule is not — `@clerk/clerk-expo` fails at import
with `Cannot find native module 'ExpoCryptoAES'`. Only loading the bundle on a
device proves anything.

**One React copy, enforced in `apps/mobile/metro.config.js`.** Three exist
legitimately (root + web on 19.2.x for Next, mobile on 19.1.0 for Expo SDK 54).
Two in one bundle means `useState of null` on every screen. `extraNodeModules`
does **not** fix it — react-native is hoisted to the root so its own
`require("react")` resolves before any fallback. Only `resolveRequest` works.
Do not "simplify" this away.

**Do not set `disableHierarchicalLookup`** in metro config. It looks like the
fix for duplicate React and breaks nested expo deps (`expo-asset`) instead.

**Middleware is `proxy.ts` in Next 16**, not `middleware.ts`, and only one is
allowed — Clerk and CORS are composed in the single file.

**Clerk Core 3 removed `SignedIn`/`SignedOut`/`Protect`** for `<Show when=...>`.
`<Show>` only hides visually — every real guard is a server-side check.

**Stripe Connect is Accounts v2.** v1 account creation is refused for new
integrations. Per-capability status replaces `charges_enabled`, and
dashboard + fees/losses collector replaces the standard/express type. Express
*requires* the platform to absorb losses, which is the liability we chose
against — hence `dashboard: "full"` with Stripe collecting.

**`expo install --fix` can add a bogus config plugin.** It added
`expo-status-bar` to `app.json` plugins, which is not one, and the dev server
refused to start.

**Never run `npm audit fix --force`.** The advisory is in the Prisma CLI's
config loader and the "fix" downgrades to Prisma 6.

**The Bash tool's working directory sometimes reverts.** Use absolute paths.

---

## Services

| Service | State |
| --- | --- |
| Stripe | Test mode, keys set, webhooks working, Connect enabled (Accounts v2) |
| Clerk | Configured, web sign-in working |
| Resend | Key set, **sends only to the account address** — no verified domain |
| Database | Local via `prisma dev` |
| Apple Developer | Not enrolled |
| GitHub | Private repo, `Happening-DTLA/happeningdtla`, `main` pushed |

`ADMIN_API_SECRET` is a development-only placeholder used by test scripts.
It is refused in production.

---

## What's next

**Blocking 1 October, both non-code:**

1. **Form the legal entity.** Longest lead time by far. Gates the D-U-N-S
   number for the App Store *and* real Stripe Connect onboarding for venues.
   Nothing else on this list takes a month.
2. **Verify a sending domain in Resend.** Logan's partner owns a domain.
   Until then ticket and invitation emails reach only Logan's own address.
   Then set `EMAIL_FROM=tickets@<domain>`.

**Waiting on an Apple Developer account ($99):** mobile sign-in
(`@clerk/clerk-expo` needs a development build), Apple Pay, App Store listing.
None block anything else. Guest checkout means no buyer needs an account.

**Small and mine to do:**
- Get street addresses for the 37 ArtNight venues that have none, so they can
  be pinned on the map. See "Owed: 37 venue addresses" in
  `launch-readiness.md`. Nothing else about ArtNight is blocked on code.
- Remove the dev-only "claim a venue" button — invitations replace it, and it
  should not exist when a venue partner first sees the dashboard.
- Invite the other developer to the GitHub org and the repo, and send them
  the Clerk and Stripe **test** keys out of band — `.env` is gitignored, so a
  clone gives them `.env.example` and nothing else.
- Re-run the door tests against real Postgres before the night. Some burst
  behaviour is an artifact of the local `prisma dev` proxy.

**Deliberately not built:** the passport / crawl features, refunds UI, event
creation UI (events are seeded), push notifications.

**Open business decisions** — see `docs/payments-brief.html`, the partner
document. Merchant of record (recommendation: direct charges, venue liable),
refund policy, exclusivity in writing, and the fee level. The 6% + $0.99 in
`packages/core/src/money.ts` is a **placeholder** — worked against Stripe's
rate it charges the buyer more and pays the venue less than a fee sized so
venues net full face value.
