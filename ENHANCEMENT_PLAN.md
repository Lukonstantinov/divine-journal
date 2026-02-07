# Divine Journal — Enhancement Implementation Plan

> **Purpose**: This document is the single source of truth for all planned enhancements.
> Each phase contains enough detail for a Claude session to implement it without
> re-reading the entire codebase. Read this file first, then implement.

---

## Current Architecture Summary

**Read this section before starting any phase.**

### File Layout

| File | Lines | Purpose |
|---|---|---|
| `App.tsx` | ~1,119 | **Entire app** — all screens, components, styles, DB logic |
| `BibleVerses.ts` | ~31,182 | Static Bible data: `BIBLE_VERSES` array, `BIBLE_BOOKS` array |
| `app.json` | Expo config | Package: `com.lukkonas.divinejournal`, portrait only |
| `package.json` | Dependencies | Expo 54, React 19.1, RN 0.81.5, expo-sqlite 16 |
| `eas.json` | EAS Build | Preview profile: Android APK |

### App.tsx Internal Structure (top to bottom)

```
Lines 1-9       Imports (React, RN, expo-sqlite, Ionicons, BibleVerses, SafeArea)
Lines 10-15     C = color constants object (primary #8B4513, bg #FDFBF7, etc.)
Lines 17-34     VERSE_COLORS[], VERSE_FONTS[], HIGHLIGHT_COLORS[], FONT_SIZES[], MONTHS[], WDAYS[]
Lines 36-46     TypeScript types: Cat, Tab, VerseHighlight, VerseData, Block, Entry, Reading, Fasting, NavTarget
Lines 48-88     DB init (initDb), utility functions (genId, parseBlocks, getVColor, fmtDate, catStyle, catIcon)
Lines 89-165    App shell: SafeAreaWrapper, AppContent (tab router), App export
Lines 167-188   RTToolbar component (bold/italic/underline/font-size)
Lines 190-287   HighlightedVerseText + VerseFormatModal components
Lines 289-435   JournalScreen (~146 lines) — entries CRUD, block editor, verse embedding
Lines 437-463   VersePickerModal — Bible verse selection with search
Lines 465-968   CalendarScreen (~503 lines) — calendar, reading plans, fasting tracker
Lines 971-1021  BibleScreen — testament filter, book/chapter/verse navigation, bookmarks
Lines 1023-1043 SearchScreen — debounced Bible search
Lines 1045-1057 SettingsScreen — basic stats (entries, bookmarks, readings)
Lines 1059-1119 StyleSheet.create (s = {...}) — all styles in one object
```

### Database Schema (SQLite — `divine_journal.db`)

```sql
-- Current tables (initialized in initDb, lines 50-58):
entries       (id INTEGER PK, title TEXT, content TEXT, category TEXT DEFAULT 'мысль',
               created_at DATETIME DEFAULT CURRENT_TIMESTAMP, linked_verses TEXT DEFAULT '[]')
bookmarks     (id INTEGER PK, verse_id TEXT UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)
reading_plan  (id INTEGER PK, date TEXT, book TEXT, chapter INTEGER, completed BOOLEAN DEFAULT 0,
               UNIQUE(date, book, chapter))
daily_notes   (id INTEGER PK, date TEXT UNIQUE, notes TEXT DEFAULT '')
fasting       (id INTEGER PK, start_date TEXT, end_date TEXT, notes TEXT DEFAULT '',
               created_at DATETIME DEFAULT CURRENT_TIMESTAMP)
```

### Key Patterns

- **Navigation**: Manual tab state (`useState<Tab>`) at line 104, not React Navigation's tab navigator (despite it being in dependencies). Cross-tab nav via `navigateToBible()` callback.
- **Data loading**: Each screen has its own `load()` callback triggered by `useEffect`.
- **Entry content**: Stored as JSON array of `Block[]` — each block is `{id, type:'text'|'verse', content, boxColor?, textStyle?}`.
- **Styling**: Single `StyleSheet.create(s)` object at bottom. Colors from `C` constant object at top.
- **Modals**: All use RN `<Modal>` component. Bottom sheets use `sheetOverlay` + `sheet` styles.
- **No external state management** — all state is local `useState` within each screen component.

### Current Dependencies

```json
"@expo/vector-icons": "^15.0.3",
"@react-navigation/bottom-tabs": "^7.0.0",
"@react-navigation/native": "^7.0.0",
"@react-navigation/native-stack": "^7.0.0",
"expo": "^54.0.32",
"expo-sqlite": "~16.0.10",
"expo-status-bar": "~3.0.9",
"react": "19.1.0",
"react-native": "0.81.5",
"react-native-safe-area-context": "~5.6.0",
"react-native-screens": "~4.16.0"
```

---

## Priority Execution Order

Phases are ordered by dependency and user impact:

```
Phase 1: Critical Fixes          ← BLOCKING, do first
Phase 2: Folder System           ← Core feature
Phase 4: Daily Bible Feature     ← Core feature
Phase 3: Statistics Dashboard    ← Enhancement
Phase 5: Enhanced Themes         ← Enhancement
Phase 6: Advanced Editing        ← Power feature
Phase 7: Graph View              ← Power feature
Additional Features              ← Independent, any order
```

### Phase Dependencies

```
Phase 1 → no dependencies (fix existing code)
Phase 2 → no dependencies (new DB table, modify JournalScreen)
Phase 3 → benefits from Phase 2 (folder stats), but can work without it
Phase 4 → no dependencies (new DB table, new widget)
Phase 5 → no dependencies (theme context wraps entire app)
Phase 6 → no dependencies (extends RTToolbar and Block system)
Phase 7 → benefits from Phase 2 (folder connections), requires new package
Additional Features → each is independent
```

