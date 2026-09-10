# DTLAHappening — handoff

Rewritten 6 September 2026. Read this, then `AGENTS.md` for the code-level
rules before touching the map.

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
2. **`apps/web/.env`** — there is no other machine to copy it from, and Vercel
   cannot give it back: all 11 production variables are marked Sensitive, so
   `vercel env pull` writes `[SENSITIVE]` placeholders. Rebuild it from
   `.env.example` plus the Supabase, Stripe, Clerk and Resend dashboards.
   `DATABASE_URL` and `SHADOW_DATABASE_URL` do not need copying at all —
   `npm run db:start` writes fresh local ones. Run `vercel env pull` to a
   scratch filename anyway: it tells you which keys production has set.
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
  device with a durable AsyncStorage sync queue. It retries on launch,
  foreground and reconnection; restart, concurrent enqueue and lost-response
  replay are covered by an automated test, and API replay was verified in the
  simulator.
- **Artist submissions** — modelled field-for-field on the organisers' own form,
  with the artwork list as real columns rather than filename conventions. The
  iOS 18 form, permission prompt, photo picker and image selection are verified;
  the expected storage 503 is the current stopping point.
- **App Store groundwork** — public privacy, terms and support routes; product
  copy, privacy-answer draft and six-frame screenshot plan in
  `docs/app-store-submission.md`.
- **Error reporting code** — Sentry is integrated into native mobile, web and
  API errors with PII-heavy features disabled. It activates after the manual
  project/credential setup in `docs/error-reporting.md`.
- **Venue sync** — name the target night explicitly:
  `npm run sync:artnight -- --date=2026-10-01` (add `--apply` to write).

### Blocked on Logan, not on code

- ~~**`SUPABASE_SERVICE_ROLE_KEY` is not set.**~~ **Done.** It is set in Vercel,
  and the whole pipeline was verified end to end on 10 September 2026 — sign,
  PUT the bytes, read the public URL, delete — every step 200, in production and
  locally. The `submissions` bucket exists, is public, caps at 25MB and allows
  jpeg/png/webp/heic/heif. Two traps if you retest it: the public object URL is
  CDN-cached so a GET keeps returning 200 for a while after a delete (confirm
  with a service-role `object/list`), and a *missing* object returns HTTP **400**
  whose body says `"statusCode":"404"`.
- **Email is blocked on DNS, not on `EMAIL_FROM`.** `EMAIL_FROM` *is* set in
  Vercel (it is one of the write-only Sensitive vars, which is why
  `/api/health` never showed it). The real problem is that
  `send.dtlaartnight.com` has **no MX, no SPF and no DKIM** — Resend domain
  verification was never completed. The apex resolves and runs Google Workspace
  mail, so DNS is live and reachable; the records were simply never added.
  Resend rejects every send, `send()` swallows the error, and the API returns
  200. **Artist submission notifications reach nobody.**
  DNS is at **GoDaddy** (`ns75/ns76.domaincontrol.com`) — that answers question
  one of the message in `docs/email-setup-ask-dino.md`, so drop it from the ask.
  Because this is indefinite, `/admin/submissions` now reads the database
  directly; nothing depends on mail working.

### Exercised but configuration-blocked

- The **artist submission form** now runs through image selection on an iOS 18
  simulator. The production signing endpoint then returns the documented 503.
  A separate iOS 26.3 simulator run exposed a PhotosPicker loading hang in that
  runtime; the same app path works on iOS 18.5, so this is not being treated as
  a form regression. Upload, database creation and organizer email still need
  the Supabase service-role key and Resend DNS before end-to-end completion.

### Deliberately not built

- **Auth.** There is none. Profile type (attendee / artist / venue) is chosen on
  the Profile tab and stored on the device. It reveals a module; it grants
  nothing, and the server validates everything independently.
- **Venue submissions** — the second module, stubbed as "coming soon".
- **Onboarding** — the profile-type question belongs there when it exists.

## The map

The app now uses `react-native-maps@1.29` in a development client. Xcode compiled
`RNMapsMapView`, `RNMapsMarker` and their generated Fabric specs, and the iOS
Simulator loaded the complete 56-stop map. The four Expo Go interop workarounds
were removed: filters now add and remove markers normally, map children mount
immediately, markers mount together, and a selected marker can change z-order.

Expo Go is no longer a supported runtime for this repo because its fixed SDK 54
binary contains react-native-maps 1.20.1. Use the development client scripts in
`apps/mobile/package.json`; after any native dependency change, rebuild it.

## What to do next

The Expo project is linked as `@logan_tierno/dtlahappening` (project id
`70169062-3300-4455-b53c-3327511ab869`). EAS build
`2b343b4e-6e43-4355-8a85-dfe84bd8ba38` produced the first iOS simulator
development client. That exact cloud artifact was installed in the dedicated
iPhone 17 Pro simulator: the 56-marker Fabric map rendered, marker selection
opened its venue sheet, and neighbouring labelled markers remained visible.

1. **Cut a signed iPhone development build and install it on physical devices.**
   - Register Logan's and Dino's iPhone UDIDs with `eas device:create` first.
     The simulator build did not require signing; the device build needs an
     authorized Apple Developer login to create or reuse the distribution
     certificate and ad-hoc provisioning profile.
   - Enable Developer Mode on both iPhones. A newly registered device on a new
     Apple membership can take 24–72 hours to become available for profiles.
   - Authenticate EAS with the gitignored `apps/mobile/.env.eas.local` token;
     never paste or commit that token.
   - Run `eas build --platform ios --profile development` interactively for the
     first credential setup. Full prerequisites and install steps are in
     `docs/deploying.md` under "Signed physical-iPhone development build".

## After that

Roughly in order of value:

- **Finish release-service configuration** — create the Sentry projects and
  alerts from `docs/error-reporting.md`, set the Supabase service-role key, and
  finish Resend DNS. Never put those values in chat or Git.
- **End-of-night passport summary** worth screenshotting, and a venue footfall
  readout for Dino — the argument for why a venue wants to be listed.
- **Venue submission module**, mirroring the artist one.
- **Onboarding**, which gives profile type a real home.
- **Final App Store screenshots** — layouts and captions are ready; capture them
  only from the physical-device-validated build.
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
