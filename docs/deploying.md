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

Expo Go does not contain the app. It fetches the JS bundle from Metro at a LAN
address, so on any other network there is nothing for it to load — the Vercel
API being public does not help, because that is the data and not the code.

```bash
npm run start:anywhere
```

Routes the bundle through Expo's tunnel instead of the LAN and points the app
at the deployed API, so the phone needs the laptop for neither. Then open
`exp://<host>` in Expo Go, where `<host>` is printed as the tunnel URL.

The host is derived from the project, not the session, so **it survives a
restart** — verified by restarting twice and comparing. It contains the word
`anonymous` because no Expo account is logged in; that is cosmetic and does not
make it unstable. Do not go looking for an account to fix it.

Two things that do not work, both confirmed the hard way:

- `expo login` cannot sign in an account created with Sign in with Apple. That
  account has no password, so every attempt fails as a wrong password.
- `EXPO_TOKEN` authenticates as a *robot* user, and Expo refuses to open an
  ngrok tunnel for one: `Cannot use ngrok with a robot user`.

The command runs under `caffeinate`, which holds the no-sleep assertion only
for as long as the server does — so the Mac stays awake while previewing and
goes back to its normal behaviour the moment you stop it. Nothing to remember
to undo. (Doing it in System Settings instead: Energy Saver, "Prevent
automatic sleeping when the display is off". The display may still sleep;
that is fine and does not drop the tunnel.)

The machine has to stay awake and running the command, and the URL is public
while it does. Not needing the laptop at all means a build installed on the
device, which needs the Apple Developer account.
