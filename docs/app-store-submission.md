# App Store submission draft

Updated 7 September 2026. This is working copy for App Store Connect, not a
record of fields already submitted. Recheck it against the exact binary before
publishing the privacy answers.

## Product page copy

**Name — 30 characters maximum**

DTLA Art Night

**Subtitle — 30 characters maximum**

Downtown's art walk, mapped

**Promotional text — 170 characters maximum**

Find every participating gallery, plan a Downtown route, and stamp your
personal Art Night passport as you explore.

**Description — 4,000 characters maximum**

DTLA Art Night puts Downtown Los Angeles's monthly art walk in your pocket.

See the current participating venues on one live map, browse the full night by
corridor, and open each stop for its address, hours, artwork and venue details.
Use your location to understand what is nearby, then build a route through the
galleries, studios and creative spaces you want to visit.

Your Art Night passport records the stops you make. Stamps save on your phone
first, so a weak signal between buildings does not erase your night. When a
connection returns, privacy-preserving visit reports sync without sharing your
precise location.

Artists can also open the submission form from their profile, attach work and
send their information to the Art Night team.

Features:

- The current DTLA Art Night venue directory
- A Downtown map with corridor filters and nearby venues
- Venue details, addresses, hours and artwork
- A personal, offline-first Art Night passport
- Artist submissions from the app
- A visitor guide, saved venues and direct map directions

Location access is optional. The directory and venue map remain available if
you choose not to share it.

DTLA Art Night is free to browse. Venue details can change; confirm time-sensitive
information with the venue before traveling.

**Keywords — 100 bytes maximum**

gallery,art walk,museum,exhibition,artist,events,downtown LA,venue,culture,passport

**Categories**

- Primary: Entertainment
- Secondary: Travel

**URLs**

- Privacy policy: `https://happeningdtla-web-v63f.vercel.app/privacy`
- Support: `https://happeningdtla-web-v63f.vercel.app/support`
- Terms: `https://happeningdtla-web-v63f.vercel.app/terms`
- Marketing: use the canonical DTLA Art Night site if the organizers approve;
  otherwise leave this optional field empty.

Use a permanent branded domain before submission if one is ready. If not, the
Vercel URLs above are public, stable deployment URLs and match the links inside
the current app.

## Review notes draft

The app's October launch path is free and does not require an account. Ticketing
is disabled in this build. Location permission is optional and is used on the
device to show the visitor on the map, sort nearby venues and verify passport
stamps. Precise coordinates are not sent to the DTLAHappening API. Artist
submission is available after choosing the Artist profile and requires contact
information and images so the organizers can review the application.

Suggested reviewer path:

1. Dismiss the opening poster.
2. Open the Explore tab to view and filter the current Art Night map.
3. Open a venue to see details and the passport action.
4. Open Profile, choose Artist, then open Artist submission.

No demo credentials are required for those paths. If ticketing is enabled in a
later binary, replace these notes and provide complete review credentials and a
test purchase path.

## App privacy answers for the launch binary

Answer **Yes, we collect data from this app**. The following is a conservative
draft covering the app and enabled third-party SDKs. Nothing is used for
third-party advertising or cross-app tracking.

| Apple data type | What causes collection | Purpose | Linked to identity? | Tracking? |
| --- | --- | --- | --- | --- |
| Name | Artist submission | App Functionality | Yes | No |
| Email Address | Artist submission | App Functionality | Yes | No |
| Phone Number | Artist submission | App Functionality | Yes | No |
| Physical Address | Artist submission | App Functionality | Yes | No |
| Photos or Videos | Artist portfolio upload | App Functionality | Yes | No |
| Other User Content | Artist statement, links and application fields | App Functionality | Yes | No |
| Device ID | Random per-install passport identifier and diagnostic SDK identifiers | App Functionality; Analytics | No | No |
| Product Interaction | Venue/night/time in synced passport reports | Analytics; App Functionality | No | No |
| Crash Data | Sentry when configured | App Functionality | No | No |
| Performance Data | App hangs and launch diagnostics from Sentry when configured | App Functionality | No | No |
| Other Diagnostic Data | Stack traces, app/OS/device version and error context | App Functionality | No | No |

