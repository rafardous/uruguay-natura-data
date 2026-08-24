// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // Reanimated SharedValue.value is intentionally mutable inside worklets;
      // React's generic immutability rule cannot distinguish that API.
      'react-hooks/immutability': 'off',
      // These hooks mark a new async SQLite request as loading at effect start.
      'react-hooks/set-state-in-effect': 'off',
    },
  }
]);
