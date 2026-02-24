# Divine Journal — Enhancement Plan

> **Purpose**: Single source of truth for all planned enhancements.
> Each feature contains enough detail for a Claude session to implement without re-reading the entire codebase.

---

## Completed Features

| # | Feature | Version |
|---|---------|---------|
| 1 | Critical UX fixes (toolbar above keyboard, scroll fixes) | v3.0 |
| 2 | Folder system for organizing entries | v3.1 |
| 3 | Statistics dashboard with charts | v3.2 |
| 4 | Daily Bible verse widget + reading reminders | v3.3 |
| 5 | Theme system (light/dark/sepia) + font scaling | v3.4 |
| 6 | Advanced editing (highlights, dividers, block reorder, rich daily notes) | v3.5 |
| 7 | Graph view for entry connections | v3.6 |
| A1 | Export/import data (JSON backup via share sheet) | v4.0 |
| 8 | Daily reading system (verse of the day, Psalms, Proverbs, reading plans) | v5.0 |
| 9 | Backdated notes (create/edit entries with custom dates) | v5.2 |

---

## Feature Suggestions for Future Development

| # | Feature | Priority | Complexity |
|---|---------|----------|------------|
| 1 | Backdated Notes | ✅ Done | — |
| 2 | "On This Day" — Past Years Memories | High | Medium |
| 3 | Tags / Labels System | Medium | Medium |
| 4 | Entry Templates | Low | Low |
| 5 | Bible Verse Cross-References | Medium | High |
| 6 | Journal Full-Text Search with Filters | High | Medium |
| 7 | Weekly / Monthly Spiritual Summaries | Low | Medium |
| 8 | Entry Sharing with Rich Formatting | Medium | Low |
| 9 | Entry Pinning & Favorites | High | Low |
| 10 | Home Screen Widget (Daily Verse) | High | High |

---

## Feature 2: "On This Day" — Past Years Memories

**Goal**: Show journal entries written on the same calendar day in previous years (e.g., on Feb 24, show all entries from Feb 24 of 2025, 2024, etc.). Displayed as a horizontal slider/carousel at the top of the JournalScreen.

**User value**: Spiritual reflection — see how thoughts, prayers, and dreams evolved over years on the same day.

### Database Query

```sql
-- Get entries from the same day (MM-DD) in past years, excluding current year
SELECT * FROM entries
WHERE strftime('%m-%d', created_at) = ?
  AND strftime('%Y', created_at) != ?
ORDER BY created_at DESC
```

Parameters: `[currentMonthDay, currentYear]` where `currentMonthDay = '02-24'`.

### State Additions (JournalScreen)

```tsx
const [onThisDayEntries, setOnThisDayEntries] = useState<Entry[]>([]);
const [showOnThisDay, setShowOnThisDay] = useState(true);
```

### Data Loading

Add to the existing `useEffect` or `load()` callback:

```tsx
const today = new Date();
const mmdd = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
const yyyy = String(today.getFullYear());
db.getAllAsync<Entry>(
  "SELECT * FROM entries WHERE strftime('%m-%d', created_at) = ? AND strftime('%Y', created_at) != ? ORDER BY created_at DESC",
  [mmdd, yyyy]
).then(setOnThisDayEntries);
```

### UI: Horizontal Slider

Place above the daily verse widget (or replace it when "On This Day" entries exist). Use a horizontal `FlatList` or `ScrollView`:

```
┌─────────────────────────────────────────────────┐
│  📅 В этот день                          [✕]   │
│  ┌──────────────┐ ┌──────────────┐ ┌─────       │
│  │ 24 фев 2025  │ │ 24 фев 2024  │ │ 24 ф      │
│  │ 💭 Мысль     │ │ 🙏 Молитва   │ │ 💤 С      │
│  │ "Размышление │ │ "Молитва о   │ │ "Сон       │
│  │  о вере..."  │ │  семье..."   │ │  о хр      │
│  └──────────────┘ └──────────────┘ └─────       │
└─────────────────────────────────────────────────┘
```

