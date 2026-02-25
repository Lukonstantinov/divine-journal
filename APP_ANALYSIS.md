# App Analysis — Bible Apps, Notes Apps, UI Patterns & Design Trends

Research conducted Feb 2026 for Divine Journal feature planning.

---

## 1. Top Bible Apps

### YouVersion (600M+ installs)
- **Swipeable daily verse hero card** with background image, shareable as social graphic
- 40K+ reading plans with streak tracking (fire icon + day count)
- 5 highlight colors; tap verse → inline color picker
- Horizontal swipe for chapter-to-chapter navigation
- Social: friends, shared plans, prayer lists
- Bottom tab nav: Home, Search, Plans, Videos, More

### Logos Bible
- **Passage Guide** — one-tap access to commentaries, cross-refs, word studies for any verse
- Unlimited custom highlight colors + underline/box styles
- Margin notes anchored to verse ranges with rich text
- Split-panel layout for side-by-side resources
- Every word is a hyperlink to Greek/Hebrew study

### Blue Letter Bible
- **500K+ cross-references** (Treasury of Scripture Knowledge) organized by phrase
- Highlights as **named categories** (e.g., "Prophecy" = purple, "Commands" = red)
- Tap any verse → Greek/Hebrew with grammatical breakdown
- 8,000+ verse-linked commentaries from 40+ authors
- Parallel Bible comparison; interlinear display

### Bible Gateway
- 200+ translations, clean reading view
- Topical Index for browsing by subject
- Smart passage lookup with abbreviation support
- Inline footnotes and cross-references

### Olive Tree
- Split-screen: up to 3 panels (Bible + commentary + dictionary)
- 12 preset + custom highlight colors
- Cloud sync across all devices

### Bible.is
- **Karaoke-style text sync** — words highlight as dramatized audio plays
- Full-cast audio Bible with sound effects
- 1,800+ languages; offline download support

---

## 2. Top Notes/Writing Apps

