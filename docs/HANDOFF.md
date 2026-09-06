# DTLAHappening — handoff

Rewritten 5 September 2026. Read this, then `AGENTS.md` for the code-level
rules, then `docs/map-crashes.md` before touching the map.

---

## What this is

A native app for **DTLA Art Night** — the first Thursday of every month, when
galleries, studios, museums and rooftops across Downtown Los Angeles open their
doors. Logan builds it; Dino and Michael organise Art Night and are the
partners it exists to serve.

It began as a general events-and-ticketing app. It is now **Art Night first**:
one night, 56 venues, nine corridors. Ticketing still exists in full but sits
behind a flag (`EXPO_PUBLIC_TICKETING` / `NEXT_PUBLIC_TICKETING`) and is off,
because the night is free.

The app is deliberately **not** a wrapper around dtlaartnight.com. What makes it
an app rather than a website is the map, live walking distances, and the
passport — things that need a device in a pocket on a street.

### The visual direction

The gig poster. Flat ink, square corners (`radius.block = 0`), Archivo Black
set large, corridor colours lifted from the organisers' printed map. The
welcome screen is a screenprint being pulled. **Do not introduce soft,
translucent, rounded, glassy surfaces** — that was considered and rejected on
purpose; it would read as two products stapled together.

## The shape of the repo

npm workspaces monorepo:

- `apps/mobile` — Expo SDK 54, React Native 0.81, expo-router. The product.
- `apps/web` — Next.js 16. The API, plus web checkout for when ticketing returns.
- `packages/core` — shared pure TypeScript. Must run in Hermes. Types,
  money, dates, geo, passport rules, submission contract.

Deployed API: `https://happeningdtla-web-v63f.vercel.app`
Database: Supabase Postgres, `us-west-1`.

## Setting up on a new machine

Git brings everything except secrets:

1. `npm install` at the root (postinstall generates the Prisma client).
2. **`apps/web/.env`** — copy from the old machine by AirDrop, not email. It
   holds the database URL, Supabase direct URL and CA cert, Stripe, Clerk and
   Resend keys.
3. Optionally `apps/mobile/.env.local` with
   `EXPO_PUBLIC_API_URL=https://happeningdtla-web-v63f.vercel.app`.
4. `npm run typecheck` should be clean across all three workspaces.

To run it on a phone from anywhere: `npm run start:anywhere` — tunnels the
bundle and points at the deployed API, under `caffeinate` so the Mac stays
awake only while it runs. See `docs/deploying.md`.

## Where things stand

### Working and verified

- **Art Night directory** — the app's home tab. 56 venues grouped by corridor,
  filterable by corridor and by the organisers' own kinds and tags.
- **Map** — corridor routes, pins in corridor colours, labels placed by
  collision avoidance, live location, walking distance per stop. See the map
  section below; it has a history.
- **Walking distances** — "6 min · 0.3 mi" on directory rows and the map sheet,
  plus a nearest-first sort. Verified against real Downtown geometry.
- **Venue photos** — pulled from the organisers' map, served through the web
  app's image optimiser (their CDN ignores resize params and serves 1.6MB PNGs).
  Only **14 of 56** venues have any; Dino is supplying the rest.
- **Passport** — stamps per venue, corridor completion, offline-first on the
  device with best-effort anonymous sync. Endpoint verified idempotent.
- **Artist submissions** — modelled field-for-field on the organisers' own form,
  with the artwork list as real columns rather than filename conventions.
- **Venue sync** — name the target night explicitly:
  `npm run sync:artnight -- --date=2026-10-01` (add `--apply` to write).

### Blocked on Logan, not on code

- **`SUPABASE_SERVICE_ROLE_KEY` is not set.** Artist portfolio and artwork
  uploads cannot work without it. Everything else in that pipeline is built and
  deployed; the signing endpoint returns a clear 503 saying exactly this.
- **`EMAIL_FROM` is blank**, so mail falls back to `onboarding@resend.dev`,
  which only delivers to the Resend account owner. **Artist submission
  notifications are therefore not reaching anyone.** Waiting on a DNS record
  from Dino — see `docs/email-setup-ask-dino.md`.

### Built but never exercised on a device

- The **artist submission form** — typechecks and bundles, but the image picker,
  upload and submit path have never run, because uploads are blocked above.

### Deliberately not built

- **Auth.** There is none. Profile type (attendee / artist / venue) is chosen on
  the Profile tab and stored on the device. It reveals a module; it grants
  nothing, and the server validates everything independently.