**Card layout** (each card ~160px wide):
- Year + date at top
- Category badge (icon + label)
- Entry title (1 line, truncated)
- Content preview (2 lines, truncated)
- Tap to open the full entry in viewing modal

### Implementation

```tsx
{showOnThisDay && onThisDayEntries.length > 0 && (
  <View style={[s.dailyVerse, { backgroundColor: theme.surfaceAlt, borderColor: theme.accent }]}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="calendar" size={16} color={theme.warning} />
        <Text style={[s.dailyVerseLbl, { color: theme.warning }]}>В этот день</Text>
      </View>
      <TouchableOpacity onPress={() => setShowOnThisDay(false)}>
        <Ionicons name="close" size={18} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={onThisDayEntries}
      keyExtractor={i => i.id.toString()}
      contentContainerStyle={{ gap: 10, paddingTop: 10 }}
      renderItem={({ item }) => {
        const cs = catStyle(item.category);
        const year = item.created_at.split('-')[0];
        const pv = preview(item.content);
        return (
          <TouchableOpacity
            style={{
              width: 160, backgroundColor: theme.surface, borderRadius: 12,
              padding: 12, borderWidth: 1, borderColor: theme.border,
            }}
            onPress={() => setViewing(item)}
          >
            <Text style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
              {new Date(item.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <View style={[s.badge, { backgroundColor: cs.bg, alignSelf: 'flex-start', marginBottom: 6 }]}>
              <Ionicons name={catIcon(item.category)} size={12} color={cs.color} />
              <Text style={[s.badgeTxt, { color: cs.color, fontSize: 11 }]}>{item.category}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }} numberOfLines={1}>
              {item.title}
            </Text>
            {pv && <Text style={{ fontSize: 12, color: theme.textSec, marginTop: 4 }} numberOfLines={2}>{pv}</Text>}
          </TouchableOpacity>
        );
      }}
    />
  </View>
)}
```

### Toggle Persistence

Store user preference for showing/hiding "On This Day" in `app_settings`:

```tsx
// On load:
db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='show_on_this_day'")
  .then(r => { if (r?.value === '0') setShowOnThisDay(false); });

// On toggle:
db.runAsync("INSERT OR REPLACE INTO app_settings (key,value) VALUES ('show_on_this_day',?)", [show ? '1' : '0']);
```

### Edge Cases

- First year of use: No past entries → slider hidden (controlled by `onThisDayEntries.length > 0`)
- Entries with backdated dates: Query uses `created_at` which now can be user-set — this is correct behavior
- Performance: `strftime` is efficient in SQLite for this query volume

---

## Feature 6: Journal Full-Text Search with Filters

**Goal**: Enhance the existing journal entry search (currently simple `searchQ` filter on titles) to support full-text search across entry content, with filter options for category, folder, date range, and entries containing verses.

**User value**: Quickly find past reflections, prayers, or dreams by keyword or filter combination.

### Current State

Line ~1195 in App.tsx: `searchQ` state filters `filteredEntries` by title match only.

```tsx
const filteredEntries = entries.filter(e => {
  if (activeFolder && e.folder_id !== activeFolder) return false;
  if (searchQ) {
    const q = searchQ.toLowerCase();
    return e.title.toLowerCase().includes(q);
  }
  return true;
});
```

### Enhanced Search State

```tsx
const [searchQ, setSearchQ] = useState('');
const [searchFilters, setSearchFilters] = useState<{
  categories: Cat[];        // empty = all categories
  dateFrom: string | null;  // YYYY-MM-DD or null
  dateTo: string | null;    // YYYY-MM-DD or null
  hasVerses: boolean;       // only entries with embedded verses
}>({ categories: [], dateFrom: null, dateTo: null, hasVerses: false });
const [showFilters, setShowFilters] = useState(false);
```

### Enhanced Filter Logic

