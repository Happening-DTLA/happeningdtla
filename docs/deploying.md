# Deploying the API

The web app is `apps/web`. It serves the API the phone talks to, the public
event pages, the organizer dashboard, and web checkout. Deploying it is what
makes the phone work anywhere — on cellular, at a venue, away from the laptop.

Target: **Vercel** for the app, **Supabase** for Postgres.

---

## 1. Supabase

Create a project at supabase.com. Region: **West US (North California)** or
similar — the database should be near Los Angeles, because every page load is a
round trip to it.

Supabase gives three connection strings. They are not interchangeable:

| Which | Port | Use it for |
| --- | --- | --- |
| **Direct** | 5432 | Nothing. IPv6-only — unreachable from most networks |
| **Session pooler** | 5432 (pooler host) | Migrations, seeding, and the deployed app |
| **Transaction pooler** | 6543 | The deployed app at scale, after testing |

**Use the session pooler for everything, including migrations.**

The direct connection is a trap: `db.<ref>.supabase.co` has **no IPv4 record**.
Supabase made direct connections IPv6-only, so any machine or platform without
an IPv6 route cannot resolve it at all — the failure is `ENOTFOUND`, which
looks like a wrong hostname rather than a missing protocol. Most home networks
and many serverless platforms are IPv4-only. The pooler hostnames
(`aws-0-<region>.pooler.supabase.com`) do have A records and work everywhere.

Session mode holds one connection per client for the life of the session, so
it behaves like a direct connection: migrations, advisory locks and prepared
statements all work. Transaction mode (port 6543) holds far more clients and
is where this goes at scale, but it does not keep a connection across
statements, which breaks prepared statements — and Prisma reaches Postgres
through node-postgres here. Test that deliberately rather than assuming it.

Note the session pooler's username is `postgres.<project-ref>`, not `postgres`.

### The TLS certificate

Supabase serves Postgres under its own private root — "Supabase Root 2021 CA" —
which is in no public trust store. Connections fail with **"self-signed
certificate in certificate chain"** until that root is supplied.

The internet's usual answer is `rejectUnauthorized: false`. Do not. On an app
that handles payments, that silently accepts a man-in-the-middle on the
database connection, and `src/lib/prisma.ts` refuses to do it.

Instead: **Project Settings → Database → SSL Configuration → Download
certificate**, then set the PEM as `DATABASE_CA_CERT`. In `.env` it must be
wrapped in double quotes so dotenv keeps the newlines; in Vercel, paste it
into the value box as-is.

It is a public certificate, not a secret. It expires **April 2031**.

Worth doing once: check the downloaded root's SHA-256 fingerprint against the
one the server actually presents.

```bash
openssl x509 -in prod-ca-2021.crt -noout -fingerprint -sha256
echo | openssl s_client -connect aws-0-<region>.pooler.supabase.com:5432 \
  -starttls postgres -showcerts 2>/dev/null \
  | awk '/BEGIN CERT/{n++} n==3' | openssl x509 -noout -fingerprint -sha256
```

They must match. Taking the root from the connection alone would be circular —
it proves nothing against the attack verification exists to stop.

## 2. Migrate and seed

From the repo root, with the DIRECT url:

```bash
cd apps/web && DATABASE_URL="<session-pooler-url>" npx prisma migrate deploy
```

`migrate deploy` applies existing migrations and never diffs, so it needs no
shadow database — which matters because Supabase's app user cannot create one.
Do not use `migrate dev` against a hosted database.

Then seed once, to get ArtNight and the demo events in:

```bash
cd apps/web && DATABASE_URL="<session-pooler-url>" npx prisma db seed
```

The seed **deletes every row it manages** before inserting. It is safe now and
must never be run once real orders exist.

## 3. Vercel

Import the GitHub repo. It is a monorepo, so:

- **Root Directory:** `apps/web`
- **Framework preset:** Next.js
- **Install/Build:** leave as detected. `postinstall` runs `prisma generate`,
  which is what creates the client — it is gitignored, not committed.

`transpilePackages: ["@dtlahappening/core"]` is already set in
`next.config.ts`, so the shared package compiles from source.

## 4. Environment variables

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **session pooler** url |
| `DATABASE_POOL_MAX` | `1` — see below |
| `DATABASE_CA_CERT` | Supabase's root CA, PEM. Without it, every query fails |
| `NEXT_PUBLIC_APP_URL` | The deployed origin, e.g. `https://…vercel.app` |
| `STRIPE_SECRET_KEY` | Test key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Test key |
| `STRIPE_WEBHOOK_SECRET` | From the new endpoint in step 5 — NOT the `stripe listen` one |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk |
| `CLERK_SECRET_KEY` | Clerk |
| `RESEND_API_KEY` | Optional; without it, emails log instead of sending |
| `ALLOWED_ORIGINS` | Only if a browser on another origin calls the API |

**`DATABASE_POOL_MAX=1` is not a typo.** Every serverless instance opens its
own pool, so the real connection count is pool size × live instances. The local
default of 6 across a few dozen instances exhausts Postgres. One connection per
instance, in front of a pooler, is the correct shape.

Do **not** set `ADMIN_API_SECRET`. It is a development escape hatch and the
code refuses it in production anyway.

## 5. Stripe webhook

`stripe listen` is a laptop tool. Production needs a real endpoint:

Stripe Dashboard → Developers → Webhooks → Add endpoint

- URL: `https://<your-domain>/api/webhooks/stripe`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy. Until this
is done, payments succeed and **no tickets are issued** — silently, because
nothing watches for it. See `launch-readiness.md`, finding 8.

## 6. Point the phone at it

The app reads `EXPO_PUBLIC_API_URL` before falling back to the laptop's LAN
address, so:

