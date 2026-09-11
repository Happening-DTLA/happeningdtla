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

## Repo layout

Monorepo, npm workspaces:
- `apps/web` — Next.js. The backend, the public event pages, the organizer
  dashboard. Owns the database and every secret.
- `apps/mobile` — Expo / React Native. The App Store client.
- `packages/core` — shared pure TypeScript: API contract types, money math,
  date formatting, ticket-code helpers. Must stay free of Node and DOM APIs —
  it runs inside Hermes on a phone. Never put database access or secrets here.

Server components call `apps/web/src/lib/queries.ts` directly. Route handlers
wrap the same functions. Neither fetches over HTTP from itself.

## API boundary

Route handlers are PUBLIC. Everything crossing that boundary goes through
`apps/web/src/lib/dto.ts`, which picks every field by hand. Never spread a
Prisma object into a response — the day a column holds a payout account, a
spread publishes it and nothing fails a test. `queries.ts` also selects
organizer fields explicitly so `stripeAccountId` is never even fetched.

## Framework gotchas found the hard way

- **Middleware is `proxy.ts` in Next 16**, not `middleware.ts`. Same behavior,
  renamed. CORS for `/api/*` lives in `apps/web/src/proxy.ts`.
- **`PageProps` and `LayoutProps` do not exist until something builds.** Next 16
  generates them into `.next/dev/types`, which `tsconfig.json` includes. On a
  fresh clone `npm run typecheck` therefore fails with `TS2304: Cannot find name
  'PageProps'` in files that are completely correct. Run `next dev` or
  `next build` once and it goes away. Do not "fix" it by hand-writing the types.
- **New route files fail typecheck until the dev server has seen them.** Expo
  Router generates typed routes into `apps/mobile/.expo/types/router.d.ts`, so
  a freshly added screen makes `router.push("/submit/vendor")` an error —
  "not assignable to parameter of type ..." — while the file plainly exists.
  Start Metro and the types regenerate within seconds. It is the same class of
  problem as `PageProps` on the web side: correct code, absent generated types.
- **A local iOS build fails on Sentry unless a flag is set.** The bundle phase
  runs `sentry-cli`, the Sentry projects in `docs/error-reporting.md` were never
  created, and the upload dies with `An organization ID or slug is required` —
  taking the whole build with it, exit 65, buried under ~2500 unrelated pod
  warnings. `apps/mobile/package.json`'s `ios:native` sets
  `SENTRY_DISABLE_AUTO_UPLOAD=true`, **but only that script does**: a build
  started from Xcode.app, from `xcodebuild`, or from a build tool does not
  inherit it. The fix is `export SENTRY_DISABLE_AUTO_UPLOAD=true` in
  `apps/mobile/ios/.xcode.env.local`, which every script phase sources. Note
  `/ios` is gitignored, so that file does not survive `expo prebuild`.
- **`generateImageMetadata` passes `id` as a Promise.** Not awaiting it gives
  `fontSize: NaN` and a 500 at request time, not a type error.
- **Don't use expo-router's `<Link asChild>` around a styled `Pressable`.** The
  clone drops the style function; cards render with no background, border or
  row layout. Use `useRouter().push()` instead — identical on iOS, Android
  and web.
- **Expo SDK is pinned to 54 on purpose.** The development client and every
  native dependency must be rebuilt together when that changes. Expo Go is no
  longer a supported runtime for this repo because the map needs native code
  newer than Expo Go's fixed binary.
- **The map deliberately sets no `provider`.** iOS therefore uses Apple Maps
  and needs no API key. An **Android** development or production build uses
  Google Maps and will need a key in `app.json`.
