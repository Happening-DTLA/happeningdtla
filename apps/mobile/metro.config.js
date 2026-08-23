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

// Without this, a package hoisted to the root can be loaded twice — which for
// React shows up as the "invalid hook call" error rather than anything useful.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
