import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Alert, StatusBar, KeyboardAvoidingView, Platform, Dimensions, AppState, Keyboard, Share } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { BIBLE_VERSES, BIBLE_BOOKS, BibleVerse, BibleBook } from './BibleVerses';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { File as ExpoFile, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import { getFullDailyReading, type DailyReadingResult, type CustomPattern } from './DailyReading';

const { width: SW } = Dimensions.get('window');

const THEMES = {
  light: {
    primary: '#8B4513', primaryLight: '#A0522D', bg: '#FDFBF7', surface: '#FFFFFF', surfaceAlt: '#F5F2ED',
    text: '#2C1810', textSec: '#5D4037', textMuted: '#8D7B6C', textOn: '#FFFFFF',
    accent: '#D4A574', accentLight: '#E8D5B7', success: '#4A7C59', error: '#8B3A3A', warning: '#B8860B',
    border: '#DED5C8', borderLight: '#EDE8E0', dreamBg: '#E8F4EA', revBg: '#FFF8E7', thoughtBg: '#F0F4F8', prayerBg: '#F5E6F0',
    statusBar: 'dark-content' as const,
  },
  dark: {
    primary: '#D4A574', primaryLight: '#E8D5B7', bg: '#1A1410', surface: '#2C241E', surfaceAlt: '#3A302A',
    text: '#FDFBF7', textSec: '#C4B5A5', textMuted: '#8D7B6C', textOn: '#1A1410',
    accent: '#8B4513', accentLight: '#3A302A', success: '#66BB6A', error: '#EF5350', warning: '#FFB74D',
    border: '#4A3F35', borderLight: '#3A302A', dreamBg: '#1E2E1E', revBg: '#2E2A1A', thoughtBg: '#1E2228', prayerBg: '#2A1E2E',
    statusBar: 'light-content' as const,
  },
  sepia: {
    primary: '#6B4226', primaryLight: '#8B5E3C', bg: '#F4ECD8', surface: '#FAF5E8', surfaceAlt: '#EDE4D0',
    text: '#3E2723', textSec: '#5D4037', textMuted: '#8D6E63', textOn: '#FAF5E8',
    accent: '#A67B5B', accentLight: '#D7C4A5', success: '#558B2F', error: '#C62828', warning: '#F57F17',
    border: '#C8B99A', borderLight: '#DDD2BC', dreamBg: '#E4ECD0', revBg: '#F5EDD0', thoughtBg: '#E4E8D8', prayerBg: '#EDE0E8',
    statusBar: 'dark-content' as const,
  },
};

type ThemeId = keyof typeof THEMES;
type ThemeColors = Omit<typeof THEMES.light, 'statusBar'> & { statusBar: 'dark-content' | 'light-content' };

const ThemeContext = React.createContext<{ theme: ThemeColors; themeId: ThemeId; setThemeId: (id: ThemeId) => void; fontScale: number; setFontScale: (s: number) => void; bibleFont: string; setBibleFont: (f: string) => void }>({
  theme: THEMES.light, themeId: 'light', setThemeId: () => {}, fontScale: 1, setFontScale: () => {}, bibleFont: 'serif', setBibleFont: () => {},
});
const useTheme = () => React.useContext(ThemeContext);

type StatusBarStyle = 'dark-content' | 'light-content';

// Default colors for StyleSheet (static — overridden inline with theme)
const C = THEMES.light;

const VERSE_COLORS = [
  { id: 'gold', bg: '#FEF9F3', border: '#D4A574' }, { id: 'blue', bg: '#EBF5FF', border: '#5B9BD5' },
  { id: 'green', bg: '#E8F5E9', border: '#66BB6A' }, { id: 'purple', bg: '#F3E5F5', border: '#AB47BC' },
  { id: 'red', bg: '#FFEBEE', border: '#EF5350' }, { id: 'teal', bg: '#E0F2F1', border: '#26A69A' },
];

const VERSE_FONTS = [
  { id: 'serif', name: 'Serif', family: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  { id: 'sans', name: 'Sans', family: Platform.OS === 'ios' ? 'Helvetica' : 'sans-serif' },
  { id: 'roboto', name: 'Roboto', family: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto' },
];
const HIGHLIGHT_COLORS = [
  { id: 'yellow', bg: '#FFF59D' }, { id: 'green', bg: '#A5D6A7' },
  { id: 'blue', bg: '#90CAF9' }, { id: 'pink', bg: '#F48FB1' }, { id: 'orange', bg: '#FFCC80' },
];
const FONT_SIZES = [{ id: 's', sz: 14 }, { id: 'n', sz: 16 }, { id: 'l', sz: 18 }, { id: 'xl', sz: 22 }];
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

type Cat = 'сон' | 'откровение' | 'мысль' | 'молитва';
type Tab = 'journal' | 'bible' | 'calendar' | 'search' | 'settings';

interface VerseHighlight { start: number; end: number; bold?: boolean; italic?: boolean; underline?: boolean; color?: string; }
interface VerseData { book: string; chapter: number; verse: number; verseEnd?: number; text: string; fontFamily?: string; highlights?: VerseHighlight[]; }
interface TStyle { bold?: boolean; italic?: boolean; underline?: boolean; fontSize?: string; highlight?: string; }
interface StyleRange { start: number; end: number; bold?: boolean; italic?: boolean; underline?: boolean; highlight?: string; }
interface Block { id: string; type: 'text' | 'verse' | 'divider'; content: string; boxColor?: string; textStyle?: TStyle; ranges?: StyleRange[]; }

const TEXT_HIGHLIGHTS = [
  { id: 'yellow', bg: '#FFF9C4', label: 'Жёлтый' }, { id: 'green', bg: '#C8E6C9', label: 'Зелёный' },
  { id: 'blue', bg: '#BBDEFB', label: 'Голубой' }, { id: 'pink', bg: '#F8BBD0', label: 'Розовый' },
  { id: 'orange', bg: '#FFE0B2', label: 'Оранжевый' },
];
interface Entry { id: number; title: string; content: string; category: Cat; created_at: string; linked_verses: string; folder_id: number | null; }
interface Reading { id: number; date: string; book: string; chapter: number; completed: boolean; }
interface Fasting { id: number; start_date: string; end_date: string | null; notes: string; }
interface Folder { id: number; name: string; color: string; icon: string; sort_order: number; }
interface NavTarget { book: string; chapter: number; }

interface ReadStats {
  totalReads: number;
  currentStreak: number;
  savedFromReading: number;
  hasCustomPattern: boolean;
  uniquePsalmsRead: number;
}

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

let db: SQLite.SQLiteDatabase;
let dbInitPromise: Promise<void> | null = null;

const FOLDER_ICONS = ['folder', 'heart', 'star', 'flame', 'moon', 'sunny', 'book', 'bulb', 'leaf', 'diamond'] as const;
const FOLDER_COLORS = [
  { id: 'brown', color: '#8B4513' }, { id: 'blue', color: '#5B9BD5' }, { id: 'green', color: '#4A7C59' },
  { id: 'purple', color: '#7B4B94' }, { id: 'red', color: '#8B3A3A' }, { id: 'teal', color: '#26A69A' },
  { id: 'orange', color: '#B8860B' }, { id: 'pink', color: '#C2185B' },
];

const initDb = async () => {
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    db = await SQLite.openDatabaseAsync('divine_journal.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, category TEXT DEFAULT 'мысль', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, linked_verses TEXT DEFAULT '[]');
      CREATE TABLE IF NOT EXISTS bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, verse_id TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS reading_plan (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, completed BOOLEAN DEFAULT 0, UNIQUE(date, book, chapter));
      CREATE TABLE IF NOT EXISTS daily_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, notes TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS fasting (id INTEGER PRIMARY KEY AUTOINCREMENT, start_date TEXT NOT NULL, end_date TEXT, notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT DEFAULT '#8B4513', icon TEXT DEFAULT 'folder', sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS daily_verse_history (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, verse_id TEXT NOT NULL, seen BOOLEAN DEFAULT 0);
      CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS daily_reading_history (date TEXT PRIMARY KEY, read_at TEXT NOT NULL, verse_of_day_ref TEXT, psalms_read TEXT, proverbs_read TEXT);
      CREATE TABLE IF NOT EXISTS achievements (id TEXT PRIMARY KEY, unlocked_at TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL);
    `);
    try { await db.execAsync('ALTER TABLE entries ADD COLUMN folder_id INTEGER DEFAULT NULL'); } catch (e) {}
  })();
  return dbInitPromise;
};

// Notification configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const scheduleReadingReminder = async (hour: number, minute: number) => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Время чтения',
      body: 'Откройте Духовный дневник для ежедневного чтения',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
};

const cancelReadingReminder = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

const requestNotificationPermission = async (): Promise<boolean> => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// Auto-backup helpers
type BackupInterval = 'daily' | 'weekly' | 'monthly' | 'custom';
type BackupFileInfo = { name: string; uri: string; date: string; sizeKB: number };

const BACKUP_DIR_NAME = 'backups';
const BACKUP_INTERVALS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };

const getBackupDir = (): Directory => {
  const dir = new Directory(Paths.document, BACKUP_DIR_NAME);
  if (!dir.exists) dir.create();
  return dir;
};

const collectBackupData = async () => ({
  version: '5.1',
  exportDate: new Date().toISOString(),
  entries: await db.getAllAsync('SELECT * FROM entries'),
  bookmarks: await db.getAllAsync('SELECT * FROM bookmarks'),
  readingPlan: await db.getAllAsync('SELECT * FROM reading_plan'),
  dailyNotes: await db.getAllAsync('SELECT * FROM daily_notes'),
  fasting: await db.getAllAsync('SELECT * FROM fasting'),
  folders: await db.getAllAsync('SELECT * FROM folders'),
  dailyVerseHistory: await db.getAllAsync('SELECT * FROM daily_verse_history'),
  appSettings: await db.getAllAsync('SELECT * FROM app_settings'),
  dailyReadingHistory: await db.getAllAsync('SELECT * FROM daily_reading_history'),
  achievements: await db.getAllAsync('SELECT * FROM achievements'),
});

const listBackupFiles = async (): Promise<BackupFileInfo[]> => {
  try {
    const dir = getBackupDir();
    const items = dir.list();
    const files: BackupFileInfo[] = [];
    for (const item of items) {
      if (item instanceof Directory) continue;
      const fname = item.name;
      if (!fname.endsWith('.json')) continue;
      try {
        const content = await item.text();
        const parsed = JSON.parse(content);
        const sizeKB = Math.round(content.length / 1024);
        files.push({ name: fname, uri: item.uri, date: parsed.exportDate || '', sizeKB });
      } catch { files.push({ name: fname, uri: item.uri, date: '', sizeKB: 0 }); }
    }
    files.sort((a, b) => b.date.localeCompare(a.date));
    return files;
  } catch { return []; }
};

const cleanupOldBackups = async (maxFiles: number) => {
  const files = await listBackupFiles();
  if (files.length <= maxFiles) return;
  const toDelete = files.slice(maxFiles);
  for (const f of toDelete) {
    try { new ExpoFile(f.uri).delete(); } catch {}
  }
};

const performAutoBackup = async (maxFiles: number = 10): Promise<boolean> => {
  try {
    const data = await collectBackupData();
    const json = JSON.stringify(data, null, 2);
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const dir = getBackupDir();
    const file = new ExpoFile(dir, `backup_${ts}.json`);
    file.write(json);
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('lastAutoBackupDate', ?)", [now.toISOString()]);
    await cleanupOldBackups(maxFiles);
    return true;
  } catch (e) { console.warn('Auto-backup failed:', e); return false; }
};

const shouldAutoBackup = async (): Promise<boolean> => {
  try {
    const enabled = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='autoBackupEnabled'");
    if (!enabled || enabled.value !== '1') return false;
    const lastRow = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='lastAutoBackupDate'");
    if (!lastRow) return true; // never backed up
    const intervalRow = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='autoBackupInterval'");
    const interval = intervalRow?.value || 'daily';
    const customDaysRow = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='autoBackupCustomDays'");
    const days = BACKUP_INTERVALS[interval] || parseInt(customDaysRow?.value || '1') || 1;
    const last = new Date(lastRow.value).getTime();
    const elapsed = Date.now() - last;
    return elapsed >= days * 86400000;
  } catch { return false; }
};

const tryAutoBackup = async () => {
  try {
    if (!(await shouldAutoBackup())) return;
    const maxRow = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='autoBackupMaxFiles'");
    const maxFiles = parseInt(maxRow?.value || '10') || 10;
    await performAutoBackup(maxFiles);
  } catch {}
};

async function getDailyReadingStatus(todayStr: string): Promise<{ isRead: boolean; streak: number }> {
  try {
    const row = await db.getFirstAsync<{ date: string }>(
      'SELECT date FROM daily_reading_history WHERE date=?', [todayStr]
    );
    const isRead = !!row;
    const rows = await db.getAllAsync<{ date: string }>(
      'SELECT date FROM daily_reading_history ORDER BY date DESC LIMIT 31'
    );
    let streak = 0;
    let expected = isRead ? todayStr : (() => {
      const d = new Date(todayStr + 'T00:00:00'); d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    for (const r of rows) {
      if (r.date === expected) {
        streak++;
        const d = new Date(expected + 'T00:00:00'); d.setDate(d.getDate() - 1);
        expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else if (r.date < expected) break;
    }
    return { isRead, streak };
  } catch { return { isRead: false, streak: 0 }; }
}

async function markDailyRead(todayStr: string, verseRef: string, psalmsChapters: number[], proverbsRefs: string[]): Promise<void> {
  try {
    await db.runAsync(
      'INSERT OR REPLACE INTO daily_reading_history (date, read_at, verse_of_day_ref, psalms_read, proverbs_read) VALUES (?,?,?,?,?)',
      [todayStr, new Date().toISOString(), verseRef, JSON.stringify(psalmsChapters), JSON.stringify(proverbsRefs)]
    );
  } catch (e) { console.warn('markDailyRead error:', e); }
}

async function getReadStats(todayStr: string): Promise<ReadStats> {
  try {
    const historyRows = await db.getAllAsync<{ date: string; psalms_read: string }>(
      'SELECT date, psalms_read FROM daily_reading_history ORDER BY date DESC LIMIT 31'
    );
    const totalRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM daily_reading_history');
    const totalReads = totalRow?.c || 0;
    const { streak: currentStreak } = await getDailyReadingStatus(todayStr);
    const savedRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key='saved_from_reading_count'"
    );
    const savedFromReading = parseInt(savedRow?.value || '0');
    const patternRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key='daily_custom_pattern'"
    );
    const hasCustomPattern = !!(patternRow?.value && patternRow.value !== 'null');
    const psalmSet = new Set<number>();
    for (const row of historyRows) {
      try { const chs = JSON.parse(row.psalms_read || '[]'); chs.forEach((c: number) => psalmSet.add(c)); } catch {}
    }
    const uniquePsalmsRead = psalmSet.size;
    return { totalReads, currentStreak, savedFromReading, hasCustomPattern, uniquePsalmsRead };
  } catch { return { totalReads: 0, currentStreak: 0, savedFromReading: 0, hasCustomPattern: false, uniquePsalmsRead: 0 }; }
}

async function checkAndUnlockAchievements(stats: ReadStats): Promise<typeof ACHIEVEMENTS[number][]> {
  const unlocked: typeof ACHIEVEMENTS[number][] = [];
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

const getDailyVerse = (date: Date): BibleVerse => {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const idx = Math.abs((seed * 2654435761) | 0) % BIBLE_VERSES.length;
  return BIBLE_VERSES[idx];
};

const genId = () => Math.random().toString(36).substr(2, 9);
const parseBlocks = (c: string): Block[] => { try { const p = JSON.parse(c); if (Array.isArray(p) && p[0]?.type) return p; } catch {} return [{ id: genId(), type: 'text', content: c || '' }]; };
const getVColor = (id?: string) => VERSE_COLORS.find(c => c.id === id) || VERSE_COLORS[0];
const getFSize = (id?: string) => FONT_SIZES.find(s => s.id === id)?.sz || 16;
const getVFont = (id?: string) => VERSE_FONTS.find(f => f.id === id) || VERSE_FONTS[0];
const scaledSz = (base: number, scale: number) => Math.round(base * scale);
const fmtDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const fmtDateRu = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

const fmtRelTime = (dateStr: string): string => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

const getMonthDays = (y: number, m: number) => {
  const days: Date[] = [], first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const pad = first.getDay() === 0 ? 6 : first.getDay() - 1;
  for (let i = pad - 1; i >= 0; i--) days.push(new Date(y, m, -i));
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d));
  while (days.length < 42) days.push(new Date(y, m + 1, days.length - last.getDate() - pad + 1));
  return days;
};

const catStyle = (c: Cat) => ({ сон: { bg: C.dreamBg, color: C.success }, откровение: { bg: C.revBg, color: C.warning }, мысль: { bg: C.thoughtBg, color: C.primary }, молитва: { bg: C.prayerBg, color: '#7B4B94' } }[c]);
const catIcon = (c: Cat) => ({ сон: 'moon', откровение: 'flash', мысль: 'bulb', молитва: 'heart' }[c]);

// SafeArea Wrapper Component
const SafeAreaWrapper = ({ children }: { children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = StatusBar.currentHeight || 0;
  const topPad = Math.max(insets.top, statusBarHeight);

  return (
    <View style={[s.container, {
      paddingTop: topPad,
    }]}>
      {children}
    </View>
  );
};

const AppContent = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('journal');
  const [ready, setReady] = useState(false);
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null);

  useEffect(() => { initDb().then(() => { setReady(true); tryAutoBackup(); }); }, []);

  const navigateToBible = (book: string, chapter: number) => {
    setNavTarget({ book, chapter });
    setTab('bible');
  };

  const clearNavTarget = () => setNavTarget(null);

  if (!ready) return (
    <View style={[s.loading, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <Ionicons name="book" size={48} color={theme.primary} />
      <Text style={[s.loadingTxt, { color: theme.textSec }]}>Загрузка...</Text>
    </View>
  );

  return (
    <>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      {tab === 'journal' && <JournalScreen onNavigate={navigateToBible} />}
      {tab === 'bible' && <BibleScreen navTarget={navTarget} clearNavTarget={clearNavTarget} />}
      {tab === 'calendar' && <CalendarScreen onNavigate={navigateToBible} />}
      {tab === 'search' && <SearchScreen onNavigate={navigateToBible} />}
      {tab === 'settings' && <SettingsScreen />}
      <View style={[s.tabBar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {[['journal','book','Дневник'],['bible','library','Библия'],['calendar','calendar','Календарь'],['search','search','Поиск'],['settings','settings','Ещё']].map(([t,i,l]) => (
          <TouchableOpacity key={t} style={s.tabBtn} onPress={() => setTab(t as Tab)}>
            <Ionicons name={tab === t ? i : `${i}-outline`} size={22} color={tab === t ? theme.primary : theme.textMuted} />
            <Text style={[s.tabLbl, { color: theme.textMuted }, tab === t && { color: theme.primary, fontWeight: '600' }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
};

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeId, setThemeId] = useState<ThemeId>('light');
  const [fontScale, setFontScale] = useState(1);
  const [bibleFont, setBibleFont] = useState('serif');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        await initDb();
        const t = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='theme'");
        if (t && t.value in THEMES) setThemeId(t.value as ThemeId);
        const fs = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='fontScale'");
        if (fs) setFontScale(parseFloat(fs.value));
        const bf = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='bibleFont'");
        if (bf && VERSE_FONTS.some(f => f.id === bf.value)) setBibleFont(bf.value);
      } catch (e) {}
      setLoaded(true);
    };
    loadPrefs();
  }, []);

  const handleSetTheme = (id: ThemeId) => {
    setThemeId(id);
    db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('theme', ?)", [id]);
  };

  const handleSetFontScale = (s: number) => {
    setFontScale(s);
    db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('fontScale', ?)", [String(s)]);
  };

  const handleSetBibleFont = (f: string) => {
    setBibleFont(f);
    db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('bibleFont', ?)", [f]);
  };

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeId], themeId, setThemeId: handleSetTheme, fontScale, setFontScale: handleSetFontScale, bibleFont, setBibleFont: handleSetBibleFont }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default function App() {
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SafeAreaWrapper>
          <AppContent />
        </SafeAreaWrapper>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Rich Text Toolbar
const RTToolbar = ({ style, onToggle, onSize, onHighlight, onDivider }: { style: TStyle; onToggle: (k: keyof TStyle) => void; onSize: (id: string) => void; onHighlight: (color: string | null) => void; onDivider: () => void }) => {
  const { theme } = useTheme();
  const [showSize, setShowSize] = useState(false);
  const [showHl, setShowHl] = useState(false);
  return (
    <View style={[s.toolbar, { backgroundColor: theme.surfaceAlt, borderTopColor: theme.border }]}>
      {[['bold','B','bold'],['italic','I','italic'],['underline','U','underline']].map(([k,t,st]) => (
        <TouchableOpacity key={k} style={[s.toolBtn, style[k as keyof TStyle] && s.toolBtnAct]} onPress={() => onToggle(k as keyof TStyle)}>
          <Text style={[s.toolTxt, { color: theme.textSec }, style[k as keyof TStyle] && s.toolTxtAct, st === 'bold' && {fontWeight:'bold'}, st === 'italic' && {fontStyle:'italic'}, st === 'underline' && {textDecorationLine:'underline'}]}>{t}</Text>
        </TouchableOpacity>
      ))}
      <View style={[s.toolDiv, { backgroundColor: theme.border }]} />
      <TouchableOpacity style={s.toolBtn} onPress={() => { setShowSize(!showSize); setShowHl(false); }}>
        <Text style={[s.toolTxt, { color: theme.textSec }]}>Aa</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.toolBtn, style.highlight ? { backgroundColor: TEXT_HIGHLIGHTS.find(h => h.id === style.highlight)?.bg } : undefined]} onPress={() => { setShowHl(!showHl); setShowSize(false); }}>
        <Ionicons name="color-fill" size={18} color={style.highlight ? theme.text : theme.textSec} />
      </TouchableOpacity>
      <View style={[s.toolDiv, { backgroundColor: theme.border }]} />
      <TouchableOpacity style={s.toolBtn} onPress={onDivider}>
        <Ionicons name="remove" size={18} color={theme.textSec} />
      </TouchableOpacity>
      {showSize && <View style={[s.dropdown, { backgroundColor: theme.surface }]}>{FONT_SIZES.map(f => (
        <TouchableOpacity key={f.id} style={s.dropItem} onPress={() => { onSize(f.id); setShowSize(false); }}>
          <Text style={{ fontSize: f.sz - 4, color: theme.text }}>{f.sz}px</Text>
        </TouchableOpacity>
      ))}</View>}
      {showHl && <View style={[s.dropdown, { right: 50, flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, minWidth: 160, backgroundColor: theme.surface }]}>
        <TouchableOpacity style={{ padding: 6 }} onPress={() => { onHighlight(null); setShowHl(false); }}>
          <Ionicons name="close-circle" size={22} color={theme.textMuted} />
        </TouchableOpacity>
        {TEXT_HIGHLIGHTS.map(h => (
          <TouchableOpacity key={h.id} style={[{ width: 30, height: 30, borderRadius: 15, backgroundColor: h.bg, justifyContent: 'center', alignItems: 'center' }, style.highlight === h.id && { borderWidth: 2, borderColor: theme.primary }]} onPress={() => { onHighlight(h.id); setShowHl(false); }} />
        ))}
      </View>}
    </View>
  );
};

// Highlighted Verse Text Renderer
const HighlightedVerseText = ({ text, highlights, fontFamily, baseStyle }: { text: string; highlights?: VerseHighlight[]; fontFamily: string; baseStyle: any }) => {
  if (!highlights || highlights.length === 0) return <Text style={[baseStyle, { fontFamily }]}>{text}</Text>;
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  sorted.forEach((hl, idx) => {
    if (hl.start > lastEnd) parts.push(<Text key={`t${idx}`} style={[baseStyle, { fontFamily }]}>{text.slice(lastEnd, hl.start)}</Text>);
    const hlStyle: any = { fontFamily };
    if (hl.bold) hlStyle.fontWeight = 'bold';
    if (hl.italic) hlStyle.fontStyle = 'italic';
    if (hl.underline) hlStyle.textDecorationLine = 'underline';
    if (hl.color) { const hc = HIGHLIGHT_COLORS.find(c => c.id === hl.color); if (hc) hlStyle.backgroundColor = hc.bg; }
    parts.push(<Text key={`h${idx}`} style={[baseStyle, hlStyle]}>{text.slice(hl.start, hl.end)}</Text>);
    lastEnd = hl.end;
  });
  if (lastEnd < text.length) parts.push(<Text key="last" style={[baseStyle, { fontFamily }]}>{text.slice(lastEnd)}</Text>);
  return <Text>{parts}</Text>;
};

// Verse Format Modal
const VerseFormatModal = ({ visible, onClose, verseData, onSave }: { visible: boolean; onClose: () => void; verseData: VerseData | null; onSave: (data: VerseData) => void }) => {
  const { theme } = useTheme();
  const [fontId, setFontId] = useState('serif');
  const [highlights, setHighlights] = useState<VerseHighlight[]>([]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [hlBold, setHlBold] = useState(false);
  const [hlItalic, setHlItalic] = useState(false);
  const [hlUnderline, setHlUnderline] = useState(false);
  const [hlColor, setHlColor] = useState<string | null>(null);
  const [showFontPicker, setShowFontPicker] = useState(false);

  useEffect(() => {
    if (verseData) { setFontId(verseData.fontFamily || 'serif'); setHighlights(verseData.highlights || []); }
    setRangeStart(''); setRangeEnd(''); setHlBold(false); setHlItalic(false); setHlUnderline(false); setHlColor(null);
  }, [verseData, visible]);

  if (!verseData) return null;
  const text = verseData.text;
  const font = getVFont(fontId);
  const ref = verseData.verseEnd ? `${verseData.book} ${verseData.chapter}:${verseData.verse}-${verseData.verseEnd}` : `${verseData.book} ${verseData.chapter}:${verseData.verse}`;

  const addHighlight = () => {
    const start = parseInt(rangeStart) - 1, end = parseInt(rangeEnd);
    if (isNaN(start) || isNaN(end) || start < 0 || end > text.length || start >= end) { Alert.alert('Ошибка', `Диапазон 1-${text.length}`); return; }
    const newHl: VerseHighlight = { start, end };
    if (hlBold) newHl.bold = true; if (hlItalic) newHl.italic = true; if (hlUnderline) newHl.underline = true; if (hlColor) newHl.color = hlColor;
    setHighlights([...highlights, newHl]);
    setRangeStart(''); setRangeEnd(''); setHlBold(false); setHlItalic(false); setHlUnderline(false); setHlColor(null);
  };

  const handleSave = () => { onSave({ ...verseData, fontFamily: fontId, highlights: highlights.length > 0 ? highlights : undefined }); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent><SafeAreaProvider><SafeAreaView style={[s.modal, { backgroundColor: theme.bg }]}>
      <View style={[s.modalHdr, { borderBottomColor: theme.border }]}><TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity><Text style={[s.modalTitle, { color: theme.text }]}>Форматирование</Text><TouchableOpacity onPress={handleSave}><Text style={[s.saveTxt, { color: theme.primary }]}>Готово</Text></TouchableOpacity></View>
      <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 20 }}>
        <Text style={[s.verseRef, { color: theme.primary }]}>{ref}</Text>
        <View style={[s.fmtPreview, { backgroundColor: theme.surface }]}><HighlightedVerseText text={text} highlights={highlights} fontFamily={font.family} baseStyle={[s.fmtPreviewTxt, { color: theme.text }]} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Text style={[s.label, { color: theme.textSec }]}>Шрифт:</Text>
          <TouchableOpacity style={s.fontBtn} onPress={() => setShowFontPicker(!showFontPicker)}><Text style={[s.fontBtnTxt, { fontFamily: font.family, color: theme.primary }]}>{font.name}</Text><Ionicons name="chevron-down" size={16} color={theme.primary} /></TouchableOpacity>
        </View>
        {showFontPicker && <View style={s.fontPickerList}>{VERSE_FONTS.map(f => (
          <TouchableOpacity key={f.id} style={[s.fontPickerItem, { backgroundColor: theme.surfaceAlt }, fontId === f.id && { backgroundColor: theme.accentLight }]} onPress={() => { setFontId(f.id); setShowFontPicker(false); }}>
            <Text style={[s.fontPickerSample, { fontFamily: f.family, color: theme.text }]}>Аа</Text><Text style={[s.fontPickerName, { color: theme.textSec }]}>{f.name}</Text>
            {fontId === f.id && <Ionicons name="checkmark" size={20} color={theme.primary} style={{ marginLeft: 'auto' }} />}
          </TouchableOpacity>
        ))}</View>}
        <Text style={[s.label, { marginTop: 20, color: theme.textSec }]}>Выделение слов</Text>
        <Text style={[s.fmtHint, { color: theme.textMuted }]}>Позиции символов (1-{text.length})</Text>
        <View style={s.fmtRangeRow}>
          <View style={s.fmtRangeInput}><Text style={[s.fmtRangeLbl, { color: theme.textSec }]}>От:</Text><TextInput style={[s.fmtRangeField, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} value={rangeStart} onChangeText={setRangeStart} keyboardType="number-pad" placeholder="1" placeholderTextColor={theme.textMuted} /></View>
          <View style={s.fmtRangeInput}><Text style={[s.fmtRangeLbl, { color: theme.textSec }]}>До:</Text><TextInput style={[s.fmtRangeField, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} value={rangeEnd} onChangeText={setRangeEnd} keyboardType="number-pad" placeholder={String(text.length)} placeholderTextColor={theme.textMuted} /></View>
        </View>
        <View style={s.fmtStyleRow}>
          <TouchableOpacity style={[s.fmtStyleBtn, { backgroundColor: theme.surface, borderColor: theme.border }, hlBold && s.fmtStyleBtnAct]} onPress={() => setHlBold(!hlBold)}><Text style={[s.fmtStyleTxt, { fontWeight: 'bold', color: theme.text }, hlBold && s.fmtStyleTxtAct]}>B</Text></TouchableOpacity>
          <TouchableOpacity style={[s.fmtStyleBtn, { backgroundColor: theme.surface, borderColor: theme.border }, hlItalic && s.fmtStyleBtnAct]} onPress={() => setHlItalic(!hlItalic)}><Text style={[s.fmtStyleTxt, { fontStyle: 'italic', color: theme.text }, hlItalic && s.fmtStyleTxtAct]}>I</Text></TouchableOpacity>
          <TouchableOpacity style={[s.fmtStyleBtn, { backgroundColor: theme.surface, borderColor: theme.border }, hlUnderline && s.fmtStyleBtnAct]} onPress={() => setHlUnderline(!hlUnderline)}><Text style={[s.fmtStyleTxt, { textDecorationLine: 'underline', color: theme.text }, hlUnderline && s.fmtStyleTxtAct]}>U</Text></TouchableOpacity>
        </View>
        <Text style={[s.fontLabel, { color: theme.textMuted }]}>Цвет:</Text>
        <View style={s.fmtColorRow}>
          <TouchableOpacity style={[s.fmtColorItem, { backgroundColor: 'transparent', borderColor: theme.border }, !hlColor && { borderColor: theme.primary, borderWidth: 3 }]} onPress={() => setHlColor(null)}><Ionicons name="close" size={16} color={theme.textMuted} /></TouchableOpacity>
          {HIGHLIGHT_COLORS.map(c => <TouchableOpacity key={c.id} style={[s.fmtColorItem, { backgroundColor: c.bg, borderColor: theme.border }, hlColor === c.id && { borderWidth: 3, borderColor: theme.primary }]} onPress={() => setHlColor(c.id)} />)}
        </View>
        <TouchableOpacity style={[s.fmtAddBtn, { backgroundColor: theme.primary }]} onPress={addHighlight}><Ionicons name="add-circle" size={20} color={theme.textOn} /><Text style={[s.fmtAddTxt, { color: theme.textOn }]}>Добавить</Text></TouchableOpacity>
        {highlights.length > 0 && <>{highlights.map((hl, idx) => (
          <View key={idx} style={[s.fmtHlItem, { backgroundColor: theme.surface }]}>
            <View style={{ flex: 1 }}><Text style={[s.fmtHlRange, { color: theme.primary }]}>{hl.start + 1}-{hl.end}</Text><Text style={[s.fmtHlPreview, { color: theme.textSec }]} numberOfLines={1}>"{text.slice(hl.start, hl.end)}"</Text>
              <View style={s.fmtHlStyles}>{hl.bold && <Text style={[s.fmtHlTag, { color: theme.textMuted, backgroundColor: theme.surfaceAlt }]}>Ж</Text>}{hl.italic && <Text style={[s.fmtHlTag, { color: theme.textMuted, backgroundColor: theme.surfaceAlt }]}>К</Text>}{hl.underline && <Text style={[s.fmtHlTag, { color: theme.textMuted, backgroundColor: theme.surfaceAlt }]}>П</Text>}{hl.color && <View style={[s.fmtHlColorDot, { backgroundColor: HIGHLIGHT_COLORS.find(c => c.id === hl.color)?.bg }]} />}</View>
            </View>
            <TouchableOpacity onPress={() => setHighlights(highlights.filter((_, i) => i !== idx))}><Ionicons name="trash-outline" size={20} color={theme.error} /></TouchableOpacity>
          </View>
        ))}</>}
      </ScrollView>
    </SafeAreaView></SafeAreaProvider></Modal>
  );
};

// Daily Reading Card
const DailyReadingCard = ({ isRead, streak, onOpenReading }: { isRead: boolean; streak: number; onOpenReading: () => void }) => {
  const { theme } = useTheme();
  const dateStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <View style={[s.readingCard, { backgroundColor: isRead ? '#E8F5E9' : '#FFF8E7', borderColor: isRead ? '#4A7C59' : theme.accent }]}>
      {streak >= 1 && <View style={[s.readingStreakBadge, { backgroundColor: theme.accentLight }]}><Text style={{ fontSize: 12, color: theme.warning }}>🔥 {streak} дн.</Text></View>}
      <Text style={[s.readingCardTitle, { color: theme.text }]}>📖 Ежедневное чтение</Text>
      <Text style={[s.readingCardDate, { color: theme.textMuted }]}>{dateStr}</Text>
      {isRead ? (
        <View style={[s.readingCardBtn, { backgroundColor: '#E8F5E9' }]}>
          <Text style={[s.readingCardBtnTxt, { color: '#4A7C59' }]}>✓ Прочитано сегодня</Text>
        </View>
      ) : (
        <TouchableOpacity style={[s.readingCardBtn, { backgroundColor: theme.accent }]} onPress={onOpenReading}>
          <Text style={[s.readingCardBtnTxt, { color: '#FFFFFF' }]}>Читать на сегодня →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Daily Reading Modal
const DailyReadingModal = ({ visible, reading, isRead, onClose, onMarkRead, onSaveToJournal }: {
  visible: boolean; reading: DailyReadingResult | null; isRead: boolean;
  onClose: () => void; onMarkRead: () => void; onSaveToJournal: (title: string, text: string, verseRef: string) => void;
}) => {
  const { theme } = useTheme();
  const [expandedPsalms, setExpandedPsalms] = useState<Set<number>>(new Set([0]));
  const [containerH, setContainerH] = useState(Dimensions.get('window').height);
  const [headerH, setHeaderH] = useState(57);

  if (!reading) return null;

  const togglePsalm = (idx: number) => {
    setExpandedPsalms(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const shareVerse = (text: string, reference: string) => {
    Share.share({ message: `"${text}" — ${reference}` });
  };

  const day = new Date().getDate();
  const scrollH = containerH - headerH;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaProvider>
      <SafeAreaView style={[s.modal, { backgroundColor: theme.bg }]} onLayout={e => setContainerH(e.nativeEvent.layout.height)}>
        <View style={[s.modalHdr, { borderBottomColor: theme.border }]} onLayout={e => setHeaderH(e.nativeEvent.layout.height)}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
          <Text style={[s.modalTitle, { color: theme.text }]}>Ежедневное чтение</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={{ height: scrollH }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator overScrollMode="always">
          {/* Section 1: Verse of the Day */}
          <View style={s.drSection}>
            <Text style={[s.drSectionHdr, { color: theme.text }]}>✨ Стих дня</Text>
            <View style={s.drVerseCard}>
              <Text style={[s.drVerseRef, { color: theme.primary }]}>{reading.verseOfDay.reference}</Text>
              <Text style={[s.drVerseTxt, { color: theme.text }]}>"{reading.verseOfDay.text}"</Text>
              <View style={s.drVerseActions}>
                <TouchableOpacity style={[s.drActionBtn, { backgroundColor: theme.accentLight }]} onPress={() => onSaveToJournal(reading.verseOfDay.reference, reading.verseOfDay.text, reading.verseOfDay.reference)}>
                  <Text style={[s.drActionBtnTxt, { color: theme.primary }]}>💾 В журнал</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.drActionBtn, { backgroundColor: theme.accentLight }]} onPress={() => shareVerse(reading.verseOfDay.text, reading.verseOfDay.reference)}>
                  <Text style={[s.drActionBtnTxt, { color: theme.primary }]}>📤 Поделиться</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Section 2: Date Pattern Verses */}
          <View style={s.drSection}>
            <Text style={[s.drSectionHdr, { color: theme.text }]}>📅 Стихи {day}:{day}</Text>
            {reading.datePatternVerses.length === 0 ? (
              <Text style={[s.drEmptyTxt, { color: theme.textMuted }]}>Стихи с таким паттерном не найдены</Text>
            ) : reading.datePatternVerses.map((v, i) => (
              <View key={i} style={[s.drPatternCard, { backgroundColor: theme.surface }]}>
                <Text style={[s.drVerseRef, { color: theme.primary, marginBottom: 6 }]}>{v.reference}</Text>
                <Text style={{ fontSize: 14, color: theme.textSec, lineHeight: 20 }}>{v.text}</Text>
                <View style={[s.drVerseActions, { marginTop: 8 }]}>
                  <TouchableOpacity style={[s.drActionBtn, { backgroundColor: theme.accentLight }]} onPress={() => onSaveToJournal(v.reference, v.text, v.reference)}>
                    <Text style={[s.drActionBtnTxt, { color: theme.primary }]}>💾 В журнал</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Section 3: Psalms */}
          <View style={s.drSection}>
            <Text style={[s.drSectionHdr, { color: theme.text }]}>🎵 Псалмы на сегодня</Text>
            {reading.psalms.length === 0 ? (
              <Text style={[s.drEmptyTxt, { color: theme.textMuted }]}>Псалмы не найдены</Text>
            ) : reading.psalms.map((psalm, idx) => (
              <View key={idx} style={[s.drPsalmCard, { backgroundColor: theme.surface }]}>
                <View style={s.drPsalmHdr}>
                  <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => togglePsalm(idx)}>
                    <Ionicons name={expandedPsalms.has(idx) ? 'chevron-down' : 'chevron-forward'} size={20} color={theme.primary} />
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: theme.text }}>{psalm.title}</Text>
                    <Text style={{ fontSize: 12, color: theme.textMuted }}>{psalm.verses.length} ст.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ marginLeft: 8, padding: 4 }} onPress={() => {
                    const fullText = psalm.verses.map(v => `${v.number}. ${v.text}`).join('\n');
                    onSaveToJournal(psalm.title, fullText, psalm.title);
                  }}>
                    <Text style={{ fontSize: 13, color: theme.primary }}>💾</Text>
                  </TouchableOpacity>
                </View>
                {expandedPsalms.has(idx) && (
                  <View style={s.drPsalmBody}>
                    {psalm.verses.map(v => (
                      <View key={v.number} style={s.drPsalmVerse}>
                        <Text style={[s.drPsalmVNum, { color: theme.primary }]}>{v.number}</Text>
                        <Text style={[s.drPsalmVTxt, { color: theme.text, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }]}>{v.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Section 4: Proverbs */}
          <View style={s.drSection}>
            <Text style={[s.drSectionHdr, { color: theme.text }]}>💡 Притчи на сегодня</Text>
            {reading.proverbs.length === 0 ? (
              <Text style={[s.drEmptyTxt, { color: theme.textMuted }]}>Притчи не найдены</Text>
            ) : reading.proverbs.map((p, i) => (
              <View key={i} style={[s.drPatternCard, { backgroundColor: theme.surface }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <View style={{ backgroundColor: p.type === 'by_day' ? theme.accentLight : theme.dreamBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, color: p.type === 'by_day' ? theme.primary : theme.success, fontWeight: '600' }}>{p.type === 'by_day' ? 'По дню' : 'Случайная'}</Text>
                  </View>
                  <Text style={[s.drVerseRef, { color: theme.primary }]}>{p.reference}</Text>
                </View>
                <Text style={{ fontSize: 14, color: theme.textSec, lineHeight: 20 }}>{p.text}</Text>
                <View style={[s.drVerseActions, { marginTop: 8 }]}>
                  <TouchableOpacity style={[s.drActionBtn, { backgroundColor: theme.accentLight }]} onPress={() => onSaveToJournal(p.reference, p.text, p.reference)}>
                    <Text style={[s.drActionBtnTxt, { color: theme.primary }]}>💾 В журнал</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Mark as read button - inside scroll so layout is always bounded */}
          {isRead ? (
            <View style={[s.drMarkBtn, { backgroundColor: theme.borderLight }]}>
              <Text style={[s.drMarkBtnTxt, { color: theme.textMuted }]}>✓ Прочитано</Text>
            </View>
          ) : (
            <TouchableOpacity style={[s.drMarkBtn, { backgroundColor: '#4A7C59' }]} onPress={onMarkRead}>
              <Text style={[s.drMarkBtnTxt, { color: '#FFFFFF' }]}>✅ Отметить прочитанным</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

// Journal Screen
const JournalScreen = ({ onNavigate }: { onNavigate: (book: string, chapter: number) => void }) => {
  const { theme, bibleFont, fontScale } = useTheme();
  const bibleFontFamily = getVFont(bibleFont).family;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([{ id: genId(), type: 'text', content: '' }]);
  const [cat, setCat] = useState<Cat>('мысль');
  const [vpick, setVpick] = useState(false);
  const [insertId, setInsertId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Entry | null>(null);
  // Entry date state (for backdated entries)
  const [entryDate, setEntryDate] = useState(fmtDate(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [colorPick, setColorPick] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tStyle, setTStyle] = useState<TStyle>({});
  const [fasts, setFasts] = useState<Fasting[]>([]);
  const [formatVerse, setFormatVerse] = useState<{ blockId: string; data: VerseData } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const blockPositions = useRef<Record<string, number>>({});
  const [sel, setSel] = useState<{start: number; end: number}>({start: 0, end: 0});
  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<number | null>(null);
  const [entryFolder, setEntryFolder] = useState<number | null>(null);
  const [showFolderMgmt, setShowFolderMgmt] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0].color);
  const [folderIcon, setFolderIcon] = useState<string>('folder');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  // Daily verse state
  const [dailyVerse, setDailyVerse] = useState<BibleVerse | null>(null);
  const [verseStreak, setVerseStreak] = useState(0);
  const [showDailyVerse, setShowDailyVerse] = useState(true);
  // Daily reading state
  const [dailyIsRead, setDailyIsRead] = useState(false);
  const [readingStreak, setReadingStreak] = useState(0);
  const [showDailyReadingModal, setShowDailyReadingModal] = useState(false);
  const [dailyReadingResult, setDailyReadingResult] = useState<DailyReadingResult | null>(null);
  const [customPattern, setCustomPattern] = useState<CustomPattern | null>(null);
  // View modal layout state
  const [viewContainerH, setViewContainerH] = useState(Dimensions.get('window').height);
  const [viewHeaderH, setViewHeaderH] = useState(57);
  // Search & UX state
  const [searchQ, setSearchQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    const today = new Date();
    const verse = getDailyVerse(today);
    setDailyVerse(verse);
    const todayStr = fmtDate(today);
    db.runAsync('INSERT OR IGNORE INTO daily_verse_history (date, verse_id, seen) VALUES (?,?,1)', [todayStr, verse.id]);
    db.getAllAsync<{ date: string }>('SELECT date FROM daily_verse_history WHERE seen=1 ORDER BY date DESC')
      .then(rows => {
        let streak = 0;
        let expected = todayStr;
        for (const r of rows) {
          if (r.date === expected) { streak++; const d = new Date(expected); d.setDate(d.getDate() - 1); expected = fmtDate(d); }
          else break;
        }
        setVerseStreak(streak);
      });
  }, []);

  useEffect(() => {
    const today = new Date();
    const todayStr = fmtDate(today);
    db.getFirstAsync<{value: string}>("SELECT value FROM app_settings WHERE key='daily_custom_pattern'")
      .then(row => {
        let pattern: CustomPattern | null = null;
        if (row?.value) { try { pattern = JSON.parse(row.value); } catch {} }
        setCustomPattern(pattern);
        try {
          const result = getFullDailyReading(today, pattern || undefined);
          setDailyReadingResult(result);
        } catch (e) { console.warn('DailyReading compute error:', e); }
      });
    getDailyReadingStatus(todayStr).then(({ isRead, streak }) => {
      setDailyIsRead(isRead);
      setReadingStreak(streak);
    });
  }, []);

  const load = useCallback(async () => {
    setEntries(await db.getAllAsync<Entry>('SELECT * FROM entries ORDER BY created_at DESC'));
    setFasts(await db.getAllAsync<Fasting>('SELECT * FROM fasting'));
    setFolders(await db.getAllAsync<Folder>('SELECT * FROM folders ORDER BY sort_order ASC'));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const folderEntryCount = useCallback((folderId: number) => entries.filter(e => e.folder_id === folderId).length, [entries]);

  const saveFolder = async () => {
    if (!folderName.trim()) return Alert.alert('Ошибка', 'Введите название папки');
    if (editingFolder) {
      await db.runAsync('UPDATE folders SET name=?, color=?, icon=? WHERE id=?', [folderName.trim(), folderColor, folderIcon, editingFolder.id]);
    } else {
      const maxOrder = folders.length > 0 ? Math.max(...folders.map(f => f.sort_order)) + 1 : 0;
      await db.runAsync('INSERT INTO folders (name, color, icon, sort_order) VALUES (?,?,?,?)', [folderName.trim(), folderColor, folderIcon, maxOrder]);
    }
    setFolderName(''); setFolderColor(FOLDER_COLORS[0].color); setFolderIcon('folder'); setEditingFolder(null);
    load();
  };

  const delFolder = (f: Folder) => Alert.alert(`Удалить «${f.name}»?`, 'Записи не будут удалены', [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Удалить', style: 'destructive', onPress: async () => {
      await db.runAsync('UPDATE entries SET folder_id=NULL WHERE folder_id=?', [f.id]);
      await db.runAsync('DELETE FROM folders WHERE id=?', [f.id]);
      if (activeFolder === f.id) setActiveFolder(null);
      load();
    }},
  ]);

  const startEditFolder = (f: Folder) => { setEditingFolder(f); setFolderName(f.name); setFolderColor(f.color); setFolderIcon(f.icon); };
  useEffect(() => { load(); }, [load]);

  const isFastingEntry = (e: Entry) => {
    const entryDate = e.created_at.split('T')[0].split(' ')[0];
    return fasts.some(f => {
      const start = f.start_date;
      const end = f.end_date || fmtDate(new Date());
      return entryDate >= start && entryDate <= end;
    });
  };

  const saveVerseToJournal = async (title: string, text: string, _verseRef: string) => {
    try {
      const block: Block = { id: genId(), type: 'verse', content: JSON.stringify({
        book: '', chapter: 0, verse: 0, text
      }), boxColor: 'gold' };
      const textBlock: Block = { id: genId(), type: 'text', content: '' };
      await db.runAsync(
        'INSERT INTO entries (title, content, category, linked_verses, folder_id) VALUES (?,?,?,?,?)',
        [title, JSON.stringify([block, textBlock]), 'откровение', '[]', null]
      );
      const cur = await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='saved_from_reading_count'");
      const newCount = (parseInt(cur?.value || '0')) + 1;
      await db.runAsync("INSERT OR REPLACE INTO app_settings (key,value) VALUES ('saved_from_reading_count',?)", [String(newCount)]);
      load();
      Alert.alert('Сохранено ✓', 'Стих добавлен в журнал');
    } catch (e: any) { Alert.alert('Ошибка', e?.message || 'Не удалось сохранить'); }
  };

  const handleMarkRead = async () => {
    const todayStr = fmtDate(new Date());
    const psalmsChapters = dailyReadingResult?.psalms.map(p => p.chapter) || [];
    const proverbsRefs = dailyReadingResult?.proverbs.map(p => `${p.chapter}:${p.verse}`) || [];
    await markDailyRead(todayStr, dailyReadingResult?.verseOfDay.reference || '', psalmsChapters, proverbsRefs);
    setDailyIsRead(true);
    const { streak } = await getDailyReadingStatus(todayStr);
    setReadingStreak(streak);
    const stats = await getReadStats(todayStr);
    const newAchievements = await checkAndUnlockAchievements(stats);
    if (newAchievements.length > 0) {
      Alert.alert('🏆 Достижение разблокировано!', newAchievements.map(a => `${a.emoji} ${a.title}`).join('\n'));
    }
    setShowDailyReadingModal(false);
  };

  const save = async () => {
    if (!title.trim()) return Alert.alert('Ошибка', 'Введите заголовок');
    try {
      const cJson = JSON.stringify(blocks);
      const linked = blocks.filter(b => b.type === 'verse').map(b => { try { const d = JSON.parse(b.content); return { book: d.book, chapter: d.chapter, verse: d.verse }; } catch { return null; } }).filter(Boolean);
      const timePart = editing ? (editing.created_at.includes('T') ? editing.created_at.split('T')[1] : editing.created_at.split(' ').slice(1).join(' ')) || '12:00:00' : new Date().toTimeString().slice(0, 8);
      const timestamp = entryDate + ' ' + timePart;
      if (editing) await db.runAsync('UPDATE entries SET title=?, content=?, category=?, linked_verses=?, folder_id=?, created_at=? WHERE id=?', [title, cJson, cat, JSON.stringify(linked), entryFolder, timestamp, editing.id]);
      else await db.runAsync('INSERT INTO entries (title, content, category, linked_verses, folder_id, created_at) VALUES (?,?,?,?,?,?)', [title, cJson, cat, JSON.stringify(linked), entryFolder, timestamp]);
      reset(); load();
    } catch (e: any) { Alert.alert('Ошибка сохранения', e?.message || 'Не удалось сохранить'); }
  };

  const del = (id: number) => Alert.alert('Удалить?', '', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: async () => { await db.runAsync('DELETE FROM entries WHERE id=?', [id]); load(); setViewing(null); }}]);

  const openEdit = (e?: Entry) => {
    if (e) {
      setEditing(e); setTitle(e.title); setBlocks(parseBlocks(e.content)); setCat(e.category); setEntryFolder(e.folder_id);
      const dateStr = e.created_at.split('T')[0].split(' ')[0];
      setEntryDate(dateStr);
      const d = new Date(dateStr + 'T12:00:00');
      setPickerMonth(d.getMonth()); setPickerYear(d.getFullYear());
    } else {
      reset(); setBlocks([{ id: genId(), type: 'text', content: '' }]); setEntryFolder(activeFolder);
      const now = new Date();
      setEntryDate(fmtDate(now)); setPickerMonth(now.getMonth()); setPickerYear(now.getFullYear());
    }
    setShowDatePicker(false); setViewing(null); setModal(true);
  };

  const reset = () => { setEditing(null); setTitle(''); setBlocks([{ id: genId(), type: 'text', content: '' }]); setCat('мысль'); setModal(false); setActiveId(null); setTStyle({}); setEntryFolder(null); setDirty(false); const now = new Date(); setEntryDate(fmtDate(now)); setShowDatePicker(false); setPickerMonth(now.getMonth()); setPickerYear(now.getFullYear()); };

  const confirmClose = () => {
    if (dirty) {
      Alert.alert('Несохранённые изменения', 'Вы уверены, что хотите закрыть? Изменения будут потеряны.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Закрыть', style: 'destructive', onPress: reset },
      ]);
    } else { reset(); }
  };

  const updateBlock = (id: string, txt: string) => { setDirty(true); setBlocks(bs => bs.map(b => {
    if (b.id !== id) return b;
    const upd: Block = { ...b, content: txt };
    if (b.ranges?.length) {
      const delta = txt.length - b.content.length;
      if (delta !== 0) {
        const cp = Math.max(0, sel.start - Math.max(0, delta));
        upd.ranges = b.ranges.map(r => {
          if (cp >= r.end) return r;
          if (cp <= r.start) return { ...r, start: r.start + delta, end: r.end + delta };
          return { ...r, end: Math.max(r.start + 1, r.end + delta) };
        }).filter(r => r.start >= 0 && r.end <= txt.length && r.start < r.end);
      }
    }
    return upd;
  })); };
  const toggleStyle = (k: keyof TStyle) => {
    if (activeId && sel.start < sel.end && (k === 'bold' || k === 'italic' || k === 'underline')) {
      setBlocks(bs => bs.map(b => {
        if (b.id !== activeId) return b;
        const ranges = [...(b.ranges || [])];
        let fullyCovered = true;
        for (let i = sel.start; i < sel.end && fullyCovered; i++) {
          if (!ranges.some(r => r[k] && r.start <= i && r.end > i)) fullyCovered = false;
        }
        if (fullyCovered && ranges.length > 0) {
          const nr: StyleRange[] = [];
          for (const r of ranges) {
            if (!r[k] || r.end <= sel.start || r.start >= sel.end) { nr.push(r); continue; }
            if (r.start < sel.start) nr.push({ ...r, end: sel.start });
            if (r.end > sel.end) nr.push({ ...r, start: sel.end });
          }
          return { ...b, ranges: nr };
        }
        return { ...b, ranges: [...ranges, { start: sel.start, end: sel.end, [k]: true }] };
      }));
      setTStyle(p => ({ ...p, [k]: !p[k] }));
    } else {
      const nv = !tStyle[k]; setTStyle(p => ({ ...p, [k]: nv }));
      if (activeId) setBlocks(bs => bs.map(b => b.id === activeId ? { ...b, textStyle: { ...b.textStyle, [k]: nv } } : b));
    }
  };
  const setFontSize = (sz: string) => { setTStyle(p => ({ ...p, fontSize: sz })); if (activeId) setBlocks(bs => bs.map(b => b.id === activeId ? { ...b, textStyle: { ...b.textStyle, fontSize: sz } } : b)); };
  const setHighlight = (color: string | null) => {
    if (activeId && sel.start < sel.end) {
      setBlocks(bs => bs.map(b => {
        if (b.id !== activeId) return b;
        const ranges = [...(b.ranges || [])];
        if (color) return { ...b, ranges: [...ranges, { start: sel.start, end: sel.end, highlight: color }] };
        const nr: StyleRange[] = [];
        for (const r of ranges) {
          if (!r.highlight || r.end <= sel.start || r.start >= sel.end) { nr.push(r); continue; }
          if (r.start < sel.start) nr.push({ ...r, end: sel.start });
          if (r.end > sel.end) nr.push({ ...r, start: sel.end });
        }
        return { ...b, ranges: nr };
      }));
    } else {
      if (activeId) setBlocks(bs => bs.map(b => b.id === activeId ? { ...b, textStyle: { ...b.textStyle, highlight: color || undefined } } : b));
    }
    setTStyle(p => ({ ...p, highlight: color || undefined }));
  };
  const addDivider = () => { const div: Block = { id: genId(), type: 'divider', content: '' }; if (activeId) { setBlocks(bs => { const i = bs.findIndex(b => b.id === activeId); const n = [...bs]; n.splice(i + 1, 0, div); return n; }); } else { setBlocks(bs => [...bs, div]); } };
  const moveBlock = (idx: number, dir: -1 | 1) => setBlocks(bs => { const n = [...bs]; const t = idx + dir; if (t < 0 || t >= n.length) return bs; [n[idx], n[t]] = [n[t], n[idx]]; return n; });

  const addVerses = (vs: BibleVerse[], col: string = 'gold') => {
    const sorted = [...vs].sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter || a.verse - b.verse);
    const newBs: Block[] = [];
    let grp: BibleVerse[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const p = sorted[i-1], c = sorted[i];
      if (p.book === c.book && p.chapter === c.chapter && c.verse === p.verse + 1) grp.push(c);
      else { newBs.push(mkVerseBlock(grp, col)); grp = [c]; }
    }
    newBs.push(mkVerseBlock(grp, col));
    const nb: Block = { id: genId(), type: 'text', content: '' };
    setBlocks(bs => { const i = insertId ? bs.findIndex(b => b.id === insertId) : -1; if (i !== -1) { const n = [...bs]; n.splice(i + 1, 0, ...newBs, nb); return n; } return [...bs, ...newBs, nb]; });
    setVpick(false); setInsertId(null);
  };

  const mkVerseBlock = (vs: BibleVerse[], col: string): Block => {
    const f = vs[0], l = vs[vs.length - 1];
    return { id: genId(), type: 'verse', content: JSON.stringify({ book: f.book, chapter: f.chapter, verse: f.verse, verseEnd: vs.length > 1 ? l.verse : undefined, text: vs.map(v => `${v.verse}. ${v.text}`).join(' ') }), boxColor: col };
  };

  const updateColor = (id: string, col: string) => { setBlocks(bs => bs.map(b => b.id === id ? { ...b, boxColor: col } : b)); setColorPick(null); };
  const removeBlock = (id: string) => setBlocks(bs => { const f = bs.filter(b => b.id !== id); return f.length === 0 || !f.some(b => b.type === 'text') ? [{ id: genId(), type: 'text', content: '' }] : f; });

  const openVerseFormat = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (block?.type === 'verse') { try { setFormatVerse({ blockId, data: JSON.parse(block.content) as VerseData }); } catch {} }
  };
  const saveVerseFormat = (data: VerseData) => { if (formatVerse) { setBlocks(bs => bs.map(b => b.id === formatVerse.blockId ? { ...b, content: JSON.stringify(data) } : b)); setFormatVerse(null); } };

  const preview = (c: string) => parseBlocks(c).filter(b => b.type === 'text').map(b => b.content).join(' ').substring(0, 100);
  const vCount = (c: string) => parseBlocks(c).filter(b => b.type === 'verse').length;

  const renderVerse = (b: Block) => { try { const d = JSON.parse(b.content) as VerseData, vc = getVColor(b.boxColor), font = getVFont(d.fontFamily), ref = d.verseEnd ? `${d.book} ${d.chapter}:${d.verse}-${d.verseEnd}` : `${d.book} ${d.chapter}:${d.verse}`; return <View style={[s.verseView, { backgroundColor: vc.bg, borderLeftColor: vc.border }]}><View style={s.verseHdr}><Ionicons name="book" size={16} color={vc.border} /><Text style={[s.verseRef, { color: vc.border }]}>{ref}</Text>{d.fontFamily && <Text style={s.verseFontLabel}>{font.name}</Text>}</View><HighlightedVerseText text={d.text} highlights={d.highlights} fontFamily={font.family} baseStyle={s.verseTxt} /></View>; } catch { return null; } };

  const renderText = (b: Block) => {
    if (!b.content) return null;
    const base: any = { ...s.viewTxt, color: theme.text, fontSize: scaledSz(b.textStyle?.fontSize ? getFSize(b.textStyle.fontSize) : 16, fontScale) };
    if (b.textStyle?.fontSize) base.fontSize = scaledSz(getFSize(b.textStyle.fontSize), fontScale);
    if (b.textStyle?.highlight) { const hl = TEXT_HIGHLIGHTS.find(h => h.id === b.textStyle?.highlight); if (hl) base.backgroundColor = hl.bg; }
    if (!b.ranges?.length) {
      if (b.textStyle?.bold) base.fontWeight = 'bold'; if (b.textStyle?.italic) base.fontStyle = 'italic'; if (b.textStyle?.underline) base.textDecorationLine = 'underline';
      return <Text style={base}>{b.content}</Text>;
    }
    const len = b.content.length, pts = new Set<number>([0, len]);
    b.ranges.forEach(r => { pts.add(Math.max(0, r.start)); pts.add(Math.min(len, r.end)); });
    const sorted = Array.from(pts).sort((a, c) => a - c);
    const parts: React.ReactNode[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const ps = sorted[i], pe = sorted[i + 1];
      const st: any = { ...base };
      if (b.textStyle?.bold) st.fontWeight = 'bold'; if (b.textStyle?.italic) st.fontStyle = 'italic'; if (b.textStyle?.underline) st.textDecorationLine = 'underline';
      for (const r of b.ranges) { if (r.start <= ps && r.end >= pe) { if (r.bold) st.fontWeight = 'bold'; if (r.italic) st.fontStyle = 'italic'; if (r.underline) st.textDecorationLine = 'underline'; if (r.highlight) { const hl = TEXT_HIGHLIGHTS.find(h => h.id === r.highlight); if (hl) st.backgroundColor = hl.bg; } } }
      parts.push(<Text key={i} style={st}>{b.content.slice(ps, pe)}</Text>);
    }
    return <Text>{parts}</Text>;
  };

  const filteredEntries = useMemo(() => {
    let result = activeFolder ? entries.filter(e => e.folder_id === activeFolder) : entries;
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(q) || preview(e.content).toLowerCase().includes(q));
    }
    return result;
  }, [entries, activeFolder, searchQ]);
  const getFolderName = (id: number | null) => { if (!id) return null; const f = folders.find(x => x.id === id); return f || null; };

  return (
    <View style={[s.screen, { backgroundColor: theme.bg }]}>
      <View style={s.header}><Text style={[s.headerTxt, { color: theme.text }]}>📖 Духовный дневник</Text><TouchableOpacity style={[s.addBtn, { backgroundColor: theme.primary }]} onPress={() => openEdit()}><Ionicons name="add" size={28} color={theme.textOn} /></TouchableOpacity></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.folderBar} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: 'center', paddingVertical: 4 }}>
        <TouchableOpacity style={[s.folderChip, !activeFolder && s.folderChipAct]} onPress={() => setActiveFolder(null)}>
          <Ionicons name="albums" size={14} color={!activeFolder ? theme.textOn : theme.textSec} />
          <Text style={[s.folderChipTxt, { color: theme.textSec }, !activeFolder && s.folderChipTxtAct]}>Все ({entries.length})</Text>
        </TouchableOpacity>
        {folders.map(f => (
          <TouchableOpacity key={f.id} style={[s.folderChip, { borderColor: theme.border }, activeFolder === f.id && { backgroundColor: f.color, borderColor: f.color }]} onPress={() => setActiveFolder(activeFolder === f.id ? null : f.id)}>
            <Ionicons name={f.icon as any} size={14} color={activeFolder === f.id ? theme.textOn : f.color} />
            <Text style={[s.folderChipTxt, activeFolder === f.id && s.folderChipTxtAct]}>{f.name} ({folderEntryCount(f.id)})</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.folderChip, { borderColor: theme.primary, borderWidth: 1.5, backgroundColor: theme.primary + '10', paddingHorizontal: 16 }]} onPress={() => { setEditingFolder(null); setFolderName(''); setFolderColor(FOLDER_COLORS[0].color); setFolderIcon('folder'); setShowFolderMgmt(true); }}>
          <Ionicons name="add-circle-outline" size={16} color={theme.primary} />
          <Text style={[s.folderChipTxt, { color: theme.primary, fontWeight: '600' }]}>Папка</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={[s.searchBox, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 0, marginBottom: 4 }]}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput style={[s.searchIn, { color: theme.text, padding: 10, fontSize: 14 }]} value={searchQ} onChangeText={setSearchQ} placeholder="Поиск записей..." placeholderTextColor={theme.textMuted} />
        {searchQ.length > 0 && <TouchableOpacity onPress={() => setSearchQ('')}><Ionicons name="close-circle" size={18} color={theme.textMuted} /></TouchableOpacity>}
      </View>
      {dailyVerse && showDailyVerse && <View style={[s.dailyVerse, { backgroundColor: theme.revBg, borderColor: theme.accent }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[s.dailyVerseLbl, { color: theme.warning }]}>Стих дня</Text>
          <TouchableOpacity onPress={() => setShowDailyVerse(false)}><Ionicons name="close" size={18} color={theme.textMuted} /></TouchableOpacity>
        </View>
        <Text style={[s.dailyVerseTxt, { fontFamily: bibleFontFamily, color: theme.text }]}>"{dailyVerse.text}"</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <Text style={[s.dailyVerseRef, { color: theme.primary }]}>— {dailyVerse.book} {dailyVerse.chapter}:{dailyVerse.verse}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {verseStreak > 1 && <View style={[s.streakBadge, { backgroundColor: theme.accentLight }]}><Ionicons name="flame" size={14} color={theme.warning} /><Text style={{ fontSize: 12, color: theme.warning, fontWeight: '600' }}>{verseStreak}</Text></View>}
            <TouchableOpacity onPress={() => onNavigate(dailyVerse.book, dailyVerse.chapter)}><Ionicons name="book-outline" size={20} color={theme.primary} /></TouchableOpacity>
          </View>
        </View>
      </View>}
      <DailyReadingCard
        isRead={dailyIsRead}
        streak={readingStreak}
        onOpenReading={() => setShowDailyReadingModal(true)}
      />
      <FlatList data={filteredEntries} keyExtractor={i => i.id.toString()} renderItem={({ item }) => {
        const cs = catStyle(item.category), vc = vCount(item.content), pv = preview(item.content);
        const isFasting = isFastingEntry(item);
        return (
          <TouchableOpacity style={[s.card, { borderLeftColor: cs.color, backgroundColor: theme.surface }, isFasting && { backgroundColor: theme.prayerBg, borderLeftColor: '#9C27B0' }]} onPress={() => setViewing(item)} onLongPress={() => del(item.id)}>
            <View style={s.cardHdr}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.badge, { backgroundColor: cs.bg }]}><Ionicons name={catIcon(item.category)} size={14} color={cs.color} /><Text style={[s.badgeTxt, { color: cs.color }]}>{item.category}</Text></View>
                {isFasting && <Ionicons name="flame" size={14} color="#9C27B0" />}
              </View>
              <Text style={[s.cardDate, { color: theme.textMuted }]}>{fmtRelTime(item.created_at)}</Text>
            </View>
            <Text style={[s.cardTitle, { color: theme.text, fontSize: scaledSz(17, fontScale) }]}>{item.title}</Text>
            {pv ? <Text style={[s.cardPrev, { color: theme.textSec, fontSize: scaledSz(14, fontScale) }]} numberOfLines={2}>{pv}</Text> : null}
            {(vc > 0 || item.folder_id) && <View style={s.tags}>{item.folder_id && (() => { const fl = getFolderName(item.folder_id); return fl ? <View style={[s.tag, { backgroundColor: fl.color + '20' }]}><Ionicons name={fl.icon as any} size={10} color={fl.color} /><Text style={[s.tagTxt, { color: fl.color }]}>{fl.name}</Text></View> : null; })()}{vc > 0 && <View style={s.tag}><Ionicons name="book" size={10} color={C.primary} /><Text style={s.tagTxt}>{vc} стих{vc > 1 ? (vc < 5 ? 'а' : 'ов') : ''}</Text></View>}</View>}
          </TouchableOpacity>
        );
      }} contentContainerStyle={s.list} refreshing={refreshing} onRefresh={onRefresh} ListEmptyComponent={<View style={s.empty}><Ionicons name="journal-outline" size={64} color={theme.border} /><Text style={[s.emptyTxt, { color: theme.textMuted }]}>{searchQ ? 'Ничего не найдено' : 'Записей пока нет'}</Text>{!searchQ && <Text style={{ color: theme.textSec, fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 40, lineHeight: 20 }}>Нажмите «+» чтобы создать первую запись. Ведите дневник снов, откровений, мыслей и молитв.</Text>}</View>} />

      <DailyReadingModal
        visible={showDailyReadingModal && !!dailyReadingResult}
        reading={dailyReadingResult}
        isRead={dailyIsRead}
        onClose={() => setShowDailyReadingModal(false)}
        onMarkRead={handleMarkRead}
        onSaveToJournal={saveVerseToJournal}
      />

      <Modal visible={viewing !== null} animationType="slide" statusBarTranslucent>
        <SafeAreaProvider><SafeAreaView style={[s.modal, { backgroundColor: theme.bg }]} onLayout={e => setViewContainerH(e.nativeEvent.layout.height)}>
          <View style={[s.modalHdr, { borderBottomColor: theme.border }]} onLayout={e => setViewHeaderH(e.nativeEvent.layout.height)}><TouchableOpacity onPress={() => setViewing(null)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity><Text style={[s.modalTitle, { color: theme.text }]} numberOfLines={1}>{viewing?.title}</Text><TouchableOpacity onPress={() => viewing && openEdit(viewing)}><Ionicons name="create-outline" size={24} color={theme.primary} /></TouchableOpacity></View>
          {viewing && <ScrollView style={{ height: viewContainerH - viewHeaderH }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <View style={s.viewMeta}><View style={[s.badge, { backgroundColor: catStyle(viewing.category).bg }]}><Ionicons name={catIcon(viewing.category)} size={14} color={catStyle(viewing.category).color} /><Text style={[s.badgeTxt, { color: catStyle(viewing.category).color }]}>{viewing.category}</Text></View><Text style={s.viewDate}>{new Date(viewing.created_at).toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text></View>
            {parseBlocks(viewing.content).map(b => <View key={b.id}>{b.type === 'divider' ? <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 12 }} /> : b.type === 'text' ? renderText(b) : renderVerse(b)}</View>)}
            <TouchableOpacity style={[s.delBtn, { marginTop: 20 }]} onPress={() => viewing && del(viewing.id)}><Ionicons name="trash-outline" size={20} color={C.error} /><Text style={s.delTxt}>Удалить</Text></TouchableOpacity>
          </ScrollView>}
        </SafeAreaView></SafeAreaProvider>
      </Modal>

      <Modal visible={modal} animationType="slide" statusBarTranslucent>
        <SafeAreaProvider><SafeAreaView style={[s.modal, { backgroundColor: theme.bg }]}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[s.modalHdr, { borderBottomColor: theme.border }]}><TouchableOpacity onPress={confirmClose}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity><Text style={[s.modalTitle, { color: theme.text }]}>{editing ? 'Редактировать' : 'Новая запись'}</Text><TouchableOpacity onPress={save}><Text style={[s.saveTxt, { color: theme.primary }]}>Сохранить</Text></TouchableOpacity></View>
          <ScrollView ref={scrollRef} style={s.modalBody} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled" scrollEventThrottle={16}>
            <Text style={s.label}>Категория</Text>
            <View style={s.catPicker}>{(['сон','откровение','мысль','молитва'] as Cat[]).map(c => { const cs = catStyle(c); return <TouchableOpacity key={c} style={[s.catOpt, { backgroundColor: cs.bg }, cat === c && { borderColor: cs.color }]} onPress={() => setCat(c)}><Ionicons name={catIcon(c)} size={16} color={cs.color} /><Text style={[s.catOptTxt, { color: cs.color }]}>{c}</Text></TouchableOpacity>; })}</View>
            {folders.length > 0 && <><Text style={s.label}>Папка</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity style={[s.folderChip, !entryFolder && s.folderChipAct]} onPress={() => setEntryFolder(null)}>
                <Text style={[s.folderChipTxt, !entryFolder && s.folderChipTxtAct]}>Без папки</Text>
              </TouchableOpacity>
              {folders.map(f => (
                <TouchableOpacity key={f.id} style={[s.folderChip, entryFolder === f.id && { backgroundColor: f.color, borderColor: f.color }]} onPress={() => setEntryFolder(f.id)}>
                  <Ionicons name={f.icon as any} size={14} color={entryFolder === f.id ? C.textOn : f.color} />
                  <Text style={[s.folderChipTxt, entryFolder === f.id && s.folderChipTxtAct]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView></>}
            <Text style={[s.label, { color: theme.textSec }]}>Дата</Text>
            <TouchableOpacity style={[s.input, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }]} onPress={() => { setShowDatePicker(!showDatePicker); Keyboard.dismiss(); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="calendar-outline" size={18} color={theme.primary} />
                <Text style={{ color: theme.text, fontSize: 15 }}>{new Date(entryDate + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' })}</Text>
                {entryDate !== fmtDate(new Date()) && <View style={{ backgroundColor: theme.accent + '30', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: theme.primary }}>изменено</Text></View>}
              </View>
              <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
            </TouchableOpacity>
            {showDatePicker && <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: 12, padding: 12, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}><Ionicons name="chevron-back" size={22} color={theme.primary} /></TouchableOpacity>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{MONTHS[pickerMonth]} {pickerYear}</Text>
                <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}><Ionicons name="chevron-forward" size={22} color={theme.primary} /></TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 4 }}>{WDAYS.map(w => <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: theme.textMuted, fontWeight: '600' }}>{w}</Text>)}</View>
              {(() => { const days = getMonthDays(pickerYear, pickerMonth); const rows = []; for (let r = 0; r < 6; r++) { rows.push(<View key={r} style={{ flexDirection: 'row' }}>{days.slice(r * 7, r * 7 + 7).map((d, i) => { const ds = fmtDate(d); const isCurMonth = d.getMonth() === pickerMonth; const isSel = ds === entryDate; const isToday = ds === fmtDate(new Date()); return <TouchableOpacity key={i} style={{ flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: isSel ? theme.primary : 'transparent' }} onPress={() => { setEntryDate(ds); setDirty(true); setShowDatePicker(false); }}><Text style={{ fontSize: 14, color: isSel ? theme.textOn : isCurMonth ? theme.text : theme.textMuted, fontWeight: isToday ? '700' : '400' }}>{d.getDate()}</Text></TouchableOpacity>; })}</View>); } return rows; })()}
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 8, paddingVertical: 6, paddingHorizontal: 16, backgroundColor: theme.primary + '15', borderRadius: 8 }} onPress={() => { const now = new Date(); setEntryDate(fmtDate(now)); setPickerMonth(now.getMonth()); setPickerYear(now.getFullYear()); setShowDatePicker(false); }}><Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>Сегодня</Text></TouchableOpacity>
            </View>}
            <Text style={[s.label, { color: theme.textSec }]}>Заголовок</Text>
            <TextInput style={[s.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} value={title} onChangeText={t => { setTitle(t); setDirty(true); }} placeholder="Название..." placeholderTextColor={theme.textMuted} />
            <Text style={s.label}>Содержание</Text>
            {blocks.map((b, i) => <View key={b.id} onLayout={(e) => { blockPositions.current[b.id] = e.nativeEvent.layout.y; }}>{b.type === 'divider' ? <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 8 }}><View style={{ flex: 1, height: 1, backgroundColor: C.border }} /><View style={{ flexDirection: 'row', gap: 4 }}>{i > 0 && <TouchableOpacity onPress={() => moveBlock(i, -1)}><Ionicons name="arrow-up" size={16} color={C.textMuted} /></TouchableOpacity>}{i < blocks.length - 1 && <TouchableOpacity onPress={() => moveBlock(i, 1)}><Ionicons name="arrow-down" size={16} color={C.textMuted} /></TouchableOpacity>}<TouchableOpacity onPress={() => removeBlock(b.id)}><Ionicons name="close" size={16} color={C.error} /></TouchableOpacity></View></View> : b.type === 'text' ? <View style={b.textStyle?.highlight ? { borderLeftWidth: 4, borderLeftColor: TEXT_HIGHLIGHTS.find(h => h.id === b.textStyle?.highlight)?.bg, borderRadius: 8, marginBottom: 4, paddingLeft: 4 } : undefined}><View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><TextInput style={[s.input, s.textArea, activeId === b.id && s.inputAct, b.textStyle?.fontSize && { fontSize: getFSize(b.textStyle.fontSize) }, b.textStyle?.bold && { fontWeight: 'bold' }, b.textStyle?.italic && { fontStyle: 'italic' }, b.textStyle?.underline && { textDecorationLine: 'underline' as const }, b.textStyle?.highlight && { backgroundColor: TEXT_HIGHLIGHTS.find(h => h.id === b.textStyle?.highlight)?.bg }]} value={b.content} onChangeText={t => updateBlock(b.id, t)} onSelectionChange={(e) => setSel(e.nativeEvent.selection)} onFocus={() => { setActiveId(b.id); setTStyle(b.textStyle || {}); setSel({start: 0, end: 0}); setTimeout(() => { const y = blockPositions.current[b.id]; if (y !== undefined && scrollRef.current) { scrollRef.current.scrollTo({ y: Math.max(0, y - 100), animated: true }); } }, 150); }} placeholder={i === 0 ? "Начните писать..." : "Продолжайте..."} placeholderTextColor={C.textMuted} multiline scrollEnabled={false} textAlignVertical="top" /></View>{blocks.length > 1 && <View style={{ paddingLeft: 4, gap: 2 }}>{i > 0 && <TouchableOpacity onPress={() => moveBlock(i, -1)}><Ionicons name="chevron-up" size={16} color={C.textMuted} /></TouchableOpacity>}{i < blocks.length - 1 && <TouchableOpacity onPress={() => moveBlock(i, 1)}><Ionicons name="chevron-down" size={16} color={C.textMuted} /></TouchableOpacity>}</View>}</View>{b.ranges && b.ranges.length > 0 && b.content.length > 0 && <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 4 }}><Text style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>Предпросмотр:</Text>{(() => { const len = b.content.length, pts = new Set<number>([0, len]); b.ranges.forEach(r => { pts.add(Math.max(0, r.start)); pts.add(Math.min(len, r.end)); }); const srt = Array.from(pts).sort((a, c) => a - c); return <Text style={{ fontSize: 14, lineHeight: 22, color: theme.text }}>{srt.slice(0, -1).map((ps, ix) => { const pe = srt[ix + 1]; const rs: any = {}; if (b.textStyle?.bold) rs.fontWeight = 'bold'; if (b.textStyle?.italic) rs.fontStyle = 'italic'; if (b.textStyle?.underline) rs.textDecorationLine = 'underline'; for (const r of (b.ranges || [])) { if (r.start <= ps && r.end >= pe) { if (r.bold) rs.fontWeight = 'bold'; if (r.italic) rs.fontStyle = 'italic'; if (r.underline) rs.textDecorationLine = 'underline'; if (r.highlight) { const hl = TEXT_HIGHLIGHTS.find(h => h.id === r.highlight); if (hl) rs.backgroundColor = hl.bg; } } } return <Text key={ix} style={rs}>{b.content.slice(ps, pe)}</Text>; })}</Text>; })()}</View>}<TouchableOpacity style={s.insertBtn} onPress={() => { setInsertId(b.id); setVpick(true); }}><Ionicons name="add-circle" size={18} color={C.primary} /><Text style={s.insertTxt}>Вставить стихи</Text></TouchableOpacity></View> : <View style={[s.verseEdit, { backgroundColor: getVColor(b.boxColor).bg, borderLeftColor: getVColor(b.boxColor).border }]}>{(() => { try { const d = JSON.parse(b.content) as VerseData; const font = getVFont(d.fontFamily); const ref = d.verseEnd ? `${d.book} ${d.chapter}:${d.verse}-${d.verseEnd}` : `${d.book} ${d.chapter}:${d.verse}`; return <><View style={s.verseEditHdr}><View style={s.verseEditLeft}><Ionicons name="book" size={16} color={getVColor(b.boxColor).border} /><Text style={[s.verseRef, { color: getVColor(b.boxColor).border }]}>{ref}</Text>{d.fontFamily && <Text style={s.verseFontLabel}>{font.name}</Text>}</View><View style={s.verseEditActs}><TouchableOpacity onPress={() => openVerseFormat(b.id)}><Ionicons name="text" size={20} color={getVColor(b.boxColor).border} /></TouchableOpacity><TouchableOpacity onPress={() => setColorPick(b.id)}><Ionicons name="color-palette" size={20} color={getVColor(b.boxColor).border} /></TouchableOpacity><TouchableOpacity onPress={() => removeBlock(b.id)}><Ionicons name="close-circle" size={22} color={C.error} /></TouchableOpacity></View></View><HighlightedVerseText text={d.text} highlights={d.highlights} fontFamily={font.family} baseStyle={s.verseEditTxt} /></>; } catch { return null; } })()}</View>}</View>)}
            <View style={{ height: 200 }} />
          </ScrollView>
          {activeId && keyboardVisible && <RTToolbar style={tStyle} onToggle={toggleStyle} onSize={setFontSize} onHighlight={setHighlight} onDivider={addDivider} />}
        </KeyboardAvoidingView></SafeAreaView></SafeAreaProvider>
      </Modal>

      <Modal visible={colorPick !== null} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} onPress={() => setColorPick(null)}>
          <View style={s.picker}><Text style={s.pickerTitle}>Выберите цвет</Text><View style={s.pickerGrid}>{VERSE_COLORS.map(c => <TouchableOpacity key={c.id} style={[s.pickerItem, { backgroundColor: c.bg, borderColor: c.border }]} onPress={() => colorPick && updateColor(colorPick, c.id)}><View style={[s.pickerDot, { backgroundColor: c.border }]} /></TouchableOpacity>)}</View></View>
        </TouchableOpacity>
      </Modal>

      <VerseFormatModal visible={formatVerse !== null} onClose={() => setFormatVerse(null)} verseData={formatVerse?.data || null} onSave={saveVerseFormat} />
      <VersePickerModal visible={vpick} onClose={() => { setVpick(false); setInsertId(null); }} onSelect={addVerses} />

      <Modal visible={showFolderMgmt} animationType="slide" transparent>
        <View style={s.sheetOverlay}>
          <View style={[s.sheet, { maxHeight: '85%' }]}>
            <View style={s.sheetHdr}>
              <Text style={s.sheetTitle}>{editingFolder ? 'Редактировать папку' : 'Управление папками'}</Text>
              <TouchableOpacity onPress={() => { setShowFolderMgmt(false); setEditingFolder(null); setFolderName(''); }}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              <Text style={[s.label, { marginTop: 0 }]}>{editingFolder ? 'Название' : 'Новая папка'}</Text>
              <TextInput style={s.input} value={folderName} onChangeText={setFolderName} placeholder="Название папки..." placeholderTextColor={C.textMuted} />
              <Text style={s.label}>Цвет</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                {FOLDER_COLORS.map(c => (
                  <TouchableOpacity key={c.id} style={[s.fmtColorItem, { backgroundColor: c.color }, folderColor === c.color && s.fmtColorItemAct]} onPress={() => setFolderColor(c.color)} />
                ))}
              </View>
              <Text style={s.label}>Иконка</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {FOLDER_ICONS.map(ic => (
                  <TouchableOpacity key={ic} style={[{ width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: folderIcon === ic ? folderColor : C.border, backgroundColor: folderIcon === ic ? folderColor + '20' : C.surface }]} onPress={() => setFolderIcon(ic)}>
                    <Ionicons name={ic as any} size={20} color={folderIcon === ic ? folderColor : C.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[s.saveBtn, { margin: 0, backgroundColor: folderColor }]} onPress={saveFolder}>
                <Text style={s.saveBtnTxt}>{editingFolder ? 'Сохранить' : 'Создать папку'}</Text>
              </TouchableOpacity>
              {editingFolder && <TouchableOpacity style={{ alignItems: 'center', padding: 12, marginTop: 8 }} onPress={() => { setEditingFolder(null); setFolderName(''); setFolderColor(FOLDER_COLORS[0].color); setFolderIcon('folder'); }}>
                <Text style={{ color: C.textMuted }}>Отмена редактирования</Text>
              </TouchableOpacity>}
              {folders.length > 0 && <>
                <Text style={s.label}>Существующие папки</Text>
                {folders.map(f => (
                  <View key={f.id} style={[s.sheetItem, { borderRadius: 10, marginBottom: 6 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: f.color + '20', justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name={f.icon as any} size={18} color={f.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.sheetItemTxt}>{f.name}</Text>
                        <Text style={s.sheetItemSub}>{folderEntryCount(f.id)} записей</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity onPress={() => startEditFolder(f)}><Ionicons name="pencil" size={20} color={C.textMuted} /></TouchableOpacity>
                      <TouchableOpacity onPress={() => delFolder(f)}><Ionicons name="trash-outline" size={20} color={C.error} /></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Verse Picker
const VersePickerModal = ({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (v: BibleVerse[], c: string) => void }) => {
  const { theme } = useTheme();
  const [book, setBook] = useState<BibleBook | null>(null);
  const [chap, setChap] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [col, setCol] = useState('gold');

  const reset = () => { setBook(null); setChap(null); setQ(''); setSel(new Set()); setCol('gold'); };
  const close = () => { reset(); onClose(); };
  const toggle = (v: BibleVerse) => setSel(p => { const n = new Set(p); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n; });
  const confirm = () => { const vs = BIBLE_VERSES.filter(v => sel.has(v.id)); if (vs.length > 0) onSelect(vs, col); reset(); };
  const chapVs = () => book && chap ? BIBLE_VERSES.filter(v => v.book === book.name && v.chapter === chap) : [];
  const results = q.length > 2 ? BIBLE_VERSES.filter(v => v.text.toLowerCase().includes(q.toLowerCase()) || v.book.toLowerCase().includes(q.toLowerCase())).slice(0, 50) : [];

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent><SafeAreaProvider><SafeAreaView style={[s.modal, { backgroundColor: theme.bg }]}>
      <View style={[s.modalHdr, { borderBottomColor: theme.border }]}><TouchableOpacity onPress={close}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity><Text style={[s.modalTitle, { color: theme.text }]}>Выбрать стихи {sel.size > 0 && `(${sel.size})`}</Text>{sel.size > 0 ? <TouchableOpacity onPress={confirm}><Text style={[s.saveTxt, { color: theme.primary }]}>Добавить</Text></TouchableOpacity> : <View style={{ width: 60 }} />}</View>
      {sel.size > 0 && <View style={[s.colorRow, { backgroundColor: theme.surfaceAlt }]}><Text style={[s.colorLbl, { color: theme.textSec }]}>Цвет:</Text>{VERSE_COLORS.map(c => <TouchableOpacity key={c.id} style={[s.colorItem, { backgroundColor: c.bg, borderColor: c.border }, col === c.id && s.colorItemAct]} onPress={() => setCol(c.id)} />)}</View>}
      <View style={[s.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}><Ionicons name="search" size={20} color={theme.textMuted} /><TextInput style={[s.searchIn, { color: theme.text }]} value={q} onChangeText={setQ} placeholder="Поиск..." placeholderTextColor={theme.textMuted} />{q.length > 0 && <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={20} color={theme.textMuted} /></TouchableOpacity>}</View>
      {q.length > 2 ? <FlatList data={results} keyExtractor={i => i.id} renderItem={({ item }) => <TouchableOpacity style={[s.vpItem, sel.has(item.id) && s.vpItemSel]} onPress={() => toggle(item)}><View style={s.vpCheck}>{sel.has(item.id) ? <Ionicons name="checkmark" size={16} color={C.primary} /> : null}</View><View style={{ flex: 1 }}><Text style={s.vpRef}>{item.book} {item.chapter}:{item.verse}</Text><Text style={s.vpTxt} numberOfLines={2}>{item.text}</Text></View></TouchableOpacity>} contentContainerStyle={s.list} />
      : !book ? <FlatList data={BIBLE_BOOKS} keyExtractor={i => i.name} renderItem={({ item }) => <TouchableOpacity style={s.pickItem} onPress={() => setBook(item)}><Text style={s.pickTxt}>{item.name}</Text><Text style={s.pickSub}>{item.chapters} глав</Text></TouchableOpacity>} contentContainerStyle={s.list} />
      : !chap ? <View style={{ flex: 1 }}><TouchableOpacity style={s.backNav} onPress={() => setBook(null)}><Ionicons name="arrow-back" size={20} color={C.primary} /><Text style={s.backTxt}>{book.name}</Text></TouchableOpacity><FlatList key="ch" data={Array.from({ length: book.chapters }, (_, i) => i + 1)} numColumns={5} keyExtractor={i => i.toString()} renderItem={({ item }) => <TouchableOpacity style={s.chapBtn} onPress={() => setChap(item)}><Text style={s.chapTxt}>{item}</Text></TouchableOpacity>} contentContainerStyle={s.chapGrid} /></View>
      : <View style={{ flex: 1 }}><TouchableOpacity style={s.backNav} onPress={() => setChap(null)}><Ionicons name="arrow-back" size={20} color={C.primary} /><Text style={s.backTxt}>{book.name} {chap}</Text></TouchableOpacity><FlatList data={chapVs()} keyExtractor={i => i.id} renderItem={({ item }) => <TouchableOpacity style={[s.vpItem, sel.has(item.id) && s.vpItemSel]} onPress={() => toggle(item)}><View style={s.vpCheck}>{sel.has(item.id) ? <Ionicons name="checkmark" size={16} color={C.primary} /> : null}</View><Text style={s.vpNum}>{item.verse}</Text><Text style={s.vpTxt}>{item.text}</Text></TouchableOpacity>} contentContainerStyle={s.list} /></View>}
    </SafeAreaView></SafeAreaProvider></Modal>
  );
};

// Calendar Screen
const CalendarScreen = ({ onNavigate }: { onNavigate: (book: string, chapter: number) => void }) => {
  const { theme } = useTheme();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selDate, setSelDate] = useState(fmtDate(today));
  const [entriesByDate, setEbd] = useState<Record<string, Entry[]>>({});
  const [readings, setReadings] = useState<Reading[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [editNote, setEditNote] = useState(false);
  const [noteTxt, setNoteTxt] = useState('');
  const [noteBlocks, setNoteBlocks] = useState<Block[]>([{ id: genId(), type: 'text', content: '' }]);
  const [noteActiveId, setNoteActiveId] = useState<string | null>(null);
  const [noteTStyle, setNoteTStyle] = useState<TStyle>({});
  const [noteKbVisible, setNoteKbVisible] = useState(false);
  const noteScrollRef = useRef<ScrollView>(null);
  const noteBlockPos = useRef<Record<string, number>>({});
  const [noteSel, setNoteSel] = useState<{start: number; end: number}>({start: 0, end: 0});
  const [pickBook, setPickBook] = useState<BibleBook | null>(null);
  // Reading Plan Generator
  const [showPlanGen, setShowPlanGen] = useState(false);
  const [planStep, setPlanStep] = useState<'book' | 'chapter' | 'pace' | 'duration'>('book');
  const [planBook, setPlanBook] = useState<BibleBook | null>(null);
  const [planStartCh, setPlanStartCh] = useState(1);
  const [planPace, setPlanPace] = useState(1);
  const [planDays, setPlanDays] = useState(30);
  // Fasting Tracker
  const [fasts, setFasts] = useState<Fasting[]>([]);
  const [showFastModal, setShowFastModal] = useState(false);
  const [fastNote, setFastNote] = useState('');
  const [editingFastName, setEditingFastName] = useState(false);
  const [fastName, setFastName] = useState('');
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null);

  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const load = useCallback(async () => {
    const es = await db.getAllAsync<Entry>('SELECT * FROM entries ORDER BY created_at DESC');
    const g: Record<string, Entry[]> = {};
    es.forEach(e => { const k = e.created_at.split('T')[0].split(' ')[0]; if (!g[k]) g[k] = []; g[k].push(e); });
    setEbd(g);
    setReadings(await db.getAllAsync<Reading>('SELECT * FROM reading_plan ORDER BY date DESC'));
    const ns = await db.getAllAsync<{ date: string; notes: string }>('SELECT date, notes FROM daily_notes');
    const nm: Record<string, string> = {}; ns.forEach(n => { nm[n.date] = n.notes; }); setNotes(nm);
    setFasts(await db.getAllAsync<Fasting>('SELECT * FROM fasting ORDER BY start_date DESC'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const prevM = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const nextM = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };
  const goToday = () => { setMonth(today.getMonth()); setYear(today.getFullYear()); setSelDate(fmtDate(today)); };

  const toggleRead = async (id: number, done: boolean) => { await db.runAsync('UPDATE reading_plan SET completed=? WHERE id=?', [done ? 0 : 1, id]); load(); };
  const addRead = async (bk: string, ch: number) => { await db.runAsync('INSERT OR REPLACE INTO reading_plan (date, book, chapter, completed) VALUES (?,?,?,0)', [selDate, bk, ch]); load(); setShowAdd(false); };
  const delRead = (id: number) => Alert.alert('Удалить?', '', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: async () => { await db.runAsync('DELETE FROM reading_plan WHERE id=?', [id]); load(); } }]);
  const saveNote = async () => { await db.runAsync('INSERT OR REPLACE INTO daily_notes (date, notes) VALUES (?,?)', [selDate, noteTxt]); load(); setEditNote(false); };

  // Fasting functions
  const activeFast = fasts.find(f => !f.end_date);
  const isFastingDay = (date: string) => fasts.some(f => {
    const start = f.start_date;
    const end = f.end_date || fmtDate(today);
    return date >= start && date <= end;
  });
  const startFast = async () => {
    await db.runAsync('INSERT INTO fasting (start_date, notes) VALUES (?,?)', [selDate, fastNote]);
    load(); setShowFastModal(false); setFastNote('');
    Alert.alert('🙏 Пост начат', `С ${fmtDateRu(selDate)}`);
  };
  const endFast = async () => {
    if (!activeFast) return;
    await db.runAsync('UPDATE fasting SET end_date=?, notes=? WHERE id=?', [selDate, fastNote || activeFast.notes, activeFast.id]);
    load(); setShowFastModal(false); setFastNote('');
    const days = Math.round((new Date(selDate + 'T00:00:00').getTime() - new Date(activeFast.start_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1;
    Alert.alert('✓ Пост завершён', `${days} дней поста`);
  };
  const delFast = (id: number) => Alert.alert('Удалить пост?', '', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: async () => { await db.runAsync('DELETE FROM fasting WHERE id=?', [id]); load(); } }]);
  const updateFastName = async () => {
    if (!activeFast) return;
    await db.runAsync('UPDATE fasting SET notes=? WHERE id=?', [fastName, activeFast.id]);
    load(); setEditingFastName(false);
  };
  const totalFastDays = useMemo(() => {
    let total = 0;
    fasts.forEach(f => {
      const start = new Date(f.start_date + 'T00:00:00');
      const end = f.end_date ? new Date(f.end_date + 'T00:00:00') : new Date(fmtDate(today) + 'T00:00:00');
      total += Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    });
    return total;
  }, [fasts]);

  // Note block editing functions
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setNoteKbVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setNoteKbVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const parseNote = (n: string): Block[] => {
    try { const p = JSON.parse(n); if (Array.isArray(p) && p[0]?.type) return p; } catch {}
    return [{ id: genId(), type: 'text', content: n || '' }];
  };

  const openNoteEdit = () => {
    const raw = notes[selDate] || '';
    setNoteBlocks(parseNote(raw));
    setNoteActiveId(null);
    setNoteTStyle({});
    setEditNote(true);
  };

  const saveNoteBlocks = async () => {
    const json = JSON.stringify(noteBlocks);
    await db.runAsync('INSERT OR REPLACE INTO daily_notes (date, notes) VALUES (?,?)', [selDate, json]);
    load(); setEditNote(false);
  };

  const updateNoteBlock = (id: string, txt: string) => setNoteBlocks(bs => bs.map(b => {
    if (b.id !== id) return b;
    const upd: Block = { ...b, content: txt };
    if (b.ranges?.length) {
      const delta = txt.length - b.content.length;
      if (delta !== 0) {
        const cp = Math.max(0, noteSel.start - Math.max(0, delta));
        upd.ranges = b.ranges.map(r => {
          if (cp >= r.end) return r;
          if (cp <= r.start) return { ...r, start: r.start + delta, end: r.end + delta };
          return { ...r, end: Math.max(r.start + 1, r.end + delta) };
        }).filter(r => r.start >= 0 && r.end <= txt.length && r.start < r.end);
      }
    }
    return upd;
  }));
  const toggleNoteStyle = (k: keyof TStyle) => {
    if (noteActiveId && noteSel.start < noteSel.end && (k === 'bold' || k === 'italic' || k === 'underline')) {
      setNoteBlocks(bs => bs.map(b => {
        if (b.id !== noteActiveId) return b;
        const ranges = [...(b.ranges || [])];
        let fullyCovered = true;
        for (let i = noteSel.start; i < noteSel.end && fullyCovered; i++) {
          if (!ranges.some(r => r[k] && r.start <= i && r.end > i)) fullyCovered = false;
        }
        if (fullyCovered && ranges.length > 0) {
          const nr: StyleRange[] = [];
          for (const r of ranges) {
            if (!r[k] || r.end <= noteSel.start || r.start >= noteSel.end) { nr.push(r); continue; }
            if (r.start < noteSel.start) nr.push({ ...r, end: noteSel.start });
            if (r.end > noteSel.end) nr.push({ ...r, start: noteSel.end });
          }
          return { ...b, ranges: nr };
        }
        return { ...b, ranges: [...ranges, { start: noteSel.start, end: noteSel.end, [k]: true }] };
      }));
      setNoteTStyle(p => ({ ...p, [k]: !p[k] }));
    } else {
      const nv = !noteTStyle[k]; setNoteTStyle(p => ({ ...p, [k]: nv }));
      if (noteActiveId) setNoteBlocks(bs => bs.map(b => b.id === noteActiveId ? { ...b, textStyle: { ...b.textStyle, [k]: nv } } : b));
    }
  };
  const setNoteFontSize = (sz: string) => { setNoteTStyle(p => ({ ...p, fontSize: sz })); if (noteActiveId) setNoteBlocks(bs => bs.map(b => b.id === noteActiveId ? { ...b, textStyle: { ...b.textStyle, fontSize: sz } } : b)); };
  const setNoteHighlight = (color: string | null) => {
    if (noteActiveId && noteSel.start < noteSel.end) {
      setNoteBlocks(bs => bs.map(b => {
        if (b.id !== noteActiveId) return b;
        const ranges = [...(b.ranges || [])];
        if (color) return { ...b, ranges: [...ranges, { start: noteSel.start, end: noteSel.end, highlight: color }] };
        const nr: StyleRange[] = [];
        for (const r of ranges) {
          if (!r.highlight || r.end <= noteSel.start || r.start >= noteSel.end) { nr.push(r); continue; }
          if (r.start < noteSel.start) nr.push({ ...r, end: noteSel.start });
          if (r.end > noteSel.end) nr.push({ ...r, start: noteSel.end });
        }
        return { ...b, ranges: nr };
      }));
    } else {
      if (noteActiveId) setNoteBlocks(bs => bs.map(b => b.id === noteActiveId ? { ...b, textStyle: { ...b.textStyle, highlight: color || undefined } } : b));
    }
    setNoteTStyle(p => ({ ...p, highlight: color || undefined }));
  };
  const addNoteDivider = () => { const div: Block = { id: genId(), type: 'divider', content: '' }; if (noteActiveId) { setNoteBlocks(bs => { const i = bs.findIndex(b => b.id === noteActiveId); const n = [...bs]; n.splice(i + 1, 0, div); return n; }); } else { setNoteBlocks(bs => [...bs, div]); } };
  const addNoteTextBlock = () => { setNoteBlocks(bs => [...bs, { id: genId(), type: 'text', content: '' }]); };
  const removeNoteBlock = (id: string) => setNoteBlocks(bs => { const f = bs.filter(b => b.id !== id); return f.length === 0 || !f.some(b => b.type === 'text') ? [{ id: genId(), type: 'text', content: '' }] : f; });

  const renderNotePreview = (raw: string): string => {
    try { const p = JSON.parse(raw); if (Array.isArray(p) && p[0]?.type) return p.filter((b: Block) => b.type === 'text').map((b: Block) => b.content).join(' ').substring(0, 200); } catch {}
    return raw?.substring(0, 200) || '';
  };

  // Reading Plan Generator
  const resetPlanGen = () => { setPlanStep('book'); setPlanBook(null); setPlanStartCh(1); setPlanPace(1); setPlanDays(30); };
  const generatePlan = async () => {
    if (!planBook) return;
    const startDate = new Date(selDate);
    let currentCh = planStartCh;
    const maxCh = planBook.chapters;
    
    for (let day = 0; day < planDays && currentCh <= maxCh; day++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + day);
      const dateStr = fmtDate(d);
      
      for (let i = 0; i < planPace && currentCh <= maxCh; i++) {
        await db.runAsync('INSERT OR REPLACE INTO reading_plan (date, book, chapter, completed) VALUES (?,?,?,0)', [dateStr, planBook.name, currentCh]);
        currentCh++;
      }
    }
    load();
    setShowPlanGen(false);
    resetPlanGen();
    Alert.alert('✓ План создан!', `${planBook.name} с главы ${planStartCh}, ${planPace} глав/день на ${planDays} дней`);
  };

  const PRESET_PLANS = [
    { name: 'Библия за год', desc: '3-4 главы в день', books: 'all', pace: 3, days: 365 },
    { name: 'НЗ за 90 дней', desc: '3 главы в день', testament: 'new', pace: 3, days: 90 },
    { name: 'Псалмы за месяц', desc: '5 псалмов в день', book: 'Псалтирь', pace: 5, days: 31 },
    { name: 'Евангелия', desc: 'За 30 дней', books: ['Матфея', 'Марка', 'Луки', 'Иоанна'], pace: 3, days: 30 },
  ];

  const applyPreset = async (preset: typeof PRESET_PLANS[0]) => {
    const startDate = new Date(selDate);
    let day = 0;
    
    if (preset.book) {
      // Single book plan
      const book = BIBLE_BOOKS.find(b => b.name === preset.book);
      if (!book) return;
      let ch = 1;
      while (ch <= book.chapters && day < preset.days) {
        const d = new Date(startDate); d.setDate(d.getDate() + day);
        for (let i = 0; i < preset.pace && ch <= book.chapters; i++) {
          await db.runAsync('INSERT OR REPLACE INTO reading_plan (date, book, chapter, completed) VALUES (?,?,?,0)', [fmtDate(d), book.name, ch]);
          ch++;
        }
        day++;
      }
    } else if (preset.books === 'all') {
      // Full Bible
      for (const book of BIBLE_BOOKS) {
        for (let ch = 1; ch <= book.chapters && day < preset.days; ch++) {
          const d = new Date(startDate); d.setDate(d.getDate() + Math.floor((ch - 1) / preset.pace) + day);
          await db.runAsync('INSERT OR REPLACE INTO reading_plan (date, book, chapter, completed) VALUES (?,?,?,0)', [fmtDate(d), book.name, ch]);
        }
        day += Math.ceil(book.chapters / preset.pace);
      }
    } else if (preset.testament) {
      // Testament plan
      const books = BIBLE_BOOKS.filter(b => b.testament === preset.testament);
      for (const book of books) {
        for (let ch = 1; ch <= book.chapters && day < preset.days; ch++) {
          const d = new Date(startDate); d.setDate(d.getDate() + Math.floor((ch - 1) / preset.pace) + day);
          await db.runAsync('INSERT OR REPLACE INTO reading_plan (date, book, chapter, completed) VALUES (?,?,?,0)', [fmtDate(d), book.name, ch]);
        }
        day += Math.ceil(book.chapters / preset.pace);
      }
    } else if (Array.isArray(preset.books)) {
      // Specific books
      for (const bookName of preset.books) {
        const book = BIBLE_BOOKS.find(b => b.name === bookName);
        if (!book) continue;
        for (let ch = 1; ch <= book.chapters && day < preset.days; ch++) {
          const d = new Date(startDate); d.setDate(d.getDate() + Math.floor((ch - 1) / preset.pace) + day);
          await db.runAsync('INSERT OR REPLACE INTO reading_plan (date, book, chapter, completed) VALUES (?,?,?,0)', [fmtDate(d), book.name, ch]);
        }
        day += Math.ceil(book.chapters / preset.pace);
      }
    }
    
    load();
    setShowPlanGen(false);
    Alert.alert('✓ План создан!', preset.name);
  };

  const selEs = entriesByDate[selDate] || [];
  const selRs = readings.filter(r => r.date === selDate);
  const todayStr = fmtDate(today);
  const selIsFasting = isFastingDay(selDate);

  const dayInfo = (d: Date) => { 
    const ds = fmtDate(d), dr = readings.filter(r => r.date === ds); 
    return { hasE: !!entriesByDate[ds]?.length, hasR: dr.length > 0, compR: dr.filter(r => r.completed).length, totR: dr.length, hasF: isFastingDay(ds) }; 
  };

  return (
    <View style={[s.screen, { backgroundColor: theme.bg }]}>
      <View style={s.header}>
        <Text style={[s.headerTxt, { color: theme.text }]}>📅 Календарь</Text>
        <TouchableOpacity onPress={goToday} style={[s.todayBtn, { backgroundColor: theme.accentLight }]}><Text style={[s.todayTxt, { color: theme.primary }]}>Сегодня</Text></TouchableOpacity>
      </View>
      <View style={s.monthNav}>
        <TouchableOpacity onPress={prevM}><Ionicons name="chevron-back" size={24} color={theme.primary} /></TouchableOpacity>
        <Text style={[s.monthTxt, { color: theme.text }]}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextM}><Ionicons name="chevron-forward" size={24} color={theme.primary} /></TouchableOpacity>
      </View>
      <View style={s.wdayRow}>{WDAYS.map(d => <Text key={d} style={s.wdayTxt}>{d}</Text>)}</View>
      {/* Explicit height: always 42 cells = 6 rows × 7 cols. Without this, flexWrap:'wrap'
          reports incorrect height to Yoga, causing dayDetails ScrollView to get a wrong size. */}
      <View style={[s.calGrid, { height: ((SW - 16) / 7) * 6 }]}>
        {days.map((d, i) => {
          const ds = fmtDate(d), isCur = d.getMonth() === month, isT = ds === todayStr, isS = ds === selDate;
          const { hasE, hasR, compR, totR, hasF } = dayInfo(d);
          return (
            <TouchableOpacity key={i} style={[s.calDay, !isCur && s.calDayOther, isT && s.calDayToday, isS && s.calDaySel, hasF && { backgroundColor: '#F3E5F5' }]} onPress={() => setSelDate(ds)}>
              <Text style={[s.calDayTxt, !isCur && s.calDayTxtOther, isT && s.calDayTxtT, isS && s.calDayTxtS]}>{d.getDate()}</Text>
              {(hasE || hasR || hasF) && <View style={s.dayDots}>{hasE ? <View style={[s.dot, { backgroundColor: theme.primary }]} /> : null}{hasR ? <View style={[s.dot, { backgroundColor: compR === totR ? theme.success : theme.warning }]} /> : null}{hasF ? <View style={[s.dot, { backgroundColor: '#9C27B0' }]} /> : null}</View>}
            </TouchableOpacity>
          );
        })}
      </View>
      <ScrollView style={s.dayDetails} keyboardShouldPersistTaps="handled" nestedScrollEnabled contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={[s.dayTitle, { color: theme.text }]}>{fmtDateRu(selDate)}</Text>
        <View style={[s.daySec, { backgroundColor: theme.surface }]}>
          <View style={s.daySecHdr}>
            <Ionicons name="create" size={18} color={theme.primary} />
            <Text style={[s.daySecTitle, { color: theme.text }]}>Заметки дня</Text>
            <TouchableOpacity onPress={openNoteEdit}><Ionicons name="pencil" size={18} color={theme.textMuted} /></TouchableOpacity>
          </View>
          {notes[selDate] ? <Text style={[s.noteText, { color: theme.textSec }]}>{renderNotePreview(notes[selDate])}</Text> : <Text style={[s.emptyDay, { color: theme.textMuted }]}>Нажмите карандаш для добавления</Text>}
        </View>
        <View style={[s.daySec, { backgroundColor: theme.surface }]}>
          <View style={s.daySecHdr}>
            <Ionicons name="book" size={18} color={theme.success} />
            <Text style={[s.daySecTitle, { color: theme.text }]}>План чтения</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setShowPlanGen(true)}><Ionicons name="calendar" size={20} color={theme.warning} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAdd(true)}><Ionicons name="add-circle" size={22} color={theme.primary} /></TouchableOpacity>
            </View>
          </View>
          {selRs.length > 0 ? selRs.map(r => (
            <TouchableOpacity key={r.id} style={s.readItem} onPress={() => toggleRead(r.id, r.completed)} onLongPress={() => delRead(r.id)}>
              <View style={[s.readCheck, { borderColor: theme.border }, r.completed && { backgroundColor: theme.success, borderColor: theme.success }]}>{r.completed ? <Ionicons name="checkmark" size={14} color={theme.textOn} /> : null}</View>
              <Text style={[s.readTxt, { color: theme.text }, r.completed && { textDecorationLine: 'line-through', color: theme.textMuted }]}>{r.book} {r.chapter}</Text>
              <TouchableOpacity style={s.goBtn} onPress={() => onNavigate(r.book, r.chapter)}><Ionicons name="arrow-forward-circle" size={22} color={theme.primary} /></TouchableOpacity>
            </TouchableOpacity>
          )) : <Text style={[s.emptyDay, { color: theme.textMuted }]}>Нет чтения</Text>}
        </View>
        <View style={[s.daySec, { backgroundColor: theme.surface }]}>
          <View style={s.daySecHdr}>
            <Ionicons name="journal" size={18} color={theme.warning} />
            <Text style={[s.daySecTitle, { color: theme.text }]}>Записи</Text>
          </View>
          {selEs.length > 0 ? selEs.map(e => (
            <TouchableOpacity key={e.id} style={s.dayEntry} onPress={() => setViewingEntry(e)}>
              <Text style={[s.dayEntryTitle, { color: theme.text }]}>{e.title}</Text>
              <Text style={[s.dayEntryCat, { color: theme.textMuted }]}>{e.category}</Text>
            </TouchableOpacity>
          )) : <Text style={[s.emptyDay, { color: theme.textMuted }]}>Нет записей</Text>}
        </View>

        {/* Fasting Section */}
        <View style={[s.daySec, { backgroundColor: theme.surface }, selIsFasting && { backgroundColor: theme.prayerBg, borderLeftWidth: 3, borderLeftColor: '#9C27B0' }]}>
          <View style={s.daySecHdr}>
            <Ionicons name="flame" size={18} color="#9C27B0" />
            <Text style={[s.daySecTitle, { color: theme.text }]}>Пост</Text>
            <TouchableOpacity onPress={() => setShowFastModal(true)}>
              <Ionicons name={activeFast ? 'stop-circle' : 'add-circle'} size={22} color="#9C27B0" />
            </TouchableOpacity>
          </View>
          {selIsFasting ? (
            <View>
              <Text style={{ color: '#9C27B0', fontWeight: '600', marginBottom: 4 }}>🙏 День поста</Text>
              {activeFast && activeFast.start_date <= selDate && (
                <Text style={s.emptyDay}>Начало: {fmtDateRu(activeFast.start_date)}</Text>
              )}
            </View>
          ) : (
            <Text style={s.emptyDay}>{activeFast ? 'Пост идёт' : 'Нет поста'}</Text>
          )}
          {totalFastDays > 0 && (
            <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>Всего дней поста: {totalFastDays}</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={s.sheetOverlay}>
          <View style={s.sheet}>
            <View style={s.sheetHdr}>
              <Text style={s.sheetTitle}>{pickBook ? `${pickBook.name} — выберите главу` : 'Добавить чтение'}</Text>
              <TouchableOpacity onPress={() => { setShowAdd(false); setPickBook(null); }}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
            </View>
            {pickBook ? (
              <>
                <TouchableOpacity style={s.backNav} onPress={() => setPickBook(null)}>
                  <Ionicons name="arrow-back" size={20} color={C.primary} />
                  <Text style={s.backTxt}>Назад к книгам</Text>
                </TouchableOpacity>
                <FlatList
                  data={Array.from({ length: pickBook.chapters }, (_, i) => i + 1)}
                  numColumns={5}
                  keyExtractor={i => i.toString()}
                  contentContainerStyle={s.chapGrid}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={s.chapBtn} onPress={() => { addRead(pickBook.name, item); setPickBook(null); }}>
                      <Text style={s.chapTxt}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </>
            ) : (
              <FlatList data={BIBLE_BOOKS} keyExtractor={i => i.name} renderItem={({ item }) => (
                <TouchableOpacity style={s.sheetItem} onPress={() => setPickBook(item)}>
                  <Text style={s.sheetItemTxt}>{item.name}</Text>
                  <Text style={s.sheetItemSub}>{item.chapters} глав</Text>
                </TouchableOpacity>
              )} style={s.sheetList} />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={editNote} animationType="slide" statusBarTranslucent>
        <SafeAreaProvider><SafeAreaView style={[s.modal, { backgroundColor: theme.bg }]}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[s.modalHdr, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setEditNote(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
            <Text style={[s.modalTitle, { color: theme.text }]}>Заметка — {fmtDateRu(selDate)}</Text>
            <TouchableOpacity onPress={saveNoteBlocks}><Text style={[s.saveTxt, { color: theme.primary }]}>Сохранить</Text></TouchableOpacity>
          </View>
          <ScrollView ref={noteScrollRef} style={s.modalBody} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled" scrollEventThrottle={16}>
            {noteBlocks.map((b, i) => <View key={b.id} onLayout={(e) => { noteBlockPos.current[b.id] = e.nativeEvent.layout.y; }}>
              {b.type === 'divider' ? <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 8 }}><View style={{ flex: 1, height: 1, backgroundColor: C.border }} /><TouchableOpacity onPress={() => removeNoteBlock(b.id)}><Ionicons name="close" size={16} color={C.error} /></TouchableOpacity></View>
              : <View style={b.textStyle?.highlight ? { borderLeftWidth: 4, borderLeftColor: TEXT_HIGHLIGHTS.find(h => h.id === b.textStyle?.highlight)?.bg, borderRadius: 8, marginBottom: 4, paddingLeft: 4 } : undefined}>
                <TextInput style={[s.input, s.textArea, noteActiveId === b.id && s.inputAct, b.textStyle?.fontSize && { fontSize: getFSize(b.textStyle.fontSize) }, b.textStyle?.bold && { fontWeight: 'bold' }, b.textStyle?.italic && { fontStyle: 'italic' }, b.textStyle?.underline && { textDecorationLine: 'underline' as const }, b.textStyle?.highlight && { backgroundColor: TEXT_HIGHLIGHTS.find(h => h.id === b.textStyle?.highlight)?.bg }]} value={b.content} onChangeText={t => updateNoteBlock(b.id, t)} onSelectionChange={(e) => setNoteSel(e.nativeEvent.selection)} onFocus={() => { setNoteActiveId(b.id); setNoteTStyle(b.textStyle || {}); setNoteSel({start: 0, end: 0}); setTimeout(() => { const y = noteBlockPos.current[b.id]; if (y !== undefined && noteScrollRef.current) { noteScrollRef.current.scrollTo({ y: Math.max(0, y - 100), animated: true }); } }, 150); }} placeholder={i === 0 ? "Мысли, молитвы..." : "Продолжайте..."} placeholderTextColor={C.textMuted} multiline scrollEnabled={false} textAlignVertical="top" />
              </View>}
            </View>)}
            <TouchableOpacity style={s.insertBtn} onPress={addNoteTextBlock}>
              <Ionicons name="add-circle" size={18} color={C.primary} /><Text style={s.insertTxt}>Добавить блок</Text>
            </TouchableOpacity>
            <View style={{ height: 200 }} />
          </ScrollView>
          {noteActiveId && noteKbVisible && <RTToolbar style={noteTStyle} onToggle={toggleNoteStyle} onSize={setNoteFontSize} onHighlight={setNoteHighlight} onDivider={addNoteDivider} />}
        </KeyboardAvoidingView></SafeAreaView></SafeAreaProvider>
      </Modal>

      <Modal visible={showPlanGen} animationType="slide" transparent>
        <View style={s.sheetOverlay}>
          <View style={[s.sheet, { maxHeight: '85%' }]}>
            <View style={s.sheetHdr}>
              <Text style={s.sheetTitle}>📖 Генератор плана</Text>
              <TouchableOpacity onPress={() => { setShowPlanGen(false); resetPlanGen(); }}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {/* Preset Plans */}
              <Text style={[s.label, { marginTop: 0 }]}>Готовые планы</Text>
              {PRESET_PLANS.map((p, i) => (
                <TouchableOpacity key={i} style={[s.sheetItem, { marginBottom: 8, borderRadius: 12 }]} onPress={() => applyPreset(p)}>
                  <View>
                    <Text style={s.sheetItemTxt}>{p.name}</Text>
                    <Text style={s.sheetItemSub}>{p.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
                </TouchableOpacity>
              ))}

              {/* Custom Plan */}
              <Text style={s.label}>Свой план</Text>
              
              {planStep === 'book' && (
                <>
                  <Text style={{ color: C.textMuted, marginBottom: 12 }}>1. Выберите книгу:</Text>
                  <FlatList
                    data={BIBLE_BOOKS}
                    keyExtractor={b => b.name}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={[s.sheetItem, { marginBottom: 4, borderRadius: 8 }]} onPress={() => { setPlanBook(item); setPlanStep('chapter'); }}>
                        <Text style={s.sheetItemTxt}>{item.name}</Text>
                        <Text style={s.sheetItemSub}>{item.chapters} гл.</Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              )}

              {planStep === 'chapter' && planBook && (
                <>
                  <TouchableOpacity style={s.backNav} onPress={() => setPlanStep('book')}>
                    <Ionicons name="arrow-back" size={18} color={C.primary} />
                    <Text style={s.backTxt}>{planBook.name}</Text>
                  </TouchableOpacity>
                  <Text style={{ color: C.textMuted, marginBottom: 12 }}>2. С какой главы начать?</Text>
                  <FlatList
                    data={Array.from({ length: planBook.chapters }, (_, i) => i + 1)}
                    numColumns={5}
                    keyExtractor={i => i.toString()}
                    scrollEnabled={false}
                    contentContainerStyle={s.chapGrid}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={[s.chapBtn, planStartCh === item && { backgroundColor: C.primary }]} onPress={() => { setPlanStartCh(item); setPlanStep('pace'); }}>
                        <Text style={[s.chapTxt, planStartCh === item && { color: C.textOn }]}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              )}

              {planStep === 'pace' && (
                <>
                  <TouchableOpacity style={s.backNav} onPress={() => setPlanStep('chapter')}>
                    <Ionicons name="arrow-back" size={18} color={C.primary} />
                    <Text style={s.backTxt}>{planBook?.name} с гл. {planStartCh}</Text>
                  </TouchableOpacity>
                  <Text style={{ color: C.textMuted, marginBottom: 12 }}>3. Глав в день:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {[1, 2, 3, 5, 10].map(n => (
                      <TouchableOpacity key={n} style={[s.chapBtn, { flex: 0, width: 60 }, planPace === n && { backgroundColor: C.primary }]} onPress={() => { setPlanPace(n); setPlanStep('duration'); }}>
                        <Text style={[s.chapTxt, planPace === n && { color: C.textOn }]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {planStep === 'duration' && (
                <>
                  <TouchableOpacity style={s.backNav} onPress={() => setPlanStep('pace')}>
                    <Ionicons name="arrow-back" size={18} color={C.primary} />
                    <Text style={s.backTxt}>{planPace} гл./день</Text>
                  </TouchableOpacity>
                  <Text style={{ color: C.textMuted, marginBottom: 12 }}>4. Длительность (дней):</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {[7, 14, 30, 60, 90, 180, 365].map(n => (
                      <TouchableOpacity key={n} style={[s.chapBtn, { flex: 0, width: 60 }, planDays === n && { backgroundColor: C.primary }]} onPress={() => setPlanDays(n)}>
                        <Text style={[s.chapTxt, planDays === n && { color: C.textOn }]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ marginTop: 20, padding: 16, backgroundColor: C.surfaceAlt, borderRadius: 12 }}>
                    <Text style={{ fontWeight: '600', color: C.text, marginBottom: 8 }}>Итого:</Text>
                    <Text style={{ color: C.textSec }}>📖 {planBook?.name}</Text>
                    <Text style={{ color: C.textSec }}>📍 С главы {planStartCh}</Text>
                    <Text style={{ color: C.textSec }}>📊 {planPace} глав/день × {planDays} дней</Text>
                    <Text style={{ color: C.textSec }}>📅 Начало: {fmtDateRu(selDate)}</Text>
                  </View>
                  <TouchableOpacity style={[s.saveBtn, { marginTop: 16 }]} onPress={generatePlan}>
                    <Text style={s.saveBtnTxt}>Создать план</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Fasting Modal */}
      <Modal visible={showFastModal} animationType="slide" transparent>
        <View style={s.sheetOverlay}>
          <View style={s.sheet}>
            <View style={s.sheetHdr}>
              <Text style={s.sheetTitle}>🙏 {activeFast ? 'Управление постом' : 'Начать пост'}</Text>
              <TouchableOpacity onPress={() => { setShowFastModal(false); setFastNote(''); setEditingFastName(false); }}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {activeFast ? (
                <>
                  <View style={{ backgroundColor: '#F3E5F5', padding: 16, borderRadius: 12, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontWeight: '600', color: '#9C27B0' }}>Текущий пост</Text>
                      <TouchableOpacity onPress={() => { setFastName(activeFast.notes || ''); setEditingFastName(!editingFastName); }}>
                        <Ionicons name="pencil" size={18} color="#9C27B0" />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: C.textSec }}>Начало: {fmtDateRu(activeFast.start_date)}</Text>
                    <Text style={{ color: C.textSec }}>Дней: {Math.ceil((new Date(selDate).getTime() - new Date(activeFast.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1}</Text>
                    {activeFast.notes && !editingFastName ? <Text style={{ color: '#9C27B0', marginTop: 4, fontWeight: '500' }}>📝 {activeFast.notes}</Text> : null}
                  </View>
                  
                  {editingFastName && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={s.label}>Название поста</Text>
                      <TextInput style={s.input} value={fastName} onChangeText={setFastName} placeholder="Пост Даниила, Великий пост..." placeholderTextColor={C.textMuted} />
                      <TouchableOpacity style={[s.saveBtn, { backgroundColor: '#9C27B0', marginTop: 12 }]} onPress={updateFastName}>
                        <Text style={s.saveBtnTxt}>Сохранить название</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <Text style={s.label}>Заметка при завершении (опционально)</Text>
                  <TextInput style={[s.input, { marginBottom: 16 }]} value={fastNote} onChangeText={setFastNote} placeholder="Мысли о посте..." placeholderTextColor={C.textMuted} />
                  <TouchableOpacity style={[s.saveBtn, { backgroundColor: '#9C27B0' }]} onPress={endFast}>
                    <Text style={s.saveBtnTxt}>Завершить пост ({fmtDateRu(selDate)})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.delBtn, { marginTop: 8 }]} onPress={() => { delFast(activeFast.id); setShowFastModal(false); }}>
                    <Ionicons name="trash" size={18} color={C.error} />
                    <Text style={s.delTxt}>Удалить пост</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ color: C.textSec, marginBottom: 16 }}>Начать пост с выбранной даты: <Text style={{ fontWeight: '600' }}>{fmtDateRu(selDate)}</Text></Text>
                  <Text style={s.label}>Название поста</Text>
                  <TextInput style={[s.input, { marginBottom: 16 }]} value={fastNote} onChangeText={setFastNote} placeholder="Пост Даниила, Великий пост..." placeholderTextColor={C.textMuted} />
                  <TouchableOpacity style={[s.saveBtn, { backgroundColor: '#9C27B0' }]} onPress={startFast}>
                    <Text style={s.saveBtnTxt}>🙏 Начать пост</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Fasting History */}
              {fasts.filter(f => f.end_date).length > 0 && (
                <View style={{ marginTop: 24 }}>
                  <Text style={s.label}>История постов</Text>
                  {fasts.filter(f => f.end_date).slice(0, 5).map(f => (
                    <TouchableOpacity key={f.id} style={[s.sheetItem, { marginBottom: 4, borderRadius: 8 }]} onLongPress={() => delFast(f.id)}>
                      <View>
                        <Text style={s.sheetItemTxt}>{f.notes || 'Пост'}</Text>
                        <Text style={s.sheetItemSub}>
                          {fmtDateRu(f.start_date)} — {fmtDateRu(f.end_date!)} • {Math.ceil((new Date(f.end_date!).getTime() - new Date(f.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} дней
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {viewingEntry && (
        <Modal visible animationType="slide" statusBarTranslucent>
          <SafeAreaProvider><SafeAreaView style={[s.modal, { backgroundColor: theme.bg }]}>
            <View style={[s.modalHdr, { borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={() => setViewingEntry(null)}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
              <Text style={[s.modalTitle, { color: theme.text }]} numberOfLines={1}>{viewingEntry.title}</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              <View style={s.viewMeta}><View style={[s.badge, { backgroundColor: catStyle(viewingEntry.category).bg }]}><Ionicons name={catIcon(viewingEntry.category) as any} size={14} color={catStyle(viewingEntry.category).color} /><Text style={[s.badgeTxt, { color: catStyle(viewingEntry.category).color }]}>{viewingEntry.category}</Text></View><Text style={[s.viewDate, { color: theme.textMuted }]}>{new Date(viewingEntry.created_at).toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text></View>
              {parseBlocks(viewingEntry.content).map(b => {
                if (b.type === 'divider') return <View key={b.id} style={{ height: 1, backgroundColor: theme.border, marginVertical: 12 }} />;
                if (b.type === 'verse') { try { const d = JSON.parse(b.content) as VerseData; const vc = getVColor(b.boxColor); const ref = d.verseEnd ? `${d.book} ${d.chapter}:${d.verse}-${d.verseEnd}` : `${d.book} ${d.chapter}:${d.verse}`; return <View key={b.id} style={[s.verseView, { backgroundColor: vc.bg, borderLeftColor: vc.border }]}><View style={s.verseHdr}><Ionicons name="book" size={16} color={vc.border} /><Text style={[s.verseRef, { color: vc.border }]}>{ref}</Text></View><Text style={[s.verseTxt, { color: theme.text }]}>{d.text}</Text></View>; } catch { return null; } }
                if (!b.content) return null;
                const st: any = { fontSize: 16, color: theme.text, lineHeight: 26, marginBottom: 8 };
                if (b.textStyle?.bold) st.fontWeight = 'bold'; if (b.textStyle?.italic) st.fontStyle = 'italic'; if (b.textStyle?.underline) st.textDecorationLine = 'underline';
                if (b.textStyle?.highlight) { const hl = TEXT_HIGHLIGHTS.find(h => h.id === b.textStyle?.highlight); if (hl) st.backgroundColor = hl.bg; }
                return <Text key={b.id} style={st}>{b.content}</Text>;
              })}
            </ScrollView>
          </SafeAreaView></SafeAreaProvider>
        </Modal>
      )}
    </View>
  );
};

// Bible Screen
const BibleScreen = ({ navTarget, clearNavTarget }: { navTarget: NavTarget | null; clearNavTarget: () => void }) => {
  const { theme, bibleFont, fontScale } = useTheme();
  const bibleFontFamily = getVFont(bibleFont).family;
  const [book, setBook] = useState<BibleBook | null>(null);
  const [chap, setChap] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'old' | 'new'>('all');
  const [bmarks, setBmarks] = useState<Set<string>>(new Set());

  useEffect(() => { (async () => { const r = await db.getAllAsync<{ verse_id: string }>('SELECT verse_id FROM bookmarks'); setBmarks(new Set(r.map(x => x.verse_id))); })(); }, []);

  useEffect(() => {
    if (navTarget) {
      const b = BIBLE_BOOKS.find(x => x.name === navTarget.book);
      if (b) { setBook(b); setChap(navTarget.chapter); }
      clearNavTarget();
    }
  }, [navTarget, clearNavTarget]);

  const toggleBm = async (id: string) => { if (bmarks.has(id)) { await db.runAsync('DELETE FROM bookmarks WHERE verse_id=?', [id]); bmarks.delete(id); } else { await db.runAsync('INSERT OR IGNORE INTO bookmarks (verse_id) VALUES (?)', [id]); bmarks.add(id); } setBmarks(new Set(bmarks)); };

  const books = BIBLE_BOOKS.filter(b => filter === 'all' || b.testament === filter);
  const verses = book && chap ? BIBLE_VERSES.filter(v => v.book === book.name && v.chapter === chap) : [];

  if (!book) return (
    <View style={[s.screen, { backgroundColor: theme.bg }]}>
      <View style={s.header}><Text style={[s.headerTxt, { color: theme.text }]}>📜 Библия</Text></View>
      <View style={s.filterRow}>{[['all','Все'],['old','Ветхий'],['new','Новый']].map(([k,l]) => <TouchableOpacity key={k} style={[s.filterBtn, filter === k && s.filterBtnAct, { backgroundColor: filter === k ? theme.primary : theme.surface, borderColor: filter === k ? theme.primary : theme.border }]} onPress={() => setFilter(k as any)}><Text style={[s.filterTxt, filter === k && s.filterTxtAct, { color: filter === k ? theme.textOn : theme.textSec }]}>{l}</Text></TouchableOpacity>)}</View>
      <FlatList data={books} keyExtractor={i => i.name} renderItem={({ item }) => <TouchableOpacity style={[s.bookItem, { backgroundColor: theme.surface }]} onPress={() => setBook(item)}><View><Text style={[s.bookName, { color: theme.text }]}>{item.name}</Text><Text style={[s.bookChaps, { color: theme.textMuted }]}>{item.chapters} глав</Text></View><Ionicons name="chevron-forward" size={20} color={theme.textMuted} /></TouchableOpacity>} contentContainerStyle={s.list} />
    </View>
  );

  if (!chap) return (
    <View style={[s.screen, { backgroundColor: theme.bg }]}>
      <View style={s.header}><TouchableOpacity onPress={() => setBook(null)} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity><Text style={[s.headerTxt, { color: theme.text }]}>{book.name}</Text><View style={{ width: 40 }} /></View>
      <FlatList key="cg" data={Array.from({ length: book.chapters }, (_, i) => i + 1)} numColumns={5} keyExtractor={i => i.toString()} renderItem={({ item }) => <TouchableOpacity style={[s.chapBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setChap(item)}><Text style={[s.chapTxt, { color: theme.primary }]}>{item}</Text></TouchableOpacity>} contentContainerStyle={s.chapGrid} />
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: theme.bg }]}>
      <View style={s.header}><TouchableOpacity onPress={() => setChap(null)} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity><Text style={[s.headerTxt, { color: theme.text }]}>{book.name} {chap}</Text><View style={{ width: 40 }} /></View>
      {verses.length === 0 ? <View style={s.empty}><Ionicons name="alert-circle-outline" size={48} color={theme.border} /><Text style={[s.emptyTxt, { color: theme.textMuted }]}>Стихи не найдены</Text></View>
      : <FlatList data={verses} keyExtractor={i => i.id} renderItem={({ item }) => (
        <View style={[s.verseItem, { backgroundColor: theme.surface }]}>
          <Text style={[s.vNum, { color: theme.primary }]}>{item.verse}</Text>
          <Text style={[s.vTxt, { color: theme.text, fontFamily: bibleFontFamily, fontSize: scaledSz(15, fontScale) }]}>{item.text}</Text>
          <TouchableOpacity onPress={() => toggleBm(item.id)} style={s.bmBtn}><Ionicons name={bmarks.has(item.id) ? 'bookmark' : 'bookmark-outline'} size={20} color={bmarks.has(item.id) ? theme.primary : theme.textMuted} /></TouchableOpacity>
        </View>
      )} contentContainerStyle={s.list} />}
    </View>
  );
};

// Search Screen
const SearchScreen = ({ onNavigate }: { onNavigate: (book: string, chapter: number) => void }) => {
  const { theme, bibleFont, fontScale } = useTheme();
  const bibleFontFamily = getVFont(bibleFont).family;
  const [q, setQ] = useState('');
  const [res, setRes] = useState<BibleVerse[]>([]);
  const search = useCallback(() => { if (!q.trim()) { setRes([]); return; } setRes(BIBLE_VERSES.filter(v => v.text.toLowerCase().includes(q.toLowerCase()) || v.book.toLowerCase().includes(q.toLowerCase())).slice(0, 100)); }, [q]);
  useEffect(() => { const t = setTimeout(search, 300); return () => clearTimeout(t); }, [q, search]);
  return (
    <View style={[s.screen, { backgroundColor: theme.bg }]}>
      <View style={s.header}><Text style={[s.headerTxt, { color: theme.text }]}>🔍 Поиск</Text></View>
      <View style={[s.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}><Ionicons name="search" size={20} color={theme.textMuted} /><TextInput style={[s.searchIn, { color: theme.text }]} value={q} onChangeText={setQ} placeholder="Поиск по Библии..." placeholderTextColor={theme.textMuted} />{q.length > 0 && <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={20} color={theme.textMuted} /></TouchableOpacity>}</View>
      {res.length > 0 && <Text style={[s.resCnt, { color: theme.textMuted }]}>Найдено: {res.length}</Text>}
      <FlatList data={res} keyExtractor={i => i.id} renderItem={({ item }) => (
        <TouchableOpacity style={[s.searchRes, { backgroundColor: theme.surface }]} onPress={() => onNavigate(item.book, item.chapter)}>
          <Text style={[s.searchRef, { color: theme.primary }]}>{item.book} {item.chapter}:{item.verse}</Text>
          <Text style={[s.searchTxt, { color: theme.textSec, fontFamily: bibleFontFamily, fontSize: scaledSz(14, fontScale) }]}>{item.text}</Text>
          <View style={[s.goHint, { borderTopColor: theme.borderLight }]}><Text style={[s.goHintTxt, { color: theme.primary }]}>Открыть в Библии →</Text></View>
        </TouchableOpacity>
      )} contentContainerStyle={s.list} />
    </View>
  );
};

// Graph View
interface GraphNode { id: string; type: 'entry' | 'verse' | 'folder'; label: string; color: string; x: number; y: number; radius: number; }
interface GraphEdge { from: string; to: string; strength: number; }

const STOPWORDS_RU = new Set(['и','в','на','о','с','к','по','за','из','не','что','как','это','для','но','от','при','его','она','они','мы','то','бы','было','был','быть','все','так','же','уже','ещё','ни','мне','мой','моя','моё','тот','эта','это']);
const extractKeywords = (title: string) => title.toLowerCase().replace(/[^\wа-яёА-ЯЁ\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !STOPWORDS_RU.has(w));

const computeGraph = (entries: Entry[], folders: Folder[]): { nodes: GraphNode[]; edges: GraphEdge[] } => {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, GraphNode>();
  const catColors: Record<string, string> = { сон: '#4A7C59', откровение: '#B8860B', мысль: '#8B4513', молитва: '#7B4B94' };

  // Entry nodes
  entries.slice(0, 40).forEach(e => {
    const id = `e${e.id}`;
    const node: GraphNode = { id, type: 'entry', label: e.title.substring(0, 20), color: catColors[e.category] || '#8B4513', x: 0, y: 0, radius: 10 };
    nodes.push(node);
    nodeMap.set(id, node);
  });

  // Folder nodes
  folders.forEach(f => {
    const id = `f${f.id}`;
    const node: GraphNode = { id, type: 'folder', label: f.name.substring(0, 15), color: f.color, x: 0, y: 0, radius: 14 };
    nodes.push(node);
    nodeMap.set(id, node);
  });

  // Connections: same category
  const byCategory = new Map<string, string[]>();
  entries.slice(0, 40).forEach(e => {
    const id = `e${e.id}`;
    const arr = byCategory.get(e.category) || [];
    arr.push(id);
    byCategory.set(e.category, arr);
  });
  byCategory.forEach(ids => {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < Math.min(ids.length, i + 4); j++) {
        edges.push({ from: ids[i], to: ids[j], strength: 0.3 });
      }
    }
  });

  // Connections: shared verses
  const verseMap = new Map<string, string[]>();
  entries.slice(0, 40).forEach(e => {
    const id = `e${e.id}`;
    try {
      const linked = JSON.parse(e.linked_verses || '[]');
      linked.forEach((v: any) => {
        const vKey = `${v.book}-${v.chapter}-${v.verse}`;
        const arr = verseMap.get(vKey) || [];
        arr.push(id);
        verseMap.set(vKey, arr);
      });
    } catch {}
  });
  verseMap.forEach(ids => {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        edges.push({ from: ids[i], to: ids[j], strength: 0.7 });
      }
    }
  });

  // Connections: same folder
  entries.slice(0, 40).forEach(e => {
    if (e.folder_id) {
      edges.push({ from: `e${e.id}`, to: `f${e.folder_id}`, strength: 0.5 });
    }
  });

  // Connections: keyword overlap
  const kwMap = new Map<string, string[]>();
  entries.slice(0, 40).forEach(e => {
    const kws = extractKeywords(e.title);
    kws.forEach(kw => {
      const arr = kwMap.get(kw) || [];
      arr.push(`e${e.id}`);
      kwMap.set(kw, arr);
    });
  });
  kwMap.forEach(ids => {
    if (ids.length > 1 && ids.length < 8) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          edges.push({ from: ids[i], to: ids[j], strength: 0.4 });
        }
      }
    }
  });

  // Deduplicate edges
  const edgeSet = new Map<string, GraphEdge>();
  edges.forEach(e => {
    const key = [e.from, e.to].sort().join('-');
    const existing = edgeSet.get(key);
    if (existing) { existing.strength = Math.min(1, existing.strength + e.strength * 0.5); }
    else { edgeSet.set(key, { ...e }); }
  });

  // Force-directed layout
  const w = SW - 40, h = 400;
  nodes.forEach(n => { n.x = 20 + Math.random() * w; n.y = 20 + Math.random() * (h - 40); });

  const finalEdges = Array.from(edgeSet.values());
  for (let iter = 0; iter < 60; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 600 / (dist * dist);
        nodes[i].x -= (dx / dist) * force;
        nodes[i].y -= (dy / dist) * force;
        nodes[j].x += (dx / dist) * force;
        nodes[j].y += (dy / dist) * force;
      }
    }
    // Attraction
    finalEdges.forEach(e => {
      const a = nodeMap.get(e.from);
      const b = nodeMap.get(e.to);
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = dist * 0.008 * e.strength;
      a.x += (dx / dist) * force;
      a.y += (dy / dist) * force;
      b.x -= (dx / dist) * force;
      b.y -= (dy / dist) * force;
    });
    // Bounds
    nodes.forEach(n => {
      n.x = Math.max(20, Math.min(w, n.x));
      n.y = Math.max(20, Math.min(h - 20, n.y));
    });
  }

  return { nodes, edges: finalEdges };
};

const GraphView = ({ entries, folders, onClose }: { entries: Entry[]; folders: Folder[]; onClose: () => void }) => {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [viewEntry, setViewEntry] = useState<Entry | null>(null);
  const graph = useMemo(() => computeGraph(entries, folders), [entries, folders]);

  const typeLabel: Record<string, string> = { entry: 'Запись', verse: 'Стих', folder: 'Папка' };
  const getEntry = (node: GraphNode) => node.type === 'entry' ? entries.find(e => `e${e.id}` === node.id) || null : null;

  const renderEntryBlock = (b: Block) => {
    if (b.type === 'divider') return <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 12 }} />;
    if (b.type === 'verse') { try { const d = JSON.parse(b.content) as VerseData; const vc = getVColor(b.boxColor); const ref = d.verseEnd ? `${d.book} ${d.chapter}:${d.verse}-${d.verseEnd}` : `${d.book} ${d.chapter}:${d.verse}`; return <View style={[s.verseView, { backgroundColor: vc.bg, borderLeftColor: vc.border }]}><View style={s.verseHdr}><Ionicons name="book" size={16} color={vc.border} /><Text style={[s.verseRef, { color: vc.border }]}>{ref}</Text></View><Text style={[s.verseTxt, { color: theme.text }]}>{d.text}</Text></View>; } catch { return null; } }
    if (!b.content) return null;
    const st: any = { fontSize: 16, color: theme.text, lineHeight: 26, marginBottom: 8 };
    if (b.textStyle?.bold) st.fontWeight = 'bold'; if (b.textStyle?.italic) st.fontStyle = 'italic'; if (b.textStyle?.underline) st.textDecorationLine = 'underline';
    if (b.textStyle?.highlight) { const hl = TEXT_HIGHLIGHTS.find(h => h.id === b.textStyle?.highlight); if (hl) st.backgroundColor = hl.bg; }
    if (!b.ranges?.length) return <Text style={st}>{b.content}</Text>;
    const len = b.content.length, pts = new Set<number>([0, len]);
    b.ranges.forEach(r => { pts.add(Math.max(0, r.start)); pts.add(Math.min(len, r.end)); });
    const sorted = Array.from(pts).sort((a, c) => a - c);
    return <Text>{sorted.slice(0, -1).map((ps, i) => { const pe = sorted[i + 1]; const rs: any = { ...st }; for (const r of (b.ranges || [])) { if (r.start <= ps && r.end >= pe) { if (r.bold) rs.fontWeight = 'bold'; if (r.italic) rs.fontStyle = 'italic'; if (r.underline) rs.textDecorationLine = 'underline'; if (r.highlight) { const hl = TEXT_HIGHLIGHTS.find(h => h.id === r.highlight); if (hl) rs.backgroundColor = hl.bg; } } } return <Text key={i} style={rs}>{b.content.slice(ps, pe)}</Text>; })}</Text>;
  };

  return (
    <Modal visible animationType="slide" statusBarTranslucent><SafeAreaProvider><SafeAreaView style={s.modal}>
      <View style={[s.modalHdr, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
        <Text style={[s.modalTitle, { color: theme.text }]}>Граф связей</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#8B4513' }} /><Text style={{ fontSize: 11, color: theme.textMuted }}>Мысль</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#B8860B' }} /><Text style={{ fontSize: 11, color: theme.textMuted }}>Откров.</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4A7C59' }} /><Text style={{ fontSize: 11, color: theme.textMuted }}>Сон</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#7B4B94' }} /><Text style={{ fontSize: 11, color: theme.textMuted }}>Молитва</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: theme.accent, borderWidth: 1, borderColor: theme.border }} /><Text style={{ fontSize: 11, color: theme.textMuted }}>Папка</Text></View>
          </View>
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
            <Svg width={SW - 32} height={400}>
              {graph.edges.map((e, i) => {
                const a = graph.nodes.find(n => n.id === e.from);
                const b = graph.nodes.find(n => n.id === e.to);
                if (!a || !b) return null;
                return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.border} strokeWidth={Math.max(e.strength * 2.5, 0.5)} strokeOpacity={0.5} />;
              })}
              {graph.nodes.map(n => (
                <G key={n.id}>
                  <Circle cx={n.x} cy={n.y} r={n.radius} fill={n.color} opacity={selected && selected.id !== n.id ? 0.4 : 0.9} stroke={selected?.id === n.id ? theme.text : 'transparent'} strokeWidth={2} />
                  <SvgText x={n.x} y={n.y + n.radius + 12} textAnchor="middle" fontSize={9} fill={theme.textMuted}>{n.label}</SvgText>
                </G>
              ))}
            </Svg>
            {graph.nodes.map(n => (
              <TouchableOpacity key={`touch-${n.id}`} style={{ position: 'absolute', left: n.x - n.radius - 4, top: n.y - n.radius - 4, width: (n.radius + 4) * 2, height: (n.radius + 4) * 2, borderRadius: n.radius + 4 }} onPress={() => setSelected(selected?.id === n.id ? null : n)} activeOpacity={0.7} />
            ))}
          </View>
          {selected && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 16, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: selected.color }} />
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text, flex: 1 }}>{selected.label}</Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>({typeLabel[selected.type]})</Text>
              </View>
              {selected.type === 'entry' && getEntry(selected) && (
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 10, borderRadius: 10, marginBottom: 10 }} onPress={() => setViewEntry(getEntry(selected))}>
                  <Ionicons name="reader-outline" size={18} color={theme.textOn} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textOn }}>Открыть запись</Text>
                </TouchableOpacity>
              )}
              {(() => {
                const connEdges = graph.edges.filter(e => e.from === selected.id || e.to === selected.id);
                const connNodes = connEdges.map(e => graph.nodes.find(n => n.id === (e.from === selected.id ? e.to : e.from))).filter(Boolean);
                return <>
                  <Text style={{ fontSize: 13, color: theme.textSec, marginBottom: connNodes.length > 0 ? 8 : 0 }}>Связей: {connEdges.length}</Text>
                  {connNodes.map((cn, i) => cn && (
                    <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }} onPress={() => { if (cn.type === 'entry') { const entry = entries.find(e => `e${e.id}` === cn.id); if (entry) { setViewEntry(entry); return; } } setSelected(cn); }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cn.color }} />
                      <Text style={{ fontSize: 13, color: theme.primary }}>{cn.label}</Text>
                      <Text style={{ fontSize: 11, color: theme.textMuted }}>({typeLabel[cn.type]})</Text>
                      {cn.type === 'entry' && <Ionicons name="open-outline" size={12} color={theme.primary} />}
                    </TouchableOpacity>
                  ))}
                </>;
              })()}
            </View>
          )}
          <View style={{ marginTop: 16, padding: 12, backgroundColor: theme.surfaceAlt, borderRadius: 12 }}>
            <Text style={{ fontSize: 13, color: theme.textSec, textAlign: 'center' }}>{graph.nodes.length} узлов • {graph.edges.length} связей</Text>
          </View>
        </View>
      </ScrollView>
      {viewEntry && (
        <Modal visible animationType="slide" statusBarTranslucent>
          <SafeAreaProvider><SafeAreaView style={[s.modal, { backgroundColor: theme.bg }]}>
            <View style={[s.modalHdr, { borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={() => setViewEntry(null)}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
              <Text style={[s.modalTitle, { color: theme.text }]} numberOfLines={1}>{viewEntry.title}</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              <View style={s.viewMeta}><View style={[s.badge, { backgroundColor: catStyle(viewEntry.category).bg }]}><Ionicons name={catIcon(viewEntry.category) as any} size={14} color={catStyle(viewEntry.category).color} /><Text style={[s.badgeTxt, { color: catStyle(viewEntry.category).color }]}>{viewEntry.category}</Text></View><Text style={[s.viewDate, { color: theme.textMuted }]}>{new Date(viewEntry.created_at).toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text></View>
              {parseBlocks(viewEntry.content).map(b => <View key={b.id}>{renderEntryBlock(b)}</View>)}
            </ScrollView>
          </SafeAreaView></SafeAreaProvider>
        </Modal>
      )}
    </SafeAreaView></SafeAreaProvider></Modal>
  );
};

// Settings Screen
const SettingsScreen = () => {
  const { theme, themeId, setThemeId, fontScale, setFontScale, bibleFont, setBibleFont } = useTheme();
  const [stats, setStats] = useState({ e: 0, b: 0, r: 0, totalR: 0, streak: 0, fastDays: 0 });
  const [byCat, setByCat] = useState<Record<Cat, number>>({ сон: 0, откровение: 0, мысль: 0, молитва: 0 });
  const [byMonth, setByMonth] = useState<{ month: string; label: string; count: number }[]>([]);
  const [showGraph, setShowGraph] = useState(false);
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(9);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [customPatternMode, setCustomPatternMode] = useState<'date' | 'custom'>('date');
  const [customPatternBook, setCustomPatternBook] = useState('');
  const [showBookPicker, setShowBookPicker] = useState(false);
  // Auto-backup state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState<BackupInterval>('daily');
  const [autoBackupCustomDays, setAutoBackupCustomDays] = useState('3');
  const [autoBackupMaxFiles, setAutoBackupMaxFiles] = useState(10);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [backupFiles, setBackupFiles] = useState<BackupFileInfo[]>([]);
  const [showBackupHistory, setShowBackupHistory] = useState(false);
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);

  useEffect(() => { (async () => {
    const e = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM entries');
    const b = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM bookmarks');
    const r = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM reading_plan WHERE completed=1');
    const totalR = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM reading_plan');

    // Category breakdown
    const cats = await db.getAllAsync<{ category: string; c: number }>('SELECT category, COUNT(*) as c FROM entries GROUP BY category');
    const catMap: Record<Cat, number> = { сон: 0, откровение: 0, мысль: 0, молитва: 0 };
    cats.forEach(c => { if (c.category in catMap) catMap[c.category as Cat] = c.c; });
    setByCat(catMap);

    // Monthly activity (last 6 months)
    const months = await db.getAllAsync<{ month: string; c: number }>(
      "SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as c FROM entries GROUP BY month ORDER BY month DESC LIMIT 6"
    );
    const monthLabels = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
    setByMonth(months.reverse().map(m => ({ month: m.month, label: monthLabels[parseInt(m.month.split('-')[1]) - 1], count: m.c })));

    // Entry streak
    const dates = await db.getAllAsync<{ d: string }>("SELECT DISTINCT date(created_at) as d FROM entries ORDER BY d DESC");
    let streak = 0;
    const today = fmtDate(new Date());
    let expected = today;
    for (const r of dates) {
      if (r.d === expected) { streak++; const dt = new Date(expected); dt.setDate(dt.getDate() - 1); expected = fmtDate(dt); }
      else if (r.d < expected) break;
    }

    // Fasting days
    const fasts = await db.getAllAsync<Fasting>('SELECT * FROM fasting');
    let fastDays = 0;
    const nowStr = fmtDate(new Date());
    fasts.forEach(f => {
      const start = new Date(f.start_date + 'T00:00:00');
      const end = f.end_date ? new Date(f.end_date + 'T00:00:00') : new Date(nowStr + 'T00:00:00');
      fastDays += Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    });

    setStats({ e: e?.c || 0, b: b?.c || 0, r: r?.c || 0, totalR: totalR?.c || 0, streak, fastDays });

    // Load for graph
    setAllEntries(await db.getAllAsync<Entry>('SELECT * FROM entries ORDER BY created_at DESC'));
    setAllFolders(await db.getAllAsync<Folder>('SELECT * FROM folders ORDER BY sort_order ASC'));

    // Load reminder settings
    const remOn = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='reminderEnabled'");
    if (remOn && remOn.value === '1') setReminderEnabled(true);
    const remH = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='reminderHour'");
    if (remH) setReminderHour(parseInt(remH.value));
    const remM = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='reminderMinute'");
    if (remM) setReminderMinute(parseInt(remM.value));

    // Load achievements
    const ach = await db.getAllAsync<{id: string}>('SELECT id FROM achievements');
    setUnlockedAchievements(new Set(ach.map(r => r.id)));

    // Load custom pattern
    const cp = await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='daily_custom_pattern'");
    if (cp?.value) { try { const p = JSON.parse(cp.value); setCustomPatternMode(p ? 'custom' : 'date'); setCustomPatternBook(p?.bookName || ''); } catch {} }

    // Load auto-backup settings
    const abEnabled = await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='autoBackupEnabled'");
    if (abEnabled?.value === '1') setAutoBackupEnabled(true);
    const abInterval = await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='autoBackupInterval'");
    if (abInterval?.value) setAutoBackupInterval(abInterval.value as BackupInterval);
    const abCustom = await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='autoBackupCustomDays'");
    if (abCustom?.value) setAutoBackupCustomDays(abCustom.value);
    const abMax = await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='autoBackupMaxFiles'");
    if (abMax?.value) setAutoBackupMaxFiles(parseInt(abMax.value) || 10);
    const abLast = await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='lastAutoBackupDate'");
    if (abLast?.value) setLastBackupDate(abLast.value);
    setBackupFiles(await listBackupFiles());
  })(); }, []);

  const totalEntries = Math.max(stats.e, 1);
  const catColors: Record<Cat, string> = { сон: theme.success, откровение: theme.warning, мысль: theme.primary, молитва: '#7B4B94' };
  const maxMonth = Math.max(...byMonth.map(m => m.count), 1);
  const readPct = stats.totalR > 0 ? Math.round((stats.r / stats.totalR) * 100) : 0;

  const exportData = async () => {
    try {
      const data = await collectBackupData();
      const json = JSON.stringify(data, null, 2);
      const file = new ExpoFile(Paths.cache, 'divine_journal_backup.json');
      file.write(json);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Экспорт данных' });
      } else {
        Alert.alert('Экспорт', `Файл сохранён: ${file.uri}`);
      }
    } catch (e: any) { Alert.alert('Ошибка экспорта', e?.message || 'Не удалось экспортировать данные'); }
  };

  const saveBackupSetting = async (key: string, value: string) => {
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", [key, value]);
  };

  const toggleAutoBackup = async (enabled: boolean) => {
    setAutoBackupEnabled(enabled);
    await saveBackupSetting('autoBackupEnabled', enabled ? '1' : '0');
    if (enabled) {
      const ok = await performAutoBackup(autoBackupMaxFiles);
      if (ok) {
        setLastBackupDate(new Date().toISOString());
        setBackupFiles(await listBackupFiles());
      }
    }
  };

  const changeInterval = async (interval: BackupInterval) => {
    setAutoBackupInterval(interval);
    await saveBackupSetting('autoBackupInterval', interval);
    setShowIntervalPicker(false);
  };

  const saveCustomDays = async (days: string) => {
    setAutoBackupCustomDays(days);
    await saveBackupSetting('autoBackupCustomDays', days);
  };

  const changeMaxFiles = async (delta: number) => {
    const next = Math.max(1, Math.min(50, autoBackupMaxFiles + delta));
    setAutoBackupMaxFiles(next);
    await saveBackupSetting('autoBackupMaxFiles', String(next));
  };

  const manualBackupNow = async () => {
    const ok = await performAutoBackup(autoBackupMaxFiles);
    if (ok) {
      setLastBackupDate(new Date().toISOString());
      setBackupFiles(await listBackupFiles());
      Alert.alert('Готово', 'Резервная копия создана');
    } else {
      Alert.alert('Ошибка', 'Не удалось создать резервную копию');
    }
  };

  const restoreFromBackup = async (fileInfo: BackupFileInfo) => {
    try {
      const file = new ExpoFile(fileInfo.uri);
      const json = await file.text();
      const data = JSON.parse(json);
      if (!data.version || !data.entries) { Alert.alert('Ошибка', 'Неверный формат файла'); return; }
      Alert.alert('Восстановление', `Файл от ${new Date(fileInfo.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.\n\n${data.entries?.length || 0} записей, ${data.bookmarks?.length || 0} закладок.\n\nЭто заменит текущие данные.`, [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Восстановить', style: 'destructive', onPress: async () => {
          try {
            await db.execAsync('DELETE FROM entries; DELETE FROM bookmarks; DELETE FROM reading_plan; DELETE FROM daily_notes; DELETE FROM fasting; DELETE FROM folders; DELETE FROM daily_verse_history;');
            for (const e of (data.entries || [])) { await db.runAsync('INSERT INTO entries (id, title, content, category, created_at, linked_verses, folder_id) VALUES (?,?,?,?,?,?,?)', [e.id, e.title, e.content, e.category, e.created_at, e.linked_verses, e.folder_id || null]); }
            for (const b of (data.bookmarks || [])) { await db.runAsync('INSERT OR IGNORE INTO bookmarks (id, verse_id, created_at) VALUES (?,?,?)', [b.id, b.verse_id, b.created_at]); }
            for (const r of (data.readingPlan || [])) { await db.runAsync('INSERT OR REPLACE INTO reading_plan (id, date, book, chapter, completed) VALUES (?,?,?,?,?)', [r.id, r.date, r.book, r.chapter, r.completed]); }
            for (const n of (data.dailyNotes || [])) { await db.runAsync('INSERT OR REPLACE INTO daily_notes (id, date, notes) VALUES (?,?,?)', [n.id, n.date, n.notes]); }
            for (const f of (data.fasting || [])) { await db.runAsync('INSERT INTO fasting (id, start_date, end_date, notes, created_at) VALUES (?,?,?,?,?)', [f.id, f.start_date, f.end_date, f.notes, f.created_at]); }
            for (const f of (data.folders || [])) { await db.runAsync('INSERT INTO folders (id, name, color, icon, sort_order) VALUES (?,?,?,?,?)', [f.id, f.name, f.color, f.icon, f.sort_order]); }
            for (const v of (data.dailyVerseHistory || [])) { await db.runAsync('INSERT OR IGNORE INTO daily_verse_history (id, date, verse_id, seen) VALUES (?,?,?,?)', [v.id, v.date, v.verse_id, v.seen]); }
            for (const r of (data.dailyReadingHistory || [])) { await db.runAsync('INSERT OR REPLACE INTO daily_reading_history (date, read_at, verse_of_day_ref, psalms_read, proverbs_read) VALUES (?,?,?,?,?)', [r.date, r.read_at, r.verse_of_day_ref, r.psalms_read, r.proverbs_read]); }
            for (const a of (data.achievements || [])) { await db.runAsync('INSERT OR IGNORE INTO achievements (id, unlocked_at, title, description) VALUES (?,?,?,?)', [a.id, a.unlocked_at, a.title, a.description]); }
            Alert.alert('Готово', 'Данные успешно восстановлены. Перезапустите приложение.');
          } catch (e) { Alert.alert('Ошибка', 'Не удалось восстановить данные'); }
        }},
      ]);
    } catch { Alert.alert('Ошибка', 'Не удалось прочитать файл'); }
  };

  const deleteBackupFile = async (fileInfo: BackupFileInfo) => {
    Alert.alert('Удалить копию?', `${fileInfo.name}`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try { new ExpoFile(fileInfo.uri).delete(); } catch {}
        setBackupFiles(await listBackupFiles());
      }},
    ]);
  };

  const getBackupStatusColor = () => {
    if (!lastBackupDate) return theme.error;
    const days = (Date.now() - new Date(lastBackupDate).getTime()) / 86400000;
    const intervalDays = autoBackupInterval === 'custom' ? (parseInt(autoBackupCustomDays) || 1) : (BACKUP_INTERVALS[autoBackupInterval] || 1);
    if (days <= intervalDays) return theme.success;
    if (days <= intervalDays * 2) return theme.warning;
    return theme.error;
  };

  const getBackupStatusText = () => {
    if (!lastBackupDate) return 'Никогда';
    return fmtRelTime(lastBackupDate);
  };

  const getIntervalLabel = (interval: BackupInterval, customDays?: string) => {
    if (interval === 'daily') return 'Ежедневно';
    if (interval === 'weekly') return 'Еженедельно';
    if (interval === 'monthly') return 'Ежемесячно';
    return `Каждые ${customDays || '3'} дн.`;
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;
      const importFile = new ExpoFile(uri);
      const json = await importFile.text();
      const data = JSON.parse(json);
      if (!data.version || !data.entries) { Alert.alert('Ошибка', 'Неверный формат файла'); return; }

      Alert.alert('Импорт данных', `Найдено: ${data.entries?.length || 0} записей, ${data.bookmarks?.length || 0} закладок, ${data.folders?.length || 0} папок.\n\nЭто заменит текущие данные.`, [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Импортировать', style: 'destructive', onPress: async () => {
          try {
            // Clear existing data
            await db.execAsync('DELETE FROM entries; DELETE FROM bookmarks; DELETE FROM reading_plan; DELETE FROM daily_notes; DELETE FROM fasting; DELETE FROM folders; DELETE FROM daily_verse_history;');

            // Import entries
            for (const e of (data.entries || [])) {
              await db.runAsync('INSERT INTO entries (id, title, content, category, created_at, linked_verses, folder_id) VALUES (?,?,?,?,?,?,?)',
                [e.id, e.title, e.content, e.category, e.created_at, e.linked_verses, e.folder_id || null]);
            }
            // Import bookmarks
            for (const b of (data.bookmarks || [])) {
              await db.runAsync('INSERT OR IGNORE INTO bookmarks (id, verse_id, created_at) VALUES (?,?,?)', [b.id, b.verse_id, b.created_at]);
            }
            // Import reading plan
            for (const r of (data.readingPlan || [])) {
              await db.runAsync('INSERT OR REPLACE INTO reading_plan (id, date, book, chapter, completed) VALUES (?,?,?,?,?)', [r.id, r.date, r.book, r.chapter, r.completed]);
            }
            // Import daily notes
            for (const n of (data.dailyNotes || [])) {
              await db.runAsync('INSERT OR REPLACE INTO daily_notes (id, date, notes) VALUES (?,?,?)', [n.id, n.date, n.notes]);
            }
            // Import fasting
            for (const f of (data.fasting || [])) {
              await db.runAsync('INSERT INTO fasting (id, start_date, end_date, notes, created_at) VALUES (?,?,?,?,?)', [f.id, f.start_date, f.end_date, f.notes, f.created_at]);
            }
            // Import folders
            for (const f of (data.folders || [])) {
              await db.runAsync('INSERT INTO folders (id, name, color, icon, sort_order) VALUES (?,?,?,?,?)', [f.id, f.name, f.color, f.icon, f.sort_order]);
            }
            // Import daily verse history
            for (const v of (data.dailyVerseHistory || [])) {
              await db.runAsync('INSERT OR IGNORE INTO daily_verse_history (id, date, verse_id, seen) VALUES (?,?,?,?)', [v.id, v.date, v.verse_id, v.seen]);
            }
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
            Alert.alert('Готово', 'Данные успешно импортированы. Перезапустите приложение.');
          } catch (e) { Alert.alert('Ошибка', 'Не удалось импортировать данные'); }
        }},
      ]);
    } catch (e) { Alert.alert('Ошибка', 'Не удалось прочитать файл'); }
  };

  const toggleReminder = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) { Alert.alert('Разрешение', 'Разрешите уведомления в настройках устройства'); return; }
      await scheduleReadingReminder(reminderHour, reminderMinute);
    } else {
      await cancelReadingReminder();
    }
    setReminderEnabled(enabled);
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('reminderEnabled', ?)", [enabled ? '1' : '0']);
  };

  const updateReminderTime = async (h: number, m: number) => {
    setReminderHour(h);
    setReminderMinute(m);
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('reminderHour', ?)", [String(h)]);
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('reminderMinute', ?)", [String(m)]);
    if (reminderEnabled) {
      await scheduleReadingReminder(h, m);
    }
    setShowTimePicker(false);
  };

  const fmtTime = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const saveCustomPattern = async () => {
    let pattern: CustomPattern | null = null;
    if (customPatternMode === 'custom' && customPatternBook) {
      pattern = { bookName: customPatternBook };
    }
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key,value) VALUES ('daily_custom_pattern',?)", [JSON.stringify(pattern)]);
    if (pattern) {
      const stats = await getReadStats(fmtDate(new Date()));
      await checkAndUnlockAchievements({ ...stats, hasCustomPattern: true });
      setUnlockedAchievements(prev => new Set([...prev, 'custom_pattern']));
    }
    Alert.alert('Сохранено', 'Паттерн стихов обновлён');
  };

  return (
    <View style={[s.screen, { backgroundColor: theme.bg }]}><View style={s.header}><Text style={[s.headerTxt, { color: theme.text }]}>⚙️ Настройки</Text></View>
      <ScrollView style={s.settingsContent}>
        <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>ОБЗОР</Text>
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: theme.surface }]}><Ionicons name="journal" size={24} color={theme.primary} /><Text style={[s.statNum, { color: theme.text }]}>{stats.e}</Text><Text style={[s.statLbl, { color: theme.textMuted }]}>Записей</Text></View>
            <View style={[s.statCard, { backgroundColor: theme.surface }]}><Ionicons name="bookmark" size={24} color={theme.warning} /><Text style={[s.statNum, { color: theme.text }]}>{stats.b}</Text><Text style={[s.statLbl, { color: theme.textMuted }]}>Закладок</Text></View>
            <View style={[s.statCard, { backgroundColor: theme.surface }]}><Ionicons name="checkmark-circle" size={24} color={theme.success} /><Text style={[s.statNum, { color: theme.text }]}>{stats.r}</Text><Text style={[s.statLbl, { color: theme.textMuted }]}>Прочитано</Text></View>
          </View>
        </View>

        {stats.e > 0 && <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>ПО КАТЕГОРИЯМ</Text>
          {(['сон','откровение','мысль','молитва'] as Cat[]).map(c => {
            const count = byCat[c]; const pct = Math.round((count / totalEntries) * 100);
            return <View key={c} style={s.statBar}>
              <View style={{ width: 95, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={catIcon(c) as any} size={14} color={catColors[c]} />
                <Text style={s.statBarLbl}>{c}</Text>
              </View>
              <View style={s.statBarTrack}><View style={[s.statBarFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: catColors[c] }]} /></View>
              <Text style={s.statBarCnt}>{count} ({pct}%)</Text>
            </View>;
          })}
        </View>}

        {byMonth.length > 0 && <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>АКТИВНОСТЬ</Text>
          <View style={[s.activityChart, { backgroundColor: theme.surface }]}>
            {byMonth.map((m, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: theme.textSec, marginBottom: 4 }}>{m.count}</Text>
                <View style={[s.activityBar, { height: Math.max((m.count / maxMonth) * 80, 4), backgroundColor: theme.primary }]} />
                <Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 4 }}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>}

        {stats.totalR > 0 && <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>ПЛАН ЧТЕНИЯ</Text>
          <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: theme.textSec }}>{stats.r} из {stats.totalR}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.primary }}>{readPct}%</Text>
            </View>
            <View style={[s.statBarTrack, { backgroundColor: theme.borderLight }]}><View style={[s.statBarFill, { width: `${readPct}%`, backgroundColor: theme.success }]} /></View>
          </View>
        </View>}

        <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>ДОСТИЖЕНИЯ ЗАПИСЕЙ</Text>
          <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 16, gap: 12 }}>
            <View style={s.achieveRow}><Ionicons name="flame" size={20} color={theme.warning} /><Text style={{ fontSize: 14, color: theme.text }}>Серия записей</Text><Text style={{ marginLeft: 'auto', fontSize: 16, fontWeight: '700', color: theme.warning }}>{stats.streak} дн.</Text></View>
            <View style={s.achieveRow}><Ionicons name="heart" size={20} color="#9C27B0" /><Text style={{ fontSize: 14, color: theme.text }}>Дней поста</Text><Text style={{ marginLeft: 'auto', fontSize: 16, fontWeight: '700', color: '#9C27B0' }}>{stats.fastDays}</Text></View>
            <View style={s.achieveRow}><Ionicons name="book" size={20} color={theme.success} /><Text style={{ fontSize: 14, color: theme.text }}>Глав прочитано</Text><Text style={{ marginLeft: 'auto', fontSize: 16, fontWeight: '700', color: theme.success }}>{stats.r}</Text></View>
          </View>
        </View>

        <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>ДОСТИЖЕНИЯ ЧТЕНИЯ</Text>
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
        </View>

        <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>ОФОРМЛЕНИЕ</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {([['light', 'Светлая', 'sunny'], ['dark', 'Тёмная', 'moon'], ['sepia', 'Сепия', 'document-text']] as const).map(([id, label, icon]) => (
              <TouchableOpacity key={id} style={[s.statCard, { backgroundColor: theme.surface, borderWidth: 2, borderColor: themeId === id ? theme.primary : 'transparent' }]} onPress={() => setThemeId(id)}>
                <Ionicons name={icon} size={24} color={themeId === id ? theme.primary : theme.textMuted} />
                <Text style={[s.statLbl, { marginTop: 6, color: themeId === id ? theme.primary : theme.textMuted }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 14, color: theme.textSec, marginBottom: 8 }}>Размер текста</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setFontScale(Math.max(0.8, fontScale - 0.1))}><Text style={{ fontSize: 20, fontWeight: '700', color: theme.primary }}>A-</Text></TouchableOpacity>
            <View style={{ flex: 1, height: 4, backgroundColor: theme.borderLight, borderRadius: 2 }}>
              <View style={{ width: `${((fontScale - 0.8) / 0.6) * 100}%`, height: 4, backgroundColor: theme.primary, borderRadius: 2 }} />
            </View>
            <TouchableOpacity onPress={() => setFontScale(Math.min(1.4, fontScale + 0.1))}><Text style={{ fontSize: 20, fontWeight: '700', color: theme.primary }}>A+</Text></TouchableOpacity>
            <Text style={{ fontSize: 12, color: theme.textMuted, width: 40, textAlign: 'right' }}>{Math.round(fontScale * 100)}%</Text>
          </View>
          <Text style={{ fontSize: Math.round(14 * fontScale), color: theme.textSec, marginTop: 10, fontStyle: 'italic' }}>Образец текста</Text>
          <Text style={{ fontSize: 14, color: theme.textSec, marginBottom: 8, marginTop: 20 }}>Шрифт Библии</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {VERSE_FONTS.map(f => (
              <TouchableOpacity key={f.id} style={[s.statCard, { backgroundColor: theme.surface, borderWidth: 2, borderColor: bibleFont === f.id ? theme.primary : 'transparent', paddingVertical: 12 }]} onPress={() => setBibleFont(f.id)}>
                <Text style={{ fontSize: 20, fontFamily: f.family, color: theme.text }}>Аа</Text>
                <Text style={{ fontSize: 11, color: bibleFont === f.id ? theme.primary : theme.textMuted, marginTop: 4, fontWeight: bibleFont === f.id ? '600' : '400' }}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 14, fontFamily: getVFont(bibleFont).family, color: theme.textSec, marginTop: 10, fontStyle: 'italic', lineHeight: 22 }}>"В начале сотворил Бог небо и землю."</Text>
        </View>

        <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>ИНСТРУМЕНТЫ</Text>
          <TouchableOpacity style={[s.sheetItem, { borderRadius: 12, backgroundColor: theme.surface }]} onPress={() => setShowGraph(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="git-network" size={22} color={theme.primary} />
              <View><Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>Граф связей</Text><Text style={{ fontSize: 12, color: theme.textMuted }}>Визуализация связей между записями</Text></View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>НАПОМИНАНИЯ</Text>
          <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Ionicons name="notifications" size={22} color={theme.warning} />
                <View><Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>Напоминание о чтении</Text><Text style={{ fontSize: 12, color: theme.textMuted }}>Ежедневное уведомление</Text></View>
              </View>
              <TouchableOpacity style={{ width: 52, height: 30, borderRadius: 15, backgroundColor: reminderEnabled ? theme.success : theme.borderLight, justifyContent: 'center', paddingHorizontal: 2 }} onPress={() => toggleReminder(!reminderEnabled)}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.textOn, alignSelf: reminderEnabled ? 'flex-end' : 'flex-start', elevation: 2 }} />
              </TouchableOpacity>
            </View>
            {reminderEnabled && (
              <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.borderLight }} onPress={() => setShowTimePicker(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="time" size={20} color={theme.primary} />
                  <Text style={{ fontSize: 14, color: theme.textSec }}>Время</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: theme.primary }}>{fmtTime(reminderHour, reminderMinute)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>ЕЖЕДНЕВНЫЙ СТИХ</Text>
          <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 14, color: theme.textSec, marginBottom: 4 }}>Паттерн поиска</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: customPatternMode === 'date' ? theme.primary : theme.border, alignItems: 'center' }}
                onPress={() => setCustomPatternMode('date')}
              >
                <Text style={{ fontSize: 14, color: customPatternMode === 'date' ? theme.primary : theme.textSec, fontWeight: customPatternMode === 'date' ? '600' : '400' }}>По дате</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: customPatternMode === 'custom' ? theme.primary : theme.border, alignItems: 'center' }}
                onPress={() => setCustomPatternMode('custom')}
              >
                <Text style={{ fontSize: 14, color: customPatternMode === 'custom' ? theme.primary : theme.textSec, fontWeight: customPatternMode === 'custom' ? '600' : '400' }}>Конкретная книга</Text>
              </TouchableOpacity>
            </View>
            {customPatternMode === 'custom' && (
              <TouchableOpacity style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => setShowBookPicker(true)}>
                <Text style={{ fontSize: 14, color: customPatternBook ? theme.text : theme.textMuted }}>{customPatternBook || 'Выберите книгу'}</Text>
                <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.saveBtn, { margin: 0, backgroundColor: theme.primary }]} onPress={saveCustomPattern}>
              <Text style={[s.saveBtnTxt, { color: theme.textOn }]}>Сохранить</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>АВТОМАТИЧЕСКОЕ РЕЗЕРВНОЕ КОПИРОВАНИЕ</Text>
          <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 16, gap: 12 }}>
            {/* Status indicator */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getBackupStatusColor() }} />
              <Text style={{ fontSize: 13, color: theme.textSec }}>Последняя копия: {getBackupStatusText()}</Text>
              {backupFiles.length > 0 && <Text style={{ fontSize: 12, color: theme.textMuted, marginLeft: 'auto' }}>{backupFiles.length} файл.</Text>}
            </View>

            {/* Toggle */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTopWidth: 1, borderTopColor: theme.borderLight }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Ionicons name="sync" size={22} color={theme.primary} />
                <View><Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>Авто-копирование</Text><Text style={{ fontSize: 12, color: theme.textMuted }}>При открытии приложения</Text></View>
              </View>
              <TouchableOpacity style={{ width: 52, height: 30, borderRadius: 15, backgroundColor: autoBackupEnabled ? theme.success : theme.borderLight, justifyContent: 'center', paddingHorizontal: 2 }} onPress={() => toggleAutoBackup(!autoBackupEnabled)}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.textOn, alignSelf: autoBackupEnabled ? 'flex-end' : 'flex-start', elevation: 2 }} />
              </TouchableOpacity>
            </View>

            {autoBackupEnabled && <>
              {/* Interval selector */}
              <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.borderLight }} onPress={() => setShowIntervalPicker(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="calendar" size={20} color={theme.primary} />
                  <Text style={{ fontSize: 14, color: theme.textSec }}>Периодичность</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.primary }}>{getIntervalLabel(autoBackupInterval, autoBackupCustomDays)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </View>
              </TouchableOpacity>

              {/* Max files */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.borderLight }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="albums" size={20} color={theme.primary} />
                  <Text style={{ fontSize: 14, color: theme.textSec }}>Хранить копий</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity onPress={() => changeMaxFiles(-1)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.borderLight, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="remove" size={16} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: theme.primary, width: 30, textAlign: 'center' }}>{autoBackupMaxFiles}</Text>
                  <TouchableOpacity onPress={() => changeMaxFiles(1)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.borderLight, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="add" size={16} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </>}

            {/* Manual backup button */}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.borderLight, marginTop: 4 }} onPress={manualBackupNow}>
              <Ionicons name="download" size={18} color={theme.primary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.primary }}>Создать копию сейчас</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>ДАННЫЕ</Text>
          {backupFiles.length > 0 && <TouchableOpacity style={[s.sheetItem, { borderRadius: 12, backgroundColor: theme.surface, marginBottom: 8 }]} onPress={() => setShowBackupHistory(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="time" size={22} color={theme.warning} />
              <View><Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>История копий</Text><Text style={{ fontSize: 12, color: theme.textMuted }}>{backupFiles.length} сохранённых копий</Text></View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>}
          <TouchableOpacity style={[s.sheetItem, { borderRadius: 12, backgroundColor: theme.surface, marginBottom: 8 }]} onPress={exportData}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="share" size={22} color={theme.success} />
              <View><Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>Экспорт данных</Text><Text style={{ fontSize: 12, color: theme.textMuted }}>Поделиться резервной копией</Text></View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.sheetItem, { borderRadius: 12, backgroundColor: theme.surface }]} onPress={importData}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="cloud-download" size={22} color={theme.primary} />
              <View><Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>Импорт данных</Text><Text style={{ fontSize: 12, color: theme.textMuted }}>Восстановить из внешнего файла</Text></View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={s.section}><Text style={[s.secTitle, { color: theme.textMuted }]}>О ПРИЛОЖЕНИИ</Text><View style={[s.aboutCard, { backgroundColor: theme.surface }]}><Ionicons name="book" size={40} color={theme.primary} /><Text style={[s.appName, { color: theme.primary }]}>Divine Journal</Text><Text style={[s.appVer, { color: theme.textMuted }]}>Версия 5.3</Text><Text style={[s.appDesc, { color: theme.textSec }]}>Духовный дневник с библейскими стихами, форматированием текста, выделением слов, календарём и планом чтения.</Text></View></View>
      </ScrollView>
      {showGraph && <GraphView entries={allEntries} folders={allFolders} onClose={() => setShowGraph(false)} />}
      {showTimePicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowTimePicker(false)}>
            <View style={[s.picker, { backgroundColor: theme.surface }]}>
              <Text style={[s.pickerTitle, { color: theme.text }]}>Время напоминания</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <View style={{ alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => { const h = (reminderHour + 1) % 24; setReminderHour(h); }} style={{ padding: 8 }}><Ionicons name="chevron-up" size={24} color={theme.primary} /></TouchableOpacity>
                  <Text style={{ fontSize: 36, fontWeight: '700', color: theme.text, width: 60, textAlign: 'center' }}>{String(reminderHour).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => { const h = (reminderHour - 1 + 24) % 24; setReminderHour(h); }} style={{ padding: 8 }}><Ionicons name="chevron-down" size={24} color={theme.primary} /></TouchableOpacity>
                </View>
                <Text style={{ fontSize: 36, fontWeight: '700', color: theme.text }}>:</Text>
                <View style={{ alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => { const m = (reminderMinute + 5) % 60; setReminderMinute(m); }} style={{ padding: 8 }}><Ionicons name="chevron-up" size={24} color={theme.primary} /></TouchableOpacity>
                  <Text style={{ fontSize: 36, fontWeight: '700', color: theme.text, width: 60, textAlign: 'center' }}>{String(reminderMinute).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => { const m = (reminderMinute - 5 + 60) % 60; setReminderMinute(m); }} style={{ padding: 8 }}><Ionicons name="chevron-down" size={24} color={theme.primary} /></TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primary }]} onPress={() => updateReminderTime(reminderHour, reminderMinute)}>
                <Text style={[s.saveBtnTxt, { color: theme.textOn }]}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      {showBookPicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowBookPicker(false)}>
          <View style={s.sheetOverlay}>
            <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => setShowBookPicker(false)} />
            <View style={[s.sheet, { backgroundColor: theme.bg }]}>
              <View style={[s.sheetHdr, { borderBottomColor: theme.border }]}>
                <Text style={[s.sheetTitle, { color: theme.text }]}>Выберите книгу</Text>
                <TouchableOpacity onPress={() => setShowBookPicker(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
              </View>
              <ScrollView style={s.sheetList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {BIBLE_BOOKS.map(b => (
                  <TouchableOpacity key={b.name} style={[s.sheetItem, { borderBottomColor: theme.borderLight }]} onPress={() => { setCustomPatternBook(b.name); setShowBookPicker(false); }}>
                    <Text style={[s.sheetItemTxt, { color: theme.text }]}>{b.name}</Text>
                    <Text style={[s.sheetItemSub, { color: theme.textMuted }]}>{b.chapters} гл.</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
      {showIntervalPicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowIntervalPicker(false)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowIntervalPicker(false)}>
            <View style={[s.picker, { backgroundColor: theme.surface }]}>
              <Text style={[s.pickerTitle, { color: theme.text }]}>Периодичность</Text>
              {([['daily', 'Ежедневно', 'Каждый день'], ['weekly', 'Еженедельно', 'Каждые 7 дней'], ['monthly', 'Ежемесячно', 'Каждые 30 дней'], ['custom', 'Свой интервал', '']] as const).map(([id, label, sub]) => (
                <TouchableOpacity key={id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, backgroundColor: autoBackupInterval === id ? theme.accentLight : 'transparent', marginBottom: 4 }} onPress={() => changeInterval(id as BackupInterval)}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: autoBackupInterval === id ? theme.primary : theme.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    {autoBackupInterval === id && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.primary }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>{label}</Text>
                    {sub ? <Text style={{ fontSize: 12, color: theme.textMuted }}>{sub}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
              {autoBackupInterval === 'custom' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 14, color: theme.textSec }}>Каждые</Text>
                  <TextInput
                    style={{ width: 60, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.border, fontSize: 16, fontWeight: '600', color: theme.text, textAlign: 'center', backgroundColor: theme.bg }}
                    keyboardType="number-pad"
                    value={autoBackupCustomDays}
                    onChangeText={t => { const n = t.replace(/[^0-9]/g, ''); setAutoBackupCustomDays(n); }}
                    onEndEditing={() => saveCustomDays(autoBackupCustomDays || '1')}
                    maxLength={3}
                  />
                  <Text style={{ fontSize: 14, color: theme.textSec }}>дн.</Text>
                </View>
              )}
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primary, marginTop: 12 }]} onPress={() => setShowIntervalPicker(false)}>
                <Text style={[s.saveBtnTxt, { color: theme.textOn }]}>Готово</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      {showBackupHistory && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowBackupHistory(false)}>
          <View style={s.sheetOverlay}>
            <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => setShowBackupHistory(false)} />
            <View style={[s.sheet, { backgroundColor: theme.bg }]}>
              <View style={[s.sheetHdr, { borderBottomColor: theme.border }]}>
                <Text style={[s.sheetTitle, { color: theme.text }]}>История копий</Text>
                <TouchableOpacity onPress={() => setShowBackupHistory(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
              </View>
              <ScrollView style={s.sheetList} nestedScrollEnabled>
                {backupFiles.length === 0 && <Text style={{ padding: 20, textAlign: 'center', color: theme.textMuted, fontStyle: 'italic' }}>Нет сохранённых копий</Text>}
                {backupFiles.map((f, i) => (
                  <View key={f.name} style={[s.sheetItem, { borderBottomColor: theme.borderLight, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', color: theme.text }}>{f.date ? new Date(f.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : f.name}</Text>
                        <Text style={{ fontSize: 12, color: theme.textMuted }}>{f.date ? new Date(f.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''} {f.sizeKB > 0 ? `• ${f.sizeKB} КБ` : ''}</Text>
                      </View>
                      {i === 0 && <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.accentLight }}><Text style={{ fontSize: 11, fontWeight: '600', color: theme.primary }}>Последняя</Text></View>}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.surfaceAlt }} onPress={() => restoreFromBackup(f)}>
                        <Ionicons name="refresh" size={16} color={theme.primary} />
                        <Text style={{ fontSize: 13, fontWeight: '500', color: theme.primary }}>Восстановить</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: theme.surfaceAlt }} onPress={() => deleteBackupFile(f)}>
                        <Ionicons name="trash" size={16} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }, loadingTxt: { marginTop: 16, fontSize: 16, color: C.textSec },
  screen: { flex: 1, backgroundColor: C.bg }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 8 }, headerTxt: { fontSize: 22, fontWeight: '700', color: C.text },
  backBtn: { padding: 8 }, addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, paddingBottom: 4 }, tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 }, tabLbl: { fontSize: 10, marginTop: 2, color: C.textMuted }, tabLblAct: { color: C.primary, fontWeight: '600' },
  list: { padding: 16, paddingTop: 8 }, empty: { alignItems: 'center', paddingTop: 60 }, emptyTxt: { fontSize: 16, color: C.textMuted, marginTop: 16 },
  toolbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  toolBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginHorizontal: 2, flexDirection: 'row' }, toolBtnAct: { backgroundColor: C.primary }, toolTxt: { fontSize: 16, fontWeight: '600', color: C.textSec }, toolTxtAct: { color: C.textOn }, toolDiv: { width: 1, height: 24, backgroundColor: C.border, marginHorizontal: 8 },
  dropdown: { position: 'absolute', bottom: 44, right: 8, backgroundColor: C.surface, borderRadius: 12, padding: 8, elevation: 5, zIndex: 100, minWidth: 100 }, dropItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  card: { backgroundColor: C.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 4, elevation: 1 }, cardHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }, badgeTxt: { fontSize: 12, fontWeight: '600', marginLeft: 4, textTransform: 'capitalize' },
  cardDate: { fontSize: 12, color: C.textMuted }, cardTitle: { fontSize: 17, fontWeight: '600', color: C.text, marginBottom: 6 }, cardPrev: { fontSize: 14, color: C.textSec, lineHeight: 20 },
  tags: { flexDirection: 'row', marginTop: 10, gap: 6 }, tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, tagTxt: { fontSize: 11, color: C.primary, marginLeft: 4, fontWeight: '500' },
  modal: { flex: 1, backgroundColor: C.bg }, modalHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }, modalTitle: { fontSize: 18, fontWeight: '600', color: C.text, flex: 1, textAlign: 'center' }, saveTxt: { fontSize: 16, color: C.primary, fontWeight: '600' }, modalBody: { flex: 1, padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: C.textSec, marginBottom: 8, marginTop: 16 }, input: { backgroundColor: C.surface, borderRadius: 12, padding: 14, fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.border }, textArea: { minHeight: 100, textAlignVertical: 'top' }, inputAct: { borderColor: C.primary, borderWidth: 2 },
  catPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, catOpt: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' }, catOptTxt: { marginLeft: 6, fontWeight: '500', textTransform: 'capitalize' },
  insertBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, marginTop: 8, marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' }, insertTxt: { marginLeft: 6, color: C.primary, fontWeight: '500' },
  verseEdit: { borderRadius: 12, padding: 14, marginBottom: 16, borderLeftWidth: 4 }, verseEditHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, verseEditLeft: { flexDirection: 'row', alignItems: 'center' }, verseEditActs: { flexDirection: 'row', alignItems: 'center', gap: 12 }, verseEditTxt: { fontSize: 14, color: C.textSec, fontStyle: 'italic', lineHeight: 20 },
  verseView: { borderRadius: 12, padding: 16, marginVertical: 12, borderLeftWidth: 4 }, verseHdr: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, verseRef: { fontSize: 14, fontWeight: '700', marginLeft: 6 }, verseTxt: { fontSize: 16, color: C.text, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontStyle: 'italic', lineHeight: 24 },
  viewContent: { flex: 1, padding: 20 }, viewMeta: { marginBottom: 20 }, viewDate: { fontSize: 13, color: C.textMuted, marginTop: 10 }, viewTxt: { fontSize: 16, color: C.text, lineHeight: 26, marginBottom: 8 },
  delBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, margin: 16, borderRadius: 12, borderWidth: 1, borderColor: C.error }, delTxt: { marginLeft: 8, color: C.error, fontWeight: '500' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }, picker: { backgroundColor: C.surface, borderRadius: 16, padding: 20, width: '80%' }, pickerTitle: { fontSize: 18, fontWeight: '600', color: C.text, textAlign: 'center', marginBottom: 16 }, pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }, pickerItem: { padding: 12, borderRadius: 12, borderWidth: 2, width: 50, height: 50, justifyContent: 'center', alignItems: 'center' }, pickerDot: { width: 20, height: 20, borderRadius: 10 },
  colorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.surfaceAlt, gap: 8 }, colorLbl: { fontSize: 14, color: C.textSec, marginRight: 4 }, colorItem: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 }, colorItemAct: { borderWidth: 3 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, margin: 16, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border }, searchIn: { flex: 1, padding: 12, fontSize: 16, color: C.text },
  pickItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: C.surface, borderRadius: 10, marginBottom: 8 }, pickTxt: { fontSize: 16, color: C.text, fontWeight: '500' }, pickSub: { fontSize: 13, color: C.textMuted },
  backNav: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }, backTxt: { fontSize: 16, fontWeight: '600', color: C.primary, marginLeft: 8 },
  chapGrid: { padding: 16 }, chapBtn: { flex: 1, aspectRatio: 1, maxWidth: '18%', margin: 4, backgroundColor: C.surface, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border }, chapTxt: { fontSize: 16, fontWeight: '600', color: C.primary },
  vpItem: { flexDirection: 'row', padding: 14, backgroundColor: C.surface, borderRadius: 10, marginBottom: 8, alignItems: 'flex-start' }, vpItemSel: { backgroundColor: C.accentLight, borderWidth: 1, borderColor: C.accent }, vpCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.border, marginRight: 10, justifyContent: 'center', alignItems: 'center' }, vpNum: { fontSize: 14, fontWeight: '700', color: C.primary, marginRight: 12, minWidth: 28 }, vpTxt: { flex: 1, fontSize: 14, color: C.text, lineHeight: 20 }, vpRef: { fontSize: 13, fontWeight: '700', color: C.primary, marginBottom: 4 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 8 }, filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }, filterBtnAct: { backgroundColor: C.primary, borderColor: C.primary }, filterTxt: { fontSize: 13, color: C.textSec, fontWeight: '500' }, filterTxtAct: { color: C.textOn },
  bookItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.surface, padding: 16, borderRadius: 12, marginBottom: 8 }, bookName: { fontSize: 16, fontWeight: '500', color: C.text }, bookChaps: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  verseItem: { flexDirection: 'row', backgroundColor: C.surface, padding: 14, borderRadius: 10, marginBottom: 8, alignItems: 'flex-start' }, vNum: { fontSize: 12, fontWeight: '700', color: C.primary, marginRight: 10, minWidth: 24 }, vTxt: { flex: 1, fontSize: 15, lineHeight: 22, color: C.text }, bmBtn: { padding: 4, marginLeft: 8 },
  resCnt: { paddingHorizontal: 20, paddingBottom: 8, fontSize: 13, color: C.textMuted }, searchRes: { backgroundColor: C.surface, padding: 16, borderRadius: 12, marginBottom: 8 }, searchRef: { fontSize: 13, fontWeight: '700', color: C.primary, marginBottom: 4 }, searchTxt: { fontSize: 14, color: C.textSec, lineHeight: 20 },
  goHint: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.borderLight }, goHintTxt: { fontSize: 12, color: C.primary, fontWeight: '500' },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.accentLight, borderRadius: 16 }, todayTxt: { fontSize: 13, fontWeight: '600', color: C.primary },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }, monthTxt: { fontSize: 18, fontWeight: '600', color: C.text },
  wdayRow: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 8 }, wdayTxt: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: C.textMuted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 }, calDay: { width: (SW - 16) / 7, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }, calDayOther: { opacity: 0.3 }, calDayToday: { backgroundColor: '#E3F2FD' }, calDaySel: { backgroundColor: C.primary }, calDayTxt: { fontSize: 14, fontWeight: '500', color: C.text }, calDayTxtOther: { color: C.textMuted }, calDayTxtT: { color: C.primary, fontWeight: '700' }, calDayTxtS: { color: C.textOn, fontWeight: '700' },
  dayDots: { flexDirection: 'row', marginTop: 2, gap: 3 }, dot: { width: 5, height: 5, borderRadius: 2.5 },
  dayDetails: { flex: 1, padding: 16 }, dayTitle: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 16 },
  daySec: { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 12 }, daySecHdr: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }, daySecTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  noteText: { fontSize: 14, color: C.textSec, lineHeight: 20 }, emptyDay: { fontSize: 13, color: C.textMuted, fontStyle: 'italic' },
  readItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 }, readCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }, readCheckDone: { backgroundColor: C.success, borderColor: C.success }, readTxt: { flex: 1, fontSize: 14, color: C.text }, readTxtDone: { textDecorationLine: 'line-through', color: C.textMuted },
  goBtn: { padding: 4 },
  dayEntry: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }, dayEntryTitle: { fontSize: 14, color: C.text, fontWeight: '500' }, dayEntryCat: { fontSize: 12, color: C.textMuted, textTransform: 'capitalize' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }, sheet: { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' }, sheetHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }, sheetTitle: { fontSize: 18, fontWeight: '600', color: C.text }, sheetList: { maxHeight: 400 }, sheetItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.borderLight }, sheetItemTxt: { fontSize: 16, color: C.text }, sheetItemSub: { fontSize: 13, color: C.textMuted },
  saveBtn: { backgroundColor: C.primary, margin: 16, padding: 14, borderRadius: 12, alignItems: 'center' }, saveBtnTxt: { color: C.textOn, fontSize: 16, fontWeight: '600' },
  settingsContent: { flex: 1, padding: 16 }, section: { marginBottom: 24 }, secTitle: { fontSize: 14, fontWeight: '600', color: C.textMuted, marginBottom: 12, letterSpacing: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' }, statCard: { flex: 1, backgroundColor: C.surface, padding: 16, borderRadius: 12, alignItems: 'center', marginHorizontal: 4 }, statNum: { fontSize: 24, fontWeight: '700', color: C.text, marginTop: 8 }, statLbl: { fontSize: 11, color: C.textMuted, marginTop: 4 },
  aboutCard: { backgroundColor: C.surface, padding: 20, borderRadius: 12, alignItems: 'center' }, appName: { fontSize: 20, fontWeight: '700', color: C.primary, marginTop: 12 }, appVer: { fontSize: 13, color: C.textMuted, marginTop: 4 }, appDesc: { fontSize: 14, color: C.textSec, textAlign: 'center', marginTop: 12, lineHeight: 20 },
  // Verse formatting styles
  fontBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, marginLeft: 8, gap: 4 }, fontBtnTxt: { fontSize: 16, color: C.primary }, fontLabel: { fontSize: 11, color: C.textMuted, marginTop: 8, marginBottom: 8 }, verseFontLabel: { fontSize: 11, color: C.textMuted, marginLeft: 'auto' },
  fontPickerList: { gap: 8, marginBottom: 16 }, fontPickerItem: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: C.surfaceAlt, borderRadius: 10, gap: 12 }, fontPickerSample: { fontSize: 20, color: C.text }, fontPickerName: { fontSize: 14, color: C.textSec },
  fmtPreview: { backgroundColor: C.surface, padding: 16, borderRadius: 12, marginBottom: 16 }, fmtPreviewTxt: { fontSize: 16, lineHeight: 24, color: C.text },
  fmtRangeRow: { flexDirection: 'row', gap: 16, marginBottom: 8 }, fmtRangeInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, fmtRangeLbl: { fontSize: 14, color: C.textSec }, fmtRangeField: { flex: 1, backgroundColor: C.surface, padding: 12, borderRadius: 8, fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.border },
  fmtHint: { fontSize: 12, color: C.textMuted, marginBottom: 16 }, fmtStyleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  fmtStyleBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border }, fmtStyleBtnAct: { backgroundColor: C.primary, borderColor: C.primary }, fmtStyleTxt: { fontSize: 18, color: C.text }, fmtStyleTxtAct: { color: C.textOn },
  fmtColorRow: { flexDirection: 'row', gap: 10, marginBottom: 16 }, fmtColorItem: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }, fmtColorItemAct: { borderWidth: 3, borderColor: C.primary },
  fmtAddBtn: { flexDirection: 'row', backgroundColor: C.primary, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }, fmtAddTxt: { color: C.textOn, fontSize: 16, fontWeight: '600' },
  fmtHlItem: { flexDirection: 'row', backgroundColor: C.surface, padding: 12, borderRadius: 10, marginBottom: 8, alignItems: 'center' }, fmtHlRange: { fontSize: 13, fontWeight: '600', color: C.primary }, fmtHlPreview: { fontSize: 13, color: C.textSec, fontStyle: 'italic' },
  fmtHlStyles: { flexDirection: 'row', gap: 6, marginTop: 4 }, fmtHlTag: { fontSize: 11, color: C.textMuted, backgroundColor: C.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }, fmtHlColorDot: { width: 16, height: 16, borderRadius: 8 },
  // Folder styles
  folderBar: { minHeight: 52, marginBottom: 8 },
  folderChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, gap: 6, minHeight: 40 },
  folderChipAct: { backgroundColor: C.primary, borderColor: C.primary },
  folderChipTxt: { fontSize: 14, fontWeight: '500', color: C.textSec },
  folderChipTxtAct: { color: C.textOn },
  // Statistics styles
  statBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statBarLbl: { fontSize: 13, color: C.textSec, textTransform: 'capitalize' },
  statBarTrack: { flex: 1, height: 8, backgroundColor: C.borderLight, borderRadius: 4, overflow: 'hidden' },
  statBarFill: { height: 8, borderRadius: 4 },
  statBarCnt: { width: 70, textAlign: 'right', fontSize: 12, color: C.textMuted },
  activityChart: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.surface, borderRadius: 12, padding: 16, paddingTop: 8, height: 140 },
  activityBar: { width: 20, borderRadius: 4, backgroundColor: C.primary },
  achieveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Daily verse styles
  dailyVerse: { backgroundColor: '#FFF8E7', marginHorizontal: 16, marginBottom: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.accent },
  dailyVerseLbl: { fontSize: 13, fontWeight: '700', color: C.warning, letterSpacing: 0.5 },
  dailyVerseTxt: { fontSize: 15, fontStyle: 'italic', color: C.text, lineHeight: 22, marginTop: 8, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  dailyVerseRef: { fontSize: 13, fontWeight: '600', color: C.primary },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
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
});
