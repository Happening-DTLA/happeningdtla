# Error reporting

Updated 7 September 2026.

The code integration is complete for the Expo app and Next.js API. It remains
inactive until the Sentry projects and environment variables below exist. The
configuration deliberately sends no form values, photos, precise coordinates,
screenshots, view hierarchy, session replay or performance traces.

## What is reported

- uncaught JavaScript and native mobile crashes;
- uncaught Next.js server, edge and route errors;
- handled API responses with a status of 500 or above, tagged only by the
  fixed error code and status;
- failed artist uploads and submissions, tagged by a fixed call-site label.

Expected offline fetch failures, photo-permission denial and a user cancelling
the image picker are not reported. Sentry is for actionable failures, not a
record of normal user choices.

## One-time manual setup

Create one Sentry organization with two projects so ownership and alerts are
clear:

- a React Native project named `dtla-art-night-mobile`;
- a Next.js project named `dtla-art-night-web`.

In Vercel, add these production environment variables to the web project:

```text
SENTRY_DSN=<web project DSN>
NEXT_PUBLIC_SENTRY_DSN=<web project DSN>
SENTRY_ORG=<organization slug>
SENTRY_PROJECT=dtla-art-night-web
SENTRY_AUTH_TOKEN=<source-map upload token>
```

In the Expo project dashboard, add these to the development, preview and
production EAS environments:

```text
EXPO_PUBLIC_SENTRY_DSN=<mobile project DSN>
SENTRY_ORG=<organization slug>
SENTRY_PROJECT=dtla-art-night-mobile
SENTRY_AUTH_TOKEN=<source-map upload token>
```

The DSNs and slugs may be plain-text EAS variables; make
`SENTRY_AUTH_TOKEN` sensitive. Do not paste token values into chat, docs or
shell history. Local Metro can read the mobile DSN from
`apps/mobile/.env.local`. Local native-build scripts disable source-map upload
so a developer without the build token can still compile.

After the variables are set, redeploy the web app and make a fresh EAS build.
Source maps belong to the exact deployed bundle, so an old artifact cannot
validate the setup.

## Alerts

In Sentry, configure:

1. An issue alert for the `artist_submission`, `artist_artwork_upload` and
   `artist_portfolio_upload` mobile tags, notifying the October operator on the
   first event.
2. An issue alert for API events whose `http_status` starts with `5`, notifying
   on a new issue and again when event volume crosses the chosen threshold.
3. A release-health crash-free-sessions alert for the mobile project once real
   TestFlight traffic exists.

Choose the October operator and the repeated-5xx threshold during the device
rehearsal. A useful starting point is five events in ten minutes, but it should
be adjusted after observing TestFlight traffic rather than treated as a fact.

## Verification

Use non-production test events after the credentials are installed:

- capture a fixed mobile test error, then verify its readable stack references
  the TypeScript source rather than a minified bundle;
- hit a temporary test-only API route or locally force a 503, then verify the
  event contains the error code/status and no request body;
- remove the temporary trigger before committing or deploying;
- inspect the complete event payload for names, email addresses, images and
  coordinates before accepting the App Store privacy inventory.

Official setup reference: [Expo's Sentry guide](https://docs.expo.dev/guides/using-sentry/).