```tsx
const filteredEntries = useMemo(() => {
  return entries.filter(e => {
    // Folder filter (existing)
    if (activeFolder && e.folder_id !== activeFolder) return false;

    // Text search — search both title AND content
    if (searchQ) {
      const q = searchQ.toLowerCase();
      const titleMatch = e.title.toLowerCase().includes(q);
      const contentMatch = (() => {
        try {
          const blocks = JSON.parse(e.content) as Block[];
          return blocks.some(b => b.type === 'text' && b.content.toLowerCase().includes(q));
        } catch { return e.content.toLowerCase().includes(q); }
      })();
      if (!titleMatch && !contentMatch) return false;
    }

    // Category filter
    if (searchFilters.categories.length > 0 && !searchFilters.categories.includes(e.category as Cat)) return false;

    // Date range filter
    const entryDate = e.created_at.split('T')[0].split(' ')[0];
    if (searchFilters.dateFrom && entryDate < searchFilters.dateFrom) return false;
    if (searchFilters.dateTo && entryDate > searchFilters.dateTo) return false;

    // Verses filter
    if (searchFilters.hasVerses) {
      try {
        const blocks = JSON.parse(e.content) as Block[];
        if (!blocks.some(b => b.type === 'verse')) return false;
      } catch { return false; }
    }

    return true;
  });
}, [entries, activeFolder, searchQ, searchFilters]);
```

### UI: Filter Panel

Add a filter toggle button next to the search bar, and a collapsible filter panel below:

```
┌─────────────────────────────────────────┐
│ 🔍 [Search input...          ] [⚙️]    │
├─────────────────────────────────────────┤  ← collapsible
│ Категории: [Сон] [Откр.] [Мысль] [Мол.]│
│ Период: [c: __.__.____] [по: __.__.____]│
│ [✓] Только со стихами                   │
│                        [Сбросить]       │
└─────────────────────────────────────────┘
```

**Category filter chips**: Reuse the existing `catPicker` style. Multi-select (toggle on/off).

**Date range**: Two touchable fields that open the same mini calendar picker used in the backdated notes feature.

**"Only with verses" toggle**: Simple checkbox/switch.

**Reset button**: Clears all filters.

### Search Result Highlighting

When `searchQ` is active, highlight matched text in the entry list preview:

```tsx
const highlightMatch = (text: string, query: string) => {
  if (!query) return <Text>{text}</Text>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return <Text>{parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <Text key={i} style={{ backgroundColor: theme.warning + '40', fontWeight: '600' }}>{p}</Text>
      : <Text key={i}>{p}</Text>
  )}</Text>;
};
```

### Performance

- `useMemo` ensures filtering only runs when inputs change
- Content parsing (JSON.parse of blocks) is the main cost — for very large journals (1000+ entries), consider caching parsed blocks or using SQLite FTS
- For v1, in-memory filtering is sufficient for typical journal sizes (< 500 entries)

---

## Feature 9: Entry Pinning & Favorites

**Goal**: Allow users to pin important entries to the top of the journal list, and mark entries as favorites for quick access via a dedicated filter.

**User value**: Keep important spiritual insights, key prayers, or significant dreams always accessible without scrolling.

### Database Changes

Add two new columns to `entries` table via migration in `initDb()`:

```tsx
try {
  await db.execAsync('ALTER TABLE entries ADD COLUMN pinned BOOLEAN DEFAULT 0');
} catch (e) { /* Column already exists */ }
try {
  await db.execAsync('ALTER TABLE entries ADD COLUMN favorite BOOLEAN DEFAULT 0');
} catch (e) { /* Column already exists */ }
```

Update the `Entry` type:

```tsx
interface Entry {
  id: number; title: string; content: string; category: string;
  created_at: string; linked_verses: string; folder_id: number | null;
  pinned: number;    // 0 or 1
  favorite: number;  // 0 or 1
}
```

### Sorting Logic

Update the entries query to sort pinned entries first:

```tsx
const load = useCallback(async () => {
  setEntries(await db.getAllAsync<Entry>(
    'SELECT * FROM entries ORDER BY pinned DESC, created_at DESC'
  ));
  // ...
}, []);
```

### UI Changes

**1. Pin/Favorite actions in entry view modal**

Add pin and favorite buttons to the entry view modal header (line ~1249):

