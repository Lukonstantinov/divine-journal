# Daily Reading Integration — Implementation Plan

## Codebase Findings (Pre-Implementation)

### Critical discoveries from source review:
- **App.tsx is 2350 lines**, not 2300 — all line references in this plan use live numbers
- **Psalms book name**: `"Псалтырь"` (not "Псалтирь") — 150 chapters
- **Proverbs book name**: `"Притчи Соломона"` — 31 chapters
- **BibleVerse shape**: `{ id, book, chapter, verse, text, testament }`
- **BibleBook shape**: `{ name, testament, chapters }`
- **Global `db`** variable is accessible without passing as prop (existing pattern)
- **`Share` not yet imported** from 'react-native' — must be added
- **Current version**: "Версия 4.0" → bump to **4.1**
- `getDailyVerse` already exists in App.tsx (line 155) with a *different* seed formula
  — DailyReading.ts uses a different algorithm; they coexist and serve different purposes
- Existing "Стих дня" widget (lines 773–786) stays unchanged; DailyReadingCard is additive

---

## Task 1 — Create `DailyReading.ts`

**File location**: `/home/user/divine-journal/DailyReading.ts`
**Imports**: Only `BIBLE_VERSES`, `BIBLE_BOOKS`, `BibleVerse`, `BibleBook` from `./BibleVerses`

### Interfaces to export:

```typescript
export interface CustomPattern {
  bookName?: string;
  chapterOverride?: number;
  verseOverride?: number;
  label?: string;
}

export interface VerseOfDay {
  book: string; chapter: number; verse: number; text: string; reference: string;
}

export interface PatternVerse {
  book: string; chapter: number; verse: number; text: string; reference: string;
}

export interface PsalmChapter {
  chapter: number;
  verses: Array<{ number: number; text: string }>;
  title: string; // "Псалтырь 23"
}

export interface ProverbVerse {
  chapter: number; verse: number; text: string; reference: string;
  type: 'by_day' | 'random';
}

export interface DailyReadingResult {
  date: string;           // "YYYY-MM-DD"
  verseOfDay: VerseOfDay;
  datePatternVerses: PatternVerse[];
  psalms: PsalmChapter[];
  proverbs: ProverbVerse[];
}
```

### Internal utilities (not exported):

```typescript
function seededRandom(seed: number): () => number {
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

### `getDailyVerse(date, customPattern?)`:

```
seed = day * 31 + month * 12 + year
If customPattern.bookName → filter BIBLE_VERSES to that book first
  If customPattern.chapterOverride → further filter to that chapter
  If customPattern.verseOverride → further filter to that verse
idx = seed % filteredVerses.length (or total if no filter)
Return VerseOfDay with reference = "Книга N:N"
Graceful: if pool empty, fall back to unfiltered BIBLE_VERSES
```

### `getDatePatternVerses(date)`:

```
day = date.getDate(), month = date.getMonth() + 1
Primary search: all verses where chapter === day AND verse === day
If found >= 5: pick 5 deterministically using seededRandom(dateSeed(date))
If found < 5: also search chapter === month AND verse === day; merge, deduplicate
Still < 5 after merge: return what we have (can be 0)
Each → PatternVerse with reference string
Graceful: empty array if none found (e.g., day=31 with no matching verses)
```

### `getRandomPsalms(date, count = 2)`:

```
Find psalmsBook = BIBLE_BOOKS.find(b => b.name.includes('Псалт'))
  → "Псалтырь", chapters: 150
If not found: return []
Use seededRandom(dateSeed(date)) to pick `count` distinct chapter numbers (1-150)
For each chapter: filter BIBLE_VERSES to matching book+chapter
Return PsalmChapter[] with full verse list, title = "Псалтырь N"
Graceful: if a chapter has 0 verses, skip it
```

### `getDayProverbs(date)`:

```
day = date.getDate()  // 1-31
Find probBook = BIBLE_BOOKS.find(b => b.name.includes('Притч'))
  → "Притчи Соломона", chapters: 31
If not found: return []

Proverb 1 (type: 'by_day'):
  chapter = day (Proverbs has exactly 31 chapters, so day 1-31 always valid)
  verse = 1 (always the first verse of that chapter)
  Find the verse in BIBLE_VERSES; if not found, skip this proverb

