// metro.config.js — optimized for Termux (low inotify watcher limit)
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Use polling instead of inotify watchers to avoid ENOSPC on Termux/Android
config.watcher = {
  watchman: false,
  usePolling: true,
  interval: 2000,
};

// Exclude directories that don't need watching
config.resolver = {
  ...config.resolver,
  blockList: [
    /\/__tests__\/.*/,
    /\/\.git\/.*/,
  ],
};

module.exports = config;
