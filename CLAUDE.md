# Divine Journal (Духовный дневник)

## Project Overview

A Russian-language spiritual journaling and Bible study mobile app built with React Native and Expo. It combines personal spiritual journaling with integrated Bible study tools including the full Russian Synodal Bible translation.

## Tech Stack

- **Framework**: React Native + Expo (managed workflow)
- **Language**: TypeScript
- **Navigation**: React Navigation (bottom tabs)
- **Database**: SQLite via `expo-sqlite`
- **Build**: EAS Build (see `eas.json`)

## Project Structure

```
App.tsx          - Single-file app (~1,119 lines) containing all screens and logic
BibleVerses.ts   - Complete Russian Synodal Bible data (31,182 lines, 66 books)
app.json         - Expo configuration
babel.config.js  - Babel config
tsconfig.json    - TypeScript config
package.json     - Dependencies
assets/          - App icons and splash images
.github/workflows/build.yml - CI build workflow
```

## App Capabilities

### 5 Main Screens (Bottom Tab Navigation)

1. **Journal (Дневник)** - Create/edit spiritual journal entries
   - Four entry categories: Dream (Сон), Revelation (Откровение), Thought (Мысль), Prayer (Молитва)
   - Block-based rich text editor (text blocks + verse blocks)
   - Text formatting: bold, italic, underline, font size, font family
   - Embed Bible verses with color-coded highlighting (gold, blue, green, purple, red, teal)
   - Long-press to delete entries

2. **Bible (Библия)** - Browse the full Russian Synodal Bible
   - Three-level navigation: Testament -> Book -> Chapter
   - Bookmark verses
   - 39 Old Testament + 27 New Testament books

3. **Calendar (Календарь)** - Track entries, readings, and fasting
   - Monthly calendar with entry indicators
   - Daily notes per date
   - Reading plan generator (select book, start chapter, pace, duration)
   - Fasting tracker with date ranges and notes

4. **Search (Поиск)** - Full-text Bible search
   - Debounced search (300ms) across 31K+ verses
   - Navigate directly to results in Bible view

5. **Settings (Ещё)** - Statistics and app info
   - Entry count, bookmark count, reading progress

### Database Schema (SQLite - `divine_journal.db`)

- `entries` - Journal entries with JSON blocks, formatting, linked verses
- `bookmarks` - Saved Bible verses
- `reading_plan` - Reading schedule with completion tracking
- `daily_notes` - Date-specific calendar notes
- `fasting` - Fasting period tracking

## Development Notes

- The entire app logic lives in `App.tsx` - there are no separate component files. Keep it this way unless explicitly told otherwise.
- Bible data is statically imported from `BibleVerses.ts`
- Cross-tab navigation: Calendar and Search can jump to specific Bible chapters
- Entry blocks are stored as JSON arrays with type `'text' | 'verse'`
- App version: v3.2
- UI theme: warm earth tones (brown primary #8B4513, tan accent #D4A574, cream background #FDFBF7)
- All user-facing strings must be in Russian

## Enhancement Plan

See `ENHANCEMENT_PLAN.md` for the full roadmap with code-level implementation details for each phase. The plan covers:

- **Phase 1**: Critical UX fixes (toolbar above keyboard, scroll fixes)
- **Phase 2**: Folder system for organizing entries
- **Phase 3**: Statistics dashboard with charts
- **Phase 4**: Daily Bible verse widget + reading reminders
- **Phase 5**: Theme system (light/dark/sepia) + font scaling
- **Phase 6**: Advanced editing (highlights, dividers, block reorder)
- **Phase 7**: Graph view for entry connections
- **Additional**: Export/import, voice input, password protection, cloud backup

Priority order: Phase 1 → 2 → 4 → 3 → 5 → 6 → 7 → Additional
