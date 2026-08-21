const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The prebuilt catalogue ships as a binary asset that Metro must bundle verbatim.
config.resolver.assetExts.push('db');

module.exports = config;
