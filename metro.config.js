// metro.config.js — optimized for Termux (low inotify watcher limit)
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude test files and heavy directories from being watched
config.watcher = {
  ...config.watcher,
  additionalExts: ['cjs'],
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