---

## Phase 1: Critical Fixes

**Goal**: Fix two UX-blocking issues — toolbar hidden behind keyboard, and scroll problems in long notes.

**Estimated scope**: ~30 lines changed in App.tsx

### 1A. Toolbar Above Keyboard

**Problem**: The `RTToolbar` (line 413) renders inside the modal header area. On iOS, `KeyboardAvoidingView` with `behavior='padding'` pushes content up, but the toolbar stays at the top of the modal — far from the text input. On Android (`behavior='height'`), the toolbar may be clipped entirely.

**Current code** (lines 410-422):
```tsx
<Modal visible={modal} animationType="slide">
  <SafeAreaView style={s.modal}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={s.modalHdr}>...</View>
      {activeId && <RTToolbar ... />}          {/* ← toolbar here, above ScrollView */}
      <ScrollView style={s.modalBody}>
        ...blocks...
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
</Modal>
```

**Fix**: Move `RTToolbar` to render **below** the `ScrollView` (directly above the keyboard). Use `Keyboard` API from react-native to detect keyboard visibility and adjust.

**Implementation steps**:

1. Add `Keyboard` to the RN import at line 2:
   ```tsx
   import { ..., Keyboard } from 'react-native';
   ```

2. Add keyboard tracking state inside `JournalScreen` (around line 302):
   ```tsx
   const [keyboardVisible, setKeyboardVisible] = useState(false);
   useEffect(() => {
     const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
     const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
     return () => { showSub.remove(); hideSub.remove(); };
   }, []);
   ```

3. Restructure the editor modal (lines 410-423). Move RTToolbar below ScrollView:
   ```tsx
   <Modal visible={modal} animationType="slide">
     <SafeAreaView style={s.modal}>
       <KeyboardAvoidingView
         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
         style={{ flex: 1 }}
         keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
       >
         <View style={s.modalHdr}>...</View>
         <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
           ...blocks...
         </ScrollView>
         {activeId && keyboardVisible && <RTToolbar ... />}
       </KeyboardAvoidingView>
     </SafeAreaView>
   </Modal>
   ```

4. Update `s.toolbar` style (line 1065) — add bottom border instead of top, ensure it doesn't flex-shrink:
   ```tsx
   toolbar: {
     flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceAlt,
     paddingHorizontal: 12, paddingVertical: 8,
     borderTopWidth: 1, borderTopColor: C.border,  // changed from borderBottom
   },
   ```

**Testing**: Open journal entry editor, tap a text block, verify toolbar appears directly above the keyboard. Verify it disappears when keyboard dismisses.

### 1B. Fix Scrolling in Long Notes

**Problem**: The entry viewer modal (lines 402-408) uses `<ScrollView>` which works, but the entry **editor** modal has blocks inside a `ScrollView` where `TextInput multiline` blocks can grow unbounded. When content gets long, the scroll position jumps unpredictably — especially when switching between blocks.

**Current code** (line 414):
```tsx
<ScrollView style={s.modalBody}>
  ...blocks with TextInput multiline...
</ScrollView>
```

**Fix**:

1. Add `keyboardShouldPersistTaps="handled"` to the editor ScrollView (prevents keyboard dismiss on scroll):
   ```tsx
   <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
   ```

2. Add a ref to the ScrollView and auto-scroll to the active block when focused:
   ```tsx
   const scrollRef = useRef<ScrollView>(null);
   const blockPositions = useRef<Record<string, number>>({});
   ```

3. On each block `<View>`, capture its layout position:
   ```tsx
   <View key={b.id} onLayout={(e) => { blockPositions.current[b.id] = e.nativeEvent.layout.y; }}>
   ```

4. When a text block is focused (`onFocus`), scroll to it:
   ```tsx
   onFocus={() => {
     setActiveId(b.id);
     setTStyle(b.textStyle || {});
     setTimeout(() => {
       const y = blockPositions.current[b.id];
       if (y !== undefined && scrollRef.current) {
         scrollRef.current.scrollTo({ y: Math.max(0, y - 100), animated: true });
       }
     }, 100);
   }}
   ```

5. Add `scrollEventThrottle={16}` to ScrollView for smooth tracking.

6. Add spacer at the end of blocks list so the last block can scroll above keyboard:
   ```tsx
   {blocks.map(...)  }
   <View style={{ height: 200 }} />
   ```

**Testing**: Create a journal entry with 10+ text blocks and several verse blocks. Scroll should be smooth. Tapping any block should scroll it into view above the keyboard. Toolbar should remain accessible.

---

## Phase 2: Folder System

**Goal**: Allow users to organize journal entries into folders. Support folder CRUD, entry assignment, and filtering.

**Estimated scope**: ~200 lines added to App.tsx, 1 new DB table, 1 column added

### Database Changes

Add to `initDb()` (line 52), append after existing CREATE TABLE statements:

```sql
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8B4513',
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Add migration for existing `entries` table (append in `initDb` after table creation):

```sql
-- Add folder_id column if it doesn't exist (safe migration)
-- Use pragma to check columns, then ALTER if needed
```

**Safe migration approach** — add this after the CREATE TABLE block:
```tsx
try {
  await db.execAsync('ALTER TABLE entries ADD COLUMN folder_id INTEGER DEFAULT NULL REFERENCES folders(id)');
} catch (e) {
  // Column already exists — ignore
}
```

### New TypeScript Interfaces

Add after existing interfaces (line 46):
```tsx
interface Folder { id: number; name: string; color: string; icon: string; sort_order: number; created_at: string; }
```

### JournalScreen Changes

**State additions** (around line 291):
```tsx
const [folders, setFolders] = useState<Folder[]>([]);
const [activeFolder, setActiveFolder] = useState<number | null>(null);  // null = show all
const [showFolderMgmt, setShowFolderMgmt] = useState(false);
const [entryFolder, setEntryFolder] = useState<number | null>(null);  // folder_id for entry being edited
```

**Updated `load()` function**: Also fetch folders:
```tsx
const load = useCallback(async () => {
  setEntries(await db.getAllAsync<Entry>('SELECT * FROM entries ORDER BY created_at DESC'));
  setFasts(await db.getAllAsync<Fasting>('SELECT * FROM fasting'));
  setFolders(await db.getAllAsync<Folder>('SELECT * FROM folders ORDER BY sort_order ASC'));
}, []);
```

**Filter entries by folder**: Update the FlatList data prop:
```tsx
const filteredEntries = activeFolder
  ? entries.filter(e => (e as any).folder_id === activeFolder)
  : entries;
```

### UI Components to Add

1. **Folder filter bar** — horizontal scrollable row below the header (line 382):
   ```
   [All] [📁 Молитвы] [📁 Сны] [📁 Откровения] [+]
   ```
   - Render as horizontal `ScrollView` with folder chips
   - "All" chip shows total count
   - Each folder chip shows its name and entry count
   - "+" chip opens folder management modal

2. **Folder picker in entry editor** — add below the category picker (line 416):
   ```
   Папка: [Без папки ▼]
   ```
   - Dropdown/modal to select a folder
   - "Без папки" (No folder) as default option

3. **Folder management modal** — new `<Modal>`:
   - List all folders with edit/delete actions
   - "Add folder" button
   - Each folder row: color dot + icon + name + entry count + edit/delete icons
   - Edit inline: name, color picker (reuse VERSE_COLORS), icon picker (subset of Ionicons)
   - Long-press to reorder (or simple up/down arrows for v1)

### Entry Save Changes

Update `save()` (line 321) to include `folder_id`:
```tsx
if (editing) {
  await db.runAsync('UPDATE entries SET title=?, content=?, category=?, linked_verses=?, folder_id=? WHERE id=?',
    [title, cJson, cat, JSON.stringify(linked), entryFolder, editing.id]);
} else {
  await db.runAsync('INSERT INTO entries (title, content, category, linked_verses, folder_id) VALUES (?,?,?,?,?)',
    [title, cJson, cat, JSON.stringify(linked), entryFolder]);
}
```

### Folder Icons (Suggested Subset)

```tsx
const FOLDER_ICONS = ['folder', 'heart', 'star', 'flame', 'moon', 'sunny', 'book', 'bulb', 'leaf', 'diamond'];
```

### New Styles to Add

```tsx
folderBar: { paddingHorizontal: 12, paddingVertical: 8 },
folderChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginRight: 8 },
folderChipAct: { backgroundColor: C.primary, borderColor: C.primary },
folderChipTxt: { fontSize: 13, fontWeight: '500', color: C.textSec, marginLeft: 6 },
folderChipTxtAct: { color: C.textOn },
```

---

## Phase 3: Statistics Dashboard

**Goal**: Replace the basic 3-stat cards in SettingsScreen with a rich statistics dashboard showing entry counts by category, reading progress, and weekly/monthly insights.

**Estimated scope**: ~250 lines added/modified in App.tsx

### SettingsScreen Rewrite

The current SettingsScreen (lines 1046-1057) fetches 3 counts. Replace with a comprehensive stats loader.

**New state and data loading**:
```tsx
const SettingsScreen = () => {
  const [stats, setStats] = useState({
    totalEntries: 0, totalBookmarks: 0, totalRead: 0,
    byCat: { сон: 0, откровение: 0, мысль: 0, молитва: 0 } as Record<Cat, number>,
    byMonth: [] as { month: string; count: number }[],
    readingProgress: { total: 0, completed: 0 },
    streak: 0,           // consecutive days with entries
    totalFastDays: 0,
    byFolder: [] as { name: string; count: number; color: string }[],  // if Phase 2 done
  });
```

**Data queries**:
```sql
-- By category
SELECT category, COUNT(*) as c FROM entries GROUP BY category

-- By month (last 6 months)
SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as c
FROM entries GROUP BY month ORDER BY month DESC LIMIT 6

-- Reading progress
SELECT COUNT(*) as total, SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) as done
FROM reading_plan

-- Entry streak (consecutive days)
SELECT DISTINCT date(created_at) as d FROM entries ORDER BY d DESC

