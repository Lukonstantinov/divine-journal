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
App.tsx              - Single-file app (~3,392 lines) containing all screens and logic
utils.ts             - Pure utility functions extracted for testability
BibleVerses.ts       - Complete Russian Synodal Bible data (31,182 lines, 66 books)
DailyReading.ts      - Daily reading logic (getFullDailyReading, DailyReadingResult, CustomPattern)
__tests__/utils.test.ts - 46 unit tests for utility functions
jest.config.js       - Jest configuration (ts-jest)
app.json             - Expo configuration (com.lukkonas.divinejournal, portrait) — version: 5.4.0
babel.config.js      - Babel config
tsconfig.json        - TypeScript config
package.json         - Dependencies
eas.json             - EAS Build config (preview = Android APK)
assets/              - App icons and splash images
.github/workflows/build.yml - CI build workflow
ENHANCEMENT_PLAN.md  - Full roadmap with code-level implementation details
```

---

## App.tsx — Accurate Line Map (v5.4, ~3392 lines total)

> **IMPORTANT**: Line numbers shift as code is added. Always use `grep -n` to verify before editing.
> Quick search: `grep -n "const JournalScreen\|const BibleScreen\|const CalendarScreen\|const SearchScreen\|const SettingsScreen\|const GraphView\|const s = StyleSheet" App.tsx`

### Top-level layout

| Lines | What's there |
|-------|-------------|
| 1–13 | Imports (React, RN, expo-sqlite, Ionicons, BibleVerses, DailyReading, SafeArea, SVG, FileSystem, Sharing, DocumentPicker) |
| 14–15 | `SW` = screen width constant |
| 16–39 | `THEMES` object — light / dark / sepia palettes (all color values live here) |
| 40–52 | `ThemeId`, `ThemeColors` types; `ThemeContext`; `useTheme` hook; `C` = THEMES.light (used in StyleSheet) |
| 53–102 | Constants: `VERSE_COLORS`, `VERSE_FONTS`, `HIGHLIGHT_COLORS`, `FONT_SIZES`, `MONTHS`, `WDAYS` |
| 75–93 | Types: `Cat`, `Tab`, `VerseHighlight`, `VerseData`, `TStyle`, `StyleRange`, `Block`, `TEXT_HIGHLIGHTS`, `Entry`, `Reading`, `Fasting`, `Folder`, `NavTarget`, `ReadStats` |
| 103–116 | `ACHIEVEMENTS` array (streak, fasting days, chapters read) |
| 117–123 | `FOLDER_ICONS`, `FOLDER_COLORS` constants |
| 124–145 | `initDb()` — creates 9 tables + runs migrations |
| 146–179 | Notification helpers: `scheduleReadingReminder`, `cancelReadingReminder`, `requestNotificationPermission` |
| 181–280 | Auto-backup helpers: `BackupInterval`, `BackupFileInfo`, `getBackupDir`, `collectBackupData`, `listBackupFiles`, `cleanupOldBackups`, `performAutoBackup`, `shouldAutoBackup`, `tryAutoBackup` |
| 281–355 | DB helpers: `checkAndUnlockAchievements`, `getFullDailyReading` wrappers |
| 356–406 | Pure utility functions: `getDailyVerse`, `genId`, `parseBlocks`, `getVColor`, `getFSize`, `getVFont`, `scaledSz`, `fmtDate`, `fmtDateRu`, `fmtRelTime`, `getMonthDays`, `catStyle`, `catIcon` |
| 407–421 | `SafeAreaWrapper` component |
| 422–465 | `AppContent` — tab router, `navigateToBible`, tab bar render |
| 466–511 | `ThemeProvider` — loads/persists theme, fontScale, bibleFont from `app_settings` |
| 512–535 | `export default App()` — SafeAreaProvider → ThemeProvider → SafeAreaWrapper → AppContent |
| 536–575 | `RTToolbar` — rich text formatting toolbar (bold/italic/underline/size/highlight/divider) |
| 576–595 | `HighlightedVerseText` — renders verse text with inline highlight spans |
| 596–675 | `VerseFormatModal` — modal for styling a verse block (font, highlights, color) |
| 676–697 | `DailyReadingCard` — collapsible card shown at top of Journal screen |
| 698–843 | `DailyReadingModal` — full reading modal (verse of day + Psalm + Proverb + custom plan) |
| **844–1488** | **`JournalScreen`** |
| **1489–2145** | **`CalendarScreen`** |
| **2146–2245** | **`BibleScreen`** |
| **2246–2269** | **`SearchScreen`** |
| 2270–2276 | Graph types: `GraphNode`, `GraphEdge` |
| 2277–2414 | `computeGraph()` — force-directed layout (60 iterations, JS) |
| **2415–2526** | **`GraphView`** component (react-native-svg rendering) |
| **2527–3276** | **`SettingsScreen`** |
| **3277–3391** | **`StyleSheet.create(s = {...})`** — all styles |

---

## Feature Location Map — JournalScreen (lines 844–1488)

| Feature | Where in JournalScreen |
|---------|----------------------|
| State declarations | 845–892 |
| `load()` — fetch entries + folders from DB | ~910–940 |
| Daily verse fetch + widget state | 881, ~912–930 |
| `isFastingEntry()` — cross-check fasting DB | 993–1000 |
| `openEdit(e?)` — opens editor modal (new or edit) | 1051–1065 |
| `reset()` — clears editor state | 1066 |
| `save()` — insert/update entry in DB | ~1070–1100 |
| `del(id)` — delete entry | ~1105 |
| `saveVerseToJournal()` — add verse from daily reading | ~1010–1035 |
| Folder CRUD (`addFolder`, `updateFolder`, `deleteFolder`) | ~1110–1160 |
| `renderVerse(b)` — renders a verse block in viewer/editor | 1174 |
| `renderText(b)` — renders a text block with inline formatting | 1176–1202 |
| `preview(c)` / `vCount(c)` — card preview helpers | 1171–1172 |
| Daily verse widget (collapsible banner) | ~1240–1270 |
| Folder filter chips | ~1215–1235 |
| Entry card `renderItem` (tap=viewer, long-press=editor, chevron=expand) | 1284–1308 |
| Entry viewer modal (`viewing` state) | 1320–1329 |
| Entry editor modal (blocks, toolbar, verse picker) | 1331–1480 |
| Folder management modal | ~1390–1440 |
| Daily reading modal trigger | 1311–1318 |
| Backdated entry date picker | ~1450–1480 |

---

## Feature Location Map — CalendarScreen (lines 1489–2145)

| Feature | Where |
|---------|-------|
| State declarations | 1490–1530 |
| `load()` — fetch readings, notes, fasting, entries for month | ~1535–1540 |
| `toggleRead()` / `addRead()` | 1542–1543 |
| Fasting start/end/name logic | 1554–1570 |
| Reading plan generator (`generatePlan`) | ~1680–1760 |
| Preset plans (Bible in a year, NT 90, Psalms, Gospels) | ~1710–1760 |
| Calendar grid render | ~1770–1830 |
| Day detail panel (notes, readings, fasting, entries) | ~1830–2000 |
| Daily notes block editor (with RTToolbar) | ~1850–1950 |
| Reading plan add/delete sheet | ~2000–2070 |
| Fasting modal | ~2050–2130 |

---

## Feature Location Map — BibleScreen (lines 2146–2245)

| Feature | Where |
|---------|-------|
| State declarations (book, chap, filter, bmarks, verseUsage, badge settings) | 2148–2162 |
| Load bookmarks + badge settings from `app_settings` | 2163 (useEffect) |
| Build `verseUsageMap` from all entries' `linked_verses` | 2170–2178 |
| Navigate to target via `navTarget` prop | 2180–2186 |
| `toggleBm(id)` — bookmark a verse | 2188 |
| Book list view (filter: all/old/new) | 2193–2199 |
| Chapter grid view | 2201–2205 |
| Verse list view — vNum / vTxt / **usage badge** (right side) / bmBtn | 2208–2226 |
| Usage count badge — uses `verseUsageBadgeColor` + `verseUsageBadgeOpacity` | 2214–2218 |
| Usage entries modal (list of journal entries using that verse) | 2228–2245 |

---

## Feature Location Map — SettingsScreen (lines 2527–3276)

| Feature | Where |
|---------|-------|
| State declarations | 2528–2558 |
| `useEffect` — load all settings from DB (stats, reminders, achievements, custom pattern, badge settings) | 2560–2637 |
| `exportData()` | 2644 |
| `saveBackupSetting()` / `toggleAutoBackup()` / auto-backup controls | 2658–2730 |
| `importData()` | ~2735–2780 |
| Stats dashboard (overview cards, category bars, monthly chart) | ~2790–2870 |
| Achievements grid | ~2870–2910 |
| Reading plan progress bar | ~2910–2920 |
| Theme picker (light/dark/sepia) | ~2920–2940 |
| Font scale buttons | ~2940–2960 |
| Bible font picker | ~2950–2970 |
| **БИБЛИЯ section** — verse usage toggle + badge color/opacity | 2969–3005 |
| Graph button (opens GraphView) | ~3005–3015 |
| Reminders toggle + time picker | ~3015–3055 |
| Daily reading custom pattern | ~3055–3120 |
| Export / import buttons | ~3090–3120 |
| Auto-backup section | ~3120–3200 |
| About card (version display "Версия X.X") | 3132 |

---

## `app_settings` Key Reference

All persistent settings live in the `app_settings` table (key TEXT PK, value TEXT):

| Key | Type | Default | Used in |
|-----|------|---------|---------|
| `theme` | `'light'` \| `'dark'` \| `'sepia'` | `'light'` | ThemeProvider |
| `fontScale` | float string | `'1'` | ThemeProvider |
| `bibleFont` | string (font id) | `'serif'` | ThemeProvider |
| `reminderEnabled` | `'0'`/`'1'` | `'0'` | SettingsScreen |
| `reminderHour` | integer string | `'8'` | SettingsScreen |
| `reminderMinute` | integer string | `'0'` | SettingsScreen |
| `show_verse_usage` | `'0'`/`'1'` | `'0'` | BibleScreen, SettingsScreen |
| `verse_badge_color` | hex color string | `'#8B4513'` | BibleScreen, SettingsScreen |
| `verse_badge_opacity` | float string (0.25–1.0) | `'1'` | BibleScreen, SettingsScreen |
| `daily_custom_pattern` | JSON string | null | SettingsScreen |
| `saved_from_reading_count` | integer string | `'0'` | JournalScreen |
| `autoBackupEnabled` | `'0'`/`'1'` | `'0'` | SettingsScreen |
| `autoBackupInterval` | `'daily'`/`'weekly'`/`'monthly'`/`'custom'` | `'daily'` | SettingsScreen |
| `autoBackupCustomDays` | integer string | `'3'` | SettingsScreen |
| `autoBackupMaxFiles` | integer string | `'10'` | SettingsScreen |
| `lastAutoBackupDate` | ISO date string | null | SettingsScreen |

---

## Database Schema (SQLite — `divine_journal.db`)

```sql
entries          (id INTEGER PK, title TEXT, content TEXT, category TEXT DEFAULT 'мысль',
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, linked_verses TEXT DEFAULT '[]',
                  folder_id INTEGER DEFAULT NULL, color TEXT DEFAULT NULL)
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
achievements     (id TEXT PK, unlocked_at TEXT, title TEXT, description TEXT)
```

---

## Development Notes

### Architecture
- The entire app logic lives in `App.tsx` — no separate component files. **Keep it this way unless explicitly told otherwise.**
- `utils.ts` has pure utility functions for testability — duplicated in App.tsx (not imported, to keep single-file pattern)
- Bible data statically imported from `BibleVerses.ts`
- Daily reading logic in `DailyReading.ts` (imported into App.tsx at line 12)
- No external state management — all state is local `useState` within each screen component
- Modals use RN `<Modal>`. Bottom sheets use `sheetOverlay` + `sheet` styles
- Cross-tab navigation: Calendar and Search jump to Bible chapters via `navigateToBible()` callback (AppContent, line ~430)
- Each screen has its own `load()` triggered by `useEffect`

### Data formats
- Entry blocks: `Block[]` JSON — each block: `{id, type:'text'|'verse'|'divider', content, boxColor?, textStyle?, ranges?}`
- Daily notes: Same `Block[]` JSON format (backward-compatible with legacy plain text strings)
- Verse blocks: `content` = JSON-stringified `VerseData` object
- `linked_verses` on entries: JSON array of `{book, chapter, verse}` objects (used by verseUsageMap in BibleScreen)
- Theme: React Context (ThemeContext/ThemeProvider) + `app_settings` DB
- Daily verse: Deterministic hash `(seed * 2654435761) | 0` in `getDailyVerse()`
- Graph: Force-directed layout (60 iterations) in `computeGraph()`, rendered with react-native-svg

### Version Management
- **Current version: v5.5**
- **On every code change built into an APK, bump the version (patch: 5.4 → 5.5 etc.)**
- Update in **3 places**:
  1. `App.tsx` line ~195: `version: '5.X'` inside `collectBackupData()`
  2. `App.tsx` Settings about card: `"Версия 5.X"` display string (~line 3132)
  3. `app.json`: `"version": "5.X.0"`
- **Also update this CLAUDE.md** — "Current version" above and the line map comments

### Style conventions
- UI theme: warm earth tones — brown primary `#8B4513`, tan accent `#D4A574`
- All user-facing strings must be in **Russian**
- All styles in `const s = StyleSheet.create({...})` at line ~3277, using terse names (e.g., `headerTxt`, `cardHdr`, `badgeTxt`)
- Static styles use `C.*` (= `THEMES.light`). Dynamic (theme-aware) styles applied inline via `{ color: theme.text }` etc.
- New UI elements: use colors from `C` palette or extend `THEMES` consistently

