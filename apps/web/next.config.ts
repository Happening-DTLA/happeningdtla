import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @dtlahappening/core ships TypeScript source rather than a build step, so
  // both this app and the Expo app compile it themselves. That keeps the shared
  // contract editable without a watch process in the middle.
  transpilePackages: ["@dtlahappening/core"],
};

export default nextConfig;