-- Fasting days total
-- (computed in JS from fasting table data)
```

### UI Layout

```
┌─────────────────────────────────────────┐
│  ⚙️ Настройки                           │
├─────────────────────────────────────────┤
│  ОБЗОР                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │  42  │ │  15  │ │  89  │            │
│  │Записи│ │Закл. │ │Прочит│            │
│  └──────┘ └──────┘ └──────┘            │
├─────────────────────────────────────────┤
│  ПО КАТЕГОРИЯМ                          │
│  Сон          ████████░░░░  12 (29%)   │
│  Откровение   ████░░░░░░░░   6 (14%)   │
│  Мысль        ██████████░░  18 (43%)   │
│  Молитва      ██░░░░░░░░░░   6 (14%)   │
├─────────────────────────────────────────┤
│  АКТИВНОСТЬ (6 мес.)                    │
│  ▁▃▅▇▅▃  bar chart by month            │
│  Сен Окт Ноя Дек Янв Фев              │
├─────────────────────────────────────────┤
│  ПЛАН ЧТЕНИЯ                            │
│  ████████████░░░░  67/100 (67%)        │
│  progress bar                           │
├─────────────────────────────────────────┤
│  ДОСТИЖЕНИЯ                             │
│  🔥 Серия: 5 дней подряд               │
│  🙏 Дней поста: 14                      │
│  📖 Книг прочитано: 3                   │
├─────────────────────────────────────────┤
│  О ПРИЛОЖЕНИИ                           │
│  Divine Journal v3.2                    │
└─────────────────────────────────────────┘
```

### Implementation Approach

Build each section as an inline JSX block within the ScrollView. No separate components needed — keep the single-file pattern.

**Category bars**: Simple `<View>` with percentage-based width:
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
  <View style={{ width: 90 }}><Text>{catName}</Text></View>
  <View style={{ flex: 1, height: 8, backgroundColor: C.borderLight, borderRadius: 4 }}>
    <View style={{ width: `${pct}%`, height: 8, backgroundColor: color, borderRadius: 4 }} />
  </View>
  <Text style={{ width: 60, textAlign: 'right' }}>{count}</Text>
</View>
```

**Monthly activity bars**: Vertical bars scaled to max value:
```tsx
// No chart library needed — use View heights
const maxCount = Math.max(...byMonth.map(m => m.count), 1);
byMonth.map(m => (
  <View style={{ alignItems: 'center', flex: 1 }}>
    <View style={{ height: (m.count / maxCount) * 80, width: 20, backgroundColor: C.primary, borderRadius: 4 }} />
    <Text>{monthLabel}</Text>
  </View>
))
```

**Streak calculation** (in JS):
```tsx
const calcStreak = (entries: Entry[]): number => {
  const dates = [...new Set(entries.map(e => e.created_at.split('T')[0].split(' ')[0]))].sort().reverse();
  let streak = 0;
  const today = fmtDate(new Date());
  let expected = today;
  for (const d of dates) {
    if (d === expected) { streak++; const prev = new Date(expected); prev.setDate(prev.getDate() - 1); expected = fmtDate(prev); }
    else if (d < expected) break;
  }
  return streak;
};
```

### New Styles

```tsx
statBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
statBarLabel: { width: 90, fontSize: 13, color: C.textSec, textTransform: 'capitalize' },
statBarTrack: { flex: 1, height: 8, backgroundColor: C.borderLight, borderRadius: 4 },
statBarFill: { height: 8, borderRadius: 4 },
statBarCount: { width: 60, textAlign: 'right', fontSize: 13, color: C.textMuted },
activityChart: { flexDirection: 'row', alignItems: 'flex-end', height: 100, paddingTop: 12 },
activityBar: { flex: 1, marginHorizontal: 4, borderRadius: 4, backgroundColor: C.primary },
achieveRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
```

---

## Phase 4: Daily Bible Feature

**Goal**: Show a "verse of the day" on the journal screen, add reading reminders via notifications, and track daily reading consistency.

**Estimated scope**: ~180 lines added, 1 new DB table, 1 new package

### New Package Required

```bash
npx expo install expo-notifications
```

Add to `app.json` plugins:
```json
"plugins": ["expo-sqlite", "expo-notifications"]
```

### Database Changes

Add to `initDb()`:
```sql
CREATE TABLE IF NOT EXISTS daily_verse_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  verse_id TEXT NOT NULL,
  seen BOOLEAN DEFAULT 0
);
```

### Verse-of-the-Day Algorithm

The app has 31,182 verses in `BIBLE_VERSES`. Use a deterministic daily selection based on date:

```tsx
const getDailyVerse = (date: Date): BibleVerse => {
  // Deterministic seed from date — same verse for same day across all devices
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  // Simple hash to distribute across verses
  const idx = (seed * 2654435761) % BIBLE_VERSES.length;
  return BIBLE_VERSES[Math.abs(idx)];
};
```

### UI: Daily Verse Widget

Add to the top of `JournalScreen`, between the header and the FlatList (line 382):

```
┌─────────────────────────────────────────┐
│  ✨ Стих дня                             │
│                                          │
│  "Ибо так возлюбил Бог мир, что отдал   │
│   Сына Своего Единородного..."           │
│                                          │
│  — Иоанна 3:16              [📖] [📋]   │
│                                          │
│  Streak: 🔥 5 days                       │
└─────────────────────────────────────────┘
```

**Buttons**:
- `📖` — Navigate to this verse in Bible tab
- `📋` — Copy verse text to clipboard (use `expo-clipboard` or RN `Share`)
- Optional: `💾` — Bookmark this verse

**State additions in JournalScreen**:
```tsx
const [dailyVerse, setDailyVerse] = useState<BibleVerse | null>(null);
const [verseStreak, setVerseStreak] = useState(0);
```

