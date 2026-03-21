# Web Implementation Plan — Divine Journal v5.7 Feature Parity

## Status Overview

The web version (`web/`) is a React + Vite + Tailwind + Dexie (IndexedDB) port of the React Native mobile app.

**Phase 1 is DONE** (committed). Phases 2–4 are the remaining work.

---

## Phase 1 — DONE (Already Committed)

### New/Updated Files

| File | What Was Done |
|------|---------------|
| `web/src/types.ts` (348 lines) | Expanded with `StyleRange`, `VERSE_COLORS` (6), `HIGHLIGHT_COLORS` (5), `VERSE_FONTS` (10), `FOLDER_ICONS`/`FOLDER_COLORS`, `ACHIEVEMENTS` (8), `calcStreak`, `fmtRelTime`, `applyRanges`, `getVerseFontFamily`, `getVerseColor` |
| `web/src/db/index.ts` (128 lines) | Dexie schema bumped to v3 |
| `web/src/components/RTToolbar.tsx` (163 lines) | Bold/italic/underline/font-size/highlight/divider toolbar |
| `web/src/components/VersePicker.tsx` (199 lines) | Books → chapters → verses Bible picker modal |
| `web/src/components/VerseFormatModal.tsx` (123 lines) | Verse block box-color + font styling modal |
| `web/src/components/DailyReadingCard.tsx` (52 lines) | Compact status card with streak badge |
| `web/src/components/DailyReadingModal.tsx` (297 lines) | Full daily reading modal (verse/psalms/proverbs/mark-as-read/save-to-journal) |
| `web/src/components/FolderManager.tsx` (223 lines) | Full CRUD for folders with color + icon pickers |
| `web/src/components/GraphView.tsx` (325 lines) | SVG force-directed graph (60-iter physics, entry/folder nodes, shared-verse/keyword/category edges) |
| `web/src/data/DailyReading.ts` | Ported DailyReading logic (`getDailyVerse`, `getDatePatternVerses`, `getRandomPsalms`, `getDayProverbs`, `getFullDailyReading`) |

---

## Phase 2 — JournalScreen.tsx Rewrite (~498 → ~900 lines)

**File:** `web/src/components/JournalScreen.tsx`

### A. Rich Text Editor with RTToolbar

- Import `RTToolbar`, `ActiveFormats` from `RTToolbar.tsx`
- Import `applyRanges`, `HIGHLIGHT_COLORS`, `StyleRange` from `types.ts`
- State: `activeBlockId: string | null`, `selRange: {start: number; end: number}`
- State: `activeFormats: ActiveFormats` (bold/italic/underline/highlight/fontSize)
- On textarea `onSelect` → update selRange + detect activeFormats at cursor position
- `applyFormat(type, value?)` function: adds `StyleRange` to active block's `ranges` array
- `HighlightedText` inline component: uses `applyRanges()` to render `<span>` elements with bold/italic/underline/background styles
- Show RTToolbar sticky at bottom of editor modal — replace plain `+/−` with toolbar + verse insert button
- Render text blocks in viewer using `HighlightedText` instead of plain `<p>`

### B. Verse Block System

- Import `VersePicker`, `VerseFormatModal`, `VERSE_COLORS`, `getVerseColor`, `getVerseFontFamily`, `VerseData`
- State: `showVersePicker: boolean`, `showVerseFormat: {blockId: string; data: VerseData} | null`
- Verse insert button in editor toolbar → opens VersePicker
- `insertVerse(v: VerseData)` → adds block `{type:'verse', content: JSON.stringify(v), boxColor: 'gold', textStyle: 'serif'}`
- Verse block rendering in editor: colored box (`VERSE_COLORS`), tap → opens `VerseFormatModal`
- Verse block rendering in viewer: same colored box with font
- `saveVerseFormat({boxColor, fontFamily})` → updates block in `edBlocks`
- Update `linked_verses` on save: extract from verse blocks + existing `linked_verses`

### C. Daily Reading System

