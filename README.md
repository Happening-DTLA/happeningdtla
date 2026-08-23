# DTLAHappening

Every gallery, rooftop and warehouse opening in Downtown Los Angeles — with
tickets that live here and nowhere else.

The anchor event is **Art Night DTLA**, the first Thursday of every month.
Unlike Eventbrite, which models one event = one venue = one ticket, this app
treats a **Night** as the first-class object: many venues, one evening, people
moving between them.

---

## Repo layout

```
apps/web        Next.js — API, public event pages, organizer dashboard
apps/mobile     Expo / React Native — the App Store app
packages/core   shared types + pure logic, imported by both
```

The web app is not a stepping stone to the native one; both ship. A ticket
link sent by text has to open a real page, event pages need to be shareable
and indexable, and organizers want a dashboard on a laptop.

## Get running

Requires Node 20.9+. No Docker, no Homebrew, no Postgres install — the local
database is provided by `prisma dev`.

```bash
npm install
npm run setup      # local Postgres, migrate, seed
npm run web        # http://localhost:3100
```

For the native app, in a second terminal:

```bash
npm run mobile
```

Install **Expo Go** on your phone from the App Store, make sure the phone is on
the same WiFi, and scan the QR code the command prints. No Xcode required.

> **Don't bump the Expo SDK just because a newer one exists.** The project is
> pinned to **SDK 56** because that is what the App Store build of Expo Go can
> run. `create-expo-app` installs the newest SDK, which ran ahead of the
> shipped client and produced "Project is incompatible with this version of
> Expo Go" on a phone that was already fully up to date. Before upgrading,
> check the client version for that SDK at
> https://api.expo.dev/v2/versions/latest and confirm Expo Go has caught up.
> This constraint disappears once we move to a development build, which we
> need anyway for camera scanning.
`npx expo start --web` renders the same React Native code in a browser, which
is useful for quick checks but is not what ships.

`npm run setup` prints a couple of **scannable ticket codes** from the seeded
order — keep those, they're what you'll test the door scanner with.

### Everyday commands

| Command | What it does |
| --- | --- |
| `npm run web` | Next.js dev server on :3100 |
| `npm run mobile` | Expo dev server — scan with Expo Go |
| `npm run db:start` | Boot local Postgres, write `DATABASE_URL` into `.env` |
| `npm run db:stop` | Shut the local database down |
| `npm run db:migrate` | Create + apply a migration after editing the schema |
| `npm run db:seed` | Reset seed data |
| `npm run db:reset` | Wipe and rebuild the database from migrations |
| `npm run db:studio` | Browse the data in a GUI |
| `npm run typecheck` | `tsc --noEmit` |

## Stack

- **Next.js 16** (App Router, Turbopack) — backend, public event pages,
  organizer dashboard. Also installable as a PWA.
- **Expo / React Native** — the App Store and Play Store client.
- **Prisma 7** + Postgres. Note Prisma 7 requires a driver adapter — there is no
  `url` in `schema.prisma`; it lives in `prisma.config.ts`.
- **Tailwind v4**, dark-first. This app is used outdoors at night, one-handed.
- **Clerk** for auth, **Stripe Connect** for payments (see ROADMAP).

## Layout

```
prisma/schema.prisma     the domain model — read the comments, they document
                         the ticketing invariants that must not be broken
prisma/seed.ts           fictional but realistic DTLA data
scripts/dev-db.mjs       one-command local database
src/lib/prisma.ts        db client (TLS on for remote, off for local)
src/lib/money.ts         integer cents + all-in pricing
src/lib/datetime.ts      Pacific vs. calendar-date formatting — read this
src/lib/ticket-code.ts   unguessable ticket codes
src/lib/queries.ts       data access, shared between pages and handlers
src/app/                 routes
docs/ROADMAP.md          what we're building, in order, and why
```

## Two things that will bite you

**Don't run `npm audit fix --force`.** The one flagged advisory is
`deepmerge-ts` inside the Prisma *CLI's* config loader — not the query engine,
not reachable from user input. The "fix" downgrades you to Prisma 6, which is a
breaking change. Leave it.

**Dates come in two flavours.** `Event.startsAt` is a real instant (format in
Pacific). `Night.date` is a Postgres `date` — a wall-calendar day with no zone,
which Postgres returns as midnight UTC. Format that one in **UTC** or "first
Thursday" renders as a Wednesday. Use the helpers in `src/lib/datetime.ts`;
they exist because this bug already happened once.
