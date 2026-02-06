import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Alert, StatusBar, SafeAreaView, KeyboardAvoidingView, Platform, Dimensions, AppState, Keyboard } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { BIBLE_VERSES, BIBLE_BOOKS, BibleVerse, BibleBook } from './BibleVerses';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW } = Dimensions.get('window');

const C = {
  primary: '#8B4513', primaryLight: '#A0522D', bg: '#FDFBF7', surface: '#FFFFFF', surfaceAlt: '#F5F2ED',
  text: '#2C1810', textSec: '#5D4037', textMuted: '#8D7B6C', textOn: '#FFFFFF',
  accent: '#D4A574', accentLight: '#E8D5B7', success: '#4A7C59', error: '#8B3A3A', warning: '#B8860B',
  border: '#DED5C8', borderLight: '#EDE8E0', dreamBg: '#E8F4EA', revBg: '#FFF8E7', thoughtBg: '#F0F4F8', prayerBg: '#F5E6F0',
};

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
interface TStyle { bold?: boolean; italic?: boolean; underline?: boolean; fontSize?: string; }
interface Block { id: string; type: 'text' | 'verse'; content: string; boxColor?: string; textStyle?: TStyle; }
interface Entry { id: number; title: string; content: string; category: Cat; created_at: string; linked_verses: string; folder_id: number | null; }
interface Reading { id: number; date: string; book: string; chapter: number; completed: boolean; }
interface Fasting { id: number; start_date: string; end_date: string | null; notes: string; }
interface Folder { id: number; name: string; color: string; icon: string; sort_order: number; }
interface NavTarget { book: string; chapter: number; }

let db: SQLite.SQLiteDatabase;

const FOLDER_ICONS = ['folder', 'heart', 'star', 'flame', 'moon', 'sunny', 'book', 'bulb', 'leaf', 'diamond'] as const;
const FOLDER_COLORS = [
  { id: 'brown', color: '#8B4513' }, { id: 'blue', color: '#5B9BD5' }, { id: 'green', color: '#4A7C59' },
  { id: 'purple', color: '#7B4B94' }, { id: 'red', color: '#8B3A3A' }, { id: 'teal', color: '#26A69A' },
  { id: 'orange', color: '#B8860B' }, { id: 'pink', color: '#C2185B' },
];

