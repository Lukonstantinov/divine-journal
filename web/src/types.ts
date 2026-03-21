export type Tab = 'journal' | 'bible' | 'calendar' | 'search' | 'settings'

export type ThemeId = 'light' | 'dark' | 'sepia'

export interface ThemeColors {
  bg: string
  card: string
  text: string
  subtext: string
  border: string
  primary: string
  accent: string
  tabBar: string
  tabBarBorder: string
}

export const THEMES: Record<ThemeId, ThemeColors> = {
  light: {
    bg: '#FDF6EE',
    card: '#FFFFFF',
    text: '#2C1810',
    subtext: '#7A5C4A',
    border: '#E8D5C0',
    primary: '#8B4513',
    accent: '#D4A574',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E8D5C0',
  },
  dark: {
    bg: '#1A0F0A',
    card: '#2C1810',
    text: '#F5E6D0',
    subtext: '#C4A882',
    border: '#4A2C1A',
    primary: '#D4A574',
    accent: '#E8C9A0',
    tabBar: '#1F0F09',
    tabBarBorder: '#3D1F0F',
  },
  sepia: {
    bg: '#F5E6D0',
    card: '#EDD9B8',
    text: '#3B2A1A',
    subtext: '#7A5C3A',
    border: '#C4A87A',
    primary: '#8B4513',
    accent: '#D4A574',
    tabBar: '#EDD9B8',
    tabBarBorder: '#C4A87A',
  },
}

// Rich text formatting range within a text block
export interface StyleRange {
  start: number
  end: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  highlight?: string // color key e.g. 'yellow'
  fontSize?: string  // 's'|'n'|'l'|'xl'
}

export interface Block {
  id: string
  type: 'text' | 'verse' | 'divider'
  content: string
  boxColor?: string
  textStyle?: string
  ranges?: StyleRange[]
}

export interface VerseData {
  book: string
  chapter: number
  verse: number
  verseEnd?: number
  text: string
  fontFamily?: string
  highlights?: Array<{ start: number; end: number; bold?: boolean; italic?: boolean; underline?: boolean; color?: string }>
}

export const CATEGORIES = [
  { id: 'мысль', label: 'Мысль', color: '#8B4513' },
  { id: 'молитва', label: 'Молитва', color: '#5B4080' },
  { id: 'благодарность', label: 'Благодарность', color: '#2E7D32' },
  { id: 'откровение', label: 'Откровение', color: '#1565C0' },
  { id: 'исповедь', label: 'Исповедь', color: '#AD1457' },
  { id: 'цитата', label: 'Цитата', color: '#E65100' },
]

// Verse box color presets (6)
export const VERSE_COLORS = [
  { id: 'gold',   label: 'Обещание',     bg: '#FFF8DC', border: '#DAA520' },
  { id: 'blue',   label: 'Пророчество',  bg: '#E8F0FE', border: '#1565C0' },
  { id: 'green',  label: 'Благодать',    bg: '#E8F5E9', border: '#2E7D32' },
  { id: 'purple', label: 'Прославление', bg: '#F3E5F5', border: '#7B1FA2' },
  { id: 'red',    label: 'Предостережение', bg: '#FFEBEE', border: '#C62828' },
  { id: 'teal',   label: 'Мудрость',     bg: '#E0F2F1', border: '#00695C' },
]

// Text highlight colors (5)
export const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Жёлтый',   color: '#FFF176' },
  { id: 'green',  label: 'Зелёный',  color: '#C8E6C9' },
  { id: 'blue',   label: 'Синий',    color: '#BBDEFB' },
  { id: 'pink',   label: 'Розовый',  color: '#F8BBD0' },
  { id: 'orange', label: 'Оранжевый', color: '#FFE0B2' },
]

// Verse / Bible font families (10)
export const VERSE_FONTS = [
  { id: 'serif',       label: 'Serif (Georgia)',       family: 'Georgia, Cambria, serif' },
  { id: 'sans',        label: 'Sans (Inter)',           family: 'Inter, sans-serif' },
  { id: 'mono',        label: 'Mono',                  family: 'JetBrains Mono, monospace' },
  { id: 'lora',        label: 'Lora',                  family: 'Lora, Georgia, serif' },
  { id: 'palatino',    label: 'Palatino',              family: 'Palatino Linotype, Palatino, serif' },
  { id: 'times',       label: 'Times New Roman',       family: 'Times New Roman, Times, serif' },
  { id: 'baskerville', label: 'Baskerville',           family: 'Baskerville, Georgia, serif' },
  { id: 'roboto',      label: 'Roboto',                family: 'Roboto, Inter, sans-serif' },
  { id: 'light',       label: 'Light (Helvetica)',     family: 'Helvetica Neue, Helvetica, sans-serif' },
  { id: 'condensed',   label: 'Condensed (Arial)',     family: 'Arial Narrow, Arial, sans-serif' },
]

// Folder colors (8 presets)
export const FOLDER_COLORS = [
  '#8B4513', '#5B4080', '#2E7D32', '#1565C0',
  '#AD1457', '#E65100', '#00695C', '#37474F',
]

