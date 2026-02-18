# Daily Reading Integration — Claude Code Task

## Project Context

**App:** Divine Journal (Духовный дневник) — React Native / Expo spiritual journaling app  
**Repo:** `Lukonstantinov/divine-journal`  
**Current stack:** React Native, Expo, SQLite (`expo-sqlite`), TypeScript, `expo-notifications`, `@expo/vector-icons` (Ionicons)  
**Bible data source:** `./BibleVerses.ts` — exports `BIBLE_VERSES`, `BIBLE_BOOKS`, types `BibleVerse`, `BibleBook`  
**Main file:** `App.tsx` (~2300 lines, single-file architecture)

The app already has:
- `expo-notifications` imported
- `dailyVerse` StyleSheet keys defined (lines 2344–2349 of App.tsx)
- SQLite DB initialized in a `useEffect` on app load
- 5-tab navigation: Журнал, Библия, Календарь, Статистика, Настройки
- Theme system: `light`, `dark`, `sepia` via `ThemeContext`

---

## Goal

Port the daily verse logic from a Telegram Bible bot (Python) into the app as native TypeScript, and add a **Daily Reading card** to the Journal tab home screen with a full-screen reading modal.

---

## Task 1 — Create `DailyReading.ts`

**File to create:** `DailyReading.ts` (project root, same level as `App.tsx`)

### Logic to implement (ported from Python bot):

```typescript
// All functions must be deterministic for a given date
// (use date as seed so content is stable all day, not re-randomized on re-render)

export interface DailyReadingResult {
  date: string;                    // ISO date string YYYY-MM-DD
  verseOfDay: VerseOfDay;         // 1 highlighted verse
  datePatternVerses: PatternVerse[]; // up to 5 verses matching day:day pattern
  psalms: PsalmChapter[];         // 2 full psalm chapters
  proverbs: ProverbVerse[];       // 2 proverbs
}

export interface VerseOfDay {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  reference: string; // e.g. "Иоанна 3:16"
}

export interface PatternVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  reference: string;
}

export interface PsalmChapter {
  chapter: number;
  verses: Array<{ number: number; text: string }>;
  title: string; // e.g. "Псалтирь 23"
}

export interface ProverbVerse {
  chapter: number;
  verse: number;
  text: string;
  reference: string;
  type: 'by_day' | 'random';
}
```

### Function: `getDailyVerse(date: Date, customPattern?: CustomPattern): VerseOfDay`
- Default: picks 1 verse from the entire `BIBLE_VERSES` dataset, seeded by date
- If `customPattern` is set, picks from that specific book/chapter range
- Seed formula: `day * 31 + month * 12 + year` (mod total verses)

### Function: `getDatePatternVerses(date: Date): PatternVerse[]`
- Bot logic: find all verses where `chapter === day && verse === day` (e.g. ch.17 v.17 on the 17th)
- Fallback if fewer than 5 found: also search `chapter === month && verse === day`
- If more than 5 found: pick 5 using date seed (deterministic)
- Returns empty array if none found (graceful)

### Function: `getRandomPsalms(date: Date, count: number = 2): PsalmChapter[]`
- Find Psalms book: search `BIBLE_BOOKS` for book name containing `'Псал'`
- Pick `count` chapters using date seed
- Return full chapter with all verses

### Function: `getDayProverbs(date: Date): ProverbVerse[]`
- Find Proverbs book: search `BIBLE_BOOKS` for `'Притч'`
- Proverb 1 (`type: 'by_day'`): chapter = day of month, verse 1 (or verse = day if chapter 1)
- Proverb 2 (`type: 'random'`): random verse from any Proverbs chapter, date-seeded
- Graceful fallback if day > available chapters

### Function: `getFullDailyReading(date: Date, customPattern?: CustomPattern): DailyReadingResult`
- Combines all 4 above
- Returns the full `DailyReadingResult` object

### Custom Pattern type:
```typescript
export interface CustomPattern {
  bookName?: string;      // filter to specific book
  chapterOverride?: number; // always use this chapter
  verseOverride?: number;   // always use this verse
  label?: string;           // user-facing label e.g. "Мой стих"
}
```

### Seeding utility (no external libs):
```typescript
function seededRandom(seed: number): () => number {
  // Simple LCG: good enough for non-crypto use
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function dateSeed(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}
```

---

