# DTLAHappening — handoff

Rewritten 11 September 2026, at `main` = `0c8f100`, working tree clean.

Read this, then `AGENTS.md` for the code-level rules. Every claim here was
verified against production or a running build on the day it was written; where
something is unverified it says so.

---

## What this is

A native iOS app for **DTLA Art Night** — the first Thursday of every month,
when galleries, studios, museums and rooftops across Downtown Los Angeles open
their doors. Logan builds it. Dino and Michael organise Art Night, run
**Happening in DTLA**, and are the partners it exists to serve.

It is **Art Night first**. Ticketing is built and tested but hidden behind
`EXPO_PUBLIC_TICKETING` / `NEXT_PUBLIC_TICKETING`, both off, because the night
is free.

The app is deliberately **not** a wrapper around dtlaartnight.com. What makes it
an app is the map, live walking distances, and the passport — things that need
a device in a pocket on a street.

### The visual direction

The gig poster. Flat ink, square corners (`radius.block = 0`), Archivo Black set
large, corridor colours from the organisers' printed map. **Do not introduce
soft, translucent, rounded or glassy surfaces.** This was re-confirmed on 10
September against iOS 26's Liquid Glass: the answer was to sharpen the poster,
not adopt the OS language. "The future is here" is delivered through motion,
haptics and speed, not translucency.

---

## Where things stand

### Working in production, verified

- **Art Night directory** — 56 venues grouped by corridor, filterable.
- **Map** — real Fabric `react-native-maps@1.29`, corridor routes, pins in
  corridor colours, **all 56 venues geocoded**, live location, walking distance.
- **Search** — 36 results for "gallery"; spans past nights as well as upcoming.
- **Passport** — offline-first with a durable AsyncStorage sync queue.
- **Four submission forms** — artist, vendor, entertainment, volunteer, matching
  dtlaartnight.com. All reject bad input with 422, never 500.
- **Admin review queues** — `/admin/submissions` and `/admin/vendors`, gated on
  `ADMIN_EMAILS`, reading the database directly so they never depend on email.
- **Participation fee path** — `ParticipationFee`, direct charges on the
  organisers' Connect account, `/pay/[id]`, webhook settlement, 72-hour expiry
  sweep. Fully built; cannot collect until Connect onboarding is done.
- **Legal pages** — `/privacy`, `/terms`, `/support`, all 200.

### Built but not reachable by anyone yet

- **Vendor markets exist in production but are UNPUBLISHED.**
  `/api/vendor-markets` returns `[]` on purpose. Four markets are in the
  database — three Spring Arcade dates and the Regent holiday flea — at the
  published $51.86. They are hidden because **`capacity` is a guess (30)**, and
  capacity is exactly the number that decides when a market reports itself full.
  **Ask Dino, set it, then flip `isPublished`.**
- **The mobile app on a phone.** Everything above is on the deployed API and in
  the simulator. No TestFlight or App Store build exists yet.

### Blocked on other people

- **Resend DNS — Dino.** `send.dtlaartnight.com` has no MX, SPF or DKIM. DNS is
  at **GoDaddy**. `EMAIL_FROM` is already set in Vercel; the domain was simply
  never verified. Until then every submission notifies nobody — which is why the
  admin queues exist. See `docs/email-setup-ask-dino.md`.
- **Stripe Connect — Dino.** Happening in DTLA needs its own Connect account.
  Until `chargesEnabled` is true, `POST /api/fees/:id` returns **503
  organizer_not_ready** rather than charging the wrong account. See
  `docs/stripe-onboarding-ask-dino.md` — it has a message to forward verbatim.
- **Apple Developer login — Logan.** The first iOS distribution build needs an
  interactive Apple sign-in with 2FA to create the certificate and provisioning
  profile. `eas credentials` correctly refuses headlessly.

---

## Next action items, in order

1. **With Dino (planned Sunday):**
   - Resend DNS — add the three records, verify the domain.
   - Stripe Connect onboarding for Happening in DTLA.
   - **Confirm booth capacity**, then publish the four vendor markets.
   - Grant him organizer access: he signs in once, then
     `npm run grant:organizer --workspace apps/web -- --email=… --apply`.
     Note that script refuses the production database with test Clerk keys.