const initDb = async () => {
  db = await SQLite.openDatabaseAsync('divine_journal.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, category TEXT DEFAULT 'мысль', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, linked_verses TEXT DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, verse_id TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS reading_plan (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, completed BOOLEAN DEFAULT 0, UNIQUE(date, book, chapter));
    CREATE TABLE IF NOT EXISTS daily_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, notes TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS fasting (id INTEGER PRIMARY KEY AUTOINCREMENT, start_date TEXT NOT NULL, end_date TEXT, notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT DEFAULT '#8B4513', icon TEXT DEFAULT 'folder', sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  try { await db.execAsync('ALTER TABLE entries ADD COLUMN folder_id INTEGER DEFAULT NULL'); } catch (e) {}
};

const genId = () => Math.random().toString(36).substr(2, 9);
const parseBlocks = (c: string): Block[] => { try { const p = JSON.parse(c); if (Array.isArray(p) && p[0]?.type) return p; } catch {} return [{ id: genId(), type: 'text', content: c || '' }]; };
const getVColor = (id?: string) => VERSE_COLORS.find(c => c.id === id) || VERSE_COLORS[0];
const getFSize = (id?: string) => FONT_SIZES.find(s => s.id === id)?.sz || 16;
const getVFont = (id?: string) => VERSE_FONTS.find(f => f.id === id) || VERSE_FONTS[0];
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
  
  return (
    <SafeAreaView style={[s.container, { 
      paddingTop: insets.top,
      paddingBottom: insets.bottom > 0 ? insets.bottom : Platform.OS === 'android' ? 16 : 4 
    }]}>
      {children}
    </SafeAreaView>
  );
};

const AppContent = () => {
  const [tab, setTab] = useState<Tab>('journal');
  const [ready, setReady] = useState(false);
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null);

  useEffect(() => { initDb().then(() => setReady(true)); }, []);

  const navigateToBible = (book: string, chapter: number) => {
    setNavTarget({ book, chapter });
    setTab('bible');
  };

  const clearNavTarget = () => setNavTarget(null);

  if (!ready) return (
    <View style={s.loading}>
      <StatusBar barStyle="dark-content" />
      <Ionicons name="book" size={48} color={C.primary} />
      <Text style={s.loadingTxt}>Загрузка...</Text>
    </View>
  );

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      {tab === 'journal' && <JournalScreen />}
      {tab === 'bible' && <BibleScreen navTarget={navTarget} clearNavTarget={clearNavTarget} />}
      {tab === 'calendar' && <CalendarScreen onNavigate={navigateToBible} />}
      {tab === 'search' && <SearchScreen onNavigate={navigateToBible} />}
      {tab === 'settings' && <SettingsScreen />}
      <View style={s.tabBar}>
        {[['journal','book','Дневник'],['bible','library','Библия'],['calendar','calendar','Календарь'],['search','search','Поиск'],['settings','settings','Ещё']].map(([t,i,l]) => (
          <TouchableOpacity key={t} style={s.tabBtn} onPress={() => setTab(t as Tab)}>
            <Ionicons name={tab === t ? i : `${i}-outline`} size={22} color={tab === t ? C.primary : C.textMuted} />
            <Text style={[s.tabLbl, tab === t && s.tabLblAct]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
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
      <SafeAreaWrapper>
        <AppContent />
      </SafeAreaWrapper>
    </SafeAreaProvider>
  );
}

// Rich Text Toolbar
const RTToolbar = ({ style, onToggle, onSize }: { style: TStyle; onToggle: (k: keyof TStyle) => void; onSize: (id: string) => void }) => {
  const [showSize, setShowSize] = useState(false);
  return (
    <View style={s.toolbar}>
      {[['bold','B','bold'],['italic','I','italic'],['underline','U','underline']].map(([k,t,st]) => (
        <TouchableOpacity key={k} style={[s.toolBtn, style[k as keyof TStyle] && s.toolBtnAct]} onPress={() => onToggle(k as keyof TStyle)}>
          <Text style={[s.toolTxt, style[k as keyof TStyle] && s.toolTxtAct, st === 'bold' && {fontWeight:'bold'}, st === 'italic' && {fontStyle:'italic'}, st === 'underline' && {textDecorationLine:'underline'}]}>{t}</Text>
        </TouchableOpacity>
      ))}
      <View style={s.toolDiv} />
      <TouchableOpacity style={s.toolBtn} onPress={() => setShowSize(!showSize)}>
        <Text style={s.toolTxt}>Aa</Text>
      </TouchableOpacity>
      {showSize && <View style={s.dropdown}>{FONT_SIZES.map(f => (
        <TouchableOpacity key={f.id} style={s.dropItem} onPress={() => { onSize(f.id); setShowSize(false); }}>
          <Text style={{ fontSize: f.sz - 4 }}>{f.sz}px</Text>
        </TouchableOpacity>
      ))}</View>}
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
    <Modal visible={visible} animationType="slide"><SafeAreaView style={s.modal}>
      <View style={s.modalHdr}><TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity><Text style={s.modalTitle}>Форматирование</Text><TouchableOpacity onPress={handleSave}><Text style={s.saveTxt}>Готово</Text></TouchableOpacity></View>
      <ScrollView style={s.modalBody}>
        <Text style={s.verseRef}>{ref}</Text>
        <View style={s.fmtPreview}><HighlightedVerseText text={text} highlights={highlights} fontFamily={font.family} baseStyle={s.fmtPreviewTxt} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Text style={s.label}>Шрифт:</Text>
          <TouchableOpacity style={s.fontBtn} onPress={() => setShowFontPicker(!showFontPicker)}><Text style={[s.fontBtnTxt, { fontFamily: font.family }]}>{font.name}</Text><Ionicons name="chevron-down" size={16} color={C.primary} /></TouchableOpacity>
        </View>
        {showFontPicker && <View style={s.fontPickerList}>{VERSE_FONTS.map(f => (
          <TouchableOpacity key={f.id} style={[s.fontPickerItem, fontId === f.id && { backgroundColor: C.accentLight }]} onPress={() => { setFontId(f.id); setShowFontPicker(false); }}>
            <Text style={[s.fontPickerSample, { fontFamily: f.family }]}>Аа</Text><Text style={s.fontPickerName}>{f.name}</Text>
            {fontId === f.id && <Ionicons name="checkmark" size={20} color={C.primary} style={{ marginLeft: 'auto' }} />}
          </TouchableOpacity>
        ))}</View>}
        <Text style={[s.label, { marginTop: 20 }]}>Выделение слов</Text>
        <Text style={s.fmtHint}>Позиции символов (1-{text.length})</Text>
        <View style={s.fmtRangeRow}>
          <View style={s.fmtRangeInput}><Text style={s.fmtRangeLbl}>От:</Text><TextInput style={s.fmtRangeField} value={rangeStart} onChangeText={setRangeStart} keyboardType="number-pad" placeholder="1" placeholderTextColor={C.textMuted} /></View>
          <View style={s.fmtRangeInput}><Text style={s.fmtRangeLbl}>До:</Text><TextInput style={s.fmtRangeField} value={rangeEnd} onChangeText={setRangeEnd} keyboardType="number-pad" placeholder={String(text.length)} placeholderTextColor={C.textMuted} /></View>
        </View>
        <View style={s.fmtStyleRow}>
          <TouchableOpacity style={[s.fmtStyleBtn, hlBold && s.fmtStyleBtnAct]} onPress={() => setHlBold(!hlBold)}><Text style={[s.fmtStyleTxt, { fontWeight: 'bold' }, hlBold && s.fmtStyleTxtAct]}>B</Text></TouchableOpacity>
          <TouchableOpacity style={[s.fmtStyleBtn, hlItalic && s.fmtStyleBtnAct]} onPress={() => setHlItalic(!hlItalic)}><Text style={[s.fmtStyleTxt, { fontStyle: 'italic' }, hlItalic && s.fmtStyleTxtAct]}>I</Text></TouchableOpacity>
          <TouchableOpacity style={[s.fmtStyleBtn, hlUnderline && s.fmtStyleBtnAct]} onPress={() => setHlUnderline(!hlUnderline)}><Text style={[s.fmtStyleTxt, { textDecorationLine: 'underline' }, hlUnderline && s.fmtStyleTxtAct]}>U</Text></TouchableOpacity>
        </View>
        <Text style={s.fontLabel}>Цвет:</Text>
        <View style={s.fmtColorRow}>
          <TouchableOpacity style={[s.fmtColorItem, { backgroundColor: 'transparent' }, !hlColor && s.fmtColorItemAct]} onPress={() => setHlColor(null)}><Ionicons name="close" size={16} color={C.textMuted} /></TouchableOpacity>
          {HIGHLIGHT_COLORS.map(c => <TouchableOpacity key={c.id} style={[s.fmtColorItem, { backgroundColor: c.bg }, hlColor === c.id && s.fmtColorItemAct]} onPress={() => setHlColor(c.id)} />)}
        </View>
        <TouchableOpacity style={s.fmtAddBtn} onPress={addHighlight}><Ionicons name="add-circle" size={20} color={C.textOn} /><Text style={s.fmtAddTxt}>Добавить</Text></TouchableOpacity>
        {highlights.length > 0 && <>{highlights.map((hl, idx) => (
          <View key={idx} style={s.fmtHlItem}>
            <View style={{ flex: 1 }}><Text style={s.fmtHlRange}>{hl.start + 1}-{hl.end}</Text><Text style={s.fmtHlPreview} numberOfLines={1}>"{text.slice(hl.start, hl.end)}"</Text>
              <View style={s.fmtHlStyles}>{hl.bold && <Text style={s.fmtHlTag}>Ж</Text>}{hl.italic && <Text style={s.fmtHlTag}>К</Text>}{hl.underline && <Text style={s.fmtHlTag}>П</Text>}{hl.color && <View style={[s.fmtHlColorDot, { backgroundColor: HIGHLIGHT_COLORS.find(c => c.id === hl.color)?.bg }]} />}</View>
            </View>
            <TouchableOpacity onPress={() => setHighlights(highlights.filter((_, i) => i !== idx))}><Ionicons name="trash-outline" size={20} color={C.error} /></TouchableOpacity>
          </View>
        ))}</>}
      </ScrollView>
    </SafeAreaView></Modal>
  );
};

// Journal Screen
const JournalScreen = () => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([{ id: genId(), type: 'text', content: '' }]);
  const [cat, setCat] = useState<Cat>('мысль');
  const [vpick, setVpick] = useState(false);
  const [insertId, setInsertId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Entry | null>(null);
  const [colorPick, setColorPick] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tStyle, setTStyle] = useState<TStyle>({});
  const [fasts, setFasts] = useState<Fasting[]>([]);
  const [formatVerse, setFormatVerse] = useState<{ blockId: string; data: VerseData } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const blockPositions = useRef<Record<string, number>>({});
  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<number | null>(null);
  const [entryFolder, setEntryFolder] = useState<number | null>(null);
  const [showFolderMgmt, setShowFolderMgmt] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0].color);
  const [folderIcon, setFolderIcon] = useState<string>('folder');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const load = useCallback(async () => {
    setEntries(await db.getAllAsync<Entry>('SELECT * FROM entries ORDER BY created_at DESC'));
    setFasts(await db.getAllAsync<Fasting>('SELECT * FROM fasting'));
    setFolders(await db.getAllAsync<Folder>('SELECT * FROM folders ORDER BY sort_order ASC'));
  }, []);

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

  const save = async () => {
    if (!title.trim()) return Alert.alert('Ошибка', 'Введите заголовок');
    const cJson = JSON.stringify(blocks);
    const linked = blocks.filter(b => b.type === 'verse').map(b => { try { const d = JSON.parse(b.content); return { book: d.book, chapter: d.chapter, verse: d.verse }; } catch { return null; } }).filter(Boolean);
    if (editing) await db.runAsync('UPDATE entries SET title=?, content=?, category=?, linked_verses=?, folder_id=? WHERE id=?', [title, cJson, cat, JSON.stringify(linked), entryFolder, editing.id]);
    else await db.runAsync('INSERT INTO entries (title, content, category, linked_verses, folder_id) VALUES (?,?,?,?,?)', [title, cJson, cat, JSON.stringify(linked), entryFolder]);
    reset(); load();
  };

  const del = (id: number) => Alert.alert('Удалить?', '', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: async () => { await db.runAsync('DELETE FROM entries WHERE id=?', [id]); load(); setViewing(null); }}]);

  const openEdit = (e?: Entry) => {
    if (e) { setEditing(e); setTitle(e.title); setBlocks(parseBlocks(e.content)); setCat(e.category); setEntryFolder(e.folder_id); }
    else { reset(); setBlocks([{ id: genId(), type: 'text', content: '' }]); setEntryFolder(activeFolder); }
    setViewing(null); setModal(true);
  };

  const reset = () => { setEditing(null); setTitle(''); setBlocks([{ id: genId(), type: 'text', content: '' }]); setCat('мысль'); setModal(false); setActiveId(null); setTStyle({}); setEntryFolder(null); };

  const updateBlock = (id: string, txt: string) => setBlocks(bs => bs.map(b => b.id === id ? { ...b, content: txt, textStyle: tStyle } : b));
  const toggleStyle = (k: keyof TStyle) => { const nv = !tStyle[k]; setTStyle(p => ({ ...p, [k]: nv })); if (activeId) setBlocks(bs => bs.map(b => b.id === activeId ? { ...b, textStyle: { ...b.textStyle, [k]: nv } } : b)); };
  const setFontSize = (sz: string) => { setTStyle(p => ({ ...p, fontSize: sz })); if (activeId) setBlocks(bs => bs.map(b => b.id === activeId ? { ...b, textStyle: { ...b.textStyle, fontSize: sz } } : b)); };

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

  const renderText = (b: Block) => { if (!b.content) return null; const st: any = { ...s.viewTxt }; if (b.textStyle?.bold) st.fontWeight = 'bold'; if (b.textStyle?.italic) st.fontStyle = 'italic'; if (b.textStyle?.underline) st.textDecorationLine = 'underline'; if (b.textStyle?.fontSize) st.fontSize = getFSize(b.textStyle.fontSize); return <Text style={st}>{b.content}</Text>; };

  const filteredEntries = activeFolder ? entries.filter(e => e.folder_id === activeFolder) : entries;
  const getFolderName = (id: number | null) => { if (!id) return null; const f = folders.find(x => x.id === id); return f || null; };

  return (
    <View style={[s.screen, { paddingBottom: 80 }]}>
      <View style={s.header}><Text style={s.headerTxt}>📖 Духовный дневник</Text><TouchableOpacity style={s.addBtn} onPress={() => openEdit()}><Ionicons name="add" size={28} color={C.textOn} /></TouchableOpacity></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.folderBar} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        <TouchableOpacity style={[s.folderChip, !activeFolder && s.folderChipAct]} onPress={() => setActiveFolder(null)}>
          <Ionicons name="albums" size={14} color={!activeFolder ? C.textOn : C.textSec} />
          <Text style={[s.folderChipTxt, !activeFolder && s.folderChipTxtAct]}>Все ({entries.length})</Text>
        </TouchableOpacity>
        {folders.map(f => (
          <TouchableOpacity key={f.id} style={[s.folderChip, activeFolder === f.id && { backgroundColor: f.color, borderColor: f.color }]} onPress={() => setActiveFolder(activeFolder === f.id ? null : f.id)}>
            <Ionicons name={f.icon as any} size={14} color={activeFolder === f.id ? C.textOn : f.color} />
            <Text style={[s.folderChipTxt, activeFolder === f.id && s.folderChipTxtAct]}>{f.name} ({folderEntryCount(f.id)})</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.folderChip, { borderStyle: 'dashed' }]} onPress={() => { setEditingFolder(null); setFolderName(''); setFolderColor(FOLDER_COLORS[0].color); setFolderIcon('folder'); setShowFolderMgmt(true); }}>
          <Ionicons name="add" size={14} color={C.primary} />
          <Text style={[s.folderChipTxt, { color: C.primary }]}>Папка</Text>
        </TouchableOpacity>
      </ScrollView>
      <FlatList data={filteredEntries} keyExtractor={i => i.id.toString()} renderItem={({ item }) => {
        const cs = catStyle(item.category), vc = vCount(item.content), pv = preview(item.content);
        const isFasting = isFastingEntry(item);
        return (
          <TouchableOpacity style={[s.card, { borderLeftColor: cs.color }, isFasting && { backgroundColor: '#F9F0FA', borderLeftColor: '#9C27B0' }]} onPress={() => setViewing(item)} onLongPress={() => del(item.id)}>
            <View style={s.cardHdr}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.badge, { backgroundColor: cs.bg }]}><Ionicons name={catIcon(item.category)} size={14} color={cs.color} /><Text style={[s.badgeTxt, { color: cs.color }]}>{item.category}</Text></View>
                {isFasting && <Ionicons name="flame" size={14} color="#9C27B0" />}
              </View>
              <Text style={s.cardDate}>{new Date(item.created_at).toLocaleDateString('ru-RU')}</Text>
            </View>
            <Text style={s.cardTitle}>{item.title}</Text>
            {pv ? <Text style={s.cardPrev} numberOfLines={2}>{pv}</Text> : null}
            {(vc > 0 || item.folder_id) && <View style={s.tags}>{item.folder_id && (() => { const fl = getFolderName(item.folder_id); return fl ? <View style={[s.tag, { backgroundColor: fl.color + '20' }]}><Ionicons name={fl.icon as any} size={10} color={fl.color} /><Text style={[s.tagTxt, { color: fl.color }]}>{fl.name}</Text></View> : null; })()}{vc > 0 && <View style={s.tag}><Ionicons name="book" size={10} color={C.primary} /><Text style={s.tagTxt}>{vc} стих{vc > 1 ? (vc < 5 ? 'а' : 'ов') : ''}</Text></View>}</View>}
          </TouchableOpacity>
        );
      }} contentContainerStyle={s.list} ListEmptyComponent={<View style={s.empty}><Ionicons name="journal-outline" size={64} color={C.border} /><Text style={s.emptyTxt}>Записей пока нет</Text></View>} />

      <Modal visible={viewing !== null} animationType="slide">
        <SafeAreaView style={s.modal}>
          <View style={s.modalHdr}><TouchableOpacity onPress={() => setViewing(null)}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity><Text style={s.modalTitle} numberOfLines={1}>{viewing?.title}</Text><TouchableOpacity onPress={() => viewing && openEdit(viewing)}><Ionicons name="create-outline" size={24} color={C.primary} /></TouchableOpacity></View>
          <ScrollView style={s.viewContent}>{viewing && <><View style={s.viewMeta}><View style={[s.badge, { backgroundColor: catStyle(viewing.category).bg }]}><Ionicons name={catIcon(viewing.category)} size={14} color={catStyle(viewing.category).color} /><Text style={[s.badgeTxt, { color: catStyle(viewing.category).color }]}>{viewing.category}</Text></View><Text style={s.viewDate}>{new Date(viewing.created_at).toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text></View>{parseBlocks(viewing.content).map(b => <View key={b.id}>{b.type === 'text' ? renderText(b) : renderVerse(b)}</View>)}</>}</ScrollView>
          <TouchableOpacity style={s.delBtn} onPress={() => viewing && del(viewing.id)}><Ionicons name="trash-outline" size={20} color={C.error} /><Text style={s.delTxt}>Удалить</Text></TouchableOpacity>
        </SafeAreaView>
      </Modal>

      <Modal visible={modal} animationType="slide">
        <SafeAreaView style={s.modal}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalHdr}><TouchableOpacity onPress={reset}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity><Text style={s.modalTitle}>{editing ? 'Редактировать' : 'Новая запись'}</Text><TouchableOpacity onPress={save}><Text style={s.saveTxt}>Сохранить</Text></TouchableOpacity></View>
          <ScrollView ref={scrollRef} style={s.modalBody} keyboardShouldPersistTaps="handled" scrollEventThrottle={16}>
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
            <Text style={s.label}>Заголовок</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Название..." placeholderTextColor={C.textMuted} />
            <Text style={s.label}>Содержание</Text>
            {blocks.map((b, i) => <View key={b.id} onLayout={(e) => { blockPositions.current[b.id] = e.nativeEvent.layout.y; }}>{b.type === 'text' ? <View><TextInput style={[s.input, s.textArea, activeId === b.id && s.inputAct, b.textStyle?.fontSize && { fontSize: getFSize(b.textStyle.fontSize) }, b.textStyle?.bold && { fontWeight: 'bold' }, b.textStyle?.italic && { fontStyle: 'italic' }]} value={b.content} onChangeText={t => updateBlock(b.id, t)} onFocus={() => { setActiveId(b.id); setTStyle(b.textStyle || {}); setTimeout(() => { const y = blockPositions.current[b.id]; if (y !== undefined && scrollRef.current) { scrollRef.current.scrollTo({ y: Math.max(0, y - 100), animated: true }); } }, 150); }} placeholder={i === 0 ? "Начните писать..." : "Продолжайте..."} placeholderTextColor={C.textMuted} multiline textAlignVertical="top" /><TouchableOpacity style={s.insertBtn} onPress={() => { setInsertId(b.id); setVpick(true); }}><Ionicons name="add-circle" size={18} color={C.primary} /><Text style={s.insertTxt}>Вставить стихи</Text></TouchableOpacity></View> : <View style={[s.verseEdit, { backgroundColor: getVColor(b.boxColor).bg, borderLeftColor: getVColor(b.boxColor).border }]}>{(() => { try { const d = JSON.parse(b.content) as VerseData; const font = getVFont(d.fontFamily); const ref = d.verseEnd ? `${d.book} ${d.chapter}:${d.verse}-${d.verseEnd}` : `${d.book} ${d.chapter}:${d.verse}`; return <><View style={s.verseEditHdr}><View style={s.verseEditLeft}><Ionicons name="book" size={16} color={getVColor(b.boxColor).border} /><Text style={[s.verseRef, { color: getVColor(b.boxColor).border }]}>{ref}</Text>{d.fontFamily && <Text style={s.verseFontLabel}>{font.name}</Text>}</View><View style={s.verseEditActs}><TouchableOpacity onPress={() => openVerseFormat(b.id)}><Ionicons name="text" size={20} color={getVColor(b.boxColor).border} /></TouchableOpacity><TouchableOpacity onPress={() => setColorPick(b.id)}><Ionicons name="color-palette" size={20} color={getVColor(b.boxColor).border} /></TouchableOpacity><TouchableOpacity onPress={() => removeBlock(b.id)}><Ionicons name="close-circle" size={22} color={C.error} /></TouchableOpacity></View></View><HighlightedVerseText text={d.text} highlights={d.highlights} fontFamily={font.family} baseStyle={s.verseEditTxt} /></>; } catch { return null; } })()}</View>}</View>)}
            <View style={{ height: 200 }} />
          </ScrollView>
          {activeId && keyboardVisible && <RTToolbar style={tStyle} onToggle={toggleStyle} onSize={setFontSize} />}
        </KeyboardAvoidingView></SafeAreaView>
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
    <Modal visible={visible} animationType="slide"><SafeAreaView style={s.modal}>
      <View style={s.modalHdr}><TouchableOpacity onPress={close}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity><Text style={s.modalTitle}>Выбрать стихи {sel.size > 0 && `(${sel.size})`}</Text>{sel.size > 0 ? <TouchableOpacity onPress={confirm}><Text style={s.saveTxt}>Добавить</Text></TouchableOpacity> : <View style={{ width: 60 }} />}</View>
      {sel.size > 0 && <View style={s.colorRow}><Text style={s.colorLbl}>Цвет:</Text>{VERSE_COLORS.map(c => <TouchableOpacity key={c.id} style={[s.colorItem, { backgroundColor: c.bg, borderColor: c.border }, col === c.id && s.colorItemAct]} onPress={() => setCol(c.id)} />)}</View>}
      <View style={s.searchBox}><Ionicons name="search" size={20} color={C.textMuted} /><TextInput style={s.searchIn} value={q} onChangeText={setQ} placeholder="Поиск..." placeholderTextColor={C.textMuted} />{q.length > 0 && <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={20} color={C.textMuted} /></TouchableOpacity>}</View>
      {q.length > 2 ? <FlatList data={results} keyExtractor={i => i.id} renderItem={({ item }) => <TouchableOpacity style={[s.vpItem, sel.has(item.id) && s.vpItemSel]} onPress={() => toggle(item)}><View style={s.vpCheck}>{sel.has(item.id) ? <Ionicons name="checkmark" size={16} color={C.primary} /> : null}</View><View style={{ flex: 1 }}><Text style={s.vpRef}>{item.book} {item.chapter}:{item.verse}</Text><Text style={s.vpTxt} numberOfLines={2}>{item.text}</Text></View></TouchableOpacity>} contentContainerStyle={s.list} />
      : !book ? <FlatList data={BIBLE_BOOKS} keyExtractor={i => i.name} renderItem={({ item }) => <TouchableOpacity style={s.pickItem} onPress={() => setBook(item)}><Text style={s.pickTxt}>{item.name}</Text><Text style={s.pickSub}>{item.chapters} глав</Text></TouchableOpacity>} contentContainerStyle={s.list} />
      : !chap ? <View style={{ flex: 1 }}><TouchableOpacity style={s.backNav} onPress={() => setBook(null)}><Ionicons name="arrow-back" size={20} color={C.primary} /><Text style={s.backTxt}>{book.name}</Text></TouchableOpacity><FlatList key="ch" data={Array.from({ length: book.chapters }, (_, i) => i + 1)} numColumns={5} keyExtractor={i => i.toString()} renderItem={({ item }) => <TouchableOpacity style={s.chapBtn} onPress={() => setChap(item)}><Text style={s.chapTxt}>{item}</Text></TouchableOpacity>} contentContainerStyle={s.chapGrid} /></View>
      : <View style={{ flex: 1 }}><TouchableOpacity style={s.backNav} onPress={() => setChap(null)}><Ionicons name="arrow-back" size={20} color={C.primary} /><Text style={s.backTxt}>{book.name} {chap}</Text></TouchableOpacity><FlatList data={chapVs()} keyExtractor={i => i.id} renderItem={({ item }) => <TouchableOpacity style={[s.vpItem, sel.has(item.id) && s.vpItemSel]} onPress={() => toggle(item)}><View style={s.vpCheck}>{sel.has(item.id) ? <Ionicons name="checkmark" size={16} color={C.primary} /> : null}</View><Text style={s.vpNum}>{item.verse}</Text><Text style={s.vpTxt}>{item.text}</Text></TouchableOpacity>} contentContainerStyle={s.list} /></View>}
    </SafeAreaView></Modal>
  );
};

