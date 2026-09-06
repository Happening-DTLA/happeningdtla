# Getting the app's email working — what to ask Dino

Plain-English version. Read this, send Dino the message near the bottom, done.

## What's wrong right now

The app can't send email to anyone.

When someone submits an artist application, the app saves it correctly — but
the email telling Dino and Michael about it **never arrives**. It's not lost;
it's just never delivered.

## Why

Email providers won't let you send email from a domain unless the domain's
owner has said it's allowed. Otherwise anyone could send email pretending to be
anyone.

Right now we haven't proved we're allowed to send as `dtlaartnight.com`, so our
provider (Resend) refuses to deliver.

Proving it means adding a few lines of text to the domain's settings. Dino (or
whoever runs the website) is the only person who can do that.

## The one thing to get right

**Ask for a subdomain: `send.dtlaartnight.com` — not `dtlaartnight.com`.**

Think of the domain as a building and a subdomain as one room in it. We're
asking for a room, not the building.

This matters for two reasons:

1. **It can't break their existing email.** If ArtNight's normal email runs on
   `dtlaartnight.com`, changing settings on the main domain can stop it working.
   Changes to a subdomain can't touch it.
2. **It keeps reputations separate.** If the app ever sends a lot of mail and
   someone marks it as spam, that reflects on `send.dtlaartnight.com` and not on
   the address Dino runs his business from.

It also makes it much easier for him to say yes.

## Important: you can't ask him for the records yet

The records don't exist until you create them. Resend generates them — one of
them is a security key unique to your domain — the moment you add the domain.

So the order is:

1. **You** add `send.dtlaartnight.com` in Resend.
2. **Resend** shows you three records.
3. **You** send those exact records to Dino.
4. **Dino** pastes them in.
5. **You** click "Verify" in Resend.

What you're asking Dino for *today* is access and permission, not the records.

## Message to send Dino

> Hey — I need to set up email for the app so submissions and notifications
> actually reach you. To do that I need three small records added to the
> dtlaartnight.com domain settings.
>
> Four quick questions:
>
> 1. **Where is DNS managed for dtlaartnight.com?** That's whoever has the
>    control panel for the domain — the registrar, or something like Cloudflare.
> 2. **Can you add records yourself, or is there a web person who handles it?**
> 3. **Does dtlaartnight.com already send email** — Google Workspace, Outlook,
>    anything? I need to know so I don't interfere with it.
> 4. **Can I use a subdomain, `send.dtlaartnight.com`?** It's separate from your
>    main domain and can't affect your existing email at all.
>
> Once you confirm, I'll send you exactly three lines to paste in. Five minutes.

## If Dino asks "is this safe?"

Fair question, and the honest answers:

- **It cannot affect the website.** These records are only about email.
- **It cannot affect existing email**, because it's on a subdomain.
- **It is reversible.** Delete the three records and it's exactly as before.
- **It does mean his domain vouches for the app's email.** That's real, and it's
  why the subdomain matters — the trust is scoped to that one room.

## What the three records look like

Roughly this shape. **Do not copy these values** — the real ones come from
Resend and one of them is unique to your domain.

| Type | Name | What it's for |
|---|---|---|
| MX | `send` | Where bounces and complaints go |
| TXT | `send` | Says our provider is allowed to send |
| TXT | `resend._domainkey` | The security key that signs each email |

## After Dino adds them

1. Click **Verify** in Resend. Usually a few minutes; occasionally a few hours.
2. Set these two values in `apps/web/.env` **and** in Vercel's environment
   variables (Settings → Environment Variables), then redeploy:

   ```
   EMAIL_FROM=DTLA Art Night <hello@send.dtlaartnight.com>
   SUBMISSIONS_EMAIL=info@dtlaartnight.com
   ```

   `EMAIL_FROM` is who the email comes from. `SUBMISSIONS_EMAIL` is where artist
   applications get sent.

3. Submit a test artist application and check it arrives.

Until step 2 is done, nothing changes — the app keeps failing to deliver even
after the domain verifies. Both values have to be set in **both** places.
