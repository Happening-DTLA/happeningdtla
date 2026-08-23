<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DTLAHappening

A ticketing + event-discovery PWA for Downtown Los Angeles. Read
`docs/ROADMAP.md` for what is being built and in what order.

## Before changing anything money- or ticket-related

`prisma/schema.prisma` documents invariants in comments. The load-bearing ones:

- **Never oversell.** Increment `TicketType.quantitySold` with a conditional
  `UPDATE … WHERE quantitySold + n <= quantity` inside a transaction. Never
  read-then-write; concurrent buyers will oversell and someone gets turned away
  at a door holding a valid ticket.
- **Webhooks are at-least-once.** Insert the Stripe event id into
  `WebhookEvent` in the same transaction that fulfils the order. A unique
  violation means "already handled".
- **First scan wins.** Admit via `UPDATE … WHERE checkedInAt IS NULL`. Log every
  attempt to `Scan`, including duplicates and unknown codes.
- **Money is integer cents.** Never float, never `Decimal` for currency.
- **Ticket codes must be unguessable.** Use `newTicketCode()`.
- **Show all-in pricing** on every surface that displays a price. Use
  `priceBreakdown()` and show `totalCents`.

## Dates

Two kinds, formatted differently — see `src/lib/datetime.ts`. `Event.startsAt`
is an instant (Pacific). `Night.date` is a Postgres `date` (format in **UTC**,
or the first Thursday renders as a Wednesday). Always use the helpers.

## Local environment

- Dev server runs on **port 3100** (3000 may be taken by an unrelated project).
- The database is local via `prisma dev`; `npm run db:start` writes the URL into
  `.env` because the port is assigned dynamically. Don't hardcode it.
- Do not run `npm audit fix --force` — the sole advisory is in the Prisma CLI's
  config loader and the "fix" downgrades Prisma to v6.