## Task 2 — Add DB Tables to `App.tsx`

In the existing SQLite `useEffect` where tables are created, add these two new `CREATE TABLE IF NOT EXISTS` statements:

```sql
CREATE TABLE IF NOT EXISTS daily_reading_history (
  date TEXT PRIMARY KEY,
  read_at TEXT NOT NULL,
  verse_of_day_ref TEXT,
  psalms_read TEXT,
  proverbs_read TEXT
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  unlocked_at TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL
);
```

Also add a helper function in App.tsx:

```typescript
async function markDailyRead(db, date: string, verseRef: string): Promise<void>
async function getDailyReadHistory(db, date: string): Promise<boolean>
async function checkAndUnlockAchievements(db, stats: ReadStats): Promise<Achievement[]>
```

---

## Task 3 — `DailyReadingCard` Component (add to `App.tsx`)

Insert this card into the Journal tab, **above the entry FlatList**, below the folder filter chips row.

### Visual design:
```
┌─────────────────────────────────────────────┐
│  📖 Ежедневное чтение    [streak 🔥 5 дней] │
│  Среда, 18 февраля 2026                      │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  ✨ Читать на сегодня          →     │   │  ← golden button, full width
│  └──────────────────────────────────────┘   │
│  [already read: ✓ Прочитано  |  green bg]   │
└─────────────────────────────────────────────┘
```

### State logic:
- On mount: query `daily_reading_history` for today's date
- If read: show green "✓ Прочитано сегодня" state + streak count
- If not read: show golden pulsing "Читать на сегодня" button
- Tapping button opens `DailyReadingModal`

### Styling:
- Unread state: golden border `#D4A574`, background `#FFF8E7`, button `backgroundColor: theme.warning`
- Read state: green border `#4A7C59`, background `#E8F5E9`, checkmark icon
- Streak badge: `🔥 N дней` in orange pill, top-right corner
- Respects all 3 themes (light/dark/sepia) via `useTheme()`

---

## Task 4 — `DailyReadingModal` Component (add to `App.tsx`)

Full-screen `Modal` with `animationType="slide"`.

### Header:
- Back/close button (chevron-back)
- Title: "Чтение на [date]"
- Share button (top right) — `Sharing.shareAsync` or `Share.share`

### Sections (inside ScrollView):

**Section 1 — Стих дня**
```
┌─ gold card ──────────────────────────────┐
│  ✨ СТИХ ДНЯ                             │
│                                          │
│  "Verse text in large serif italic..."   │
│                                          │
│  — Книга 3:16              [💾] [📤]    │
└──────────────────────────────────────────┘
```

**Section 2 — Стихи по дате**
- Header: "📅 Стихи {day}:{day}" 
- List of up to 5 verse cards, each with `[💾 В журнал]` button
- If empty: "Стихи с таким паттерном не найдены" muted text

**Section 3 — Псалмы**
- Header: "🎵 Псалмы на сегодня"
- 2 collapsible psalm cards (tap header to expand/collapse)
- Each verse numbered, serif font
- `[💾 В журнал]` on each psalm card header

**Section 4 — Притчи**
- Header: "💡 Притчи на сегодня"
- 2 proverb cards with type label ("По дню" / "Случайная")
- Each with `[💾 В журнал]` button

**Footer:**
```
┌──────────────────────────────────────────┐
│  ✅  Отметить прочитанным               │
└──────────────────────────────────────────┘
```
- Green button, full width
- On tap: calls `markDailyRead()`, closes modal, card updates to green state
- If already marked: shows "✓ Прочитано" disabled state

### Save to Journal (`[💾 В журнал]`) action:
- Creates a new journal entry with:
  - `category: 'revelation'`
  - `title`: verse reference (e.g. "Иоанна 3:16")
  - `content`: verse text
  - `linked_verse`: reference string
- Shows brief toast/alert confirmation: "Сохранено в журнал ✓"

---

## Task 5 — Achievements System

### Achievement definitions (hardcode as constant in `App.tsx` or `DailyReading.ts`):

