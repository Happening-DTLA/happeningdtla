/**
 * What this build of the app is.
 *
 * The product is ArtNight first: a free, city-wide walk where nothing is sold.
 * Ticketing — checkout, the wallet, the door scanner — is built and tested and
 * stays in the codebase, compiled and typechecked on every build, but it is
 * not shown. A Tickets tab that is always empty reads as unfinished, and a
 * door scanner is meaningless at an event with no doors to scan.
 *
 * This is a switch, not a deletion. Oversell prevention, offline door sync and
 * the Stripe payment sheet took real work and are the eventual business; the
 * day a venue wants to sell, this flips and they are already there.
 *
 * Off unless explicitly enabled. Set EXPO_PUBLIC_TICKETING=on to turn it back
 * on — inlined at build time, so it needs a restart, not a reload.
 */
export const TICKETING_ENABLED = process.env.EXPO_PUBLIC_TICKETING === "on";