2. **First iOS build** (needs Logan's Apple login, then it is repeatable):
   ```bash
   cd apps/mobile && npx eas-cli@latest build --platform ios --profile production
   ```
   Before submitting, decide what an App Store reviewer sees when they reach the
   artist submission fee: it charges **$36.40** and will 503 until Connect is
   live. Either finish onboarding first or hide the fee step for v1.

3. **After that:** the returning-artist form (last piece of website parity), and
   the volunteer ID upload, which was deliberately not built — see below.

---

## Decisions already made — do not relitigate these

- **`apps/web` is the backend, not a rival website.** The mobile app makes 29
  API calls to it across 30 routes. Deleting it leaves an empty shell. Some of
  its HTML pages genuinely must be web: legal pages (Apple requires a public
  privacy URL), `/pay/[id]` (emailed links), `/organizer/payouts` (Stripe
  onboarding is a browser redirect), and the admin queues. The duplicative ones
  — `/`, `/e/[slug]`, web checkout, `/orders/[id]` — are dormant behind the
  ticketing flag and should simply be left alone.
- **Stay on Expo.** The project is already native: a real Xcode project, Fabric
  components, 11 native modules. "Expo vs bare React Native" largely died with
  prebuild. Going bare would lose EAS Build/Submit and config plugins for no
  gain. The friction in `AGENTS.md` is npm-workspaces hoisting, not Expo.
- **Stripe, not In-App Purchase.** Apple requires IAP for *digital* goods
  consumed in-app and exempts **physical goods and real-world services**. Event
  tickets, a booth, a submission for a physical show are all exempt. The 30% does
  not apply. Do not let anyone "fix" this toward IAP.
- **Apple Pay is possible but not wired**, and shouldn't be yet. Fee payment
  happens on the web from emailed links; ticketing is off. The real candidate is
  the artist fee, which is paid in-app.
- **Participation fees: platform takes 0%.** Agreed rate when switched on is
  **5%**, a single constant (`PLATFORM_FEE_PERCENT`). Charging the applicant
  would make the app dearer than the website; charging the organisers would give
  them a reason to steer people back to it.
- **Happening in DTLA is merchant of record** for those fees — separate legal
  entity, direct charges on their account, and **deliberately no
  platform-charge fallback**. Falling back would put their chargebacks on us.
- **Selling art through the app is out of scope.** Possibly a separate platform
  later. The organisers advertise "artists keep 100% of sales"; revenue is in
  **participation fees**, not commission.
- **The volunteer form does not collect a government ID**, though their web form
  does. The `submissions` bucket is public, so an ID there would sit on a
  readable URL. It asks for an 18+ confirmation instead. Collecting one properly
  needs private storage, signed reads and a privacy-policy change.

---

## Money rules, and where the numbers come from

The organisers publish their own prices and the app must match them exactly.

- A **$50 booth is charged $51.86**. That is not a markup — it is grossed up so
  they net the fee they advertise.
- They gross up at a round **3% + 30¢**, *not* Stripe's 2.9%. This is the only
  rate reproducing $51.86; 2.9% gives $51.81. Stripe then deducts its real 2.9%,
  so they land a few cents above ($50.06).
- `packages/core/src/participation-fees.ts` keeps the two rates deliberately
  separate. `npm run test:fees --workspace apps/web` pins the published price.
- **A payer's breakdown must add up.** Show `totalCents − advertisedCents`, not
  `processingCents` — the latter is Stripe's real deduction and differs by a few
  cents, which on screen reads as arithmetic that does not work.
- The artist fee is **$35 advertised, $36.40 charged**.

Invariants, all covered by `npm run test:fee-lifecycle --workspace apps/web`:
one charge per thing owed; settlement idempotent because webhooks arrive at
least once; **a declined card does not cost a vendor their booth** — only the
72-hour deadline releases it; approval and billing happen in one transaction.

---

## Things that cost time today — read before repeating them

- **`git push` does NOT deploy.** The Vercel project has no GitHub integration.
  Deploy manually **from the repo root**: `vercel --prod --yes --archive=tgz`.
  Running it from `apps/web` fails, because the project's Root Directory is
  already `apps/web`. `--archive=tgz` is required: the monorepo exceeds Vercel's
  15,000-file limit. **The CLI reports "fetch failed" while the build is still
  running** — check `vercel inspect <url>`, it is probably still Building.
- **Vercel Hobby allows one cron run per day.** An hourly schedule is refused at
  deploy time. `/api/vendor-markets` therefore sweeps opportunistically, the way
  checkout calls `releaseExpiredHolds()`.
- **`vercel.json` lives in `apps/web`**, not the repo root. A root-level one is
  silently ignored.
- ⚠️ **Never run `npm run db:seed` against production.** It opens with
  `deleteMany()` across venues, nights, corridors and organizers and would erase
  the 56 synced venues. Use `npm run markets:create --workspace apps/web`.
- **Migrations: `migrate deploy` against `SUPABASE_DIRECT_URL`**, never
  `migrate dev`. Read the SQL first.
- **The DTLA ArtNight organizer had zero members**, and in production every route
  in is by invitation while invitations need an existing member. Hence
  `grant-organizer-access.ts`.
- **Vercel is not a backup for secrets.** All production variables are marked
  Sensitive and are write-only. `vercel env pull` returns `[SENSITIVE]`.
- **`EXPO_PUBLIC_API_URL` must be set in release build profiles.** Without it a
  TestFlight build has no Metro, `hostUri` is undefined, and it falls back to
  `localhost:3100` — which on a phone is the phone. Fixed in `eas.json`.
- **Permission strings are set by config plugins, not `infoPlist`**, which merges
  after plugins and silently wins. Microphone is declared by *both* expo-camera
  and expo-image-picker; both need turning off.
- **`PageProps`/`LayoutProps` do not exist until something builds**, and Expo
  Router's typed routes do not exist until Metro has seen a new file. Both look
  like broken code and are not.

---

## Repo layout

npm workspaces monorepo:

- `apps/mobile` — Expo SDK 54, RN 0.81, expo-router. **The product.**
- `apps/web` — Next.js 16. **The backend**, plus the few pages that must be web.
  Owns the database and every secret.
- `packages/core` — shared pure TypeScript. Must run in Hermes: no Node, no DOM.

Deployed API: `https://happeningdtla-web-v63f.vercel.app`
Database: Supabase Postgres, `us-west-1`. Vercel team `happening3`.

### Useful commands

```bash
npm run typecheck                              # all three workspaces
npm run db:start && npm run db:migrate && npm run db:seed   # local database
npm run dev                                    # API on 3100
npm run ios --workspace apps/mobile            # development client
npm run test:fees --workspace apps/web         # published-price arithmetic
npm run test:fee-lifecycle --workspace apps/web # money invariants, local DB
npm run sync:artnight -- --date=2026-10-01     # dry run; --apply to write
npm run markets:create --workspace apps/web    # vendor markets (NOT the seed)
npm run grant:organizer --workspace apps/web   # first organizer member
```

### Setting up on a new machine

`apps/web/.env` cannot be recovered from Vercel. Rebuild it from `.env.example`
plus the Supabase, Stripe, Clerk and Resend dashboards. `DATABASE_URL` and
`SHADOW_DATABASE_URL` do not need copying — `npm run db:start` writes fresh
local ones.

---

## Still open, lower priority

- `docs/launch-readiness.md` items 8, 9, 10, 12, 13 — mostly ticketing concerns,
  deferred while it is flagged off. **The Stripe production webhook matters
  before anything is ever sold**, and is easy to forget because payments would
  succeed and issue no tickets, silently.
- Sentry projects were never created, which is why local iOS builds need
  `SENTRY_DISABLE_AUTO_UPLOAD=true` in `ios/.xcode.env.local`.
- The seed only geocodes 13 of 50 venues, so the local map looks sparse against
  production's 56. Not a bug.
- Search returns past nights as well as upcoming. Defensible, mildly odd.
- Map label collision avoidance mostly works; a couple of labels sit on their own
  pins. Real polish item.

## Things worth knowing about the people

`AGENTS.md` is real and load-bearing — every entry cost hours. Commit messages
carry the reasoning; `git log` is documentation here. The moat is Dino and
Michael's connections and audience, so anything that weakens artist or venue
trust is expensive in a way a feature list will not show.