### Bear
- Swipe right on note → pin; swipe left → archive/delete (two-stage)
- Nested tags (#work/project/client) as organization system
- Beautiful serif/sans/mono fonts with adjustable line height
- Export: Markdown, PDF, HTML, DOCX

### Notion
- 50+ block types; slash commands to insert; drag-and-drop reorder via ⋮⋮ handle
- Databases with 6 view types (table, board, calendar, gallery, timeline, list)
- Pages within pages; relations between databases
- Offline mode (2025); mobile bottom toolbar for block editing

### Obsidian
- **Force-directed graph view** — nodes sized by connections, color-coded by folder/tag, filterable
- **Backlinks** panel on every note; unlinked mentions detection
- Local-first (plain Markdown files); 1,500+ plugins
- Mobile: swipe right → sidebar, swipe left → backlinks panel

### Day One (most relevant to Divine Journal)
- **On This Day** — horizontal card carousel of past entries from same date
- **Daily prompts** — swipeable inspiration cards
- Calendar view with dot indicators
- Multiple journals with custom colors/icons (like our folders)
- Swipe on entry → favorite/delete
- Floating "+" button; bottom sheet for options
- Streak tracking; end-to-end encrypted sync

### Craft
- Spring physics animations on every interaction; haptic feedback on drag
- Cards that expand into sub-pages
- Native SwiftUI; beautiful typography
- Daily Notes feature (journal + to-do hybrid)

### iA Writer
- **Focus mode** — dims all text except current sentence
- **Syntax highlighting** for prose — adjectives, nouns, verbs in different colors
- 4 carefully curated fonts; minimal UI by design

### Ulysses
- Typewriter mode (current line stays centered)
- Writing goals (word/character count targets)
- Library → Groups → Sheets hierarchy
- Export to PDF, DOCX, ePub, WordPress, Medium

---

## 3. Swipe/Slide-Off UI Patterns

### Swipeable Card Types

**Daily Content Carousel** (YouVersion, Day One):
- Horizontal scroll with snap-to-center; dot pagination
- Peek of adjacent cards (10-20px visible)

**Tinder-Style Stack**:
- Cards stacked with offset; swipe rotates card 5-15°
- Snap-back if swipe < 40% threshold
- Underlying card scales 0.95 → 1.0 as top card leaves

**Collapsible Hero Card** (Spotify, Apple Maps):
- Full card → swipe down → collapses to mini bar
- Tap mini bar or swipe up → restores full card
- Tab indicator designs: edge tab (40×8px pill), pill with icon/text, floating badge

### Email-Style Two-Stage Swipe (Gmail, Apple Mail)
- Short swipe (< 50%) → reveals action buttons
- Full swipe (> 50%) → executes primary action
- Color-coded: green = archive, red = delete, blue = flag
- Haptic feedback at threshold; max 2-3 actions per side

### Recommended Daily Verse Pattern
```
┌──────────────────────────────┐
│  ✦ Стих дня                  │
│  "Ибо так возлюбил Бог мир,  │
│   что отдал Сына Своего..."   │
│  Иоанна 3:16                │
│  [Открыть] [Поделиться]     │
│          ● ○ ○               │
└──────────────────────────────┘
         ↓ swipe down
┌──────────────────────────────┐
│  ✦ Стих дня ────────── ▲    │  ← collapsed mini bar
└──────────────────────────────┘
```

---

## 4. Modern Mobile UI Trends 2025-2026

### Cards & Layout
- 12-16px border radius; subtle shadows replacing borders
- Full-bleed cards with 12-16px horizontal margin
- Card depth hierarchy: primary elevated, secondary flat

### Animations & Haptics
- Spring physics (damping: 0.8, stiffness: 300) replacing linear/ease
- Skeleton/shimmer loading instead of spinners
- Haptics: light (tap), medium (threshold), heavy (destructive action)

### Bottom Sheets (2025 standard)
- Three detent positions: peek (10-15%), half (50%), full (90%)
- Drag handle: 36×5px rounded pill, centered
- Gradual background dimming; velocity-based dismissal
- Nested scrolling (only dismiss when at scroll top + pull down)

### FAB → Extended FAB
- Pill-shaped with icon + label (e.g., "+ Новая запись")
- Speed dial: tap FAB → smaller action buttons fan out
- Inline actions rising: swipe actions, contextual menus on long-press

### Dark Mode
- NOT pure black — use #121212 to #1A1A1A
- Elevation = lighter: L0 #121212, L1 #1E1E1E, L2 #232323, L3 #282828
- Text opacity: primary 87%, secondary 60%, disabled 38%
- Accent colors desaturated 10-20%; shadows replaced by borders

### Typography for Reading
- Serif fonts for long-form content (Georgia, Charter, Literata)
- Line height 1.5-1.7; paragraph spacing 0.5-1em
- Max line width 65-75 chars; font scaling 0.8x-1.5x
- Reader mode: adjustable margins, spacing, font choice, bg color

---

## Prioritized Feature Recommendations

### High Priority
1. **Swipeable Daily Verse Card** — collapsible hero card with carousel and mini bar (YouVersion + Spotify pattern)
2. **Named Highlight Categories** — labeled color groups like "Пророчество", "Обещание" (Blue Letter Bible)
3. **Swipe Actions on Entries** — swipe left = delete, swipe right = pin/favorite (Bear, Day One, Gmail)
4. **On This Day Memories** — horizontal card carousel of past entries (Day One)
5. **Bottom Sheets** — replace modal overlays with 3-detent draggable sheets (iOS standard)
6. **Reading Plan Progress UI** — progress bars, streak animation, completion checkmarks (YouVersion)

### Medium Priority
7. Spring physics animations for all transitions
8. Skeleton/shimmer loading states
9. Collapsible section headers with smooth animation
10. Serif font option for Bible reading; optimized line height/spacing

### Lower Priority
11. Focus/reader mode for Bible (iA Writer)
12. Daily prompts/reflections alongside verse (Day One)
13. Bible audio playback (Bible.is)
14. Split-panel Bible + notes view (Logos, Olive Tree)
