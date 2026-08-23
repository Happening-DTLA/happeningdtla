# Working together

Two developers, two cities, one `main`. The rules are deliberately few.

## Setup

```bash
git clone <repo-url>
cd dtlahappening
npm install
npm run setup
npm run dev
```

Your database is **yours** — `prisma dev` runs a Postgres on your own machine.
You cannot break the other person's data, and there is no shared dev database
to fight over.

Copy `.env.example` to `.env` and fill in the Clerk/Stripe keys. `npm run setup`
fills in the database URL for you.

## Branching

`main` is always deployable. Never commit to it directly.

```bash
git checkout -b feat/checkout-flow
# …work…
git push -u origin feat/checkout-flow
```

Open a PR. The other person reviews it. Small PRs get reviewed same-day; a
1,500-line PR sits for three days and gets rubber-stamped, which is worse than
no review at all.

Branch names: `feat/`, `fix/`, `chore/`, `docs/`.

## Before you push

```bash
npm run typecheck
npm run lint
```

## Schema changes

Editing `prisma/schema.prisma` requires a migration in the same commit:

```bash
npm run db:migrate -- --name add_refunds
```

Commit the generated folder under `prisma/migrations/`. **Never** edit a
migration that has already been pushed — write a new one. When you pull someone
else's schema change, run `npm run db:migrate` to apply it locally.

## Money code

Anything touching `Order`, `Ticket`, `TicketType.quantitySold`, or a Stripe
webhook gets reviewed by the other person before merge — no exceptions, even for
a one-liner. The failure mode isn't a broken page, it's someone being turned
away at a door holding a ticket they paid for, or a double charge.

The invariants are documented in the comments in `prisma/schema.prisma`. Read
them before changing anything in that area.

## Secrets

Never commit `.env`. Use Stripe **test** keys (`sk_test_…`) locally — a live key
in a dev environment charges real cards. If a key is ever committed, rotate it
immediately in the provider dashboard; removing the commit is not enough,
because it is already in the push history.