// Folder icons (Lucide icon names)
export const FOLDER_ICONS = [
  'folder', 'book-open', 'heart', 'star',
  'cross', 'flame', 'sun', 'moon',
  'feather', 'bookmark',
]

// Achievements definitions
export const ACHIEVEMENTS = [
  {
    id: 'first_entry',
    title: 'Первый шаг',
    description: 'Создана первая запись',
    icon: '✍️',
    check: (stats: AchievementStats) => stats.totalEntries >= 1,
  },
  {
    id: 'streak_3',
    title: 'Три дня подряд',
    description: 'Записи 3 дня подряд',
    icon: '🔥',
    check: (stats: AchievementStats) => stats.entryStreak >= 3,
  },
  {
    id: 'streak_7',
    title: 'Неделя',
    description: 'Записи 7 дней подряд',
    icon: '⚡',
    check: (stats: AchievementStats) => stats.entryStreak >= 7,
  },
  {
    id: 'streak_30',
    title: 'Месяц верности',
    description: 'Записи 30 дней подряд',
    icon: '🏆',
    check: (stats: AchievementStats) => stats.entryStreak >= 30,
  },
  {
    id: 'saved_5',
    title: 'Собиратель',
    description: '5 стихов сохранено из чтения',
    icon: '📖',
    check: (stats: AchievementStats) => stats.savedFromReading >= 5,
  },
  {
    id: 'fasting_7',
    title: 'Пост',
    description: '7 дней поста',
    icon: '🙏',
    check: (stats: AchievementStats) => stats.fastingDays >= 7,
  },
  {
    id: 'chapters_10',
    title: 'Читатель',
    description: '10 глав прочитано по плану',
    icon: '📜',
    check: (stats: AchievementStats) => stats.completedReadings >= 10,
  },
  {
    id: 'chapters_100',
    title: 'Знаток Писания',
    description: '100 глав прочитано по плану',
    icon: '🌟',
    check: (stats: AchievementStats) => stats.completedReadings >= 100,
  },
]

export interface AchievementStats {
  totalEntries: number
  entryStreak: number
  savedFromReading: number
  fastingDays: number
  completedReadings: number
}

export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

export const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

export const WDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function fmtDateRu(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtRelTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин. назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} дн. назад`
  return fmtDateRu(dateStr.slice(0, 10))
}

export function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function catColor(cat: string): string {
  return CATEGORIES.find(c => c.id === cat)?.color ?? '#8B4513'
}

export function catLabel(cat: string): string {
  return CATEGORIES.find(c => c.id === cat)?.label ?? cat
}

export function parseBlocks(content: string): Block[] {
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  // legacy plain text
  if (content.trim()) {
    return [{ id: genId(), type: 'text', content }]
  }
  return []
}

export function getDailyVerseIndex(total: number, date?: Date): number {
  const d = date ?? new Date()
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  let h = (seed * 2654435761) | 0
  h = ((h >>> 16) ^ h) | 0
  return Math.abs(h) % total
}

// Calculate consecutive-day streak from an array of YYYY-MM-DD date strings
export function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const unique = [...new Set(dates)].sort().reverse()
  let streak = 0
  let cur = new Date()
  cur.setHours(0, 0, 0, 0)
  for (const ds of unique) {
    const d = new Date(ds + 'T00:00:00')
    const diff = Math.round((cur.getTime() - d.getTime()) / 86400000)
    if (diff <= 1) {
      streak++
      cur = d
    } else break
  }
  return streak
}

// Get verse font family CSS string by font id
export function getVerseFontFamily(fontId: string): string {
  return VERSE_FONTS.find(f => f.id === fontId)?.family ?? 'Georgia, serif'
}

// Get verse box color by id
export function getVerseColor(colorId: string) {
  return VERSE_COLORS.find(c => c.id === colorId) ?? VERSE_COLORS[0]
}

// Apply styled ranges to text, returns array of {text, style} spans
export function applyRanges(content: string, ranges: StyleRange[] = []): Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean; highlight?: string }> {
  if (!ranges.length) return [{ text: content }]

  // Build character-level style map
  const len = content.length
  const bold = new Array(len).fill(false)
  const italic = new Array(len).fill(false)
  const underline = new Array(len).fill(false)
  const highlight = new Array(len).fill(null)

  for (const r of ranges) {
    const s = Math.max(0, r.start)
    const e = Math.min(len, r.end)
    for (let i = s; i < e; i++) {
      if (r.bold) bold[i] = true
      if (r.italic) italic[i] = true
      if (r.underline) underline[i] = true
      if (r.highlight) highlight[i] = r.highlight
    }
  }

  // Group consecutive chars with same style
  const spans: Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean; highlight?: string }> = []
  let i = 0
  while (i < len) {
    let j = i + 1
    while (
      j < len &&
      bold[j] === bold[i] &&
      italic[j] === italic[i] &&
      underline[j] === underline[i] &&
      highlight[j] === highlight[i]
    ) j++
    spans.push({
      text: content.slice(i, j),
      bold: bold[i] || undefined,
      italic: italic[i] || undefined,
      underline: underline[i] || undefined,
      highlight: highlight[i] || undefined,
    })
    i = j
  }
  return spans
}