Proverb 2 (type: 'random'):
  Use seededRandom(dateSeed(date) + 1) to pick a random chapter (1-31)
  Then pick a random verse within that chapter
  Avoid duplicating the same chapter+verse as proverb 1
  If not found, return only proverb 1

Return ProverbVerse[] (0, 1, or 2 items)
```

### `getFullDailyReading(date, customPattern?)`:

```
Calls all 4 above, assembles DailyReadingResult
date field = fmtDate(date) = YYYY-MM-DD ISO string
```

**Error handling**: All functions wrapped in try/catch internally; fallback to empty arrays / undefined.

---

## Task 2 — Add DB Tables to `App.tsx`

### In `initDb()` (after line 113, before the `try { ALTER TABLE }` block):

```sql
CREATE TABLE IF NOT EXISTS daily_reading_history (
  date TEXT PRIMARY KEY,
  read_at TEXT NOT NULL,
  verse_of_day_ref TEXT,
  psalms_read TEXT,    -- JSON array of psalm chapter numbers
  proverbs_read TEXT   -- JSON array of "N:N" strings
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  unlocked_at TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL
);
```

Both use `CREATE TABLE IF NOT EXISTS` → idempotent for existing installs.

### New helper functions (add after `cancelReadingReminder`, ~line 147):

```typescript
// Check if today has been read + calculate reading streak
async function getDailyReadingStatus(todayStr: string): Promise<{ isRead: boolean; streak: number }> {
  try {
    const row = await db.getFirstAsync<{ date: string }>(
      'SELECT date FROM daily_reading_history WHERE date=?', [todayStr]
    );
    const isRead = !!row;
    // Calculate streak: consecutive days ending today (or yesterday if not read today)
    const rows = await db.getAllAsync<{ date: string }>(
      'SELECT date FROM daily_reading_history ORDER BY date DESC LIMIT 31'
    );
    let streak = 0;
    // Start from today if read, else yesterday
    let expected = isRead ? todayStr : (() => {
      const d = new Date(todayStr + 'T00:00:00'); d.setDate(d.getDate() - 1); return fmtDate(d);
    })();
    for (const r of rows) {
      if (r.date === expected) {
        streak++;
        const d = new Date(expected + 'T00:00:00'); d.setDate(d.getDate() - 1); expected = fmtDate(d);
      } else if (r.date < expected) break;
    }
    return { isRead, streak };
  } catch { return { isRead: false, streak: 0 }; }
}

// Mark today as read
async function markDailyRead(todayStr: string, verseRef: string, psalmsChapters: number[], proverbsRefs: string[]): Promise<void> {
  try {
    await db.runAsync(
      'INSERT OR REPLACE INTO daily_reading_history (date, read_at, verse_of_day_ref, psalms_read, proverbs_read) VALUES (?,?,?,?,?)',
      [todayStr, new Date().toISOString(), verseRef, JSON.stringify(psalmsChapters), JSON.stringify(proverbsRefs)]
    );
  } catch (e) { console.warn('markDailyRead error:', e); }
}

// Get reading stats for achievement calculation
async function getReadStats(todayStr: string): Promise<ReadStats> {
  try {
    const historyRows = await db.getAllAsync<{ date: string; psalms_read: string }>(
      'SELECT date, psalms_read FROM daily_reading_history ORDER BY date DESC LIMIT 31'
    );
    // totalReads
    const totalRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM daily_reading_history');
    const totalReads = totalRow?.c || 0;
    // streak (reuse getDailyReadingStatus)
    const { streak: currentStreak } = await getDailyReadingStatus(todayStr);
    // savedFromReading
    const savedRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key='saved_from_reading_count'"
    );
    const savedFromReading = parseInt(savedRow?.value || '0');
    // hasCustomPattern
    const patternRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key='daily_custom_pattern'"
    );
    const hasCustomPattern = !!(patternRow?.value && patternRow.value !== 'null');
    // uniquePsalmsRead
    const psalmSet = new Set<number>();
    for (const row of historyRows) {
      try { const chs = JSON.parse(row.psalms_read || '[]'); chs.forEach((c: number) => psalmSet.add(c)); } catch {}
    }
    const uniquePsalmsRead = psalmSet.size;
    return { totalReads, currentStreak, savedFromReading, hasCustomPattern, uniquePsalmsRead };
  } catch { return { totalReads: 0, currentStreak: 0, savedFromReading: 0, hasCustomPattern: false, uniquePsalmsRead: 0 }; }
}