// Calendar Screen
const CalendarScreen = ({ onNavigate }: { onNavigate: (book: string, chapter: number) => void }) => {
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
    const days = Math.ceil((new Date(selDate).getTime() - new Date(activeFast.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
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
      const start = new Date(f.start_date);
      const end = f.end_date ? new Date(f.end_date) : today;
      total += Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    });
    return total;
  }, [fasts]);

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
    <View style={[s.screen, { paddingBottom: 80 }]}>
      <View style={s.header}>
        <Text style={s.headerTxt}>📅 Календарь</Text>
        <TouchableOpacity onPress={goToday} style={s.todayBtn}><Text style={s.todayTxt}>Сегодня</Text></TouchableOpacity>
      </View>
      <View style={s.monthNav}>
        <TouchableOpacity onPress={prevM}><Ionicons name="chevron-back" size={24} color={C.primary} /></TouchableOpacity>
        <Text style={s.monthTxt}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextM}><Ionicons name="chevron-forward" size={24} color={C.primary} /></TouchableOpacity>
      </View>
      <View style={s.wdayRow}>{WDAYS.map(d => <Text key={d} style={s.wdayTxt}>{d}</Text>)}</View>
      <View style={s.calGrid}>
        {days.map((d, i) => {
          const ds = fmtDate(d), isCur = d.getMonth() === month, isT = ds === todayStr, isS = ds === selDate;
          const { hasE, hasR, compR, totR, hasF } = dayInfo(d);
          return (
            <TouchableOpacity key={i} style={[s.calDay, !isCur && s.calDayOther, isT && s.calDayToday, isS && s.calDaySel, hasF && { backgroundColor: '#F3E5F5' }]} onPress={() => setSelDate(ds)}>
              <Text style={[s.calDayTxt, !isCur && s.calDayTxtOther, isT && s.calDayTxtT, isS && s.calDayTxtS]}>{d.getDate()}</Text>
              {(hasE || hasR || hasF) && <View style={s.dayDots}>{hasE ? <View style={[s.dot, { backgroundColor: C.primary }]} /> : null}{hasR ? <View style={[s.dot, { backgroundColor: compR === totR ? C.success : C.warning }]} /> : null}{hasF ? <View style={[s.dot, { backgroundColor: '#9C27B0' }]} /> : null}</View>}
            </TouchableOpacity>
          );
        })}
      </View>
      <ScrollView style={s.dayDetails}>
        <Text style={s.dayTitle}>{fmtDateRu(selDate)}</Text>
        <View style={s.daySec}>
          <View style={s.daySecHdr}>
            <Ionicons name="create" size={18} color={C.primary} />
            <Text style={s.daySecTitle}>Заметки дня</Text>
            <TouchableOpacity onPress={() => { setNoteTxt(notes[selDate] || ''); setEditNote(true); }}><Ionicons name="pencil" size={18} color={C.textMuted} /></TouchableOpacity>
          </View>
          {notes[selDate] ? <Text style={s.noteText}>{notes[selDate]}</Text> : <Text style={s.emptyDay}>Нажмите карандаш для добавления</Text>}
        </View>
        <View style={s.daySec}>
          <View style={s.daySecHdr}>
            <Ionicons name="book" size={18} color={C.success} />
            <Text style={s.daySecTitle}>План чтения</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setShowPlanGen(true)}><Ionicons name="calendar" size={20} color={C.warning} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAdd(true)}><Ionicons name="add-circle" size={22} color={C.primary} /></TouchableOpacity>
            </View>
          </View>
          {selRs.length > 0 ? selRs.map(r => (
            <TouchableOpacity key={r.id} style={s.readItem} onPress={() => toggleRead(r.id, r.completed)} onLongPress={() => delRead(r.id)}>
              <View style={[s.readCheck, r.completed && s.readCheckDone]}>{r.completed ? <Ionicons name="checkmark" size={14} color={C.textOn} /> : null}</View>
              <Text style={[s.readTxt, r.completed && s.readTxtDone]}>{r.book} {r.chapter}</Text>
              <TouchableOpacity style={s.goBtn} onPress={() => onNavigate(r.book, r.chapter)}><Ionicons name="arrow-forward-circle" size={22} color={C.primary} /></TouchableOpacity>
            </TouchableOpacity>
          )) : <Text style={s.emptyDay}>Нет чтения</Text>}
        </View>
        <View style={s.daySec}>
          <View style={s.daySecHdr}>
            <Ionicons name="journal" size={18} color={C.warning} />
            <Text style={s.daySecTitle}>Записи</Text>
          </View>
          {selEs.length > 0 ? selEs.map(e => (
            <View key={e.id} style={s.dayEntry}>
              <Text style={s.dayEntryTitle}>{e.title}</Text>
              <Text style={s.dayEntryCat}>{e.category}</Text>
            </View>
          )) : <Text style={s.emptyDay}>Нет записей</Text>}
        </View>
        
        {/* Fasting Section */}
        <View style={[s.daySec, selIsFasting && { backgroundColor: '#F3E5F5', borderLeftWidth: 3, borderLeftColor: '#9C27B0' }]}>
          <View style={s.daySecHdr}>
            <Ionicons name="flame" size={18} color="#9C27B0" />
            <Text style={s.daySecTitle}>Пост</Text>
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

      <Modal visible={editNote} animationType="slide" transparent>
        <View style={s.sheetOverlay}>
          <View style={s.sheet}>
            <View style={s.sheetHdr}>
              <Text style={s.sheetTitle}>Заметка дня</Text>
              <TouchableOpacity onPress={() => setEditNote(false)}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
            </View>
            <TextInput style={[s.input, s.textArea, { margin: 16 }]} value={noteTxt} onChangeText={setNoteTxt} placeholder="Мысли, молитвы..." placeholderTextColor={C.textMuted} multiline textAlignVertical="top" />
            <TouchableOpacity style={s.saveBtn} onPress={saveNote}><Text style={s.saveBtnTxt}>Сохранить</Text></TouchableOpacity>
          </View>
        </View>
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
    </View>
  );
};

