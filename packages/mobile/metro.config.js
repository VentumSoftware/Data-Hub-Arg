const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro only looks in the mobile package's node_modules
config.resolver = {
  ...config.resolver,
  platforms: ['ios', 'android', 'native', 'web'],
  disableHierarchicalLookup: true,
};

// Don't watch files outside this package
config.watchFolders = [];

module.exports = config;