// Check and unlock new achievements, return newly unlocked ones
async function checkAndUnlockAchievements(stats: ReadStats): Promise<typeof ACHIEVEMENTS> {
  const unlocked: typeof ACHIEVEMENTS = [];
  try {
    const existing = await db.getAllAsync<{ id: string }>('SELECT id FROM achievements');
    const existingIds = new Set(existing.map(r => r.id));
    for (const a of ACHIEVEMENTS) {
      if (!existingIds.has(a.id) && a.condition(stats)) {
        await db.runAsync(
          'INSERT OR IGNORE INTO achievements (id, unlocked_at, title, description) VALUES (?,?,?,?)',
          [a.id, new Date().toISOString(), a.title, a.desc]
        );
        unlocked.push(a);
      }
    }
  } catch (e) { console.warn('checkAndUnlockAchievements error:', e); }
  return unlocked;
}
```

### New TypeScript interface (add after line 89, with other interfaces):

```typescript
interface ReadStats {
  totalReads: number;
  currentStreak: number;
  savedFromReading: number;
  hasCustomPattern: boolean;
  uniquePsalmsRead: number;
}
```

---

## Task 3 — ACHIEVEMENTS Constant

**Add after the `ReadStats` interface** (before `initDb`):

```typescript
const ACHIEVEMENTS = [
  { id: 'first_read',     emoji: '📖', title: 'Первое чтение',    desc: 'Прочитай ежедневное чтение впервые',        condition: (s: ReadStats) => s.totalReads >= 1 },
  { id: 'streak_3',       emoji: '🔥', title: '3 дня подряд',     desc: '3 дня непрерывного чтения',                 condition: (s: ReadStats) => s.currentStreak >= 3 },
  { id: 'streak_7',       emoji: '✨', title: 'Неделя с Богом',   desc: '7 дней непрерывного чтения',                condition: (s: ReadStats) => s.currentStreak >= 7 },
  { id: 'streak_30',      emoji: '👑', title: 'Месяц верности',   desc: '30 дней непрерывного чтения',               condition: (s: ReadStats) => s.currentStreak >= 30 },
  { id: 'saved_5',        emoji: '💾', title: 'Хранитель слова',  desc: 'Сохрани 5 стихов в журнал из чтения',       condition: (s: ReadStats) => s.savedFromReading >= 5 },
  { id: 'saved_10',       emoji: '📚', title: 'Библиотекарь',     desc: 'Сохрани 10 стихов в журнал из чтения',      condition: (s: ReadStats) => s.savedFromReading >= 10 },
  { id: 'custom_pattern', emoji: '🎯', title: 'Искатель',          desc: 'Настрой собственный паттерн стихов',        condition: (s: ReadStats) => s.hasCustomPattern },
  { id: 'psalm_fan',      emoji: '🎵', title: 'Псалмопевец',      desc: 'Прочитай 10 различных псалмов',             condition: (s: ReadStats) => s.uniquePsalmsRead >= 10 },
] as const;
```

---

## Task 4 — `DailyReadingCard` + `DailyReadingModal` in `App.tsx`

Both defined as functions **before `JournalScreen`** (~after line 474, before line 476).

### `DailyReadingCard` props:

```typescript
interface DailyReadingCardProps {
  isRead: boolean;
  streak: number;
  onOpenReading: () => void;
}
```

**Visual logic**:
- Unread: `backgroundColor: '#FFF8E7'`, `borderColor: theme.accent`, golden "Читать на сегодня →" button
- Read: `backgroundColor: '#E8F5E9'`, `borderColor: '#4A7C59'`, "✓ Прочитано сегодня" label (green)
- Top-right streak badge: `🔥 N дней` (only shown when streak >= 1)
- Date shown: `new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })`
- Respects theme via `useTheme()`, colors overridden inline

### `DailyReadingModal` props:

```typescript
interface DailyReadingModalProps {
  visible: boolean;
  reading: DailyReadingResult | null;
  isRead: boolean;
  onClose: () => void;
  onMarkRead: () => void;       // parent handles DB + state update
  onSaveToJournal: (title: string, text: string, verseRef: string) => void;
}
```

**Internal state** (psalm collapse):
```typescript
const [expandedPsalms, setExpandedPsalms] = useState<Set<number>>(new Set([0])); // first expanded by default
```

**Section 1 — Стих дня**:
- Gold card (`#FFF8E7` bg, `#D4A574` border)
- Large italic serif text, reference, `[💾 В журнал]` `[📤 Поделиться]` buttons
- Share: uses `Share.share({ message: \`"${text}" — ${reference}\` })` (React Native built-in Share)
- Save to journal: calls `onSaveToJournal(reference, text, reference)`

