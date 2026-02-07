# Divine Journal (Духовный дневник)

## Project Overview

A Russian-language spiritual journaling and Bible study mobile app built with React Native and Expo. It combines personal spiritual journaling with integrated Bible study tools including the full Russian Synodal Bible translation.

## Tech Stack

- **Framework**: React Native + Expo (managed workflow)
- **Language**: TypeScript
- **Navigation**: React Navigation (bottom tabs)
- **Database**: SQLite via `expo-sqlite`
- **Charts/Graphics**: `react-native-svg` (graph view)
- **File I/O**: `expo-file-system`, `expo-sharing`, `expo-document-picker`
- **Build**: EAS Build (see `eas.json`)

## Project Structure

```
App.tsx          - Single-file app (~1,830 lines) containing all screens and logic
BibleVerses.ts   - Complete Russian Synodal Bible data (31,182 lines, 66 books)
app.json         - Expo configuration
babel.config.js  - Babel config
tsconfig.json    - TypeScript config
package.json     - Dependencies
assets/          - App icons and splash images
.github/workflows/build.yml - CI build workflow
ENHANCEMENT_PLAN.md - Full roadmap with implementation details
```

## App Capabilities

### 5 Main Screens (Bottom Tab Navigation)

1. **Journal (Дневник)** - Create/edit spiritual journal entries
   - Four entry categories: Dream (Сон), Revelation (Откровение), Thought (Мысль), Prayer (Молитва)
   - Block-based rich text editor (text blocks + verse blocks + divider blocks)
   - Text formatting: bold, italic, underline, font size, font family, text highlighting (5 colors)
   - Embed Bible verses with color-coded highlighting (gold, blue, green, purple, red, teal)
   - Block reordering with up/down arrows
   - Folder system for organizing entries (create, edit, delete folders with custom colors and icons)
   - Daily verse widget with streak tracking
   - Long-press to delete entries

2. **Bible (Библия)** - Browse the full Russian Synodal Bible
   - Three-level navigation: Testament -> Book -> Chapter
   - Bookmark verses
   - 39 Old Testament + 27 New Testament books

3. **Calendar (Календарь)** - Track entries, readings, and fasting
   - Monthly calendar with entry/reading/fasting indicators
   - Rich text daily notes (block-based editor with formatting toolbar)
   - Reading plan generator (select book, start chapter, pace, duration)
   - Preset reading plans (Bible in a year, NT in 90 days, Psalms, Gospels)
   - Fasting tracker with date ranges, naming, and notes

4. **Search (Поиск)** - Full-text Bible search
   - Debounced search (300ms) across 31K+ verses
   - Navigate directly to results in Bible view

5. **Settings (Ещё)** - Statistics, themes, tools, and data management
   - Statistics dashboard: overview cards, category breakdown bars, monthly activity chart
   - Achievements: entry streak, fasting days, chapters read
   - Reading plan progress bar
   - Theme system: light, dark, sepia with persistent settings
   - Font scaling (0.8x to 1.4x)
   - Knowledge graph visualization (entry connections via shared verses, categories, folders, keywords)
   - Data export/import (JSON backup via share sheet)
   - App info

### Database Schema (SQLite - `divine_journal.db`)

- `entries` - Journal entries with JSON blocks, formatting, linked verses, folder_id
- `bookmarks` - Saved Bible verses
- `reading_plan` - Reading schedule with completion tracking
- `daily_notes` - Date-specific calendar notes (Block[] JSON format)
- `fasting` - Fasting period tracking
- `folders` - Folder system for organizing entries
- `daily_verse_history` - Daily verse tracking and streak
- `app_settings` - Theme and font scale preferences (key-value store)

## Development Notes

- The entire app logic lives in `App.tsx` - there are no separate component files. Keep it this way unless explicitly told otherwise.
- Bible data is statically imported from `BibleVerses.ts`
- Cross-tab navigation: Calendar and Search can jump to specific Bible chapters
- Entry blocks are stored as JSON arrays with type `'text' | 'verse' | 'divider'`
- Daily notes also use Block[] JSON format (backward-compatible with plain text)
- Theme system uses React Context (ThemeContext/ThemeProvider) with persistent DB storage
- Graph view uses force-directed layout computed in JS, rendered with react-native-svg
- App version: v3.2
- UI theme: warm earth tones with light/dark/sepia modes
- All user-facing strings must be in Russian
- Pre-existing TS errors (5 total): 4 Ionicons type inference issues + 1 BibleVerses.ts union type complexity — these are harmless

## Enhancement Plan

See `ENHANCEMENT_PLAN.md` for the full roadmap with code-level implementation details for each phase.

### Completed Phases
- **Phase 1**: Critical UX fixes (toolbar above keyboard, scroll fixes)
- **Phase 2**: Folder system for organizing entries
- **Phase 3**: Statistics dashboard with charts
- **Phase 4**: Daily Bible verse widget (reading reminders pending)
- **Phase 5**: Theme system (light/dark/sepia) + font scaling
- **Phase 6**: Advanced editing (highlights, dividers, block reorder, rich daily notes)
- **Phase 7**: Graph view for entry connections
- **A1**: Export/import data

### Remaining
- **Phase 4**: Reading reminders (expo-notifications)
- **A2**: Voice-to-text (keyboard built-in may suffice)
- **A4**: Cloud backup
