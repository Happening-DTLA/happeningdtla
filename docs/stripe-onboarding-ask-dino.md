# Getting paid through the app — what to ask Dino and Michael

Plain-English version, like `email-setup-ask-dino.md`. Read this, do the two
things on your side, then send them the message near the bottom.

---

## What this unlocks

The app can now take artist submission fees and vendor booth fees. It charges
exactly what dtlaartnight.com charges — $36.40 for a $35 submission, $51.86 for
a $50 booth — and the money goes **to Happening in DTLA**, not to us. The
platform takes nothing.

None of it can collect a cent until Happening in DTLA has a Stripe account
connected to the app. That is the only thing standing between here and working
payments, and it is theirs to complete, not ours.

## The important part to get right when you explain it

**This is their Stripe account, not ours.** They own it. Money from a booth fee
lands in their bank, not ours and then theirs. They get a real Stripe dashboard
and can see every payment, issue refunds, and pull reports without asking us.

That is a deliberate choice and worth saying out loud, because the alternative
would have been us collecting their money and passing it on — which would make
us responsible for their refunds and their disputes, and would mean their
revenue sitting in someone else's account.

**We never see their bank details or their ID.** Every one of those fields is
entered on Stripe's own pages. We create an empty account, hand over a link,
and read back one thing afterwards: whether Stripe says they can accept
payments. Nothing sensitive passes through the app.

## Two things on your side first

### 1. Grant the first login

Nobody is a member of the DTLA ArtNight business in the app yet — I checked
production, it has zero. Every normal route in is by invitation, and an
invitation has to come from someone already inside, so the first person has to
be added from a terminal:

```bash
npm run grant:organizer --workspace apps/web -- --email=dino@example.com
```

That is a dry run. Add `--apply` to actually do it. **They must have signed in
to the app once first** — that is what creates the account this attaches to, and
the script will tell you if they haven't.

One gotcha the script now refuses rather than lets you walk into: it reads the
production database but uses whatever Clerk keys are in your local `.env`, which
are test keys. Test and live Clerk hold different people with different ids, so
granting access with the wrong ones writes a row that looks right and leaves
them locked out. Run it with production's `CLERK_SECRET_KEY` in the environment.

### 2. Check the Stripe key

The app charges on a **live** key in production. Confirm `STRIPE_SECRET_KEY` in
Vercel is `sk_live_…`, not a test key — a test key takes test cards happily and
moves no real money.

## What they will need to hand Stripe

Worth sending ahead so they can gather it once rather than abandoning the form
halfway:

- **Legal business name and structure** — LLC, sole proprietorship, whatever
  Happening in DTLA actually is.
- **EIN**, or their SSN if it is a sole proprietorship.
- **Business address** and phone.
- **Bank account** — routing and account number, for payouts.
- **A government photo ID** for whoever completes it.
- **Anyone owning 25% or more** of the business, with the same details.
- **Website** — dtlaartnight.com.
- **What they sell and roughly how much**: booth fees and submission fees,
  first Thursdays.

## The steps

1. They sign in to the app once, so an account exists.
2. You run the grant command above with `--apply`.
3. They sign in again and open **Payouts** in the venue dashboard.
4. They press connect, which drops them into Stripe's own onboarding.
5. They fill it in — 10–20 minutes with the list above to hand.
6. Stripe verifies. Often instant; sometimes it asks for a document and takes
   a day or two.
7. The app hears back automatically and starts accepting payments.

Step 7 needs no action from anyone: Stripe sends an `account.updated` event, the
app records it, and fees begin working the moment Stripe says charges are
enabled. Until then `/api/fees/:id` returns a clear "not set up yet" rather
than quietly charging the wrong account.

## Message to send Dino

> Hey — the app can now take the submission and booth fees, at exactly the
> prices on the website. The money goes straight to your Stripe, not to us; you
> get the dashboard, the payouts and the ability to refund anything without
> asking me.
>
> To switch it on you need to connect a Stripe account for Happening in DTLA.
> It's Stripe's own form, about fifteen minutes, and I never see any of it —
> bank details and ID go directly to them.
>
> Worth having ready before you start:
>
> - Legal business name and structure (LLC, sole prop, etc.)
> - EIN, or SSN if it's a sole proprietorship
> - Business address and phone
> - Bank account for payouts — routing and account number
> - A photo ID for whoever fills it in
> - Details for anyone owning 25%+ of the business
>
> First, can you sign in at the app once and tell me? That creates the account
> I attach the permissions to. Then I'll send you straight to the connect
> screen.
>
> Two things worth knowing: Stripe sometimes asks for an extra document and can
> take a day or two, so it's worth starting before the October night rather
> than during it. And this is genuinely your account — if you ever stop using
> the app, the Stripe account and its history stay yours.

## If they ask "is this safe?"

Fair question, and the honest answers:

- **The money never touches our account.** Charges are created on theirs.
- **We never see bank details or ID.** Those go to Stripe directly.
- **They can revoke it.** Disconnecting the app in Stripe stops it, and the
  account and history remain theirs.
- **They own disputes and refunds**, which is the flip side: if a vendor
  disputes a booth fee, Stripe takes it up with them, not us. That is what
  owning the money means, and it matches how their website already works.

## What "done" looks like

In the app's Payouts screen: connected, charges enabled, payouts enabled, and
no outstanding requirements listed. At that point run a real booth fee through
with a test card before the night, so the first live payment is not the first
payment anyone has ever tried.

## Notes for whoever picks this up next

- The account is created as a **full** (Standard-equivalent) Connect account,
  not Express. Express would force the platform to collect fees and absorb
  losses, which is exactly the liability this arrangement avoids. See
  `DEFAULT_SETUP` in `apps/web/src/lib/connect.ts`.
- It is declared under MCC **7922**, ticketing. Declaring event ticketing
  honestly up front is what avoids a payout freeze on the night.
- Onboarding links are single-use and expire in minutes, so they are generated
  on demand. Do not save one and send it later.
- Which business collects is `ARTNIGHT_ORGANIZER_SLUG`, defaulting to
  `dtla-artnight` — the same slug `sync-artnight.ts` requires, so production
  already has it.