**Section 2 — Стихи по дате** (`reading.datePatternVerses`):
- Header shows: `📅 Стихи {day}:{day}` where day = current day of month
- If empty: muted italic text "Стихи с таким паттерном не найдены"
- Each verse: small card with reference + text + `[💾 В журнал]` button

**Section 3 — Псалмы** (`reading.psalms`):
- Header: "🎵 Псалмы на сегодня"
- Each psalm: collapsible card (tap header → toggle)
- Header shows: psalm title + verse count + `[💾 В журнал]` button (saves whole psalm as entry)
- Expanded: each verse numbered, `fontFamily: 'serif'`, `fontSize: 14`, `lineHeight: 22`
- Default: first psalm expanded, second collapsed

**Section 4 — Притчи** (`reading.proverbs`):
- Header: "💡 Притчи на сегодня"
- Each: card with type label ("По дню" / "Случайная") + reference + text + `[💾 В журнал]`

**Footer** — full-width button:
- Not read: green `✅ Отметить прочитанным`
- Already read: grey `✓ Прочитано`, disabled, no onPress

**onSaveToJournal implementation** in parent (JournalScreen):
```typescript
const saveVerseToJournal = async (title: string, text: string) => {
  try {
    const block: Block = { id: genId(), type: 'verse', content: JSON.stringify({
      book: '', chapter: 0, verse: 0, text  // simplified; title carries the reference
    }), boxColor: 'gold' };
    const textBlock: Block = { id: genId(), type: 'text', content: '' };
    await db.runAsync(
      'INSERT INTO entries (title, content, category, linked_verses, folder_id) VALUES (?,?,?,?,?)',
      [title, JSON.stringify([block, textBlock]), 'откровение', '[]', null]
    );
    // Increment saved_from_reading_count counter
    const cur = await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='saved_from_reading_count'");
    const newCount = (parseInt(cur?.value || '0')) + 1;
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key,value) VALUES ('saved_from_reading_count',?)", [String(newCount)]);
    load(); // refresh JournalScreen entries
    Alert.alert('Сохранено ✓', 'Стих добавлен в журнал');
  } catch (e: any) { Alert.alert('Ошибка', e?.message || 'Не удалось сохранить'); }
};
```

**onMarkRead implementation** in parent (JournalScreen):
```typescript
const handleMarkRead = async () => {
  const todayStr = fmtDate(new Date());
  const psalmsChapters = dailyReadingResult?.psalms.map(p => p.chapter) || [];
  const proverbsRefs = dailyReadingResult?.proverbs.map(p => `${p.chapter}:${p.verse}`) || [];
  await markDailyRead(todayStr, dailyReadingResult?.verseOfDay.reference || '', psalmsChapters, proverbsRefs);
  setDailyIsRead(true);
  // Recalculate streak
  const { streak } = await getDailyReadingStatus(todayStr);
  setReadingStreak(streak);
  // Check achievements
  const stats = await getReadStats(todayStr);
  const newAchievements = await checkAndUnlockAchievements(stats);
  if (newAchievements.length > 0) {
    Alert.alert('🏆 Достижение разблокировано!', newAchievements.map(a => `${a.emoji} ${a.title}`).join('\n'));
  }
  setShowDailyReadingModal(false);
};
```

---

## Task 5 — JournalScreen Updates

### New state variables (add after existing state, ~line 510):

```typescript
const [dailyIsRead, setDailyIsRead] = useState(false);
const [readingStreak, setReadingStreak] = useState(0);
const [showDailyReadingModal, setShowDailyReadingModal] = useState(false);
const [dailyReadingResult, setDailyReadingResult] = useState<DailyReadingResult | null>(null);
const [customPattern, setCustomPattern] = useState<CustomPattern | null>(null);
```

### New useEffect (add alongside existing verse useEffect, after line 537):

