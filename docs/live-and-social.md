# Live and social — parked, deliberately

Written 24 August 2026. Nothing here is built. This exists so the idea is not
re-derived from scratch later, and so the decisions with long lead times are
visible now rather than discovered the week before they matter.

Not on the path to 1 October. Read `ROADMAP.md` first.

---

## The idea

The map becomes the app rather than a view of it — Citizen's model, for events
instead of incidents.

- Someone at a venue **goes live** from where they are.
- Others **upload video and photos** tied to that venue and that night.
- People **interact** — comment, react, reply — around a place while it is
  happening.

The point is answering the question a listing cannot: *is it any good right
now?* A flyer says a warehouse show starts at nine. A thirty-second clip from
the room at ten says whether to walk over. On a crawl, where the decision is
which of eight rooms to be in, that is the whole game.

## Why it fits this product specifically

This is not a generic social feed bolted onto a ticketing app. It is the same
insight the schema was already built around: Art Night is a **crawl**, and a
crawl is a live, moving thing. `Night` groups venues across one evening,
`VenueCheckIn` records a person's route through it, and both have been in the
schema from day one for the passport feature.

Live content is the passport with a camera attached. It shares the primitives:
a person, a venue, a night, a moment in time.

It is also the strongest possible answer to App Review Guideline 4.2
("minimum functionality") — though note that ticketing and door scanning
already clear that bar, so this is not needed for approval.

## What already exists that this would build on

| Piece | State |
| --- | --- |
| `Night` | In schema. Groups venues across one evening |
| `VenueCheckIn` | In schema. Unique on (user, venue, night) — "who is here now" |
| `Venue.lat/lng` | In schema, seeded, and now rendered on the map |
| `Follow` | In schema. Follower/following pairs, unused |
| `EventInterest` | In schema. Now backing device-local likes; see below |
| The map | Built. Venue pins, location, category and date filters |

What does not exist: any notion of a post, a clip, a comment, a report, a
block, or a moderator.

## What has to be true first

**Accounts.** This is the hard prerequisite and it is not close. There is no
auth in the mobile app at all — `@clerk/clerk-expo` was reverted because it
needs a native module Expo Go does not ship, so it requires a development
build, which requires the Apple Developer account. Anonymous live video from
nightlife venues is not a thing to ship; attribution is what makes moderation
and banning possible.

**Moderation, before launch not after.** App Store Guideline 1.2 requires any
app with user-generated content to have, at submission: a method for filtering
objectionable content, a mechanism for users to report it, the ability to block
abusive users, and published contact information. Live video from bars at
midnight is the highest-scrutiny version of this. An app that ships UGC without
these is rejected, and rightly.

**Venue consent.** Live broadcasting from inside someone's room is their
decision, not ours. This belongs in the same conversation as exclusivity and
the fee level — while those terms are still open. A venue that discovers live
video from its floor after the fact is a partner problem, and partners are the
whole distribution model. `Organizer.publiclyAttributed` already establishes
the principle that venues control their own visibility; this needs the
equivalent.

**Someone to answer at 1am.** Live means real-time abuse. Recorded uploads can
be reviewed on a queue; live cannot. That is a staffing commitment, not a
feature flag, and it is the single strongest argument for starting with short
uploaded clips rather than live streaming.

## Cost, honestly

Live video is the most expensive thing in this document by an order of
magnitude. Ingest, transcoding and delivery are billed per minute streamed
**and** per minute watched — one broadcaster with two hundred viewers is two
hundred billed streams. Mux, LiveKit and Cloudflare Stream are the usual
options. Storage for uploads is cheap; live is not.

At Art Night scale this is real money on a night with no matching revenue,
since tickets are already sold by then. Worth modelling against a specific
expected concurrent-viewer number before committing.

## A sane order, if it is ever picked up

1. **Photos and short clips, uploaded, tied to a venue and a night.** Async,
   reviewable on a queue, cheap to store, and it tests the actual hypothesis —
   that people want to see inside a room before walking over.
2. **Reactions and comments** on those, once there is something to react to.
3. **Live**, only if (1) shows people actually post and actually watch.

Going straight to live skips the cheap experiment that tells you whether the
expensive one is worth building.

## Related

- `ROADMAP.md` — what is actually being built, and in what order
- `HANDOFF.md` — current state
