import Dexie, { type Table } from 'dexie'

export interface Entry {
  id?: number
  title: string
  content: string // JSON Block[]
  category: string
  created_at: string
  linked_verses: string // JSON array
  folder_id: number | null
  color: string | null
}

export interface Bookmark {
  id?: number
  verse_id: string
  created_at: string
}

export interface ReadingPlan {
  id?: number
  date: string
  book: string
  chapter: number
  completed: boolean
}

export interface DailyNote {
  id?: number
  date: string
  notes: string
}

export interface Fasting {
  id?: number
  start_date: string
  end_date: string
  notes: string
  created_at: string
}

export interface Folder {
  id?: number
  name: string
  color: string
  icon: string
  sort_order: number
}

export interface AppSetting {
  key: string
  value: string
}

export interface Achievement {
  id: string
  unlocked_at: string
  title: string
  description: string
}

export interface DailyReadingHistory {
  id?: number
  date: string
  completed: boolean
  verse_id: string
}

class DivineJournalDB extends Dexie {
  entries!: Table<Entry>
  bookmarks!: Table<Bookmark>
  reading_plan!: Table<ReadingPlan>
  daily_notes!: Table<DailyNote>
  fasting!: Table<Fasting>
  folders!: Table<Folder>
  app_settings!: Table<AppSetting>
  achievements!: Table<Achievement>
  daily_reading_history!: Table<DailyReadingHistory>

  constructor() {
    super('divine_journal')
    this.version(1).stores({
      entries: '++id, category, folder_id, created_at',
      bookmarks: '++id, &verse_id, created_at',
      reading_plan: '++id, date, [date+book+chapter]',
      daily_notes: '++id, &date',
      fasting: '++id, start_date, end_date',
      folders: '++id, sort_order',
      app_settings: '&key',
      achievements: '&id',
    })
    this.version(2).stores({
      entries: '++id, category, folder_id, created_at',
      bookmarks: '++id, &verse_id, created_at',
      reading_plan: '++id, date, [date+book+chapter]',
      daily_notes: '++id, &date',
      fasting: '++id, start_date, end_date',
      folders: '++id, sort_order',
      app_settings: '&key',
      achievements: '&id',
      daily_reading_history: '++id, &date',
    })
    // v3: same schema — reserved for future migrations
    this.version(3).stores({
      entries: '++id, category, folder_id, created_at',
      bookmarks: '++id, &verse_id, created_at',
      reading_plan: '++id, date, [date+book+chapter]',
      daily_notes: '++id, &date',
      fasting: '++id, start_date, end_date',
      folders: '++id, sort_order',
      app_settings: '&key',
      achievements: '&id',
      daily_reading_history: '++id, &date',
    })
  }
}

export const db = new DivineJournalDB()

// Settings helpers
export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  const row = await db.app_settings.get(key)
  return row?.value ?? defaultValue
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.app_settings.put({ key, value })
}