```typescript
useEffect(() => {
  const today = new Date();
  const todayStr = fmtDate(today);
  // Load custom pattern from settings
  db.getFirstAsync<{value: string}>("SELECT value FROM app_settings WHERE key='daily_custom_pattern'")
    .then(row => {
      let pattern: CustomPattern | null = null;
      if (row?.value) { try { pattern = JSON.parse(row.value); } catch {} }
      setCustomPattern(pattern);
      // Compute daily reading result (async-safe: pure computation)
      try {
        const result = getFullDailyReading(today, pattern || undefined);
        setDailyReadingResult(result);
      } catch (e) { console.warn('DailyReading compute error:', e); }
    });
  // Load read status
  getDailyReadingStatus(todayStr).then(({ isRead, streak }) => {
    setDailyIsRead(isRead);
    setReadingStreak(streak);
  });
}, []);
```

### In the JournalScreen JSX render, after the existing daily verse widget (after line 786, before FlatList):

```tsx
<DailyReadingCard
  isRead={dailyIsRead}
  streak={readingStreak}
  onOpenReading={() => setShowDailyReadingModal(true)}
/>
```

And after the FlatList's `</FlatList>` (before existing Modals at line 806):

```tsx
{showDailyReadingModal && dailyReadingResult && (
  <DailyReadingModal
    visible={showDailyReadingModal}
    reading={dailyReadingResult}
    isRead={dailyIsRead}
    onClose={() => setShowDailyReadingModal(false)}
    onMarkRead={handleMarkRead}
    onSaveToJournal={saveVerseToJournal}
  />
)}
```

---

## Task 6 — SettingsScreen Updates

### A) Achievements Grid Section

**Replace** the existing basic "ДОСТИЖЕНИЯ" section (lines 2145–2151) with an expanded version:

```
ДОСТИЖЕНИЯ ЗАПИСЕЙ          (existing 3 rows: streak, fasting, chapters)

ДОСТИЖЕНИЯ ЧТЕНИЯ           (new subsection)
  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
  │  📖   │ │  🔥   │ │  ✨   │ │  👑   │
  │Первое │ │3 дня  │ │Неделя │ │Месяц  │
  └───────┘ └───────┘ └───────┘ └───────┘
  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
  │  💾   │ │  📚   │ │  🎯   │ │  🎵   │
  │Хранит.│ │Библио.│ │Искат. │ │Псалм. │
  └───────┘ └───────┘ └───────┘ └───────┘
  Unlocked = full color + colored border
  Locked   = 0.3 opacity + lock icon overlay
  Tap each = Alert.alert(title, description)
```

**New state in SettingsScreen**:
```typescript
const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
```

**In the SettingsScreen useEffect** (add to existing async block):
```typescript
const ach = await db.getAllAsync<{id: string}>('SELECT id FROM achievements');
setUnlockedAchievements(new Set(ach.map(r => r.id)));
```

**Render logic for grid**:
```tsx
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
  {ACHIEVEMENTS.map(a => {
    const isUnlocked = unlockedAchievements.has(a.id);
    return (
      <TouchableOpacity key={a.id}
        style={[s.achieveBadge, { borderColor: isUnlocked ? theme.primary : theme.border, opacity: isUnlocked ? 1 : 0.4 }]}
        onPress={() => Alert.alert(`${a.emoji} ${a.title}`, a.desc)}
      >
        <Text style={{ fontSize: 28 }}>{a.emoji}</Text>
        {!isUnlocked && <Ionicons name="lock-closed" size={12} color={theme.textMuted} style={{ position: 'absolute', top: 4, right: 4 }} />}
        <Text style={{ fontSize: 10, color: theme.textSec, textAlign: 'center', marginTop: 4 }} numberOfLines={2}>{a.title}</Text>
      </TouchableOpacity>
    );
  })}
</View>
```

### B) Custom Pattern Section

**Add after the НАПОМИНАНИЯ section** (after line 2218):

```
ЕЖЕДНЕВНЫЙ СТИХ
  Паттерн поиска: [По дате ▾] / [Конкретный стих ▾]
  Книга (если конкретный стих): [Все книги ▾]
  [Сохранить]
```

**New state**:
```typescript
const [customPatternMode, setCustomPatternMode] = useState<'date' | 'custom'>('date');
const [customPatternBook, setCustomPatternBook] = useState('');
const [showBookPicker, setShowBookPicker] = useState(false);
```

