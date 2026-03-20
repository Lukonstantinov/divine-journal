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

export interface Block {
  id: string
  type: 'text' | 'verse' | 'divider'
  content: string
  boxColor?: string
  textStyle?: string
}

export interface VerseData {
  book: string
  chapter: number
  verse: number
  text: string
}

export const CATEGORIES = [
  { id: 'мысль', label: 'Мысль', color: '#8B4513' },
  { id: 'молитва', label: 'Молитва', color: '#5B4080' },
  { id: 'благодарность', label: 'Благодарность', color: '#2E7D32' },
  { id: 'откровение', label: 'Откровение', color: '#1565C0' },
  { id: 'исповедь', label: 'Исповедь', color: '#AD1457' },
  { id: 'цитата', label: 'Цитата', color: '#E65100' },
]

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