- **Reanimated must match the development client's compiled copy EXACTLY, and
  so must `react-native-worklets`.** Reanimated throws "Mismatch between JavaScript
  part and native part" when they differ. Two traps here: `expo install
  react-native-reanimated` does NOT install `react-native-worklets`, which
  Reanimated 4 needs as a separate native peer; and a floating `~4.1.1`
  resolves to 4.1.7, whose worklets range `0.5 - 0.8` hoists 0.8.3 to the
  workspace root — so the hoisted Reanimated loads 0.8.3 while the app loads
  the correct 0.5.1 nested under apps/mobile, and every screen red-boxes. Both
  are pinned to exact versions, which nests them under apps/mobile and leaves
  no second copy to collide with. Rebuild the client after changing either one.
- **Never put Reanimated or worklets in metro's `FORCE_SINGLE`.** It looks like
  the right fix for a duplicate copy and it breaks the app silently. Both ship
  two entry points: `main` is prebuilt output, `react-native` is the SOURCE.
  Metro honours `react-native` and loads the source so the babel plugin can
  compile the worklets inside it; `require.resolve` honours `main` and returns
  the prebuilt build, which was compiled without that plugin — so Reanimated's
  own internals arrive as plain functions and the first import dies with
  "[Worklets] Failed to create a worklet". The tell is the bundle: forced
  prebuilt had one `__workletHash`, correct resolution has four.
- **The worklets babel plugin must be declared explicitly here — auto-detection
  does not survive this monorepo.** `babel-preset-expo` does add
  `react-native-worklets/plugin` by itself, but it detects the package with a
  bare `require.resolve`, which resolves from the PRESET's own location
  (`node_modules/expo/node_modules/babel-preset-expo`). Exact pinning nests
  worklets under `apps/mobile`, which is not on that lookup path, so the preset
  concludes it is not installed and silently omits the plugin. There is no
  build error: `expo export` succeeds, and the app dies on a phone with
  "[Worklets] Failed to create a worklet" on the first Reanimated import. Hence
  `apps/mobile/babel.config.js`, and `babel-preset-expo` as a devDependency
  there so the config can name it. Keep the worklets plugin LAST.
- **Over-the-air updates exist, and they cannot ship native changes.**
  `expo-updates` is configured against EAS channels that match the build
  profiles in `eas.json` — a `preview` update cannot reach a `production`
  build. `runtimeVersion` uses the **fingerprint** policy, which hashes the
  actual native dependency set, so an update can only land on a binary whose
  native side matches it. The alternative (`appVersion`) is a human-maintained
  string, and getting it wrong is silent: the update installs onto a binary
  missing a native module and the app crashes on launch for everyone at once.
  So: JS, assets and copy ship over the air in minutes; anything touching a
  native module still needs a build and a review. Apple permits OTA for fixes
  and content, not for changing what the app fundamentally does.
- **`expo prebuild` regenerates `ios/`, and `.xcode.env.local` is where local
  native fixes go.** Plain `prebuild` leaves that file alone; `prebuild --clean`
  does not. The Sentry upload flag lives there, so a `--clean` costs you a
  build failure until it is put back.
- **After changing any native dependency, restart Metro with `--clear`.** The
  transform cache survives an npm install and will happily keep serving the
  previous version's code.
- **`expo install --fix` can add a bogus config plugin.** It added
  `expo-status-bar` to `app.json` plugins, which is not a config plugin and
  makes the dev server refuse to start. Keep that array to `["expo-router"]`.
- **React versions differ per workspace on purpose.** SDK 54 needs React 19.1.0
  while Next 16 wants 19.2.x. Mobile deps are pinned to exact SDK-compatible
  versions so npm nests them; don't "align" them with the web app.
- **The root `expo-font` pin is deliberate.** `@expo/vector-icons` declares
  `expo-font >=14.0.4`; without the root devDependency and override npm installs
  the latest Expo 57 copy beside the SDK 54 copy. Expo Doctor then correctly
  reports duplicate native modules, and a cloud build can link the wrong one.
- **`localhost` on a phone is the phone.** `apps/mobile/src/api.ts` derives the
  API host from Expo's `hostUri` so it works on any machine without a
  hardcoded IP.

## Stale dev servers are the first thing to check

This has cost hours twice. Before debugging any error that does not change
between attempts, check how long the server serving it has been alive:

```bash
lsof -nP -iTCP:3100 -sTCP:LISTEN     # the API
lsof -nP -iTCP:8081 -sTCP:LISTEN     # Metro
ps -o pid,lstart,command -p <pid>
```

Both servers re-read *source* files but not the things that actually broke:

- **Metro** loads `metro.config.js` and `babel.config.js` once, at startup. A
  server started before a babel plugin was added keeps transforming new code
  with the old config, and the app fails on the phone with no build error.
- **Next dev** hot-reloads route code, but `src/lib/prisma.ts` caches the
  client on `globalThis` in development. After a migration and
  `prisma generate`, a running server keeps the OLD client, and every query
  touching a new model or relation 500s while the code on disk is correct.

An error that is byte-identical across attempts — same message, same log count
— is evidence about the pipeline, not the code. Restart before diagnosing.

## Local environment

- Dev server runs on **port 3100** (3000 may be taken by an unrelated project).
- The database is local via `prisma dev`; `npm run db:start` writes the URL into
  `.env` because the port is assigned dynamically. Don't hardcode it.
- **Vercel is not a backup for secrets.** All 11 production variables on
  `happening3/happeningdtla-web-v63f` are marked **Sensitive**, which makes them
  write-only: `vercel env pull` returns `[SENSITIVE]` placeholders and the
  dashboard cannot show them either. The only copies live in the Supabase,
  Stripe, Clerk and Resend dashboards. `vercel env pull` is still worth running
  to learn *which* keys are set — that is how we found `EMAIL_FROM` was set all
  along, which `/api/health` does not report.
- **The seed only geocodes 13 of its 50 venues**, so the map looks nearly empty
  against a local database while production has coordinates for all 56. Before
  chasing a "missing pins" bug, check `venue.lat`/`lng` counts — the map has no
  cap and no pagination, it simply cannot pin a venue with no coordinates, and
  `NightDirectory` says so in the "N of M mapped" line.
- Do not run `npm audit fix --force` — the sole advisory is in the Prisma CLI's
  config loader and the "fix" downgrades Prisma to v6.

## Image optimisation rejects most quality values

`/_next/image` answers 400 `INVALID_IMAGE_OPTIMIZE_REQUEST` for any `q` not
listed in `images.qualities` — which defaults to `[75]`, not to "anything from
1 to 100". `w` is constrained the same way, to `deviceSizes` + `imageSizes`.
Neither error says which parameter was wrong, and a wrong `q` looks exactly
like a `remotePatterns` miss, so check the number before rewriting the config.

## The map requires the development build

Mobile uses `react-native-maps@1.29`, whose genuine Fabric components avoid the
native child-list crashes in Expo Go's bundled 1.20.1. **Do not use Expo Go for
this app.** Run `npm run ios` from the root for an installed development client,
or `npm run ios:native` after changing native dependencies.

After changing any native dependency, rebuild the development client and
restart Metro with `--clear`. Seeing the app bundle successfully is not proof
that the installed native binary contains the matching module.