**Load in useEffect**:
```typescript
const cp = await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='daily_custom_pattern'");
if (cp?.value) { try { const p = JSON.parse(cp.value); setCustomPatternMode(p ? 'custom' : 'date'); setCustomPatternBook(p?.bookName || ''); } catch {} }
```

**Save handler**:
```typescript
const saveCustomPattern = async () => {
  let pattern: CustomPattern | null = null;
  if (customPatternMode === 'custom' && customPatternBook) {
    pattern = { bookName: customPatternBook };
  }
  await db.runAsync("INSERT OR REPLACE INTO app_settings (key,value) VALUES ('daily_custom_pattern',?)", [JSON.stringify(pattern)]);
  // Unlock custom_pattern achievement if setting custom
  if (pattern) {
    const stats = await getReadStats(fmtDate(new Date()));
    await checkAndUnlockAchievements({ ...stats, hasCustomPattern: true });
    setUnlockedAchievements(prev => new Set([...prev, 'custom_pattern']));
  }
  Alert.alert('Сохранено', 'Паттерн стихов обновлён');
};
```

### C) Update export/import

**In `exportData`** (around line 1994), add to the data object:
```typescript
dailyReadingHistory: await db.getAllAsync('SELECT * FROM daily_reading_history'),
achievements: await db.getAllAsync('SELECT * FROM achievements'),
```

**In `importData`** (in the `onPress: async` block after line 2035), add after other imports:
```typescript
// Import daily reading history
for (const r of (data.dailyReadingHistory || [])) {
  await db.runAsync('INSERT OR REPLACE INTO daily_reading_history (date, read_at, verse_of_day_ref, psalms_read, proverbs_read) VALUES (?,?,?,?,?)',
    [r.date, r.read_at, r.verse_of_day_ref, r.psalms_read, r.proverbs_read]);
}
// Import achievements
for (const a of (data.achievements || [])) {
  await db.runAsync('INSERT OR IGNORE INTO achievements (id, unlocked_at, title, description) VALUES (?,?,?,?)',
    [a.id, a.unlocked_at, a.title, a.description]);
}
```

---

## Task 7 — Styles to Add

Add to `StyleSheet.create(s)` at the end (after line 2349, before `}`):

```typescript
// Daily reading card styles
readingCard: { marginHorizontal: 16, marginBottom: 8, padding: 16, borderRadius: 16, borderWidth: 1.5 },
readingCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
readingCardDate: { fontSize: 12, marginBottom: 12 },
readingCardBtn: { padding: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
readingCardBtnTxt: { fontSize: 15, fontWeight: '600' },
readingStreakBadge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
// Daily reading modal styles
drSection: { marginBottom: 24 },
drSectionHdr: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
drVerseCard: { backgroundColor: '#FFF8E7', borderRadius: 16, padding: 20, borderWidth: 1.5, borderColor: '#D4A574', marginBottom: 8 },
drVerseTxt: { fontSize: 17, fontStyle: 'italic', lineHeight: 26, marginVertical: 12 },
drVerseRef: { fontSize: 14, fontWeight: '600' },
drVerseActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
drActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
drActionBtnTxt: { fontSize: 13, fontWeight: '600' },
drPatternCard: { borderRadius: 12, padding: 14, marginBottom: 8 },
drPsalmCard: { borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
drPsalmHdr: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
drPsalmBody: { padding: 14, paddingTop: 0 },
drPsalmVerse: { flexDirection: 'row', marginBottom: 8, gap: 8 },
drPsalmVNum: { fontSize: 12, fontWeight: '700', minWidth: 24 },
drPsalmVTxt: { flex: 1, fontSize: 14, lineHeight: 22 },
drMarkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, margin: 16, borderRadius: 16 },
drMarkBtnTxt: { fontSize: 17, fontWeight: '700' },
drEmptyTxt: { fontStyle: 'italic', textAlign: 'center', padding: 12 },
// Achievement badge styles
achieveBadge: { width: (SW - 32 - 28) / 4, alignItems: 'center', padding: 10, borderRadius: 14, borderWidth: 1.5, position: 'relative' },
```

---

## Task 8 — Import Changes in `App.tsx`

**Line 2** — Add `Share` to react-native imports:
```typescript
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Alert, StatusBar, KeyboardAvoidingView, Platform, Dimensions, AppState, Keyboard, Share } from 'react-native';
```

