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
| **Direct** | 5432 | Migrations and seeding, run from a laptop |
| **Session pooler** | 5432 (pooler host) | The deployed app — safe default |
| **Transaction pooler** | 6543 | The deployed app at scale, with caveats |

**Start with the session pooler for the app.** The transaction pooler is the
one you eventually want — it holds far more clients — but it does not keep a
connection across statements, which breaks prepared statements. Prisma reaches
them through node-postgres here, so transaction mode needs testing rather than
assuming. Session mode has neither problem and is plenty for now.

Migrations must use the **direct** connection. A pooler will not reliably hold
the advisory lock that `migrate deploy` takes.

## 2. Migrate and seed

From the repo root, with the DIRECT url:

```bash
cd apps/web && DATABASE_URL="<direct-url>" npx prisma migrate deploy
```

`migrate deploy` applies existing migrations and never diffs, so it needs no
shadow database — which matters because Supabase's app user cannot create one.
Do not use `migrate dev` against a hosted database.

Then seed once, to get ArtNight and the demo events in:

```bash
cd apps/web && DATABASE_URL="<direct-url>" npx prisma db seed
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
