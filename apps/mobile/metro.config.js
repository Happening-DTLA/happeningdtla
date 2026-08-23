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
