// Pure utility functions extracted for testability
// These are also used in App.tsx via import

export interface Block {
  id: string;
  type: 'text' | 'verse' | 'divider';
  content: string;
  boxColor?: string;
  textStyle?: { bold?: boolean; italic?: boolean; underline?: boolean; fontSize?: string; highlight?: string };
}

export const genId = () => Math.random().toString(36).substr(2, 9);

export const parseBlocks = (c: string): Block[] => {
  try {
    const p = JSON.parse(c);
    if (Array.isArray(p) && p[0]?.type) return p;
  } catch {}
  return [{ id: genId(), type: 'text', content: c || '' }];
};

export const fmtDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getMonthDays = (y: number, m: number): Date[] => {
  const days: Date[] = [];
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const pad = first.getDay() === 0 ? 6 : first.getDay() - 1;
  for (let i = pad - 1; i >= 0; i--) days.push(new Date(y, m, -i));
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d));
  while (days.length < 42) days.push(new Date(y, m + 1, days.length - last.getDate() - pad + 1));
  return days;
};

export const getDailyVerseIndex = (date: Date, totalVerses: number): number => {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return Math.abs((seed * 2654435761) | 0) % totalVerses;
};

const VERSE_COLORS = [
  { id: 'gold', bg: '#FEF9F3', border: '#D4A574' },
  { id: 'blue', bg: '#EBF5FF', border: '#5B9BD5' },
  { id: 'green', bg: '#E8F5E9', border: '#66BB6A' },
  { id: 'purple', bg: '#F3E5F5', border: '#AB47BC' },
  { id: 'red', bg: '#FFEBEE', border: '#EF5350' },
  { id: 'teal', bg: '#E0F2F1', border: '#26A69A' },
];

const FONT_SIZES = [{ id: 's', sz: 14 }, { id: 'n', sz: 16 }, { id: 'l', sz: 18 }, { id: 'xl', sz: 22 }];

export const getVColor = (id?: string) => VERSE_COLORS.find(c => c.id === id) || VERSE_COLORS[0];
export const getFSize = (id?: string) => FONT_SIZES.find(s => s.id === id)?.sz || 16;

export const STOPWORDS_RU = new Set(['и','в','на','о','с','к','по','за','из','не','что','как','это','для','но','от','при','его','она','они','мы','то','бы','было','был','быть','все','так','же','уже','ещё','ни','мне','мой','моя','моё','тот','эта','это']);

export const extractKeywords = (title: string) =>
  title.toLowerCase().replace(/[^\wа-яёА-ЯЁ\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !STOPWORDS_RU.has(w));

export const calcStreak = (dates: string[]): number => {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  let streak = 0;
  const today = fmtDate(new Date());
  let expected = today;
  for (const d of sorted) {
    if (d === expected) {
      streak++;
      const prev = new Date(expected);
      prev.setDate(prev.getDate() - 1);
      expected = fmtDate(prev);
    } else if (d < expected) break;
  }
  return streak;
};

export const fmtRelTime = (dateStr: string): string => {
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

export const scaledSz = (base: number, scale: number) => Math.round(base * scale);

export const parseNote = (n: string): Block[] => {
  try {
    const p = JSON.parse(n);
    if (Array.isArray(p) && p[0]?.type) return p;
  } catch {}
  return [{ id: genId(), type: 'text', content: n || '' }];
};