```bash
cd apps/mobile && EXPO_PUBLIC_API_URL=https://<your-domain> npx expo start
```

Now the phone works on cellular, anywhere. This is what makes the app usable
while walking Downtown on ArtNight.

## 7. Check it actually works

```bash
curl -s https://<your-domain>/api/nights/upcoming | head -c 300
curl -s "https://<your-domain>/api/events/search" | head -c 300
```

Both should return JSON. A 500 almost always means `DATABASE_URL` is wrong or
still pointing at a pooler that cannot serve the query — check the Vercel
function logs, which name the failing query.

## Known gaps at launch

- **Emails reach only the Resend account address** until a sending domain is
  verified. On web, email *is* ticket delivery.
- **Charges route through the platform**, not the venue, for any organizer that
  has not completed Stripe Connect onboarding.

## Opening the app away from your laptop

The development client fetches the JS bundle from Metro at a LAN address, so on
any other network there is nothing for it to load — the Vercel API being public
does not help, because that is the data and not the code.

```bash
npm run start:anywhere
```

Routes the bundle through Expo's tunnel instead of the LAN and points the app
at the deployed API. Open the printed development-client URL in the installed
DTLAHappening development build; Expo Go cannot run this repo's map binary.

The host is derived from the project, not the session, so **it survives a
restart** — verified by restarting twice and comparing. It contains the word
`anonymous` because no Expo account is logged in; that is cosmetic and does not
make it unstable. Do not go looking for an account to fix it.

Two things that do not work, both confirmed the hard way:

- `expo login` cannot sign in an account created with Sign in with Apple. That
  account has no password, so every attempt fails as a wrong password.
- Expo CLI rejected the token-authenticated session when starting ngrok with
  `Cannot use ngrok with a robot user`. EAS Build accepts the same personal
  access token; this limitation is specific to the tunnel path that was tested.

The command runs under `caffeinate`, which holds the no-sleep assertion only
for as long as the server does — so the Mac stays awake while previewing and
goes back to its normal behaviour the moment you stop it. Nothing to remember
to undo. (Doing it in System Settings instead: Energy Saver, "Prevent
automatic sleeping when the display is off". The display may still sleep;
that is fine and does not drop the tunnel.)

The machine has to stay awake and running the command, and the URL is public
while it does. Not needing the laptop at all means a build installed on the
device, which needs the Apple Developer account.

## Signed physical-iPhone development build

This is an **ad-hoc development client**, not a simulator build and not
TestFlight. It has the real native modules, installs directly on selected
iPhones, and still loads JavaScript from Metro while developing.

### Requirements

- An active paid Apple Developer Program membership.
- An Apple team member allowed to create certificates, identifiers and
  profiles. An individual membership requires the Account Holder. For an
  organization, use the Account Holder or Admin; an App Manager also works if
  `Access to Certificates, Identifiers & Profiles` is enabled.
- Every iPhone's UDID registered before the build. Ad-hoc builds install only
  on devices included in their provisioning profile.
- Developer Mode enabled on every test iPhone running iOS 16 or later:
  **Settings → Privacy & Security → Developer Mode**, then restart and confirm.
- The Expo personal access token in the gitignored
  `apps/mobile/.env.eas.local`. Never paste it into docs, chat, shell history or
  Git.
- The Apple Account email, password and two-factor authentication available
  locally for the first interactive credential setup. This is separate from
  Expo authentication. EAS can create and manage the Apple Distribution
  certificate and ad-hoc provisioning profile.

### Register the test iPhones

From `apps/mobile`, load the EAS token without printing it and start device
registration:

```bash
set -a
source .env.eas.local
set +a
npx eas-cli@latest device:create
```

Choose the website registration method. Open its URL on each iPhone and follow
the iOS profile-install prompts. Register Logan's phone and Dino's phone before
building so one artifact can install on both.

Registration in Expo is only the first half: EAS adds the UDIDs to Apple's
developer portal when it generates the provisioning profile. On a new or
recently renewed Apple membership, Apple may take **24–72 hours** to process a
new device. The first build may therefore fail even when registration was done
correctly; wait for Apple, then rebuild.

Check the registered list at any time:

```bash
npx eas-cli@latest device:list
```

### Build and install

The `development` profile in `apps/mobile/eas.json` already sets
`developmentClient: true` and `distribution: internal`:

```bash
npx eas-cli@latest build --platform ios --profile development
```

The first run is intentionally interactive. Log in to the Apple Account, use
two-factor authentication, allow EAS to create or reuse the distribution
certificate and ad-hoc provisioning profile, and select every registered test
device. Do not use `--non-interactive` for this first credential setup.

When the build finishes, open its install URL on an included iPhone or scan the
EAS dashboard's install QR code. A phone registered after the build cannot
install that artifact; make a new build or re-sign the existing one with an
updated provisioning profile.

Start Metro before opening the development client:

```bash
# Same LAN
npm run start

# Away from the Mac's network
npm run start:anywhere
```

The Mac must remain awake and Metro must remain running. A signed development
client removes Expo Go's native-module limits; it does not embed a release JS
bundle.

### TestFlight is the laptop-independent path

TestFlight is separate from EAS internal distribution. It uses a production
App Store build, does not require device UDIDs or Developer Mode, and embeds
the JavaScript bundle. Once the physical-device checks pass, create the App
Store Connect record, run a production EAS build, and submit that artifact to
TestFlight. Do not reuse the ad-hoc development build as a TestFlight build.

Official references: [Expo's physical iPhone development-build guide](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/),
[internal distribution and device registration](https://docs.expo.dev/build/internal-distribution/),
[Apple roles required by EAS](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/),
and [Apple's Developer Mode instructions](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).
