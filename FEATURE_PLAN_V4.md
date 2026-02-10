# Divine Journal — Feature Plan v4.0

> **Purpose**: Implementation plan for the next wave of features (v3.6–v3.9).
> Each phase contains enough detail for a Claude session to implement it without
> re-reading the entire codebase. Read `ENHANCEMENT_PLAN.md` for architecture context first.

---

## Overview

| Phase | Feature | Version | Complexity | New DB |
|-------|---------|---------|------------|--------|
| A | Bible Chapter Navigation | v3.6 | Low | — |
| B | Pin Important Entries | v3.6 | Low | ALTER |
| C | Archive Old Entries | v3.6 | Low-Med | ALTER |
| D | Swipe Calendar Navigation | v3.7 | Low-Med | — |
| E | Calendar Events + Color/Gradient | v3.7 | High | NEW TABLE |
| J | Gradient/Colored Notes | v3.7 | Medium | ALTER |
| F | Undo/Redo in Editor | v3.8 | Medium | — |
| G | Linked Entries + Reading Plan | v3.8 | Medium | ALTER |
| H | Achievement System with Awards | v3.9 | High | NEW TABLE |
| I | Monthly/Yearly Review | v3.9 | High | — |

**Total estimated new lines**: ~980 in App.tsx, ~40 in utils.ts, ~30 in tests
**New dependencies needed**: None (all done with existing react-native-svg, Animated, PanResponder)
**New DB tables**: 2 (calendar_events, achievements)
**DB migrations**: 5 ALTER TABLEs (entries: pinned, archived, reading_plan_link; daily_notes: color, gradient_end)

---

## Phase A: Bible Chapter Navigation (v3.6)

**Problem**: When reading a chapter (e.g., Второзаконие 24), the user must go back to the book view to select the next chapter. No forward/backward navigation exists.

### Implementation

**BibleScreen changes** (currently ~lines 1554–1606 in App.tsx):

1. Add `← Пред.` / `След. →` arrow buttons in the chapter header bar:
   ```tsx
   // Inside the chapter verse-list view, replace the simple back header with:
   <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
     <TouchableOpacity onPress={() => {
       if (chap! > 1) setChap(chap! - 1);
       else {
         // Go to previous book's last chapter
         const idx = BIBLE_BOOKS.findIndex(b => b.name === book!.name);
         if (idx > 0) {
           const prevBook = BIBLE_BOOKS[idx - 1];
           setBook(prevBook);
           setChap(prevBook.chapters);
         }
       }
     }}>
       <Ionicons name="chevron-back" size={22} color={theme.primary} />
       <Text>Пред.</Text>
     </TouchableOpacity>

     <Text style={s.headerTxt}>{book!.name} {chap}</Text>

     <TouchableOpacity onPress={() => {
       if (chap! < book!.chapters) setChap(chap! + 1);
       else {
         // Go to next book's chapter 1
         const idx = BIBLE_BOOKS.findIndex(b => b.name === book!.name);
         if (idx < BIBLE_BOOKS.length - 1) {
           const nextBook = BIBLE_BOOKS[idx + 1];
           setBook(nextBook);
           setChap(1);
         }
       }
     }}>
       <Text>След.</Text>
       <Ionicons name="chevron-forward" size={22} color={theme.primary} />
     </TouchableOpacity>
   </View>
   ```

2. Add horizontal swipe gesture via `PanResponder` on the verse FlatList:
   ```tsx
   const panResponder = useRef(PanResponder.create({
     onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 50 && Math.abs(gs.dy) < 30,
     onPanResponderRelease: (_, gs) => {
       if (gs.dx < -50) { /* swipe left → next chapter */ }
       if (gs.dx > 50)  { /* swipe right → prev chapter */ }
     },
   })).current;
   // Apply: <FlatList {...panResponder.panHandlers} ... />
   ```

3. Auto-scroll to top when chapter changes:
   ```tsx
   const verseListRef = useRef<FlatList>(null);
   useEffect(() => { verseListRef.current?.scrollToOffset({ offset: 0, animated: false }); }, [chap]);
   ```

**Edge cases**:
- At Genesis 1 (first chapter of Bible): disable/hide prev button
- At Revelation 22 (last chapter): disable/hide next button
- Cross-book navigation: advance to next book's chapter 1 / previous book's last chapter

**DB changes**: None

**New styles**:
```tsx
chapNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
chapNavBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 4 },
chapNavBtnDisabled: { opacity: 0.3 },
```