**Load daily verse**:
```tsx
useEffect(() => {
  const today = new Date();
  const verse = getDailyVerse(today);
  setDailyVerse(verse);
  // Track that user saw today's verse
  db.runAsync('INSERT OR IGNORE INTO daily_verse_history (date, verse_id, seen) VALUES (?,?,1)',
    [fmtDate(today), verse.id]);
  // Calculate streak
  db.getAllAsync<{ date: string }>('SELECT date FROM daily_verse_history WHERE seen=1 ORDER BY date DESC')
    .then(rows => {
      let streak = 0;
      let expected = fmtDate(today);
      for (const r of rows) {
        if (r.date === expected) { streak++; const d = new Date(expected); d.setDate(d.getDate() - 1); expected = fmtDate(d); }
        else break;
      }
      setVerseStreak(streak);
    });
}, []);
```

### Reading Reminders (Notifications)

**Notification setup** — add in `App` component or `AppContent`:

```tsx
import * as Notifications from 'expo-notifications';

// At app startup:
const setupNotifications = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  // Cancel existing scheduled notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Schedule daily reminder at 9:00 AM
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📖 Время чтения',
      body: 'Откройте Духовный дневник для ежедневного чтения',
    },
    trigger: {
      type: 'daily',
      hour: 9,
      minute: 0,
    },
  });
};
```

**Settings toggle** — add in SettingsScreen:
```
[🔔 Напоминания о чтении]  [Toggle ON/OFF]
 Время: 09:00              [Change time]
```

Store notification preference in `AsyncStorage` or a new `settings` DB table:
```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### New Styles

```tsx
dailyVerse: { backgroundColor: '#FFF8E7', margin: 16, marginBottom: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#D4A574' },
dailyVerseLabel: { fontSize: 13, fontWeight: '700', color: C.warning, marginBottom: 8 },
dailyVerseTxt: { fontSize: 16, fontStyle: 'italic', color: C.text, lineHeight: 24, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
dailyVerseRef: { fontSize: 14, fontWeight: '600', color: C.primary, marginTop: 8 },
dailyVerseActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 12 },
streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
```

---

## Phase 5: Enhanced Themes

**Goal**: Support light/dark/sepia theme modes, custom color schemes, and global font size scaling.

**Estimated scope**: ~150 lines added/modified, significant refactor of `C` constant

### Architecture Decision: Theme Context

Currently, colors are hardcoded in the `C` object (line 10). To support themes, wrap the app in a `ThemeContext`.

**Step 1**: Define theme objects:
```tsx
const THEMES = {
  light: {
    primary: '#8B4513', primaryLight: '#A0522D', bg: '#FDFBF7', surface: '#FFFFFF', surfaceAlt: '#F5F2ED',
    text: '#2C1810', textSec: '#5D4037', textMuted: '#8D7B6C', textOn: '#FFFFFF',
    accent: '#D4A574', accentLight: '#E8D5B7', success: '#4A7C59', error: '#8B3A3A', warning: '#B8860B',
    border: '#DED5C8', borderLight: '#EDE8E0',
    statusBar: 'dark-content' as const,
  },
  dark: {
    primary: '#D4A574', primaryLight: '#E8D5B7', bg: '#1A1410', surface: '#2C241E', surfaceAlt: '#3A302A',
    text: '#FDFBF7', textSec: '#C4B5A5', textMuted: '#8D7B6C', textOn: '#1A1410',
    accent: '#8B4513', accentLight: '#3A302A', success: '#66BB6A', error: '#EF5350', warning: '#FFB74D',
    border: '#4A3F35', borderLight: '#3A302A',
    statusBar: 'light-content' as const,
  },
  sepia: {
    primary: '#6B4226', primaryLight: '#8B5E3C', bg: '#F4ECD8', surface: '#FAF5E8', surfaceAlt: '#EDE4D0',
    text: '#3E2723', textSec: '#5D4037', textMuted: '#8D6E63', textOn: '#FAF5E8',
    accent: '#A67B5B', accentLight: '#D7C4A5', success: '#558B2F', error: '#C62828', warning: '#F57F17',
    border: '#C8B99A', borderLight: '#DDD2BC',
    statusBar: 'dark-content' as const,
  },
};

type ThemeId = keyof typeof THEMES;
type Theme = typeof THEMES.light;
```

**Step 2**: Create context:
```tsx
const ThemeContext = React.createContext<{
  theme: Theme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  fontScale: number;
  setFontScale: (s: number) => void;
}>({
  theme: THEMES.light,
  themeId: 'light',
  setThemeId: () => {},
  fontScale: 1,
  setFontScale: () => {},
});
const useTheme = () => React.useContext(ThemeContext);
```

**Step 3**: Wrap `AppContent` in a `ThemeProvider`:
```tsx
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeId, setThemeId] = useState<ThemeId>('light');
  const [fontScale, setFontScale] = useState(1);

  // Persist preference
  useEffect(() => {
    db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='theme'")
      .then(r => { if (r) setThemeId(r.value as ThemeId); });
    db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='fontScale'")
      .then(r => { if (r) setFontScale(parseFloat(r.value)); });
  }, []);

  const handleSetTheme = (id: ThemeId) => {
    setThemeId(id);
    db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('theme', ?)", [id]);
  };

  const handleSetFontScale = (s: number) => {
    setFontScale(s);
    db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('fontScale', ?)", [String(s)]);
  };

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeId], themeId, setThemeId: handleSetTheme, fontScale, setFontScale: handleSetFontScale }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

**Step 4**: Replace `C.xxx` references with `theme.xxx`.

