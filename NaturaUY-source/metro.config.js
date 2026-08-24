const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The prebuilt catalogue and expo-sqlite's browser worker are binary assets.
config.resolver.assetExts.push('db', 'wasm');

module.exports = config;
