# Divine Journal (Духовный дневник)

## Project Overview

A Russian-language spiritual journaling and Bible study mobile app built with React Native and Expo. It combines personal spiritual journaling with integrated Bible study tools including the full Russian Synodal Bible translation.

## Tech Stack

- **Framework**: React Native + Expo SDK 54 (managed workflow)
- **Language**: TypeScript
- **Navigation**: Manual tab state via `useState<Tab>` (not React Navigation's tab navigator, despite it being in dependencies)
- **Database**: SQLite via `expo-sqlite` v16
- **Charts/Graphics**: `react-native-svg` (graph view)
- **File I/O**: `expo-file-system` v19 (new File/Paths API), `expo-sharing`, `expo-document-picker`
- **Testing**: Jest + ts-jest (run via `npm test`)
- **Build**: GitHub Actions APK build (`.github/workflows/build.yml`) — push to main triggers `expo prebuild` + Gradle `assembleRelease`

## Project Structure

```
App.tsx              - Single-file app (~1,914 lines) containing all screens and logic
utils.ts             - Pure utility functions extracted for testability
BibleVerses.ts       - Complete Russian Synodal Bible data (31,182 lines, 66 books)
__tests__/utils.test.ts - 46 unit tests for utility functions
jest.config.js       - Jest configuration (ts-jest)
app.json             - Expo configuration (com.lukkonas.divinejournal, portrait)
babel.config.js      - Babel config
tsconfig.json        - TypeScript config
package.json         - Dependencies
eas.json             - EAS Build config (preview = Android APK)
assets/              - App icons and splash images
.github/workflows/build.yml - CI build workflow
ENHANCEMENT_PLAN.md  - Full roadmap with code-level implementation details
```

## App.tsx Internal Structure (line ranges)

```
Lines 1-10       Imports (React, RN, expo-sqlite, Ionicons, BibleVerses, SafeArea, SVG, FileSystem, Sharing, DocumentPicker)
Lines 14-42      THEMES object (light/dark/sepia palettes), ThemeContext, useTheme hook
Lines 43-97      Constants: VERSE_COLORS, VERSE_FONTS, FONT_SIZES, TEXT_HIGHLIGHTS, MONTHS, WDAYS
                 Types: TStyle, Block, Cat, Tab, Entry, Folder, Reading, Fasting, NavTarget
Lines 98-147     initDb (8 tables + 1 migration), getDailyVerse, genId, parseBlocks, utility functions
Lines 148-203    SafeAreaWrapper component
Lines 204-241    ThemeProvider component (persistent theme/fontScale via app_settings table)
Lines 242-266    App export: SafeAreaProvider → ThemeProvider → SafeAreaWrapper → AppContent (tab router)
Lines 267-404    RTToolbar component (bold/italic/underline/font-size/highlight-picker/divider)
Lines 405-751    JournalScreen — entries CRUD, block editor, verse embedding, folders, daily verse widget
Lines 752-1311   CalendarScreen — calendar grid, daily notes (block editor), reading plans, fasting tracker
Lines 1313-1363  BibleScreen — testament filter, book/chapter/verse navigation, bookmarks
Lines 1365-1385  SearchScreen — debounced Bible search with navigation
Lines 1386-1588  Graph types + computeGraph (force-directed layout) + GraphView component
Lines 1589-1832  SettingsScreen — stats dashboard, themes, font scale, graph button, export/import, about
Lines 1833-1914  StyleSheet.create (s = {...}) — all styles in one terse-named object
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

```sql
entries          (id INTEGER PK, title TEXT, content TEXT, category TEXT DEFAULT 'мысль',
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, linked_verses TEXT DEFAULT '[]',
                  folder_id INTEGER DEFAULT NULL)
bookmarks        (id INTEGER PK, verse_id TEXT UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)
reading_plan     (id INTEGER PK, date TEXT, book TEXT, chapter INTEGER, completed BOOLEAN DEFAULT 0,
                  UNIQUE(date, book, chapter))
daily_notes      (id INTEGER PK, date TEXT UNIQUE, notes TEXT DEFAULT '')
fasting          (id INTEGER PK, start_date TEXT, end_date TEXT, notes TEXT DEFAULT '',
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP)
folders          (id INTEGER PK, name TEXT, color TEXT DEFAULT '#8B4513',
                  icon TEXT DEFAULT 'folder', sort_order INTEGER DEFAULT 0)
daily_verse_history (id INTEGER PK, date TEXT UNIQUE, verse_id TEXT, seen BOOLEAN DEFAULT 0)
app_settings     (key TEXT PK, value TEXT)
```

## Development Notes

### Architecture
- The entire app logic lives in `App.tsx` - there are no separate component files. **Keep it this way unless explicitly told otherwise.**
- Pure utility functions are in `utils.ts` for testability — these are duplicated in App.tsx (not imported, to keep single-file pattern)
- Bible data is statically imported from `BibleVerses.ts`
- No external state management — all state is local `useState` within each screen component
- Modals use RN `<Modal>` component. Bottom sheets use `sheetOverlay` + `sheet` styles
- Cross-tab navigation: Calendar and Search can jump to specific Bible chapters via `navigateToBible()` callback
- Each screen has its own `load()` callback triggered by `useEffect`

### Data formats
- Entry blocks: JSON array of `Block[]` — each block is `{id, type:'text'|'verse'|'divider', content, boxColor?, textStyle?}`
- Daily notes: Also Block[] JSON format (backward-compatible with legacy plain text strings)
- Theme system: React Context (ThemeContext/ThemeProvider) with persistent DB storage in `app_settings` table
- Daily verse: Deterministic selection using date-based hash `(seed * 2654435761) | 0`
- Graph view: Force-directed layout (60 iterations) computed in JS, rendered with react-native-svg

### Version Management
- **Current version: v3.6**
- **IMPORTANT**: On every code change that will be built into an APK, bump the version number (patch increment: 3.3 → 3.4 → 3.5 etc.)
- Update version in **3 places**: `App.tsx` export `version` field, `App.tsx` "Версия X.X" display string, and `app.json` `"version"` field
- This ensures the user can always verify they have the latest build installed

### Style conventions
- UI theme: warm earth tones with light/dark/sepia modes (brown primary #8B4513, tan accent #D4A574)
- All user-facing strings must be in Russian
- Style naming: terse convention in the `s` object (e.g., `headerTxt`, `cardHdr`, `badgeTxt`)
- Color harmony: new UI elements should use colors from the `C` palette or extend it consistently

### Testing
- Run tests: `npm test`
- 46 unit tests in `__tests__/utils.test.ts` covering: fmtDate, getMonthDays, getDailyVerseIndex, getVColor, getFSize, extractKeywords, parseBlocks, parseNote, calcStreak
- Jest with ts-jest (NOT jest-expo — expo preset causes import scope errors with pure TS tests)
- When adding new pure functions, add corresponding tests in `__tests__/`

### Known issues
- Pre-existing TS errors (5 total): 4 Ionicons type inference issues (`string` not assignable to icon name union) + 1 BibleVerses.ts union type complexity error — these are harmless and existed before any enhancements
- `expo-file-system` v19 uses the new API (`File`, `Paths` classes) — NOT the old `documentDirectory`/`writeAsStringAsync` legacy API. Import as `import { File as ExpoFile, Paths } from 'expo-file-system'`

### Database migrations
- Must be idempotent: use `CREATE TABLE IF NOT EXISTS` and wrap `ALTER TABLE` in try/catch
- The `folder_id` column on `entries` is added via migration (try/catch around ALTER TABLE)

## Enhancement Plan

See `ENHANCEMENT_PLAN.md` for the full roadmap with code-level implementation details for each phase.

### Completed Phases
- **Phase 1**: Critical UX fixes (toolbar above keyboard, scroll fixes)
- **Phase 2**: Folder system for organizing entries
- **Phase 3**: Statistics dashboard with charts
- **Phase 4**: Daily Bible verse widget + reading reminders
- **Phase 5**: Theme system (light/dark/sepia) + font scaling
- **Phase 6**: Advanced editing (highlights, dividers, block reorder, rich daily notes)
- **Phase 7**: Graph view for entry connections
- **A1**: Export/import data

### Remaining
- **A2**: Voice-to-text (keyboard built-in may suffice)
- **A4**: Cloud backup
