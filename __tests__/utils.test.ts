import {
  fmtDate,
  getMonthDays,
  getDailyVerseIndex,
  getVColor,
  getFSize,
  extractKeywords,
  parseBlocks,
  parseNote,
  calcStreak,
  Block,
} from '../utils';

// ── fmtDate ──

describe('fmtDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(fmtDate(new Date(2025, 0, 5))).toBe('2025-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(fmtDate(new Date(2025, 2, 9))).toBe('2025-03-09');
  });

  it('handles December correctly', () => {
    expect(fmtDate(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('handles first day of year', () => {
    expect(fmtDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

// ── getMonthDays ──

describe('getMonthDays', () => {
  it('returns exactly 42 entries (6 weeks grid)', () => {
    const days = getMonthDays(2025, 0); // January 2025
    expect(days).toHaveLength(42);
  });

  it('starts on Monday (ISO week)', () => {
    // January 2025 starts on Wednesday, so grid should start Mon Dec 30 2024
    const days = getMonthDays(2025, 0);
    expect(days[0].getDay()).toBe(1); // Monday
  });

  it('contains all days of the month', () => {
    const days = getMonthDays(2025, 1); // February 2025 (28 days)
    const febDays = days.filter(d => d.getMonth() === 1 && d.getFullYear() === 2025);
    expect(febDays).toHaveLength(28);
  });

  it('handles leap year February', () => {
    const days = getMonthDays(2024, 1); // February 2024 (29 days, leap year)
    const febDays = days.filter(d => d.getMonth() === 1 && d.getFullYear() === 2024);
    expect(febDays).toHaveLength(29);
  });

  it('handles month starting on Monday', () => {
    // September 2025 starts on Monday
    const days = getMonthDays(2025, 8);
    expect(days[0].getDate()).toBe(1);
    expect(days[0].getMonth()).toBe(8);
  });
});

// ── getDailyVerseIndex ──

describe('getDailyVerseIndex', () => {
  const totalVerses = 31182;

  it('returns a non-negative integer within bounds', () => {
    const idx = getDailyVerseIndex(new Date(2025, 5, 15), totalVerses);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(totalVerses);
  });

  it('is deterministic for the same date', () => {
    const d = new Date(2025, 3, 20);
    const idx1 = getDailyVerseIndex(d, totalVerses);
    const idx2 = getDailyVerseIndex(d, totalVerses);
    expect(idx1).toBe(idx2);
  });

  it('produces different results for different dates', () => {
    const idx1 = getDailyVerseIndex(new Date(2025, 0, 1), totalVerses);
    const idx2 = getDailyVerseIndex(new Date(2025, 0, 2), totalVerses);
    expect(idx1).not.toBe(idx2);
  });

  it('produces different results for same day different year', () => {
    const idx1 = getDailyVerseIndex(new Date(2025, 5, 15), totalVerses);
    const idx2 = getDailyVerseIndex(new Date(2026, 5, 15), totalVerses);
    expect(idx1).not.toBe(idx2);
  });

  it('works with small totalVerses', () => {
    const idx = getDailyVerseIndex(new Date(2025, 0, 1), 10);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(10);
  });
});

// ── getVColor ──

describe('getVColor', () => {
  it('returns gold color as default', () => {
    expect(getVColor()).toEqual({ id: 'gold', bg: '#FEF9F3', border: '#D4A574' });
  });

  it('returns correct color for known id', () => {
    expect(getVColor('blue')).toEqual({ id: 'blue', bg: '#EBF5FF', border: '#5B9BD5' });
  });

  it('returns default for unknown id', () => {
    expect(getVColor('unknown')).toEqual({ id: 'gold', bg: '#FEF9F3', border: '#D4A574' });
  });

  it('returns correct color for all known ids', () => {
    const ids = ['gold', 'blue', 'green', 'purple', 'red', 'teal'];
    ids.forEach(id => {
      expect(getVColor(id).id).toBe(id);
    });
  });
});

// ── getFSize ──

describe('getFSize', () => {
  it('returns 16 as default', () => {
    expect(getFSize()).toBe(16);
  });

  it('returns correct size for "s"', () => {
    expect(getFSize('s')).toBe(14);
  });

  it('returns correct size for "l"', () => {
    expect(getFSize('l')).toBe(18);
  });

  it('returns correct size for "xl"', () => {
    expect(getFSize('xl')).toBe(22);
  });

  it('returns default for unknown size', () => {
    expect(getFSize('xxl')).toBe(16);
  });
});

// ── extractKeywords ──

describe('extractKeywords', () => {
  it('extracts Russian words longer than 3 chars', () => {
    const result = extractKeywords('Молитва утренняя о мире');
    expect(result).toContain('молитва');
    expect(result).toContain('утренняя');
    expect(result).toContain('мире');
  });

  it('filters out Russian stopwords', () => {
    const result = extractKeywords('Это было для всех нас');
    expect(result).not.toContain('было');
    // 'всех' (4 chars) is not in stopwords (only 'все'), so it passes through
    expect(result).toContain('всех');
  });

  it('filters out short words (<= 3 chars)', () => {
    const result = extractKeywords('Мой сон был ярким');
    expect(result).not.toContain('мой');
    expect(result).not.toContain('сон');
    expect(result).not.toContain('был');
    expect(result).toContain('ярким');
  });

  it('lowercases all words', () => {
    const result = extractKeywords('МОЛИТВА Утренняя');
    expect(result).toContain('молитва');
    expect(result).toContain('утренняя');
  });

  it('removes punctuation', () => {
    const result = extractKeywords('Молитва, утренняя!');
    expect(result).toContain('молитва');
    expect(result).toContain('утренняя');
  });

  it('returns empty for all stopwords', () => {
    expect(extractKeywords('и в на о с')).toEqual([]);
  });

  it('returns empty for empty string', () => {
    expect(extractKeywords('')).toEqual([]);
  });
});

// ── parseBlocks ──

describe('parseBlocks', () => {
  it('parses valid JSON blocks', () => {
    const blocks: Block[] = [
      { id: 'abc', type: 'text', content: 'Hello' },
      { id: 'def', type: 'verse', content: 'Gen 1:1' },
    ];
    const result = parseBlocks(JSON.stringify(blocks));
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('verse');
  });

  it('wraps plain text in a single text block', () => {
    const result = parseBlocks('Just a simple note');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].content).toBe('Just a simple note');
  });

  it('handles empty string', () => {
    const result = parseBlocks('');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].content).toBe('');
  });

  it('handles invalid JSON', () => {
    const result = parseBlocks('{invalid');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].content).toBe('{invalid');
  });

  it('handles JSON array without type field', () => {
    const result = parseBlocks('[1, 2, 3]');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
  });

  it('handles divider blocks', () => {
    const blocks: Block[] = [
      { id: 'a', type: 'text', content: 'Before' },
      { id: 'b', type: 'divider', content: '' },
      { id: 'c', type: 'text', content: 'After' },
    ];
    const result = parseBlocks(JSON.stringify(blocks));
    expect(result).toHaveLength(3);
    expect(result[1].type).toBe('divider');
  });
});

// ── parseNote ──

describe('parseNote', () => {
  it('parses block-based note', () => {
    const blocks: Block[] = [{ id: 'x', type: 'text', content: 'Note content' }];
    const result = parseNote(JSON.stringify(blocks));
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Note content');
  });

  it('wraps legacy plain text note', () => {
    const result = parseNote('Legacy note text');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].content).toBe('Legacy note text');
  });

  it('handles empty string', () => {
    const result = parseNote('');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('');
  });
});