**Estimated lines**: ~40

---

## Phase B: Pin Important Entries (v3.6)

### Database Changes

Add idempotent migration in `initDb()`:
```tsx
try { await db.execAsync('ALTER TABLE entries ADD COLUMN pinned INTEGER DEFAULT 0'); } catch {}
```

### Implementation

1. **Update Entry type** — add `pinned?: number`:
   ```tsx
   interface Entry { ...; pinned?: number; }
   ```

2. **Sort entries**: pinned first, then by date:
   ```tsx
   // In load() query:
   'SELECT * FROM entries ORDER BY pinned DESC, created_at DESC'
   ```

3. **Long-press menu** — add "Закрепить" / "Открепить" option:
   - Currently, long-press shows delete confirmation
   - Change to show an action sheet / bottom modal with options: Pin/Unpin, Delete
   ```tsx
   const togglePin = async (entry: Entry) => {
     await db.runAsync('UPDATE entries SET pinned = ? WHERE id = ?', [entry.pinned ? 0 : 1, entry.id]);
     load();
   };
   ```

4. **Visual indicator** on pinned entry cards:
   ```tsx
   {entry.pinned ? <Ionicons name="pin" size={14} color={theme.warning} style={{ position: 'absolute', top: 8, right: 8 }} /> : null}
   ```

5. **Entry card styling for pinned items**: subtle left border or gold tint:
   ```tsx
   { borderLeftWidth: entry.pinned ? 3 : 0, borderLeftColor: theme.warning }
   ```

**Estimated lines**: ~30

---

## Phase C: Archive Old Entries (v3.6)

### Database Changes

```tsx
try { await db.execAsync('ALTER TABLE entries ADD COLUMN archived INTEGER DEFAULT 0'); } catch {}
```

### Implementation

1. **Update Entry type**: add `archived?: number`

2. **Default view filters out archived**:
   ```tsx
   const filteredEntries = useMemo(() => {
     let list = entries.filter(e => showArchived ? e.archived : !e.archived);
     if (searchQ) list = list.filter(e => /* existing search logic */);
     if (activeFolder) list = list.filter(e => e.folder_id === activeFolder);
     return list;
   }, [entries, showArchived, searchQ, activeFolder]);
   ```

3. **Toggle button** — "Архив" pill near the search bar:
   ```tsx
   <TouchableOpacity onPress={() => setShowArchived(!showArchived)}
     style={[s.folderChip, showArchived && s.folderChipAct]}>
     <Ionicons name="archive" size={14} />
     <Text>Архив</Text>
   </TouchableOpacity>
   ```

4. **Long-press menu** gets "В архив" / "Из архива" option:
   ```tsx
   const toggleArchive = async (entry: Entry) => {
     await db.runAsync('UPDATE entries SET archived = ? WHERE id = ?', [entry.archived ? 0 : 1, entry.id]);
     load();
   };
   ```

5. **Archive view styling** — muted appearance:
   ```tsx
   { opacity: showArchived ? 0.7 : 1 }
   ```

6. **Archived entries exclusion from stats** — update SettingsScreen stat queries:
   ```sql
   SELECT ... FROM entries WHERE archived = 0
   ```

7. **(Optional) Bulk archive** — button in Settings:
   ```
   "Архивировать записи старше 6 мес." → confirmation → UPDATE entries SET archived=1 WHERE created_at < date('now', '-6 months')
   ```

**State additions**: `showArchived: boolean`

**Estimated lines**: ~50

---

## Phase D: Swipe Calendar Navigation (v3.7)

### Implementation

1. **Wrap calendar grid** in a `PanResponder`:
   ```tsx
   const calPan = useRef(PanResponder.create({
     onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 40 && Math.abs(gs.dy) < 30,
     onPanResponderRelease: (_, gs) => {
       if (gs.dx < -40) {
         // Swipe left → next month
         setMonth(m => m === 11 ? 0 : m + 1);
         if (month === 11) setYear(y => y + 1);
       }
       if (gs.dx > 40) {
         // Swipe right → prev month
         setMonth(m => m === 0 ? 11 : m - 1);
         if (month === 0) setYear(y => y - 1);
       }
     },
   })).current;
   ```

2. **Animate transition** with `Animated.Value` for a subtle slide:
   ```tsx
   const slideAnim = useRef(new Animated.Value(0)).current;
   // On swipe: animate translateX from ±SW to 0
   const animateSlide = (fromX: number) => {
     slideAnim.setValue(fromX);
     Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
   };
   ```