// Bible Screen
const BibleScreen = ({ navTarget, clearNavTarget }: { navTarget: NavTarget | null; clearNavTarget: () => void }) => {
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
    <View style={[s.screen, { paddingBottom: 80 }]}>
      <View style={s.header}><Text style={s.headerTxt}>📜 Библия</Text></View>
      <View style={s.filterRow}>{[['all','Все'],['old','Ветхий'],['new','Новый']].map(([k,l]) => <TouchableOpacity key={k} style={[s.filterBtn, filter === k && s.filterBtnAct]} onPress={() => setFilter(k as any)}><Text style={[s.filterTxt, filter === k && s.filterTxtAct]}>{l}</Text></TouchableOpacity>)}</View>
      <FlatList data={books} keyExtractor={i => i.name} renderItem={({ item }) => <TouchableOpacity style={s.bookItem} onPress={() => setBook(item)}><View><Text style={s.bookName}>{item.name}</Text><Text style={s.bookChaps}>{item.chapters} глав</Text></View><Ionicons name="chevron-forward" size={20} color={C.textMuted} /></TouchableOpacity>} contentContainerStyle={s.list} />
    </View>
  );

  if (!chap) return (
    <View style={[s.screen, { paddingBottom: 80 }]}>
      <View style={s.header}><TouchableOpacity onPress={() => setBook(null)} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={C.text} /></TouchableOpacity><Text style={s.headerTxt}>{book.name}</Text><View style={{ width: 40 }} /></View>
      <FlatList key="cg" data={Array.from({ length: book.chapters }, (_, i) => i + 1)} numColumns={5} keyExtractor={i => i.toString()} renderItem={({ item }) => <TouchableOpacity style={s.chapBtn} onPress={() => setChap(item)}><Text style={s.chapTxt}>{item}</Text></TouchableOpacity>} contentContainerStyle={s.chapGrid} />
    </View>
  );

  return (
    <View style={[s.screen, { paddingBottom: 80 }]}>
      <View style={s.header}><TouchableOpacity onPress={() => setChap(null)} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={C.text} /></TouchableOpacity><Text style={s.headerTxt}>{book.name} {chap}</Text><View style={{ width: 40 }} /></View>
      {verses.length === 0 ? <View style={s.empty}><Ionicons name="alert-circle-outline" size={48} color={C.border} /><Text style={s.emptyTxt}>Стихи не найдены</Text></View>
      : <FlatList data={verses} keyExtractor={i => i.id} renderItem={({ item }) => (
        <View style={s.verseItem}>
          <Text style={s.vNum}>{item.verse}</Text>
          <Text style={s.vTxt}>{item.text}</Text>
          <TouchableOpacity onPress={() => toggleBm(item.id)} style={s.bmBtn}><Ionicons name={bmarks.has(item.id) ? 'bookmark' : 'bookmark-outline'} size={20} color={bmarks.has(item.id) ? C.primary : C.textMuted} /></TouchableOpacity>
        </View>
      )} contentContainerStyle={s.list} />}
    </View>
  );
};