### Entry card interaction model
- **Single tap** → opens full viewer modal (`setViewing(item)`)
- **Long-press** → opens editor modal (`openEdit(item)`)
- **Chevron icon** (in card header) → separate `TouchableOpacity`, toggles accordion expand/collapse

### Testing
- Run: `npm test`
- 46 unit tests in `__tests__/utils.test.ts`: fmtDate, getMonthDays, getDailyVerseIndex, getVColor, getFSize, extractKeywords, parseBlocks, parseNote, calcStreak
- Jest with ts-jest (NOT jest-expo — expo preset causes import scope errors with pure TS tests)
- New pure functions → add tests in `__tests__/`

### Known issues
- Pre-existing TS errors (5 total): 4 Ionicons type inference issues (`string` not assignable to icon name union) + 1 BibleVerses.ts union type complexity error — harmless, existed before any enhancements
- `expo-file-system` v19 uses the new API (`File`, `Paths`, `Directory` classes) — NOT the old `documentDirectory`/`writeAsStringAsync` API. Import: `import { File as ExpoFile, Directory, Paths } from 'expo-file-system'`

### Database migrations
- Must be idempotent: `CREATE TABLE IF NOT EXISTS`, wrap `ALTER TABLE` in try/catch
- `folder_id` on `entries` is added via migration
- `color` on `entries` is added via migration
- `achievements` table created in `initDb()`