- Import `DailyReadingCard`, `DailyReadingModal`, `db`, `getSetting`
- State: `showDailyReading: boolean`, `readingIsRead: boolean`, `readingStreak: number`
- On mount: query `daily_reading_history` for today → set isRead + calculate streak using `calcStreak`
- Render `DailyReadingCard` between daily verse banner and folder chips
- `DailyReadingModal` callbacks: `onSaveToJournal` creates new entry with verse block, `onMarkRead` updates DB + state

### D. Reading Plan Progress Card

- State: `planProgress: {total: number; completed: number; nextBook?: string; nextChapter?: number} | null`
- On mount: query `reading_plan` table → compute total/completed counts + next unread chapter
- Render compact progress card (% progress bar + "Далее: Book Ch") between DailyReadingCard and folder chips
- Only show if `total > 0`

### E. Entry Color Tagging

- State: `edColor: string | null`
- In editor: 8-color picker row (use `FOLDER_COLORS`) + "Без цвета" option
- Set `entry.color` on save
- In `EntryCard`: apply `rgba(entry.color, noteOpacity)` as card background wash

### F. Fasting Border Styling

- State: `fastings: Fasting[]` — load all fastings on mount
- `isFastingEntry(entry: Entry): boolean` → checks `created_at` date against fasting date ranges
- In `EntryCard`: if `isFastingEntry` → apply `border: 2px dashed fastingBorderColor`
- Get `fastingBorderColor` from `useTheme()` / app_settings

### G. "On This Day" Memories

- State: `memories: Entry[]`, `showMemories: boolean`
- Compute memories: entries where `MM-DD` matches today but year < currentYear
- Render horizontal scroll strip above entry list (show if `memories.length > 0 && showMemories`)
- Memory cards: year label, category badge, truncated title, preview text
- Tap memory card → `setViewing(entry)`
- X button → `setShowMemories(false)`

### H. Backdated Entry Date Picker

- State: `edDate: string` (YYYY-MM-DD, default today)
- In editor footer: `<input type="date">` field
- On save: use `edDate` as `created_at` (ISO format)
- On `openEdit`: set `edDate` from `entry.created_at`

### I. Multi-select Batch Operations

- State: `selectMode: boolean`, `selectedIds: Set<number>`, `showBatchFolderPicker: boolean`
- Toggle selectMode via header button (checkbox icon)
- `EntryCard`: in selectMode, show checkbox overlay; tap toggles selection
- Header shows "Выбрать всё" / "Снять выделение" / entry count when in selectMode
- Bottom action bar (fixed): "Переместить (N)" button → `showBatchFolderPicker`
- `BatchFolderPicker` modal: list folders + "Без папки" → bulk update `entries.folder_id`

### J. FolderManager Integration

- State: `showFolderManager: boolean`
- Import `FolderManager` from `FolderManager.tsx`
- ⚙️ gear icon button near folder chips
- `FolderManager` callbacks: `onAdd` (db.folders.add), `onEdit` (db.folders.update), `onDelete` (db.folders.delete + clear `folder_id` on entries)

---

## Phase 3 — SettingsScreen.tsx Rewrite (~254 → ~500 lines)

**File:** `web/src/components/SettingsScreen.tsx`

### A. Enhanced Statistics Dashboard

- Query entries by category → show 4 category bars with % and count
- Query last 6 months entry counts → pure CSS bar chart (divs with height proportional to count)
- Reading plan progress bar (completed/total %)
- Streak counter from daily entry dates (use `calcStreak` from `types.ts`)
- Fasting days total from `fasting` table

### B. Achievements Grid

- Import `ACHIEVEMENTS`, `AchievementStats` from `types.ts`
- Compute stats: `totalEntries`, `entryStreak`, `savedFromReading`, `fastingDays`, `completedReadings`
- Compare against `ACHIEVEMENTS[].check(stats)` → mark earned vs locked
- Display 2-column grid: icon + title + description + unlock date (or locked state)
- `checkAndUnlockAchievements()`: for each achievement, if check passes and not in DB → insert with `unlocked_at`

### C. Missing Settings Controls