- **Venue submissions** — the second module, stubbed as "coming soon".
- **Onboarding** — the profile-type question belongs there when it exists.

## The map: read `docs/map-crashes.md` first

The map has now crashed hard five times across four native child-list failure
modes — `NSRangeException`, no red box, straight to the home screen.
`react-native-maps@1.20.1` (which **Expo Go SDK 54
pins and you cannot change**) has no Fabric components, so every MapView, Marker
and Polyline runs through the legacy interop layer.

Four cumulative rules keep it alive, all in `apps/mobile/src/EventMap.tsx`.
Undoing any one brings the crash back:

1. The number of MapView children never changes — filter with `opacity`.
2. Children are never mounted with the map — wait for `onMapReady`.
3. Never mount more than one Marker per frame.
4. Marker `zIndex` never changes, including on selection.

Plus: selection must restyle a marker, never resize it.

**The marker-tap question is resolved.** The iOS Simulator reproduced a harder
form of the reported symptom: tapping the anchor of a labelled marker crashed
Expo Go natively with `index 24 beyond bounds [0 .. 1]` (and, on the first run,
`index 25 beyond bounds [0 .. 2]`). Lifecycle logging showed `EventMap` render
once with all 56 markers and the selected id; it did not unmount or reset its
progressive marker count, so the suspected map-subtree remount was ruled out.

The cause was selection changing the marker's `zIndex` from -1 to 2, which the
legacy Fabric interop layer handles as a native child reorder. Keeping `zIndex`
at -1 made the exact tap open its sheet normally; switching among nearby
labelled and unlabelled markers then left every surrounding label in place. The
sticky placement remains useful against viewport nudges, but it was not the
missing fix for this failure.

## What to do next

Logan now has an **Apple Developer account** and Xcode on this machine. The map
has been run and checked in the simulator; the next job follows from those new
capabilities.

1. **Set up EAS Build and cut a development build.** That escapes Expo Go, which
   means `react-native-maps@1.29` with real Fabric components — and deleting all
   four workarounds plus `docs/map-crashes.md`. It also unlocks TestFlight so
   Dino can install the app from a link instead of a tunnel.
   - `eas login` will fail: Logan's Expo account is Apple SSO and has no
     password. Use `EXPO_TOKEN` instead — it authenticates as a robot user,
     which EAS Build accepts (it is the standard CI path). The same token does
     *not* work for `--tunnel`, which refuses robot users.

## After that

Roughly in order of value:

- **End-of-night passport summary** worth screenshotting, and a venue footfall
  readout for Dino — the argument for why a venue wants to be listed.
- **Venue submission module**, mirroring the artist one.
- **Onboarding**, which gives profile type a real home.
- **Privacy policy and terms** — an App Store requirement, and cheap to write
  accurately because the data collection is small and deliberate: email, phone
  and address only for submissions; location never leaves the device except as
  a "was near / was not near" boolean; check-ins identify a random per-install
  id and no person.
- `docs/launch-readiness.md` holds the older audit. Items 8, 9, 10, 12 and 13
  are still open. The Stripe production webhook matters before anything is ever
  sold and is easy to forget, because payments would succeed and issue no
  tickets, silently.

## Things that will surprise you

- **`AGENTS.md` is real and load-bearing.** Every entry cost hours. Read it.
- **Next.js 16 rejects any image `quality` outside `images.qualities`** — which
  defaults to `[75]` — with a 400 whose body says only
  `INVALID_IMAGE_OPTIMIZE_REQUEST`, indistinguishable from a `remotePatterns`
  miss.
- **Prisma 7 changed the migrate CLI.** `--from-url` and `--to-schema-datamodel`
  are gone; use `--from-config-datasource --to-schema`. Migrations must target
  `SUPABASE_DIRECT_URL`, not the pooler.
- **`prisma migrate dev` is dangerous here** — the database is live. Generate
  SQL with `migrate diff`, read it, then `migrate deploy`.
- **`tracksViewChanges` does nothing on Apple Maps.** It is only exported by the
  Google provider's marker manager.
- **A stale Metro or Next server** has cost this project real hours twice. An
  error that is byte-identical across attempts is evidence about the pipeline,
  not the code — check what is actually serving before diagnosing into the code.
- **Commit messages carry the reasoning.** Eighty-odd commits explain *why*
  things are shaped as they are. `git log` is documentation here.