**Line 1** of `DailyReading.ts` (new file):
```typescript
import { BIBLE_VERSES, BIBLE_BOOKS } from './BibleVerses';
import type { BibleVerse, BibleBook } from './BibleVerses';
```

---

## Task 9 — Version Bump

**3 locations in App.tsx**:
1. `exportData` function: `version: '4.0'` → `'4.1'`
2. About section in SettingsScreen: `"Версия 4.0"` → `"Версия 4.1"`
3. Also update the app description if needed

**`app.json`**:
- `"version": "4.0"` → `"4.1"` (or whatever the current field is)

---

## Compatibility Analysis

### DB Backward Compatibility
- Both new tables use `CREATE TABLE IF NOT EXISTS` → zero risk for existing users
- Export/import gracefully handles missing tables (`|| []`)
- No changes to existing table schemas

### Existing Daily Verse Widget
- **Kept unchanged** (lines 773–786)
- The `getDailyVerse` function in App.tsx (line 155) is kept; the `getDailyVerse` in DailyReading.ts is a **different function** with different algorithm
- Both coexist independently

### Theme Compatibility
- DailyReadingCard and DailyReadingModal use `useTheme()` for all theme colors
- The gold card background `'#FFF8E7'` matches existing `dailyVerse` style (same value at line 2345)
- The green read state `'#E8F5E9'` matches `theme.dreamBg` for light theme

### BibleVerses.ts Compatibility
- No changes to BibleVerses.ts
- DailyReading.ts only imports, never mutates
- Exact book names used: `'Псалтырь'` (not Псалтирь), `'Притчи Соломона'`
- Search uses `.includes('Псалт')` and `.includes('Притч')` for resilience

### Performance
- `getFullDailyReading()` filters 31K verses 4 times
- Called once in `useEffect` (not in render) → no render-cycle performance hit
- Results stored in `dailyReadingResult` state → modal opens instantly
- Psalm chapter display can be 150 verses max, but only 2 chapters loaded, and they're collapsible

### Error Handling (all DB operations)
- All `db.*Async` calls wrapped in `try/catch`
- Graceful fallbacks: empty arrays, `isRead: false`, `streak: 0`
- DailyReadingModal: if `reading` is null, modal not shown (guarded in JournalScreen JSX)
- Achievement unlock: `INSERT OR IGNORE` prevents duplicates even if called twice

### Single-file Pattern
- All UI components (`DailyReadingCard`, `DailyReadingModal`) defined in `App.tsx`
- No new component files
- New module `DailyReading.ts` contains only pure TypeScript logic (no JSX)

---

## Implementation Order (for a single session)

1. **Create `DailyReading.ts`** — pure logic, no dependencies on App.tsx state
2. **Add `Share` to imports** in App.tsx line 2
3. **Add `ReadStats` interface and `ACHIEVEMENTS` constant** to App.tsx
4. **Update `initDb()`** — add 2 new CREATE TABLE statements
5. **Add helper functions** (`getDailyReadingStatus`, `markDailyRead`, `getReadStats`, `checkAndUnlockAchievements`)
6. **Add `DailyReadingCard` component** function before JournalScreen
7. **Add `DailyReadingModal` component** function before JournalScreen
8. **Update JournalScreen**: new state, new useEffect, render card + modal
9. **Update SettingsScreen**: achievements grid, custom pattern section, export/import
10. **Add new styles** to StyleSheet.create
11. **Bump version** in 3 places (2 in App.tsx + app.json)
12. **Run tests** (`npm test`) — verify no regressions in existing 46 tests

---

## Testing Checklist (from task spec)

- [ ] Card shows "not read" state on first launch of day
- [ ] Card shows "read" state after marking complete, survives restart
- [ ] Verse content identical across multiple renders of same day
- [ ] Date-pattern search returns empty array gracefully for day 31 (or any day with no matches)
- [ ] "В журнал" creates entry visible in Журнал tab
- [ ] Streak increments on consecutive days
- [ ] `first_read` achievement unlocks on first mark-as-read
- [ ] All 3 themes render correctly
- [ ] Psalm collapse/expand works without layout glitch
- [ ] No crash if BIBLE_VERSES has no matching Psalms/Proverbs (graceful empty return)
- [ ] Export includes `daily_reading_history` and `achievements` tables
- [ ] Import restores reading history without overwriting existing data
- [ ] Custom pattern saves and is used by next reading load
- [ ] `custom_pattern` achievement unlocks when custom pattern is saved