> **Critical implementation note**: The `StyleSheet.create(s)` at the bottom uses `C` constants
> statically. With theming, styles must become dynamic. Two approaches:
>
> **Approach A (recommended for single-file app)**: Keep `StyleSheet.create` for layout-only styles
> (flex, padding, margins). Apply colors inline using `theme`:
> ```tsx
> <View style={[s.card, { backgroundColor: theme.surface, borderLeftColor: cs.color }]}>
> ```
>
> **Approach B**: Convert `s` to a function `const getStyles = (theme: Theme) => StyleSheet.create({...})`.
> Then inside each screen: `const s = useMemo(() => getStyles(theme), [theme]);`
>
> Approach A is simpler and keeps changes minimal. Only override colors inline.

**Step 5**: Add theme selector in SettingsScreen:
```
ОФОРМЛЕНИЕ
┌────────┐ ┌────────┐ ┌────────┐
│ ☀️     │ │ 🌙     │ │ 📜     │
│ Светлая│ │ Тёмная │ │ Сепия  │
└────────┘ └────────┘ └────────┘

Размер текста
[A-] ──●────── [A+]     (slider 0.8 to 1.4)
```

### Font Size Scaling

Apply `fontScale` as a multiplier to all text:
```tsx
const scaledSize = (base: number) => Math.round(base * fontScale);
```

Use in text styles: `fontSize: scaledSize(16)`.

### Database Requirement

Requires the `app_settings` table (defined in Phase 4). If implementing Phase 5 before Phase 4, add the table:
```sql
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);
```

---

## Phase 6: Advanced Editing

**Goal**: Extend the block editor with richer text formatting, text highlighting within text blocks (not just verse blocks), and improved formatting toolbar.

**Estimated scope**: ~200 lines added/modified

### 6A. Rich Text in All Notes (Calendar Daily Notes)

Currently, daily notes (`daily_notes` table) store plain text. The `CalendarScreen` edit modal (line 777) uses a simple `TextInput`.

**Change**: Store daily notes as `Block[]` JSON (same format as journal entries). Reuse the block editor UI from JournalScreen.

**Implementation**:

1. Extract the block editor into a reusable inline function or duplicate the block rendering logic in CalendarScreen.

2. Update `daily_notes.notes` to store JSON block arrays. Add migration:
   ```tsx
   // When loading notes, detect if it's JSON or plain text:
   const parseNote = (n: string): Block[] => {
     try { const p = JSON.parse(n); if (Array.isArray(p) && p[0]?.type) return p; } catch {}
     return [{ id: genId(), type: 'text', content: n || '' }];
   };
   ```

3. Update the daily note editor modal to show blocks with formatting toolbar.

### 6B. Text Highlighting in Text Blocks

Currently only verse blocks support highlighting (character-range highlighting via `VerseHighlight`). Extend to text blocks.

**New TStyle extension**:
```tsx
interface TStyle {
  bold?: boolean; italic?: boolean; underline?: boolean; fontSize?: string;
  highlight?: string;  // highlight color id (yellow, green, blue, pink, orange)
}
```

When `highlight` is set on a text block, render with background color:
```tsx
if (b.textStyle?.highlight) {
  const hlColor = HIGHLIGHT_COLORS.find(c => c.id === b.textStyle.highlight);
  if (hlColor) st.backgroundColor = hlColor.bg;
}
```

### 6C. Formatting Toolbar Enhancements

Current toolbar (lines 167-188): Bold, Italic, Underline, Font Size dropdown.

**Add these buttons**:

```
[B] [I] [U] | [Aa▼] | [🎨▼] | [≡] [—]
                        ↑       ↑    ↑
                    highlight  list  divider
```

1. **Highlight color picker** — dropdown with HIGHLIGHT_COLORS, applies background to current text block.

2. **List/bullet toggle** — prepend `• ` to content lines. Not true list — just text formatting.

3. **Horizontal divider** — insert a new block type `'divider'`:
   ```tsx
   // Extend Block type:
   type: 'text' | 'verse' | 'divider'
   ```
   Render as:
   ```tsx
   <View style={{ height: 1, backgroundColor: C.border, marginVertical: 16 }} />
   ```

**Updated RTToolbar**:
```tsx
const RTToolbar = ({ style, onToggle, onSize, onHighlight, onDivider }: {
  style: TStyle;
  onToggle: (k: keyof TStyle) => void;
  onSize: (id: string) => void;
  onHighlight: (color: string | null) => void;
  onDivider: () => void;
}) => {
  const [showSize, setShowSize] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  // ... render with new buttons
};
```

### 6D. Block Reordering

Allow long-press on a block to enter reorder mode. Simple approach:

1. Add `reorderMode` state and `reorderIdx` state.
2. In reorder mode, show up/down arrow buttons on each block.
3. Swap block positions in the `blocks` array.

```tsx
const moveBlock = (idx: number, dir: -1 | 1) => {
  setBlocks(bs => {
    const n = [...bs];
    const target = idx + dir;
    if (target < 0 || target >= n.length) return bs;
    [n[idx], n[target]] = [n[target], n[idx]];
    return n;
  });
};
```

---

## Phase 7: Graph View

**Goal**: Visual knowledge graph showing connections between journal entries based on shared Bible verses, categories, keywords, and folders.

**Estimated scope**: ~300 lines, 1 new package

### New Package Required

```bash
npx expo install react-native-svg
```

`react-native-svg` is needed to draw the graph nodes and edges. It's well-supported in Expo managed workflow.

### Architecture

This is the most complex feature. It adds a new screen or modal accessible from the Settings tab.

**Data model**: Nodes and edges are computed in JS from existing data:

```tsx
interface GraphNode {
  id: string;
  type: 'entry' | 'verse' | 'topic' | 'folder';
  label: string;
  color: string;
  x: number;   // computed position
  y: number;
  radius: number;
}

interface GraphEdge {
  from: string;
  to: string;
  strength: number;  // 0-1, affects line thickness
}
```