3. **Apply to calendar grid**:
   ```tsx
   <Animated.View {...calPan.panHandlers} style={{ transform: [{ translateX: slideAnim }] }}>
     {/* calendar grid rows */}
   </Animated.View>
   ```

4. Keep existing `‹` / `›` arrow buttons as fallback.

**DB changes**: None

**Estimated lines**: ~40

---

## Phase E: Calendar Events with Color/Gradient Picker (v3.7)

### Database Changes

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#D4A574',
  gradient_end TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Implementation

1. **Load events in CalendarScreen**:
   ```tsx
   const [events, setEvents] = useState<CalendarEvent[]>([]);
   // In load():
   const evts = await db.getAllAsync<CalendarEvent>('SELECT * FROM calendar_events');
   setEvents(evts);
   ```

2. **Calendar day cell** — show colored event dots:
   ```tsx
   const dayEvents = events.filter(e => e.date === ds);
   // Render up to 3 colored dots below the day number:
   <View style={{ flexDirection: 'row', gap: 2, justifyContent: 'center' }}>
     {dayEvents.slice(0, 3).map((ev, i) => (
       ev.gradient_end ? (
         <Svg key={i} width={6} height={6}>
           <Defs><LinearGradient id={`g${i}`} x1="0" y1="0" x2="1" y2="1">
             <Stop offset="0" stopColor={ev.color} /><Stop offset="1" stopColor={ev.gradient_end} />
           </LinearGradient></Defs>
           <RNSvgCircle cx={3} cy={3} r={3} fill={`url(#g${i})`} />
         </Svg>
       ) : (
         <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ev.color }} />
       )
     ))}
     {dayEvents.length > 3 && <Text style={{ fontSize: 8, color: theme.textMuted }}>+{dayEvents.length - 3}</Text>}
   </View>
   ```

3. **Day cell background tint** — light wash of event color (10% opacity):
   ```tsx
   { backgroundColor: dayEvents.length ? dayEvents[0].color + '1A' : 'transparent' }
   ```

4. **Event creation modal**:
   ```
   ┌─────────────────────────────────────┐
   │  Новое событие                      │
   │                                     │
   │  Название: [________________]       │
   │  Описание: [________________]       │
   │                                     │
   │  Цвет:                              │
   │  (●)(●)(●)(●)(●)(●)(●)(●)          │
   │                                     │
   │  [✓] Градиент                       │
   │  Второй цвет:                       │
   │  (●)(●)(●)(●)(●)(●)(●)(●)          │
   │                                     │
   │  Предпросмотр: [====gradient====]   │
   │                                     │
   │  [Отмена]              [Сохранить]  │
   └─────────────────────────────────────┘
   ```

5. **Color palette** (reusable across Phases E and J):
   ```tsx
   const EVENT_COLORS = [
     '#E57373', '#F06292', '#BA68C8', '#7986CB',
     '#4FC3F7', '#4DB6AC', '#81C784', '#FFD54F',
     '#FF8A65', '#A1887F', '#90A4AE', '#D4A574',
   ];
   ```

6. **Daily detail view** — list events for the day:
   ```tsx
   // In the day detail section, add an "События" block:
   <Text style={s.sectionHdr}>События</Text>
   {dayEvents.map(ev => (
     <View style={[s.eventCard, { borderLeftColor: ev.color, borderLeftWidth: 4 }]}>
       <Text style={s.eventTitle}>{ev.title}</Text>
       {ev.description ? <Text style={s.eventDesc}>{ev.description}</Text> : null}
     </View>
   ))}
   <TouchableOpacity onPress={() => setShowEventForm(true)}>
     <Text style={{ color: theme.primary }}>+ Добавить событие</Text>
   </TouchableOpacity>
   ```

7. **Event CRUD**:
   ```tsx
   const saveEvent = async () => {
     await db.runAsync(
       'INSERT INTO calendar_events (date, title, description, color, gradient_end) VALUES (?,?,?,?,?)',
       [selectedDate, eventTitle, eventDesc, eventColor, useGradient ? gradientEnd : null]
     );
     load();
     setShowEventForm(false);
   };
   const deleteEvent = async (id: number) => {
     await db.runAsync('DELETE FROM calendar_events WHERE id = ?', [id]);
     load();
   };
   ```

**State additions**:
```tsx
const [events, setEvents] = useState<CalendarEvent[]>([]);
const [showEventForm, setShowEventForm] = useState(false);
const [eventTitle, setEventTitle] = useState('');
const [eventDesc, setEventDesc] = useState('');
const [eventColor, setEventColor] = useState('#D4A574');
const [useGradient, setUseGradient] = useState(false);
const [gradientEnd, setGradientEnd] = useState('#E57373');
const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
```

**New types**:
```tsx
interface CalendarEvent {
  id: number; date: string; title: string; description: string;
  color: string; gradient_end: string | null; created_at: string;
}
```

**New styles**:
```tsx
eventCard: { padding: 12, marginBottom: 8, borderRadius: 8, backgroundColor: theme.surface },
eventTitle: { fontSize: 14, fontWeight: '600', color: theme.text },
eventDesc: { fontSize: 12, color: theme.textSec, marginTop: 4 },
colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 },
colorDot: { width: 32, height: 32, borderRadius: 16 },
colorDotSel: { borderWidth: 3, borderColor: theme.text },
gradientPreview: { height: 24, borderRadius: 12, marginVertical: 8 },
```

**Estimated lines**: ~200

---

## Phase J: Gradient/Colored Notes (v3.7)

### Database Changes

```tsx
try { await db.execAsync('ALTER TABLE daily_notes ADD COLUMN color TEXT DEFAULT NULL'); } catch {}
try { await db.execAsync('ALTER TABLE daily_notes ADD COLUMN gradient_end TEXT DEFAULT NULL'); } catch {}
```

### Implementation

1. **Reuse color picker** from Phase E (same `EVENT_COLORS` palette + gradient toggle).

2. **Add color picker** to the daily notes editor modal:
   ```tsx
   // Below the block editor, before save button:
   <Text style={s.sectionHdr}>Цвет заметки</Text>
   <ColorPicker value={noteColor} gradient={noteGradient} onChange={...} />
   ```

3. **Save color with note**:
   ```tsx
   await db.runAsync(
     'INSERT OR REPLACE INTO daily_notes (date, notes, color, gradient_end) VALUES (?,?,?,?)',
     [selectedDate, JSON.stringify(blocks), noteColor, noteGradient]
   );
   ```

4. **Calendar day cell** — subtle background tint for days with colored notes:
   ```tsx
   const noteForDay = dailyNotes.find(n => n.date === ds);
   // Day cell background uses note color at 15% opacity:
   { backgroundColor: noteForDay?.color ? noteForDay.color + '26' : 'transparent' }
   ```

5. **Daily notes view** — show note card with color/gradient header bar:
   ```tsx
   {noteForDay?.color && (
     <View style={[s.noteColorBar, { backgroundColor: noteForDay.color }]} />
     // Or gradient using SVG <Rect> with <LinearGradient>
   )}
   ```

**State additions**: `noteColor`, `noteGradient` in daily note editor

**Estimated lines**: ~60

---

## Phase F: Undo/Redo in Editor (v3.8)

### Implementation

Applies to both **Journal entry editor** and **daily notes editor**.

1. **Undo/Redo stacks** (use refs to avoid re-renders):
   ```tsx
   const undoStack = useRef<Block[][]>([]);
   const redoStack = useRef<Block[][]>([]);
   const [canUndo, setCanUndo] = useState(false);
   const [canRedo, setCanRedo] = useState(false);
   const MAX_UNDO = 30;
   ```

2. **Push state on meaningful changes**:
   ```tsx
   const pushUndo = (currentBlocks: Block[]) => {
     undoStack.current.push(JSON.parse(JSON.stringify(currentBlocks)));
     if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
     redoStack.current = [];
     setCanUndo(true);
     setCanRedo(false);
   };
   ```

3. **Debounce text input** — don't push on every keystroke:
   ```tsx
   const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   const pushUndoDebounced = (blocks: Block[]) => {
     if (undoTimer.current) clearTimeout(undoTimer.current);
     undoTimer.current = setTimeout(() => pushUndo(blocks), 500);
   };
   ```

4. **Call pushUndo** before: block add, block delete, block reorder, format change.
   **Call pushUndoDebounced** on: text content changes (updateBlock).

5. **Undo action**:
   ```tsx
   const undo = () => {
     if (!undoStack.current.length) return;
     redoStack.current.push(JSON.parse(JSON.stringify(blocks)));
     const prev = undoStack.current.pop()!;
     setBlocks(prev);
     setCanUndo(undoStack.current.length > 0);
     setCanRedo(true);
   };
   ```

6. **Redo action**:
   ```tsx
   const redo = () => {
     if (!redoStack.current.length) return;
     undoStack.current.push(JSON.parse(JSON.stringify(blocks)));
     const next = redoStack.current.pop()!;
     setBlocks(next);
     setCanRedo(redoStack.current.length > 0);
     setCanUndo(true);
   };
   ```

7. **RTToolbar buttons** — add at the left side of the toolbar:
   ```tsx
   <TouchableOpacity onPress={onUndo} disabled={!canUndo} style={{ opacity: canUndo ? 1 : 0.3 }}>
     <Ionicons name="arrow-undo" size={20} color={theme.text} />
   </TouchableOpacity>
   <TouchableOpacity onPress={onRedo} disabled={!canRedo} style={{ opacity: canRedo ? 1 : 0.3 }}>
     <Ionicons name="arrow-redo" size={20} color={theme.text} />
   </TouchableOpacity>
   <View style={{ width: 1, height: 20, backgroundColor: theme.border, marginHorizontal: 6 }} />
   ```

8. **RTToolbar props update**:
   ```tsx
   interface RTToolbarProps {
     // ... existing props ...
     canUndo?: boolean;
     canRedo?: boolean;
     onUndo?: () => void;
     onRedo?: () => void;
   }
   ```

**Estimated lines**: ~80

---

## Phase G: Linked Entries + Reading Plan Progress (v3.8)

### Database Changes

```tsx
try { await db.execAsync('ALTER TABLE entries ADD COLUMN reading_plan_link TEXT DEFAULT NULL'); } catch {}
// Format: "BookName:ChapterNumber" e.g., "Бытие:3"
```

### Implementation

1. **Entry editor** — add "Привязать к плану чтения" button:
   ```tsx
   // Below category picker in the entry editor:
   <TouchableOpacity onPress={() => setShowPlanLink(true)}>
     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
       <Ionicons name="link" size={18} color={theme.primary} />
       <Text style={{ color: theme.primary }}>
         {readingPlanLink ? `📖 ${readingPlanLink}` : 'Привязать к плану чтения'}
       </Text>
     </View>
   </TouchableOpacity>
   ```

2. **Plan link picker modal** — shows current reading plan items:
   ```tsx
   // Modal listing reading_plan items for the current active plan:
   const planItems = await db.getAllAsync<Reading>('SELECT DISTINCT book, chapter FROM reading_plan ORDER BY id');
   // Group by book, show chapters, tap to select
   ```

3. **Save link with entry**:
   ```tsx
   // In save():
   await db.runAsync('UPDATE entries SET reading_plan_link = ? WHERE id = ?', [readingPlanLink, id]);
   ```

4. **Reading plan view enhancement** — show linked entries count:
   ```tsx
   // For each reading plan item, count linked entries:
   const linkedCount = entries.filter(e => e.reading_plan_link === `${r.book}:${r.chapter}`).length;
   // Display as badge:
   {linkedCount > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{linkedCount}</Text></View>}
   ```

5. **Reading plan progress card** (in CalendarScreen):
   ```
   ┌─────────────────────────────────────┐
   │  📖 План чтения                     │
   │  ████████████░░░░  67/100 (67%)    │
   │  Записей привязано: 12              │
   │  [Подробнее]                        │
   └─────────────────────────────────────┘
   ```

6. **Tap reading plan item** → show linked entries in a sub-list:
   ```tsx
   const linkedEntries = entries.filter(e => e.reading_plan_link === `${item.book}:${item.chapter}`);
   // Render as expandable section below the chapter checkbox
   ```

**State additions**: `readingPlanLink`, `showPlanLink` modal

**Estimated lines**: ~100

---

## Phase H: Achievement System with Awards (v3.9)

### Database Changes

```sql
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  unlocked_at DATETIME DEFAULT NULL,
  progress INTEGER DEFAULT 0
);
```

### Achievement Definitions

```tsx
const ACHIEVEMENTS = [
  // Entry milestones
  { id: 'first_entry',    name: 'Первая запись',    icon: 'create',     desc: 'Создайте первую запись', target: 1,    check: 'entries' },
  { id: 'entries_10',     name: '10 записей',       icon: 'journal',    desc: 'Напишите 10 записей', target: 10,   check: 'entries' },
  { id: 'entries_50',     name: '50 записей',       icon: 'documents',  desc: 'Напишите 50 записей', target: 50,   check: 'entries' },
  { id: 'entries_100',    name: 'Сотня записей',    icon: 'library',    desc: 'Напишите 100 записей', target: 100,  check: 'entries' },

  // Streak milestones
  { id: 'streak_7',       name: 'Неделя подряд',    icon: 'flame',      desc: 'Пишите 7 дней подряд', target: 7,    check: 'streak' },
  { id: 'streak_30',      name: 'Месяц подряд',     icon: 'fitness',    desc: 'Пишите 30 дней подряд', target: 30,   check: 'streak' },
  { id: 'streak_100',     name: '100 дней подряд',  icon: 'trophy',     desc: 'Пишите 100 дней подряд', target: 100,  check: 'streak' },

  // Bible reading
  { id: 'chapters_10',    name: 'Читатель',         icon: 'book',       desc: 'Прочитайте 10 глав', target: 10,   check: 'chapters' },
  { id: 'chapters_50',    name: 'Книжник',          icon: 'book',       desc: 'Прочитайте 50 глав', target: 50,   check: 'chapters' },
  { id: 'chapters_200',   name: 'Знаток Библии',    icon: 'school',     desc: 'Прочитайте 200 глав', target: 200,  check: 'chapters' },
  { id: 'chapters_1189',  name: 'Вся Библия',       icon: 'ribbon',     desc: 'Прочитайте все 1189 глав', target: 1189, check: 'chapters' },

  // Fasting
  { id: 'fast_7',         name: 'Пост 7 дней',      icon: 'heart',      desc: 'Поститесь 7 дней', target: 7,    check: 'fasting' },
  { id: 'fast_40',        name: 'Великий пост',     icon: 'star',       desc: 'Поститесь 40 дней', target: 40,   check: 'fasting' },

  // Variety
  { id: 'all_categories', name: 'Все категории',    icon: 'pricetags',  desc: 'Используйте все 4 категории', target: 4, check: 'categories' },
  { id: 'bookmarks_20',   name: 'Коллекционер',     icon: 'bookmark',   desc: 'Сохраните 20 закладок', target: 20,   check: 'bookmarks' },
  { id: 'folders_5',      name: 'Организатор',      icon: 'folder',     desc: 'Создайте 5 папок', target: 5,    check: 'folders' },
];
```

### Implementation

1. **`checkAchievements()` function** — called after key actions:
   ```tsx
   const checkAchievements = async () => {
     const stats = {
       entries: (await db.getFirstAsync<{c:number}>('SELECT COUNT(*) as c FROM entries WHERE archived=0'))?.c || 0,
       streak: calcStreak(entries),
       chapters: (await db.getFirstAsync<{c:number}>('SELECT COUNT(*) as c FROM reading_plan WHERE completed=1'))?.c || 0,
       fasting: computeFastingDays(fasts),
       categories: (await db.getFirstAsync<{c:number}>('SELECT COUNT(DISTINCT category) as c FROM entries'))?.c || 0,
       bookmarks: (await db.getFirstAsync<{c:number}>('SELECT COUNT(*) as c FROM bookmarks'))?.c || 0,
       folders: (await db.getFirstAsync<{c:number}>('SELECT COUNT(*) as c FROM folders'))?.c || 0,
     };

     for (const ach of ACHIEVEMENTS) {
       const current = await db.getFirstAsync<{unlocked_at: string|null; progress: number}>(
         'SELECT unlocked_at, progress FROM achievements WHERE id = ?', [ach.id]
       );
       const value = stats[ach.check as keyof typeof stats] || 0;

       if (!current) {
         await db.runAsync('INSERT INTO achievements (id, progress) VALUES (?, ?)', [ach.id, value]);
       }

       if (value >= ach.target && !current?.unlocked_at) {
         await db.runAsync('UPDATE achievements SET unlocked_at = CURRENT_TIMESTAMP, progress = ? WHERE id = ?', [value, ach.id]);
         // Show celebration modal!
         setNewAchievement(ach);
         setShowAchievementModal(true);
       } else if (!current?.unlocked_at) {
         await db.runAsync('UPDATE achievements SET progress = ? WHERE id = ?', [value, ach.id]);
       }
     }
   };
   ```

2. **Call checkAchievements** after: entry save, reading completion, fasting save, bookmark add, folder create.

3. **Celebration modal** — shown when a new achievement is unlocked:
   ```
   ┌─────────────────────────────────────┐
   │                                     │
   │            🏆                       │
   │                                     │
   │      Новая награда!                 │
   │                                     │
   │      ⭐ Неделя подряд              │
   │      Пишите 7 дней подряд          │
   │                                     │
   │         [Отлично!]                  │
   │                                     │
   └─────────────────────────────────────┘
   ```
   With scale-in animation (`Animated.spring`) and gold border.

4. **Settings/Stats — "Награды" section** (replace basic achievement rows):
   ```
   НАГРАДЫ (5/17 открыто)
   ┌──────┐ ┌──────┐ ┌──────┐
   │  🔥  │ │  📖  │ │  ❤️  │
   │Неделя│ │Читат.│ │Пост 7│
   │подряд│ │      │ │      │
   └──────┘ └──────┘ └──────┘
   ┌──────┐ ┌──────┐ ┌──────┐
   │  🔒  │ │  🔒  │ │  🔒  │
   │ ???  │ │ ???  │ │ ???  │
   │47/50 │ │3/200 │ │0/40  │
   └──────┘ └──────┘ └──────┘
   ```

   - 3-column grid layout
   - Unlocked: full color icon + name + gold border
   - Locked: gray icon + "???" or hint + progress bar (e.g., "47/50")
   - Tap unlocked achievement: show full details + unlock date

**State additions**: `achievements[]`, `newAchievement`, `showAchievementModal`

**New styles**:
```tsx
achieveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
achieveCard: { width: '31%', aspectRatio: 1, borderRadius: 12, padding: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
achieveCardUnlocked: { borderColor: '#FFD700', borderWidth: 2 },
achieveCardLocked: { opacity: 0.5 },
achieveIcon: { fontSize: 28, marginBottom: 4 },
achieveName: { fontSize: 11, textAlign: 'center', color: theme.text, fontWeight: '600' },
achieveProgress: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
celebrationModal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
celebrationCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 3, borderColor: '#FFD700' },
```

**Estimated lines**: ~180

---

## Phase I: Monthly/Yearly Review (v3.9)

### Implementation

New section accessible from SettingsScreen — "Обзор" button that opens a review modal.

1. **Review period selector**:
   ```tsx
   const [reviewMode, setReviewMode] = useState<'month' | 'year'>('month');
   const [reviewMonth, setReviewMonth] = useState(new Date().getMonth());
   const [reviewYear, setReviewYear] = useState(new Date().getFullYear());
   ```

2. **Monthly review data**:
   ```tsx
   const loadMonthReview = async (month: number, year: number) => {
     const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
     const end = `${year}-${String(month + 1).padStart(2, '0')}-31`;

     return {
       entries: await db.getAllAsync('SELECT * FROM entries WHERE created_at BETWEEN ? AND ? AND archived=0', [start, end + ' 23:59:59']),
       readings: await db.getAllAsync('SELECT * FROM reading_plan WHERE date BETWEEN ? AND ? AND completed=1', [start, end]),
       fastingDays: computeFastingDaysInRange(fasts, start, end),
       achievements: await db.getAllAsync('SELECT * FROM achievements WHERE unlocked_at BETWEEN ? AND ?', [start, end + ' 23:59:59']),
     };
   };
   ```

3. **Monthly review UI**:
   ```
   ┌─────────────────────────────────────┐
   │  [← ] Январь 2026  [→ ]   [Год]   │
   ├─────────────────────────────────────┤
   │  📊 ОБЗОР МЕСЯЦА                   │
   │                                     │
   │  Записей: 15                        │
   │  Сон: ████░░  4                     │
   │  Откр: ██░░░  2                     │
   │  Мысль: ██████ 7                    │
   │  Молитва: ████  2                   │
   │                                     │
   │  📖 Глав прочитано: 23              │
   │  🙏 Дней поста: 5                   │
   │                                     │
   │  📅 Самые активные дни:             │
   │  12 янв (3), 15 янв (2), 20 янв (2)│
   │                                     │
   │  🏷️ Ключевые слова:                │
   │  молитва, благодать, вера, покой    │
   │                                     │
   │  🏆 Награды этого месяца:           │
   │  ⭐ Неделя подряд                   │
   └─────────────────────────────────────┘
   ```

4. **Yearly review UI**:
   ```
   ┌─────────────────────────────────────┐
   │  [←]      2026      [→]   [Месяц]  │
   ├─────────────────────────────────────┤
   │  📊 ГОД В ЦИФРАХ                   │
   │                                     │
   │  ┌──────┐ ┌──────┐ ┌──────┐       │
   │  │  156 │ │  89  │ │  42  │       │
   │  │Записи│ │ Глав │ │Д.поста│       │
   │  └──────┘ └──────┘ └──────┘       │
   │                                     │
   │  📈 Активность по месяцам:          │
   │  Янв ████████░░ 18                  │
   │  Фев ██████░░░░ 12                  │
   │  Мар ██████████ 22                  │
   │  ...                                │
   │                                     │
   │  🏆 Лучший месяц: Март (22 зап.)   │
   │  📝 Любимая категория: Мысль (43%) │
   │  🔥 Рекорд серии: 23 дня           │
   │                                     │
   │  🏆 Награды за год: 8/17            │
   └─────────────────────────────────────┘
   ```

5. **Keywords extraction** — reuse existing `extractKeywords()` from utils.ts:
   ```tsx
   const allKeywords = monthEntries.flatMap(e => {
     const blocks = parseBlocks(e.content);
     return blocks.filter(b => b.type === 'text').flatMap(b => extractKeywords(b.content));
   });
   // Count frequency, show top 5
   const kwFreq = allKeywords.reduce((acc, kw) => { acc[kw] = (acc[kw] || 0) + 1; return acc; }, {} as Record<string, number>);
   const topKw = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([kw]) => kw);
   ```

6. **Most active days**:
   ```tsx
   const dayCount = monthEntries.reduce((acc, e) => {
     const d = e.created_at.split(' ')[0];
     acc[d] = (acc[d] || 0) + 1;
     return acc;
   }, {} as Record<string, number>);
   const topDays = Object.entries(dayCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
   ```

7. **Access point** in SettingsScreen:
   ```tsx
   <TouchableOpacity onPress={() => setShowReview(true)} style={s.settingsRow}>
     <Ionicons name="analytics" size={20} color={theme.primary} />
     <Text>Обзор месяца / года</Text>
   </TouchableOpacity>
   ```

**DB changes**: None (reads from existing tables + achievements from Phase H)

**State additions**: `showReview`, `reviewMode`, `reviewMonth`, `reviewYear`, review data object

**Estimated lines**: ~200

---

## Implementation Dependencies

```
Phase A (Bible Nav)         → independent
Phase B (Pin)               → independent
Phase C (Archive)           → independent
Phase D (Swipe Calendar)    → independent
Phase E (Calendar Events)   → independent (uses react-native-svg already installed)
Phase J (Colored Notes)     → reuses Phase E color picker component
Phase F (Undo/Redo)         → independent
Phase G (Linked Entries)    → independent
Phase H (Achievements)      → independent (but better after B, C, G for more checks)
Phase I (Review)            → benefits from Phase H (shows unlocked achievements)
```

**Suggested build order** (group by version release):

```
v3.6 — Phases A + B + C  (Bible nav fix + entry management)
v3.7 — Phases D + E + J  (Calendar UX + events + colors)
v3.8 — Phases F + G      (Editor power features)
v3.9 — Phases H + I      (Achievements + reviews — capstone features)
```

---

## New Database Tables Summary

```sql
-- Phase E: Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#D4A574',
  gradient_end TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Phase H: Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  unlocked_at DATETIME DEFAULT NULL,
  progress INTEGER DEFAULT 0
);
```

## Migration Summary

```tsx
// Phase B:
try { await db.execAsync('ALTER TABLE entries ADD COLUMN pinned INTEGER DEFAULT 0'); } catch {}

// Phase C:
try { await db.execAsync('ALTER TABLE entries ADD COLUMN archived INTEGER DEFAULT 0'); } catch {}

// Phase G:
try { await db.execAsync('ALTER TABLE entries ADD COLUMN reading_plan_link TEXT DEFAULT NULL'); } catch {}

// Phase J:
try { await db.execAsync('ALTER TABLE daily_notes ADD COLUMN color TEXT DEFAULT NULL'); } catch {}
try { await db.execAsync('ALTER TABLE daily_notes ADD COLUMN gradient_end TEXT DEFAULT NULL'); } catch {}
```

---

## Implementation Checklist

- [ ] **Phase A**: Bible chapter navigation (next/prev + swipe)
- [ ] **Phase B**: Pin important entries
- [ ] **Phase C**: Archive old entries
- [ ] **Phase D**: Swipe calendar navigation
- [ ] **Phase E**: Calendar events with color/gradient picker
- [ ] **Phase J**: Gradient/colored notes
- [ ] **Phase F**: Undo/Redo in editor
- [ ] **Phase G**: Linked entries + reading plan progress
- [ ] **Phase H**: Achievement system with awards
- [ ] **Phase I**: Monthly/Yearly review
