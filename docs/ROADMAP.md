# Roadmap — to DTLA Art Night, Thursday 1 October 2026

Updated 6 September 2026. **25 days.**

## The one thing that matters

A person can install the native app, see the current Art Night rather than last
month's, use the map while walking Downtown, and keep a passport that survives
bad signal and an app restart.

This is now an **Art Night-first, free-night product**. Ticketing still exists
and its concurrency invariants remain load-bearing, but it is behind
`EXPO_PUBLIC_TICKETING` / `NEXT_PUBLIC_TICKETING` and is not the October launch
path. Do not let the older ticketing roadmap pull work away from a reliable
directory, map, passport and distribution pipeline.

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
- [ ] Set up EAS Build with `EXPO_TOKEN` and cut an iOS development build.
- [ ] Upgrade the development build to `react-native-maps@1.29+`, verify its
      real Fabric components, then remove the four Expo Go interop workarounds
      and `docs/map-crashes.md`.

## 9–13 September — prove it on devices

- [ ] Test fresh install, denied/granted location, map selection and filtering
      on at least two physical iPhones.
- [ ] Walk a real Downtown route with weak connectivity. Verify live location,
      nearest-first distances, map recentering and passport persistence.
- [ ] Exercise the artist submission form end to end: image picker, signed
      upload, submission and organizer email.
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY`; uploads are otherwise deliberately 503.
- [ ] Finish Resend DNS and set `EMAIL_FROM`; submissions otherwise notify only
      the Resend account owner.

## 14–20 September — establish the release path

- [ ] Produce a TestFlight internal build and install it from a clean device,
      not from Xcode or Expo Go.
- [ ] Add privacy policy and terms pages, then use those exact URLs in App Store
      Connect.
- [ ] Add crash/error reporting for the mobile app and API. Alert on failed
      submissions and repeated API 5xx responses.
- [ ] Prepare App Store name, description, category, privacy answers,
      permission copy, support URL and screenshots.
- [ ] Re-sync the organizers' map and review the diff; October participants may
      still change during the month.

## 21–27 September — rehearse the night

- [ ] Run the attendee path from install through several passport stamps with
      airplane mode toggled during the route.
- [ ] Verify a queued passport sync remains idempotent after reconnection.
- [ ] Test cold launch and the map on the oldest supported iPhone available.
- [ ] Give Dino and Michael the TestFlight build and collect only launch-blocking
      feedback.
- [ ] Decide who watches errors and answers attendee/venue problems on October 1.

## 28 September–1 October — freeze

- [ ] Final venue sync with a human review of additions, removals, addresses and
      corridor assignments.
- [ ] Production API smoke test from cellular, not the development network.
- [ ] Confirm the installed TestFlight build points at the production API.
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
