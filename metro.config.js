// metro.config.js — optimized for Termux (low inotify watcher limit)
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude directories that don't need watching
config.resolver = {
  ...config.resolver,
  blockList: [
    /\/__tests__\/.*/,
    /\/\.git\/.*/,
  ],
};

module.exports = config;
