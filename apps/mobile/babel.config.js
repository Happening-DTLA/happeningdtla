/**
 * Explicit, because the automatic path does not survive a monorepo.
 *
 * babel-preset-expo adds `react-native-worklets/plugin` on its own — but it
 * detects the package with a bare `require.resolve`, which resolves from the
 * PRESET's own location (node_modules/expo/node_modules/babel-preset-expo).
 * This repo pins mobile dependencies to exact versions so npm nests them under
 * apps/mobile, which is not on that lookup path. The preset therefore decides
 * worklets is not installed, silently omits the plugin, and every Reanimated
 * import fails at runtime with "[Worklets] Failed to create a worklet" — no
 * build error, nothing to notice until the app is on a phone.
 *
 * Declaring both here removes the guesswork. babel-preset-expo is a
 * devDependency for the same reason: it is only reachable from here if this
 * workspace asks for it by name.
 *
 * The worklets plugin must stay LAST in this list.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  };
};