```tsx
<View style={{ flexDirection: 'row', gap: 12 }}>
  <TouchableOpacity onPress={() => togglePin(viewing!.id, viewing!.pinned)}>
    <Ionicons name={viewing?.pinned ? 'pin' : 'pin-outline'} size={22}
      color={viewing?.pinned ? theme.warning : theme.textMuted} />
  </TouchableOpacity>
  <TouchableOpacity onPress={() => toggleFav(viewing!.id, viewing!.favorite)}>
    <Ionicons name={viewing?.favorite ? 'heart' : 'heart-outline'} size={22}
      color={viewing?.favorite ? '#E53935' : theme.textMuted} />
  </TouchableOpacity>
  <TouchableOpacity onPress={() => viewing && openEdit(viewing)}>
    <Ionicons name="create-outline" size={24} color={theme.primary} />
  </TouchableOpacity>
</View>
```

**2. Toggle functions**

```tsx
const togglePin = async (id: number, current: number) => {
  await db.runAsync('UPDATE entries SET pinned=? WHERE id=?', [current ? 0 : 1, id]);
  load();
  if (viewing?.id === id) setViewing({ ...viewing!, pinned: current ? 0 : 1 });
};

const toggleFav = async (id: number, current: number) => {
  await db.runAsync('UPDATE entries SET favorite=? WHERE id=?', [current ? 0 : 1, id]);
  load();
  if (viewing?.id === id) setViewing({ ...viewing!, favorite: current ? 0 : 1 });
};
```

**3. Pin indicator in entry list card**

Add a pin icon to the card header for pinned entries:

```tsx
<View style={s.cardHdr}>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    {item.pinned ? <Ionicons name="pin" size={14} color={theme.warning} /> : null}
    <View style={[s.badge, { backgroundColor: cs.bg }]}>...</View>
  </View>
  <Text style={[s.cardDate, { color: theme.textMuted }]}>{fmtRelTime(item.created_at)}</Text>
</View>
```

**4. Favorites filter chip**

Add a "Favorites" chip in the folder filter bar:

```tsx
<TouchableOpacity
  style={[s.folderChip, showFavoritesOnly && { backgroundColor: '#E53935', borderColor: '#E53935' }]}
  onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
>
  <Ionicons name="heart" size={14} color={showFavoritesOnly ? C.textOn : '#E53935'} />
  <Text style={[s.folderChipTxt, showFavoritesOnly && s.folderChipTxtAct]}>Избранное</Text>
</TouchableOpacity>
```

**5. Swipe actions (optional enhancement)**

Long-press context menu with Pin/Favorite/Delete options instead of just Delete:

```tsx
onLongPress={() => {
  Alert.alert(item.title, '', [
    { text: item.pinned ? 'Открепить' : 'Закрепить', onPress: () => togglePin(item.id, item.pinned) },
    { text: item.favorite ? 'Убрать из избранного' : 'В избранное', onPress: () => toggleFav(item.id, item.favorite) },
    { text: 'Удалить', style: 'destructive', onPress: () => del(item.id) },
    { text: 'Отмена', style: 'cancel' },
  ]);
}}
```

### Export/Import Compatibility

Update the export/import logic to include the new `pinned` and `favorite` columns. Since they default to 0, old backups will import cleanly.

---

## Feature 10: Home Screen Widget (Daily Verse)

**Goal**: Android home screen widget showing the daily Bible verse, with a tap action that opens the app to the verse in the Bible reader.

**User value**: See the daily verse without opening the app. Quick spiritual touchpoint throughout the day.

### Required Package

```bash
npx expo install react-native-android-widget
```

This package provides an Expo-compatible way to create Android widgets in managed workflow.

### Configuration

**app.json** — add widget plugin:

```json
{
  "expo": {
    "plugins": [
      ["react-native-android-widget", {
        "widgets": [
          {
            "name": "DailyVerseWidget",
            "label": "Стих дня",
            "minWidth": "320dp",
            "minHeight": "120dp",
            "description": "Ежедневный библейский стих",
            "previewImage": "./assets/widget-preview.png",
            "updatePeriodMillis": 86400000
          }
        ]
      }]
    ]
  }
}
```

### Widget Component

Create `widget-task-handler.tsx` at project root:

