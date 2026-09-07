import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // @dtlahappening/core ships TypeScript source rather than a build step, so
  // both this app and the Expo app compile it themselves. That keeps the shared
  // contract editable without a watch process in the middle.
  transpilePackages: ["@dtlahappening/core"],

  /**
   * Venue photographs come off the organisers' map, whose CDN ignores every
   * resize parameter and serves the original — 1.6MB and 3.2MB PNGs of
   * photographs. Sending those to a phone on cellular in Downtown is not an
   * option, so they are fetched through Next's optimiser instead, which
   * resizes, converts to WebP and caches at the edge. That also means one
   * place to turn them off if the organisers ever ask us to.
   */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "maps.dtlaartnight.com", pathname: "/i/**" },
      // The map host redirects here; allowed so a stored absolute URL works
      // whichever form it was captured in.
      { protocol: "https", hostname: "i.proxi.co", pathname: "/**" },
    ],
    formats: ["image/webp"],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: {
    // Local and preview builds remain ordinary builds until the upload token
    // is deliberately configured in their environment.
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