```typescript
const ACHIEVEMENTS = [
  { id: 'first_read',    emoji: '📖', title: 'Первое чтение',   desc: 'Прочитай ежедневное чтение впервые',         condition: (s) => s.totalReads >= 1 },
  { id: 'streak_3',      emoji: '🔥', title: '3 дня подряд',    desc: '3 дня непрерывного чтения',                  condition: (s) => s.currentStreak >= 3 },
  { id: 'streak_7',      emoji: '✨', title: 'Неделя с Богом',  desc: '7 дней непрерывного чтения',                 condition: (s) => s.currentStreak >= 7 },
  { id: 'streak_30',     emoji: '👑', title: 'Месяц верности',  desc: '30 дней непрерывного чтения',                condition: (s) => s.currentStreak >= 30 },
  { id: 'saved_5',       emoji: '💾', title: 'Хранитель слова', desc: 'Сохрани 5 стихов в журнал из чтения',        condition: (s) => s.savedFromReading >= 5 },
  { id: 'saved_10',      emoji: '📚', title: 'Библиотекарь',   desc: 'Сохрани 10 стихов в журнал из чтения',       condition: (s) => s.savedFromReading >= 10 },
  { id: 'custom_pattern',emoji: '🎯', title: 'Искатель',        desc: 'Настрой собственный паттерн стихов',         condition: (s) => s.hasCustomPattern },
  { id: 'psalm_fan',     emoji: '🎵', title: 'Псалмопевец',    desc: 'Прочитай 10 различных псалмов',              condition: (s) => s.uniquePsalmsRead >= 10 },
];
```

### Streak calculation:
- On each `markDailyRead()` call, recalculate streak from `daily_reading_history`
- Query last 31 days, find longest consecutive run ending today
- Store streak in component state (not DB — recalculate on each read)

### Achievement unlock flow:
1. After `markDailyRead()` succeeds, call `checkAndUnlockAchievements()`
2. Any newly unlocked achievements → save to `achievements` table
3. Show a brief `Alert` or animated toast: "🏆 Достижение разблокировано: [title]"

### Achievements display:
- Add an "Достижения" row to the **Статистика tab** (Statistics tab)
- Grid of achievement badges: unlocked = full color, locked = greyed out with lock icon
- Each badge: emoji large, title below, tap for description in a small popover

---

## Task 6 — Custom Pattern Setting

In **Настройки tab** (Settings), add a new section "Ежедневный стих":

```
┌─ Ежедневный стих ──────────────────────┐
│  Паттерн поиска           [По дате ▾]  │
│  Книга (необязательно)    [Все книги ▾]│
│  Глава                    [авто]       │
│  Стих                     [авто]       │
│  [Сохранить]                          │
└────────────────────────────────────────┘
```

- Saves to SQLite `settings` table (key: `daily_custom_pattern`, value: JSON string)
- Loaded at app start, passed to `getFullDailyReading()`
- Unlocks `custom_pattern` achievement on save

---

## Implementation Notes for Claude Code

### Do NOT:
- Change any existing functionality, tabs, or DB tables
- Rename any existing exported types or functions in `BibleVerses.ts`
- Add new npm packages (use only what's already installed)
- Use `Math.random()` — all randomness must be date-seeded for stability

### DO:
- Keep all new UI components as functions inside `App.tsx` (consistent with existing architecture)
- Use `useTheme()` hook for all colors — never hardcode colors except in the `dailyVerse` StyleSheet keys already defined
- Follow existing StyleSheet pattern (all styles in the bottom `StyleSheet.create({})` block)
- Use existing `db` SQLite instance passed as prop or accessed via closure
- Handle all DB operations with try/catch and graceful fallbacks
- All user-facing strings in Russian

### File structure after completion:
```
divine-journal/
├── App.tsx          (modified — ~+400 lines)
├── BibleVerses.ts   (unchanged)
├── DailyReading.ts  (new — ~200 lines)
└── ...
```

### Testing checklist:
- [ ] Card shows "not read" state on first launch of the day
- [ ] Card shows "read" state after marking complete, survives app restart
- [ ] Verse content is identical across multiple renders of the same day
- [ ] Date-pattern search returns empty array gracefully on days with no matches (e.g. day 31)
- [ ] Saving to journal creates a proper entry visible in the Журнал tab
- [ ] Streak increments correctly on consecutive days
- [ ] At least `first_read` achievement unlocks on first mark-as-read
- [ ] All 3 themes render correctly (light / dark / sepia)
- [ ] Psalms collapse/expand works without layout glitch
- [ ] No crashes when `BIBLE_VERSES` doesn't contain Psalms or Proverbs matching expected book names
