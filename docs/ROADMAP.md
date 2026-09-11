# Roadmap — to DTLA Art Night, Thursday 1 October 2026

Updated 11 September 2026. **20 days.**

> For the current state of play — what is deployed, what is blocked and on whom,
> and the decisions already settled — read `docs/HANDOFF.md` first. This file is
> the plan; that one is the position.

## The one thing that matters

A person can install the native app, see the current Art Night rather than last
month's, use the map while walking Downtown, and keep a passport that survives
bad signal and an app restart.

This is now an **Art Night-first product**. The scope Logan set on 10 September
2026 is the Art Night app, complete: **ticketing, artist submissions and vendor
participation submissions**, reaching parity with what dtlaartnight.com offers.
Ticketing's concurrency invariants remain load-bearing; the flags
(`EXPO_PUBLIC_TICKETING` / `NEXT_PUBLIC_TICKETING`) decide when it is shown, not
whether it is maintained.

Nothing in the wider scope moves before 1 October. A reliable directory, map,
passport and distribution pipeline is still the only thing that has a date.

## 6–8 September — make the monthly product real

- [x] Stop `/api/nights/upcoming` from returning past nights. Its lower bound
      uses today's Los Angeles calendar date, represented as UTC for the
      Postgres `date` column.
- [x] Populate the October 1 production Night with the organizers' current
      56-stop directory. Move the six ticketing fixtures to a separate
      unpublished demo Night without changing their event ids, orders or
      tickets.
- [x] Make venue sync require an explicit date so October cannot accidentally
      update September's historical record.
- [x] Set up EAS Build with `EXPO_TOKEN` and cut an iOS simulator development
      build. Install the cloud artifact and smoke-test its 56-marker Fabric map.
- [x] Upgrade the local development build to `react-native-maps@1.29`, verify
      its real Fabric components in Xcode and the iOS Simulator, then remove
      the four Expo Go interop workarounds and obsolete crash write-up.

## 9–13 September — prove it on devices

- [ ] Register Logan's and Dino's iPhone UDIDs, enable Developer Mode, and cut
      the first signed ad-hoc development build with the EAS `development`
      profile. Allow 24–72 hours for Apple to process devices on a new account.
- [ ] Test fresh install, denied/granted location, map selection and filtering
      on at least two physical iPhones.
- [ ] Walk a real Downtown route with weak connectivity. Verify live location,
      nearest-first distances, map recentering and passport persistence.
- [ ] Exercise the artist submission form end to end on a device: image picker,
      signed upload, submission and organizer email.
- [x] Set `SUPABASE_SERVICE_ROLE_KEY`. Set in Vercel and verified end to end on
      10 Sep — sign, upload, public read and delete all return 200, in
      production and locally.
- [ ] **Finish Resend DNS.** `EMAIL_FROM` is already set; the blocker is that
      `send.dtlaartnight.com` has no MX, SPF or DKIM record at all. DNS is at
      GoDaddy. Until then every submission notifies nobody — see
      `docs/email-setup-ask-dino.md`.
- [x] Give submissions somewhere to be seen that does not depend on email.
      `/admin/submissions` reads the database directly, gated on `ADMIN_EMAILS`
      because `ArtistSubmission` has no organizer to scope it by.

## 14–20 September — establish the release path

- [ ] Produce a TestFlight internal build and install it from a clean device,
      not from Xcode or Expo Go.
- [x] Add privacy policy and terms pages, then use those exact URLs in App Store
      Connect.
- [x] Add crash/error reporting for the mobile app and API. Failed submissions
      and handled API 5xx responses now emit scrubbed Sentry events.
- [ ] Create the Sentry projects, add Vercel/EAS credentials, and configure the
      failed-submission and repeated-5xx alerts in `docs/error-reporting.md`.
- [x] Prepare App Store name, description, category, privacy answers,
      permission copy, support URL and screenshots.
- [ ] Re-sync the organizers' map and review the diff; October participants may
      still change during the month.

## 21–27 September — rehearse the night

- [ ] Run the attendee path from install through several passport stamps with
      airplane mode toggled during the route.
- [x] Verify a queued passport sync remains idempotent after reconnection.
      The durable queue test covers restart, concurrent enqueue, a lost 200
      response followed by replay, and enqueue-during-drain; simulator replay
      against the API returned 200 for the same logical stamp each time.
- [ ] Test cold launch and the map on the oldest supported iPhone available.
- [ ] Give Dino and Michael the TestFlight build and collect only launch-blocking
      feedback.
- [ ] Decide who watches errors and answers attendee/venue problems on October 1.

## 28 September–1 October — freeze

- [ ] Final venue sync with a human review of additions, removals, addresses and
      corridor assignments.
- [ ] Production API smoke test from cellular, not the development network.
- [ ] Confirm the installed TestFlight build points at the production API.
- [ ] Capture the six final App Store screenshots from that validated build,
      following `docs/app-store-submission.md`.
- [ ] Fix only launch blockers. No new modules or visual direction changes.

