import { BIBLE_VERSES, BIBLE_BOOKS } from './BibleVerses';
import type { BibleVerse, BibleBook } from './BibleVerses';

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
  title: string;
}

export interface ProverbVerse {
  chapter: number; verse: number; text: string; reference: string;
  type: 'by_day' | 'random';
}

export interface DailyReadingResult {
  date: string;
  verseOfDay: VerseOfDay;
  datePatternVerses: PatternVerse[];
  psalms: PsalmChapter[];
  proverbs: ProverbVerse[];
}

// Internal utilities
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

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDailyVerse(date: Date, customPattern?: CustomPattern): VerseOfDay {
  try {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const seed = day * 31 + month * 12 + year;

    let pool = BIBLE_VERSES;
    if (customPattern?.bookName) {
      const filtered = BIBLE_VERSES.filter(v => v.book === customPattern.bookName);
      if (filtered.length > 0) {
        pool = filtered;
        if (customPattern.chapterOverride) {
          const chFiltered = pool.filter(v => v.chapter === customPattern.chapterOverride);
          if (chFiltered.length > 0) pool = chFiltered;
        }
        if (customPattern.verseOverride) {
          const vFiltered = pool.filter(v => v.verse === customPattern.verseOverride);
          if (vFiltered.length > 0) pool = vFiltered;
        }
      }
    }

    const idx = Math.abs(seed) % pool.length;
    const v = pool[idx];
    return {
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
      text: v.text,
      reference: `${v.book} ${v.chapter}:${v.verse}`,
    };
  } catch {
    const v = BIBLE_VERSES[0];
    return { book: v.book, chapter: v.chapter, verse: v.verse, text: v.text, reference: `${v.book} ${v.chapter}:${v.verse}` };
  }
}

export function getDatePatternVerses(date: Date): PatternVerse[] {
  try {
    const day = date.getDate();
    const month = date.getMonth() + 1;

    // Primary: chapter === day AND verse === day
    let results = BIBLE_VERSES.filter(v => v.chapter === day && v.verse === day);

    if (results.length < 5) {
      // Secondary: chapter === month AND verse === day
      const secondary = BIBLE_VERSES.filter(v => v.chapter === month && v.verse === day);
      // Merge and deduplicate
      const seen = new Set(results.map(v => v.id));
      for (const v of secondary) {
        if (!seen.has(v.id)) {
          results.push(v);
          seen.add(v.id);
        }
      }
    }

    // If more than 5, pick 5 deterministically
    if (results.length > 5) {
      const rng = seededRandom(dateSeed(date));
      const shuffled = [...results].sort(() => rng() - 0.5);
      results = shuffled.slice(0, 5);
    }

    return results.map(v => ({
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
      text: v.text,
      reference: `${v.book} ${v.chapter}:${v.verse}`,
    }));
  } catch {
    return [];
  }
}

export function getRandomPsalms(date: Date, count: number = 2): PsalmChapter[] {
  try {
    const psalmsBook = BIBLE_BOOKS.find(b => b.name.includes('Псалт'));
    if (!psalmsBook) return [];

    const rng = seededRandom(dateSeed(date));
    const totalChapters = psalmsBook.chapters; // 150
    const picked = new Set<number>();

    while (picked.size < count && picked.size < totalChapters) {
      const ch = Math.floor(rng() * totalChapters) + 1;
      picked.add(ch);
    }

    const result: PsalmChapter[] = [];
    for (const ch of picked) {
      const verses = BIBLE_VERSES
        .filter(v => v.book === psalmsBook.name && v.chapter === ch)
        .map(v => ({ number: v.verse, text: v.text }))
        .sort((a, b) => a.number - b.number);
      if (verses.length > 0) {
        result.push({
          chapter: ch,
          verses,
          title: `${psalmsBook.name} ${ch}`,
        });
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function getDayProverbs(date: Date): ProverbVerse[] {
  try {
    const day = date.getDate();
    const probBook = BIBLE_BOOKS.find(b => b.name.includes('Притч'));
    if (!probBook) return [];

    const result: ProverbVerse[] = [];

    // Proverb 1 (by_day): chapter = day, verse = 1
    const v1 = BIBLE_VERSES.find(v => v.book === probBook.name && v.chapter === day && v.verse === 1);
    if (v1) {
      result.push({
        chapter: v1.chapter,
        verse: v1.verse,
        text: v1.text,
        reference: `${v1.book} ${v1.chapter}:${v1.verse}`,
        type: 'by_day',
      });
    }

    // Proverb 2 (random): seeded random chapter and verse
    const rng = seededRandom(dateSeed(date) + 1);
    const randomChapter = Math.floor(rng() * probBook.chapters) + 1;
    const chapterVerses = BIBLE_VERSES.filter(v => v.book === probBook.name && v.chapter === randomChapter);
    if (chapterVerses.length > 0) {
      const randomIdx = Math.floor(rng() * chapterVerses.length);
      const v2 = chapterVerses[randomIdx];
      // Avoid duplicating proverb 1
      if (!(v2.chapter === v1?.chapter && v2.verse === v1?.verse)) {
        result.push({
          chapter: v2.chapter,
          verse: v2.verse,
          text: v2.text,
          reference: `${v2.book} ${v2.chapter}:${v2.verse}`,
          type: 'random',
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

export function getFullDailyReading(date: Date, customPattern?: CustomPattern): DailyReadingResult {
  return {
    date: fmtDate(date),
    verseOfDay: getDailyVerse(date, customPattern),
    datePatternVerses: getDatePatternVerses(date),
    psalms: getRandomPsalms(date),
    proverbs: getDayProverbs(date),
  };
}