// Search Screen
const SearchScreen = ({ onNavigate }: { onNavigate: (book: string, chapter: number) => void }) => {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<BibleVerse[]>([]);
  const search = useCallback(() => { if (!q.trim()) { setRes([]); return; } setRes(BIBLE_VERSES.filter(v => v.text.toLowerCase().includes(q.toLowerCase()) || v.book.toLowerCase().includes(q.toLowerCase())).slice(0, 100)); }, [q]);
  useEffect(() => { const t = setTimeout(search, 300); return () => clearTimeout(t); }, [q, search]);
  return (
    <View style={[s.screen, { paddingBottom: 80 }]}>
      <View style={s.header}><Text style={s.headerTxt}>🔍 Поиск</Text></View>
      <View style={s.searchBox}><Ionicons name="search" size={20} color={C.textMuted} /><TextInput style={s.searchIn} value={q} onChangeText={setQ} placeholder="Поиск по Библии..." placeholderTextColor={C.textMuted} />{q.length > 0 && <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={20} color={C.textMuted} /></TouchableOpacity>}</View>
      {res.length > 0 && <Text style={s.resCnt}>Найдено: {res.length}</Text>}
      <FlatList data={res} keyExtractor={i => i.id} renderItem={({ item }) => (
        <TouchableOpacity style={s.searchRes} onPress={() => onNavigate(item.book, item.chapter)}>
          <Text style={s.searchRef}>{item.book} {item.chapter}:{item.verse}</Text>
          <Text style={s.searchTxt}>{item.text}</Text>
          <View style={s.goHint}><Text style={s.goHintTxt}>Открыть в Библии →</Text></View>
        </TouchableOpacity>
      )} contentContainerStyle={s.list} />
    </View>
  );
};