// ── calcStreak ──

describe('calcStreak', () => {
  const today = fmtDate(new Date());
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return fmtDate(d); })();
  const twoDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 2); return fmtDate(d); })();
  const threeDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 3); return fmtDate(d); })();

  it('returns 0 for empty dates', () => {
    expect(calcStreak([])).toBe(0);
  });

  it('returns 1 if only today', () => {
    expect(calcStreak([today])).toBe(1);
  });

  it('returns 0 if only yesterday (no today)', () => {
    // Streak must start from today
    expect(calcStreak([yesterday])).toBe(0);
  });

  it('counts consecutive days from today', () => {
    expect(calcStreak([today, yesterday, twoDaysAgo])).toBe(3);
  });

  it('stops at gaps', () => {
    expect(calcStreak([today, twoDaysAgo, threeDaysAgo])).toBe(1);
  });

  it('deduplicates dates', () => {
    expect(calcStreak([today, today, yesterday])).toBe(2);
  });

  it('handles unordered dates', () => {
    expect(calcStreak([twoDaysAgo, today, yesterday])).toBe(3);
  });
});

describe('fmtRelTime', () => {
  const { fmtRelTime } = require('../utils');

  it('returns "только что" for recent time', () => {
    const now = new Date().toISOString();
    expect(fmtRelTime(now)).toBe('только что');
  });

  it('returns minutes ago for <60 min', () => {
    const d = new Date(Date.now() - 5 * 60000).toISOString();
    expect(fmtRelTime(d)).toBe('5 мин. назад');
  });

  it('returns hours ago for <24 hours', () => {
    const d = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(fmtRelTime(d)).toBe('3 ч. назад');
  });

  it('returns "вчера" for 1 day ago', () => {
    const d = new Date(Date.now() - 25 * 3600000).toISOString();
    expect(fmtRelTime(d)).toBe('вчера');
  });

  it('returns days ago for <7 days', () => {
    const d = new Date(Date.now() - 4 * 86400000).toISOString();
    expect(fmtRelTime(d)).toBe('4 дн. назад');
  });
});

describe('scaledSz', () => {
  const { scaledSz } = require('../utils');

  it('scales font size by multiplier', () => {
    expect(scaledSz(16, 1.0)).toBe(16);
    expect(scaledSz(16, 1.2)).toBe(19);
    expect(scaledSz(16, 0.8)).toBe(13);
  });

  it('rounds to nearest integer', () => {
    expect(scaledSz(15, 1.1)).toBe(17);
  });
});