Do **not** declare precise or coarse location if the final verification confirms
coordinates remain on-device. Merely requesting Core Location does not make it
"collected" when it is not transmitted off-device. Do not declare payment
information for Stripe's hosted payment entry because DTLAHappening does not
receive full card details. Revisit Purchase History and contact-information
answers before any binary in which ticketing can be enabled.

Privacy implementation notes:

- Sentry is configured with PII, replay, screenshots, view hierarchy and tracing
  disabled. Never add submission form values, artwork or precise coordinates to
  an error event.
- The privacy answers must include every SDK enabled in the submitted binary,
  even when DTLAHappening does not directly inspect that SDK's data.
- The public policy is also linked inside Profile, satisfying the in-app access
  requirement.

## Permission copy in the binary

**Location while using the app**

Showing events near you on the map, and where you are in relation to them.

**Camera**

Scanning ticket QR codes at venue doors.

The camera permission belongs to the dormant organizer-door path. Before the
launch archive, verify App Review cannot reach that permission from the free
attendee path. If the door tools are excluded from this release, remove the
camera declaration in the next native rebuild rather than explaining a feature
customers cannot use.

## Screenshot layout and capture plan

Prepare six portrait images at **1320 × 2868 pixels**, an accepted 6.9-inch
iPhone size. App Store Connect accepts one to ten screenshots and can scale the
highest-resolution set down. Final imagery must come from the validated build;
these are the layouts and captions, not substitute mock screens.

Every frame follows the poster system: near-black paper, flat corridor ink,
Archivo Black headlines, square corners, hard one-pixel rules and no device
frame, glass panel, blur or floating rounded card. Reserve roughly the top 18%
for the headline, place a full-height real app capture below it, and keep all
critical app UI inside the center safe area.

1. **ONE NIGHT / EVERY STOP** — current Art Night directory or opening poster;
   subline: “The Downtown art walk in your pocket.”
2. **MAP THE NIGHT** — map with multiple corridor colors and one selected
   labelled venue; subline: “Find galleries, studios and creative spaces.”
3. **KNOW THE STOP** — venue detail with artwork, address and hours; subline:
   “Everything you need before you walk in.”
4. **STAMP YOUR ROUTE** — passport with several genuine test stamps; subline:
   “Your night saves first—even when signal drops.”
5. **MOVE BY CORRIDOR** — directory filters plus nearby distances; subline:
   “Shape a route through Downtown.”
6. **ARTISTS, STEP IN** — artist submission screen with non-sensitive sample
   content; subline: “Send work directly to the Art Night team.”

Capture checklist for each frame:

- production API and final venue sync;
- no developer menu, red box, loading spinner, placeholder or test email;
- representative but non-sensitive content and approved venue imagery;
- consistent time, battery and network status bar;
- location state chosen intentionally, with the blue dot shown only where it
  helps the story;
- no text or important content hidden by the Dynamic Island or home indicator;
- export as opaque PNG or JPEG—Apple rejects alpha/transparency.

## Manual decisions before App Store Connect entry

- Confirm the public-facing app name and whether `DTLA Art Night` can be used by
  the Apple Developer account holder.
- Confirm `info@dtlaartnight.com` is the monitored support and privacy address.
- Confirm the legal operator name, copyright holder and seller name.
- Have the privacy policy and terms reviewed by the operator or counsel,
  especially retention/deletion language and artist-content licensing.
- Decide whether Artist submission is in the first release. If it is removed,
  remove its contact and user-content collection answers; if it remains, finish
  Supabase and Resend before review.
- Confirm primary/secondary categories and the age-rating questionnaire.
- Re-run this privacy inventory against the final dependency list and feature
  flags immediately before publishing the answers.