### Connection Detection

1. **Shared verses**: Two entries that reference the same Bible verse are connected.
   ```tsx
   // Parse linked_verses from each entry, find intersections
   entries.forEach(e => {
     const verses = JSON.parse(e.linked_verses || '[]');
     // Build adjacency map
   });
   ```

2. **Same category**: Entries of the same category have a weak connection.

3. **Same folder**: Entries in the same folder have a medium connection (requires Phase 2).

4. **Keyword overlap**: Extract significant words from titles, find entries with matching keywords.
   ```tsx
   // Simple keyword extraction — split title, filter stopwords, find matches
   const STOPWORDS_RU = new Set(['и', 'в', 'на', 'о', 'с', 'к', 'по', 'за', 'из', 'не', 'что', 'как', 'это']);
   const keywords = (title: string) =>
     title.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOPWORDS_RU.has(w));
   ```

### Layout Algorithm

Use a simple force-directed layout computed in JS (no external library):

```tsx
const computeLayout = (nodes: GraphNode[], edges: GraphEdge[], width: number, height: number) => {
  // Initialize random positions
  nodes.forEach(n => { n.x = Math.random() * width; n.y = Math.random() * height; });

  // Run 50 iterations of force simulation
  for (let iter = 0; iter < 50; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 500 / (dist * dist);
        nodes[i].x -= (dx / dist) * force;
        nodes[i].y -= (dy / dist) * force;
        nodes[j].x += (dx / dist) * force;
        nodes[j].y += (dy / dist) * force;
      }
    }
    // Attraction along edges
    edges.forEach(e => {
      const a = nodes.find(n => n.id === e.from)!;
      const b = nodes.find(n => n.id === e.to)!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = dist * 0.01 * e.strength;
      a.x += (dx / dist) * force;
      a.y += (dy / dist) * force;
      b.x -= (dx / dist) * force;
      b.y -= (dy / dist) * force;
    });
    // Keep within bounds
    nodes.forEach(n => {
      n.x = Math.max(30, Math.min(width - 30, n.x));
      n.y = Math.max(30, Math.min(height - 30, n.y));
    });
  }
};
```

### Rendering with react-native-svg

```tsx
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';

const GraphView = () => {
  // ... compute nodes and edges ...
  return (
    <Svg width={SW} height={400}>
      {edges.map((e, i) => {
        const a = nodesMap[e.from], b = nodesMap[e.to];
        return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={C.border} strokeWidth={e.strength * 3} />;
      })}
      {nodes.map(n => (
        <G key={n.id}>
          <Circle cx={n.x} cy={n.y} r={n.radius} fill={n.color} />
          <SvgText x={n.x} y={n.y + n.radius + 12}
            textAnchor="middle" fontSize={10} fill={C.textSec}>
            {n.label.substring(0, 15)}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
};
```

### Interaction

- **Tap node**: Show a tooltip/modal with entry details
- **Pan/zoom**: Wrap in a `ScrollView` with `maximumZoomScale` or use gesture handler
- **Filters**: Toggle node types on/off (entries, verses, topics)

### Access Point

Add a button in SettingsScreen or as a new item in the tab bar. Recommended: add an icon button in the Journal header:
```tsx
<TouchableOpacity onPress={() => setShowGraph(true)}>
  <Ionicons name="git-network" size={24} color={C.primary} />
</TouchableOpacity>
```

---

## Additional Features

These are independent features that can be implemented in any order.

### A1. Export/Import Data

**Package**: No new package needed — use `expo-file-system` + `expo-sharing`.

```bash
npx expo install expo-file-system expo-sharing
```

**Export format**: JSON file containing all tables.

```tsx
const exportData = async () => {
  const data = {
    version: '3.2',
    exportDate: new Date().toISOString(),
    entries: await db.getAllAsync('SELECT * FROM entries'),
    bookmarks: await db.getAllAsync('SELECT * FROM bookmarks'),
    readingPlan: await db.getAllAsync('SELECT * FROM reading_plan'),
    dailyNotes: await db.getAllAsync('SELECT * FROM daily_notes'),
    fasting: await db.getAllAsync('SELECT * FROM fasting'),
    folders: await db.getAllAsync('SELECT * FROM folders'),  // if Phase 2 done
  };
  const json = JSON.stringify(data, null, 2);
  const fileUri = FileSystem.documentDirectory + 'divine_journal_backup.json';
  await FileSystem.writeAsStringAsync(fileUri, json);
  await Sharing.shareAsync(fileUri);
};
```

**Import**: Read JSON file, validate structure, insert into DB with conflict resolution.

```tsx
const importData = async (uri: string) => {
  const json = await FileSystem.readAsStringAsync(uri);
  const data = JSON.parse(json);
  // Validate version, table structure
  // Use INSERT OR REPLACE for each table
  // Reload all screens
};
```

**UI**: Add export/import buttons in SettingsScreen under a "ДАННЫЕ" section:
```
ДАННЫЕ
[↗️ Экспорт данных]
[↙️ Импорт данных]
```

Use `expo-document-picker` for file selection during import:
```bash
npx expo install expo-document-picker
```

### A2. Voice-to-Text Entry

**Package**:
```bash
npx expo install expo-speech-recognition
```

> **Note**: `expo-speech-recognition` may have limited support in Expo managed workflow.
> Alternative: Use the device keyboard's built-in voice input (microphone button on
> Android/iOS keyboard). This requires **no additional packages** and works automatically.

