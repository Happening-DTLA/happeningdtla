// Monorepo-aware Metro config.
//
// By default Metro only watches the app folder, so edits to packages/core
// would not trigger a reload and its imports would fail to resolve. These two
// settings are what make a shared workspace package work on the phone.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so packages/core changes hot-reload.
config.watchFolders = [workspaceRoot];

// Resolve from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Force ONE copy of React for everything Metro bundles.
//
// Three copies exist in this monorepo: the workspace root and apps/web on
// 19.2.x for Next, and apps/mobile on 19.1.0 because Expo SDK 54 pins it.
// Two Reacts in one bundle means the renderer's hook dispatcher is null and
// every component dies with "Cannot read property 'useState' of null".
//
// extraNodeModules is NOT enough. It only applies when normal resolution
// fails, and react-native is hoisted to the workspace root — so its own
// `require("react")` resolves to the root copy long before any fallback runs,
// while app code under apps/mobile resolves to the nested one.
//
// resolveRequest intercepts every request regardless of who is asking, which
// is the only place that can guarantee a single instance. Pinned to the
// version Expo expects rather than the newer root copy.
const FORCE_SINGLE = ["react", "react-dom"];

// Subpaths count. `react/jsx-runtime` and `react-dom/client` are their own
// resolution requests, so matching only the bare name pins the package and
// leaks its subpaths to hierarchical lookup and the root's 19.2.x. That is
// survivable on native — a second jsx-runtime is inert — but react-dom/client
// compares its own version against React's and throws "Incompatible React
// versions" before the web app renders a single frame.
const pinnedCache = new Map();
function pinnedPath(moduleName) {
  const owned = FORCE_SINGLE.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  );
  if (!owned) return null;
  if (pinnedCache.has(moduleName)) return pinnedCache.get(moduleName);

  let filePath = null;
  try {
    filePath = require.resolve(moduleName, { paths: [projectRoot] });
  } catch {
    /* not installed locally — leave it to normal resolution */
  }
  pinnedCache.set(moduleName, filePath);
  return filePath;
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pinned = pinnedPath(moduleName);
  if (pinned) return { type: "sourceFile", filePath: pinned };
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

// NOTE: deliberately NOT setting `disableHierarchicalLookup`.
//
// It's the usual monorepo recommendation — it stops a package being loaded
// twice, which for React surfaces as "invalid hook call". But it also stops
// Metro walking up from a package to its OWN nested node_modules, and npm
// nests plenty here: expo's dependencies (expo-asset, expo-font, ...) live in
// node_modules/expo/node_modules/ rather than hoisted, because mobile and web
// need different React versions. With it on, the bundle dies at
// "Unable to resolve module expo-asset".
//
// The duplicate-React risk it guards against doesn't apply: mobile resolves
// React from the workspace root (19.1.0) and the web app keeps its own nested
// copy (19.2.x), so only one React is reachable from here.

module.exports = config;