- Verse usage section: toggle (`show_verse_usage`) + color picker (8 colors, `verse_badge_color`) + opacity slider (0.25–1.0, `verse_badge_opacity`)
- Note appearance section: opacity slider (0.05–0.20, `note_color_opacity`) + fasting border color picker (`fasting_border_color`)
- Daily reading custom pattern: book picker (select from `BIBLE_BOOKS`) → save as JSON to `daily_custom_pattern`

### D. Graph View Button

- State: `showGraph: boolean`
- Import `GraphView` from `GraphView.tsx`
- Button in settings → renders `GraphView` modal overlay

### E. Notifications (Web Push — Best-Effort)

- State: `notifEnabled: boolean`, `notifHour: number`, `notifMinute: number`
- Load from `app_settings` on mount
- Toggle → `Notification.requestPermission()` if enabling
- Time picker: hour (0–23) + minute (0–59) inputs
- Save button → `setSetting` + schedule notification via `setTimeout`/`setInterval` (in-browser, page-visible only)
- Note: full background push requires a push server; implement as page-visible scheduler for now

### F. Auto-Backup System

- State: `autoBackupEnabled`, `autoBackupInterval`, `autoBackupMaxFiles`, `lastBackupDate`
- Load/save all from `app_settings`
- "Создать резервную копию" button → download JSON (same as exportData but with timestamp in filename)
- Auto-backup check on Settings mount: if enabled and interval elapsed → trigger export
- Backup history: store list in `localStorage` (key: `divine_backup_history`) as `[{date, size}]`
- Display backup history list with relative timestamps (`fmtRelTime`)

### G. 10 Bible Fonts

- Replace current `BIBLE_FONTS` const (5 entries) with import of `VERSE_FONTS` from `types.ts` (10 entries)
- Update font picker to render all 10 options with font-family preview

---

## Phase 4 — SearchScreen.tsx Enhancement (~153 → ~300 lines)

**File:** `web/src/components/SearchScreen.tsx`

### A. Tab Switcher

- State: `activeTab: 'bible' | 'journal'`
- Two tabs at top: "Библия" | "Записи"
- Conditionally render Bible search or Journal search panel

### B. Journal Entry Search

- State: `entryResults: Entry[]`, `catFilter: string[]`, `dateFrom: string`, `dateTo: string`
- Search across `entry.title` + `parseBlocks(entry.content).map(b => b.content).join(' ')`
- Debounced 300ms search (use `useEffect` + `setTimeout`)
- Category filter chips (мысль/молитва/благодарность/цитата) — multi-select toggle
- Date range pickers (from/to) as `<input type="date">`
- Result cards: title, category badge, date, text preview with query term highlighted
- Tap → `setViewingEntry` → show entry viewer modal (same viewer as JournalScreen)

---

## Implementation Constraints

- All UI text must be in **Russian**
- Use Tailwind CSS classes + dynamic inline styles for theming
- Use Lucide React icons (consistent with existing web code)
- Dexie v3 IndexedDB for persistence — no backend
- Do **not** create separate component files unless already planned above
- Do **not** import from `App.tsx` (mobile) — web has its own `types.ts` and `db/index.ts`
- Keep `SettingsScreen` passing `onThemeChange`, `onFontScaleChange`, `onBibleFontChange` props up to `App.tsx`
- `BibleScreen` and `CalendarScreen` are already close to parity — minor tweaks only

---

## File Change Summary

| File | Current Lines | Target Lines | Status |
|------|--------------|-------------|--------|
| `web/src/components/JournalScreen.tsx` | 498 | ~900 | **TODO (Phase 2)** |
| `web/src/components/SettingsScreen.tsx` | 254 | ~500 | **TODO (Phase 3)** |
| `web/src/components/SearchScreen.tsx` | 153 | ~300 | **TODO (Phase 4)** |
| `web/src/components/BibleScreen.tsx` | 409 | ~420 | Minor tweaks only |
| `web/src/components/CalendarScreen.tsx` | 584 | ~600 | Minor tweaks only |
| `web/src/App.tsx` | — | — | Pass new props as needed |

---

## Version Bump

After all phases are complete, bump version to **v5.8** in:
1. `web/package.json` → `"version": "5.8.0"`
2. `web/src/App.tsx` or wherever version string is displayed
3. `CLAUDE.md` → update "Current version" field