**If using native keyboard voice input** (recommended — zero code needed):
- Android: The standard keyboard has a microphone icon
- iOS: The keyboard has a dictation button
- No changes to App.tsx required

**If implementing custom voice button**:
1. Add a microphone button next to the text input in the entry editor
2. On press, start speech recognition
3. Append recognized text to the active text block

### A3. Password Protection

**Packages**:
```bash
npx expo install expo-local-authentication expo-secure-store
```

**Flow**:
1. On app launch, check if lock is enabled (stored in `SecureStore`)
2. If enabled, show a lock screen before `AppContent` renders
3. Use `expo-local-authentication` for biometric auth (fingerprint/face)
4. Fallback to PIN code (stored hashed in `SecureStore`)

**Lock screen component**:
```tsx
const LockScreen = ({ onUnlock }: { onUnlock: () => void }) => {
  const [pin, setPin] = useState('');

  const tryBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Разблокировать дневник',
    });
    if (result.success) onUnlock();
  };

  useEffect(() => { tryBiometric(); }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
      <Ionicons name="lock-closed" size={64} color={C.primary} />
      <Text style={{ fontSize: 20, marginTop: 16 }}>Введите PIN</Text>
      {/* PIN input UI */}
    </View>
  );
};
```

**Settings toggle** — add in SettingsScreen:
```
БЕЗОПАСНОСТЬ
[🔒 Защита паролем]  [Toggle ON/OFF]
[    Изменить PIN  ]
[    Биометрия     ]  [Toggle ON/OFF]
```

### A4. Cloud Backup

**Approach options**:

**Option A — Google Drive (recommended for Android-first app)**:
- Use `expo-auth-session` for Google OAuth
- Use Google Drive REST API for file upload/download
- Store backup as JSON file in app-specific Drive folder

**Option B — Custom backend**:
- Requires a server (Firebase, Supabase, etc.)
- More complex but more control

**Option C — Simple file sync (simplest)**:
- Export to a cloud-accessible location (Share sheet → Drive/Dropbox)
- User manually manages sync
- Already covered by Export/Import feature (A1)

**Recommended**: Start with Option C (Export/Import covers 80% of the need). Add Option A later if users request automatic sync.

If implementing Option A:
```bash
npx expo install expo-auth-session expo-crypto expo-web-browser
```

---

## New Database Tables Summary

All new tables across all phases:

```sql
-- Phase 2: Folder System
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8B4513',
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- + ALTER TABLE entries ADD COLUMN folder_id INTEGER DEFAULT NULL

-- Phase 4: Daily Bible Feature
CREATE TABLE IF NOT EXISTS daily_verse_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  verse_id TEXT NOT NULL,
  seen BOOLEAN DEFAULT 0
);

-- Phase 4/5: App Settings (shared)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

## New Packages Summary

| Phase | Package | Purpose |
|---|---|---|
| 4 | `expo-notifications` | Reading reminders |
| 7 | `react-native-svg` | Graph rendering |
| A1 | `expo-file-system` | Export file writing |
| A1 | `expo-sharing` | Share exported file |
| A1 | `expo-document-picker` | Import file selection |
| A3 | `expo-local-authentication` | Biometric auth |
| A3 | `expo-secure-store` | Secure PIN storage |

> **Note**: All packages above are compatible with Expo managed workflow (SDK 54).

---

## Implementation Checklist

Use this to track progress across sessions:

- [x] **Phase 1A**: Toolbar above keyboard
- [x] **Phase 1B**: Fix scrolling in long notes
- [x] **Phase 2**: Folder system (DB + UI + filtering)
- [x] **Phase 4**: Daily verse widget
- [ ] **Phase 4**: Reading reminders (notifications)
- [x] **Phase 3**: Statistics dashboard
- [x] **Phase 5**: Theme system (light/dark/sepia)
- [x] **Phase 5**: Font scaling
- [x] **Phase 6A**: Rich text in daily notes
- [x] **Phase 6B**: Text highlighting in text blocks
- [x] **Phase 6C**: Toolbar enhancements (highlight, divider)
- [x] **Phase 6D**: Block reordering
- [x] **Phase 7**: Graph view
- [x] **A1**: Export/import data
- [ ] **A2**: Voice-to-text (evaluate keyboard built-in vs custom)
- [x] **A3**: Password/biometric protection — SKIPPED (user decision)
- [ ] **A4**: Cloud backup

---

## Notes for Implementing Claude Sessions

1. **Always read `App.tsx` first** — it contains the entire application. Reference the line ranges in the Architecture Summary above to jump to the relevant section.

2. **Keep the single-file pattern** — do NOT split into separate component files unless the user explicitly requests it. The app is intentionally monolithic.

3. **Test on Android first** — the build workflow targets Android APK. iOS is secondary.

4. **Database migrations must be idempotent** — use `CREATE TABLE IF NOT EXISTS` and wrap `ALTER TABLE` in try/catch for the column-already-exists case.

5. **Russian UI text** — all user-facing strings must be in Russian. Reference existing patterns in the code for terminology.

6. **Style naming** — follow the existing terse naming convention in the `s` object (e.g., `headerTxt`, `cardHdr`, `badgeTxt`).

7. **Preserve color harmony** — the app uses warm earth tones. New UI elements should use colors from the `C` palette or extend it consistently.

8. **The `BIBLE_VERSES` array has 31,182 items** — any operation on it must be efficient. Avoid `.filter()` in render cycles; use `useMemo`.