---

## CLAUDE.md Maintenance

**When a PR is initiated or code changes are pushed:**
1. Check if any new components, screens, or major features were added
2. Update the **line map table** above (use `grep -n "const JournalScreen\|const BibleScreen..."` to get current lines)
3. Update **version** in the "Current version" field
4. Add new `app_settings` keys to the key reference table
5. Update the feature location map for any screen that was modified

---

## Enhancement Plan

See `ENHANCEMENT_PLAN.md` for the full roadmap with code-level implementation details.

### Completed
- **Phase 1**: Critical UX fixes (toolbar above keyboard, scroll fixes)
- **Phase 2**: Folder system for organizing entries
- **Phase 3**: Statistics dashboard with charts
- **Phase 4**: Daily Bible verse widget + reading reminders
- **Phase 5**: Theme system (light/dark/sepia) + font scaling
- **Phase 6**: Advanced editing (highlights, dividers, block reorder, rich daily notes)
- **Phase 7**: Graph view for entry connections
- **A1**: Export/import data
- **Phase 8**: Daily reading system (verse of the day, Psalms, Proverbs, custom plans)
- **Phase 9**: Backdated notes (custom date picker for entries)
- **v5.3**: Bible verse usage badges, daily verse collapsible, note color tagging, collapsible sections, On This Day memories
- **v5.4**: Badge moved to right-side of verse row, badge color/opacity customization in Settings, entry card tap=viewer/long-press=editor, card window-border styling

### Planned
- **Feature 2**: "On This Day" — past years memories slider
- **Feature 6**: Journal full-text search with filters
- **Feature 9**: Entry pinning & favorites
- **Feature 10**: Home screen widget (daily verse)
- **A2**: Voice-to-text
- **A4**: Cloud backup