```tsx
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

const BIBLE_VERSES_SAMPLE = [...]; // Small subset or use date-based lookup

function getDailyVerse() {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const idx = Math.abs((seed * 2654435761) | 0) % BIBLE_VERSES.length;
  return BIBLE_VERSES[idx];
}

function DailyVerseWidget() {
  const verse = getDailyVerse();
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        backgroundColor: '#FDFBF7',
        borderRadius: 16,
        padding: 16,
      }}
      clickAction="OPEN_APP"
    >
      <TextWidget
        text={`"${verse.text}"`}
        style={{ fontSize: 14, fontFamily: 'serif', color: '#2C1810' }}
        maxLines={4}
      />
      <TextWidget
        text={`— ${verse.book} ${verse.chapter}:${verse.verse}`}
        style={{ fontSize: 12, color: '#8B4513', marginTop: 8 }}
      />
      <TextWidget
        text="Стих дня • Divine Journal"
        style={{ fontSize: 10, color: '#8D7B6C', marginTop: 4 }}
      />
    </FlexWidget>
  );
}
```

### Widget Registration

Register the widget task handler in `index.js` or `App.tsx`:

```tsx
import { registerWidgetTaskHandler } from 'react-native-android-widget';

registerWidgetTaskHandler(async (widgetInfo) => {
  switch (widgetInfo.widgetName) {
    case 'DailyVerseWidget':
      return <DailyVerseWidget />;
    default:
      return <DailyVerseWidget />;
  }
});
```

### Challenges & Considerations

1. **Bible data access**: The widget runs in a separate JS context — it cannot access the full `BibleVerses.ts` (31K verses, ~3MB). Solutions:
   - Pre-compute 365 verses and bundle a small lookup table
   - Use SharedPreferences (via `react-native-shared-preferences`) to pass the daily verse from the main app
   - Use the same deterministic algorithm with a curated subset (~500 popular verses)

2. **Widget updates**: `updatePeriodMillis: 86400000` (24h) ensures daily refresh. Also trigger update from the app when it opens.

3. **Expo managed workflow**: `react-native-android-widget` requires config plugin support. Verify compatibility with Expo SDK 54 before implementing.

4. **Build impact**: Requires `expo prebuild` — the existing GitHub Actions workflow already does this.

### Fallback: Notification-Based "Widget"

If native widget proves too complex, enhance the existing daily notification to include the verse text:

```tsx
await Notifications.scheduleNotificationAsync({
  content: {
    title: '📖 Стих дня',
    body: `"${verse.text}" — ${verse.book} ${verse.chapter}:${verse.verse}`,
  },
  trigger: { type: 'daily', hour: 7, minute: 0 },
});
```

---

## Remaining from Original Plan

### Voice-to-Text (A2)

**Status**: Low priority — the device keyboard's built-in voice input (microphone button on Android/iOS) already provides this functionality with zero code changes.

**If custom implementation desired**: Use `expo-speech-recognition` for a dedicated microphone button in the entry editor toolbar.

### Cloud Backup (A4)

**Status**: Deferred — Export/Import (A1) covers 80% of the need.

**Options for future**:
- **Google Drive API** via `expo-auth-session` for automatic backup
- **Firebase** for real-time sync across devices
- **Simple**: Enhance current export to auto-save to a cloud-accessible folder

---

## Implementation Checklist

- [x] Phase 1: Critical UX fixes
- [x] Phase 2: Folder system
- [x] Phase 3: Statistics dashboard
- [x] Phase 4: Daily Bible verse + reminders
- [x] Phase 5: Theme system + font scaling
- [x] Phase 6: Advanced editing
- [x] Phase 7: Graph view
- [x] A1: Export/import data
- [x] Phase 8: Daily reading system
- [x] Phase 9: Backdated notes (custom date picker)
- [ ] **Feature 2**: "On This Day" memories slider
- [ ] **Feature 6**: Journal full-text search with filters
- [ ] **Feature 9**: Entry pinning & favorites
- [ ] **Feature 10**: Home screen widget
- [ ] A2: Voice-to-text (keyboard built-in suffices)
- [ ] A4: Cloud backup