// Settings Screen
const SettingsScreen = () => {
  const [stats, setStats] = useState({ e: 0, b: 0, r: 0 });
  useEffect(() => { (async () => { const e = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM entries'); const b = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM bookmarks'); const r = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM reading_plan WHERE completed=1'); setStats({ e: e?.c || 0, b: b?.c || 0, r: r?.c || 0 }); })(); }, []);
  return (
    <View style={[s.screen, { paddingBottom: 80 }]}><View style={s.header}><Text style={s.headerTxt}>⚙️ Настройки</Text></View>
      <ScrollView style={s.settingsContent}>
        <View style={s.section}><Text style={s.secTitle}>СТАТИСТИКА</Text><View style={s.statsRow}><View style={s.statCard}><Ionicons name="journal" size={24} color={C.primary} /><Text style={s.statNum}>{stats.e}</Text><Text style={s.statLbl}>Записей</Text></View><View style={s.statCard}><Ionicons name="bookmark" size={24} color={C.warning} /><Text style={s.statNum}>{stats.b}</Text><Text style={s.statLbl}>Закладок</Text></View><View style={s.statCard}><Ionicons name="checkmark-circle" size={24} color={C.success} /><Text style={s.statNum}>{stats.r}</Text><Text style={s.statLbl}>Прочитано</Text></View></View></View>
        <View style={s.section}><Text style={s.secTitle}>О ПРИЛОЖЕНИИ</Text><View style={s.aboutCard}><Ionicons name="book" size={40} color={C.primary} /><Text style={s.appName}>Divine Journal</Text><Text style={s.appVer}>Версия 3.2</Text><Text style={s.appDesc}>Духовный дневник с библейскими стихами, форматированием текста, выделением слов, календарём и планом чтения.</Text></View></View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }, loadingTxt: { marginTop: 16, fontSize: 16, color: C.textSec },
  screen: { flex: 1, backgroundColor: C.bg }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 8 }, headerTxt: { fontSize: 22, fontWeight: '700', color: C.text },
  backBtn: { padding: 8 }, addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, paddingBottom: Platform.OS === 'android' ? 24 : 4, position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000 }, tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 }, tabLbl: { fontSize: 10, marginTop: 2, color: C.textMuted }, tabLblAct: { color: C.primary, fontWeight: '600' },
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
  folderBar: { maxHeight: 44, marginBottom: 4 },
  folderChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, gap: 6 },
  folderChipAct: { backgroundColor: C.primary, borderColor: C.primary },
  folderChipTxt: { fontSize: 13, fontWeight: '500', color: C.textSec },
  folderChipTxtAct: { color: C.textOn },
});