## Monthly operating procedure

The organizers' live map is the source of truth. Every run names the target
calendar date explicitly and is a dry run unless `--apply` is present:

```bash
npm run sync:artnight -- --date=2026-10-01
npm run sync:artnight -- --date=2026-10-01 --apply
```

For the one-time October conversion, the six existing ticketing fixtures were
moved intact to an unpublished demo Night with
`--move-non-artnight-to-demo`. That flag is not part of normal monthly sync.

## Immediately after October 1

1. Build the end-of-night passport summary people will screenshot.
2. Give venues a privacy-preserving footfall readout showing visits by corridor
   and time window.
3. Build the venue submission module, then onboarding that gives attendee,
   artist and venue profile types a proper home.
4. Decide whether the free Art Night product has earned a separate ticketing
   pilot with 1–3 venues.

## Parity with dtlaartnight.com

Surveyed 10 September 2026. The site is the reference for what the app should
eventually do. Venue data already comes from the site's own map — `sync:artnight`
reads `maps.dtlaartnight.com/api/topics/…/points`, the same source the site's
"Open Map!" links to, and production has coordinates for all 56.

| Website | App |
| --- | --- |
| Gallery map | ✅ native map, corridor routes, walking distance |
| Visitor guide | ✅ `/visitor-guide` |
| Participating galleries | ✅ the Art Night directory |
| Artist submission | ⚠️ built, but **does not collect the $35 fee** |
| Returning-artist submission | ❌ separate shorter form, not built |
| Vendor submission | ❌ not built — see below |
| Entertainment submission | ❌ not built |
| Volunteer sign-up | ❌ not built |
| Emerging-artists directory | ❌ not built |
| About / contact | ❌ not built |
| User login | ❌ no auth by design |

**Every one of those forms belongs in the app**, at the website's prices
exactly. Prices are stored as the organisers publish them, per item, and are
NOT run through `priceBreakdown()` — our service fee is a placeholder of 6% +
99c that would make a $50 booth cost $53.99 in the app against $51.86 on the
web. Nobody should pay more for using the app.

**Selling art through the app is out of scope**, decided 10 September 2026. The
artwork prices on a submission are for the organisers' placement invoice, not a
storefront.

**The fee gap is the important one.** The site charges **$35** for an artist
submission plus a hanging fee, and **$50** for a vendor booth (shown all-in as
$51.86). The app's submission flow has no payment step at all, so an artist who
applies in the app pays nothing while one who applies on the web pays $35. That
is both lost revenue and an unfair difference between two doors to the same
event.

### Vendor submission — captured spec

From `/vendor-submission`, so it does not have to be re-read later.

**Fields.** Business name, first, last, email (+confirm), phone, social media,
website, category, describe your merchandise, how you present it, what makes
you stand out, markets to join (multi-select of dated priced markets), up to 5
photos (optional, JPG/PNG/WebP/GIF), email consent, SMS consent.

**Categories.** Fashion & Apparel · Accessories · Beauty & Wellness · Art &
Artisan Goods · Home & Lifestyle · Plants & Garden · Pet Products · Kids &
Family · Digital & Creative Services · Vintage & Antiques · Cultural &
Metaphysical · Services & Experiences · Food & Beverage · Others.

**Markets** are dated and priced individually — Spring Street Arcade on the
first Thursday, $51.86 all-in — so this is a list of purchasable occurrences,
not a single product.

**The process, which is the actual design:**

1. Apply. 2–3 business days to process.
2. If approved, **payment within 72 hours** or the space is not held.
3. Cancelling inside 24 hours means finding a replacement or forfeiting.
4. Space assignments go out 24 hours before, with load-in and parking.
5. **No refunds.**

Vendors stay for the whole event or may not be invited back, and bring their
own table and display. Food vendors need licences and permits on file; Spring
Arcade is currently not accepting food vendors at all.

This confirms the shape in `docs/marketplaces.md`: a booth is **applied for and
approved, then paid**, which is not the browse-then-buy flow ticketing has.

## Deliberately deferred

- Social feeds, following, chat and live video
- Broad auth/account work not required by a concrete module
- Search indexing, cursor pagination and caching at current catalogue size
- Push notifications before there is a clear operational owner for messages
- General visual polishing that is not visible in the real-device rehearsal

The visual direction remains the gig poster: flat ink, square blocks, Archivo
Black and corridor colors. Do not introduce translucent, rounded or glassy
surface systems.

## Ticketing, when it returns

Before enabling the ticketing flags, finish the non-code decisions and
production operations already documented in `docs/launch-readiness.md`:

- merchant of record and written refund policy;
- Stripe Connect onboarding for the pilot venues;
- production webhook plus paid-but-pending alerting;
- a real purchase/refund and a door-staff dry run;
- offline scanner rehearsal and load testing.

The money invariants in `prisma/schema.prisma` remain mandatory even while the
feature is hidden: conditional inventory updates, webhook idempotency,
first-scan-wins, integer cents and unguessable ticket codes.
