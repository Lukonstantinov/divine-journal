import React, { useMemo, useState } from 'react'
import { useTheme } from '../App'
import { BIBLE_BOOKS, BIBLE_VERSES, BibleVerse } from '../data/BibleVerses'
import { VerseData, VERSE_COLORS } from '../types'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'

interface Props {
  // Receives one or more verses (consecutive verses are grouped into ranges) plus the chosen color category
  onSelect: (verses: VerseData[], color: string) => void
  onClose: () => void
}

type View = 'books' | 'chapters' | 'verses'

const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

// Group selected verses, merging consecutive verses (same book/chapter, +1) into a single ranged VerseData
function buildVerseData(verses: BibleVerse[]): VerseData[] {
  const sorted = [...verses].sort(
    (a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter || a.verse - b.verse
  )
  const out: VerseData[] = []
  let grp: BibleVerse[] = [sorted[0]]
  const flush = () => {
    const f = grp[0], l = grp[grp.length - 1]
    out.push({
      book: f.book,
      chapter: f.chapter,
      verse: f.verse,
      verseEnd: grp.length > 1 ? l.verse : undefined,
      text: grp.map(v => cap(v.text)).join(' '),
    })
  }
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1], c = sorted[i]
    if (p.book === c.book && p.chapter === c.chapter && c.verse === p.verse + 1) grp.push(c)
    else { flush(); grp = [c] }
  }
  flush()
  return out
}

export default function VersePicker({ onSelect, onClose }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const [view, setView] = useState<View>('books')
  const [book, setBook] = useState<string | null>(null)
  const [chapter, setChapter] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [color, setColor] = useState('gold')
  const [filter, setFilter] = useState<'all' | 'old' | 'new'>('all')

  const { bg, card, border, text, subtext: sub, primary } = theme

  const filteredBooks = BIBLE_BOOKS.filter(b =>
    filter === 'all' || b.testament === filter
  )
  const bookObj = BIBLE_BOOKS.find(b => b.name === book)
  const chapterCount = bookObj?.chapters ?? 0

  const verses = useMemo(() => {
    if (!book || !chapter) return []
    return BIBLE_VERSES.filter(v => v.book === book && v.chapter === chapter)
  }, [book, chapter])

  const toggleVerse = (v: BibleVerse) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(v.id)) next.delete(v.id)
      else next.add(v.id)
      return next
    })
  }

  const handleInsert = () => {
    if (selected.size === 0) return
    const picked = BIBLE_VERSES.filter(v => selected.has(v.id))
    onSelect(buildVerseData(picked), color)
  }

  return (
    <div
      className="ios-modal z-50 flex flex-col modal-backdrop"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="flex flex-col mt-auto rounded-t-2xl overflow-hidden"
        style={{ background: bg, maxHeight: 'calc(var(--app-height, 100dvh) * 0.9)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: border, background: card }}
        >
          <button
            onClick={() => {
              if (view === 'verses') setView('chapters')
              else if (view === 'chapters') setView('books')
              else onClose()
            }}
            className="active:opacity-70"
          >
            {view === 'books' ? <X size={20} color={sub} /> : <ChevronLeft size={20} color={primary} />}
          </button>
          <span className="font-semibold" style={{ color: text, fontSize: fs(16) }}>
            {view === 'books' && `Выбрать стихи${selected.size > 0 ? ` (${selected.size})` : ''}`}
            {view === 'chapters' && book}
            {view === 'verses' && `${book} ${chapter}`}
          </span>
          <button
            onClick={handleInsert}
            disabled={selected.size === 0}
            className="active:opacity-70 font-semibold"
            style={{ color: selected.size > 0 ? primary : sub, fontSize: fs(15) }}
          >
            Добавить
          </button>
        </div>

        {/* Color category row (shown once at least one verse is selected) */}
        {selected.size > 0 && (
          <div className="px-4 py-2 border-b flex-shrink-0" style={{ borderColor: border, background: card }}>
            <p className="mb-1.5" style={{ fontSize: fs(11), color: sub }}>Категория стиха:</p>
            <div className="flex gap-3 overflow-x-auto scroll-area pb-1">
              {VERSE_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.id)}
                  className="flex flex-col items-center gap-1 flex-shrink-0 active:opacity-70"
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: 26, height: 26,
                      background: c.bg,
                      border: `2px solid ${color === c.id ? c.border : border}`,
                      boxShadow: color === c.id ? `0 0 0 2px ${c.border}` : 'none',
                    }}
                  />
                  <span
                    className="text-center"
                    style={{
                      fontSize: fs(9),
                      maxWidth: 56,
                      color: color === c.id ? c.border : sub,
                      fontWeight: color === c.id ? 700 : 400,
                    }}
                  >
                    {c.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Testament filter (books view only) */}
        {view === 'books' && (
          <div className="flex gap-2 px-4 py-2 flex-shrink-0 border-b" style={{ borderColor: border }}>
            {(['all', 'old', 'new'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded-full text-xs font-medium active:opacity-70"
                style={{
                  background: filter === f ? primary : 'transparent',
                  color: filter === f ? '#fff' : sub,
                  border: `1px solid ${filter === f ? primary : border}`,
                }}
              >
                {f === 'all' ? 'Все' : f === 'old' ? 'Ветхий' : 'Новый'}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto scroll-area">
          {/* Books list */}
          {view === 'books' && filteredBooks.map(b => (
            <button
              key={b.name}
              className="w-full flex items-center justify-between px-4 py-3 border-b active:opacity-70"
              style={{ borderColor: border }}
              onClick={() => { setBook(b.name); setView('chapters') }}
            >
              <span style={{ fontSize: fs(15), color: text, fontWeight: 500 }}>{b.name}</span>
              <div className="flex items-center gap-1">
                <span style={{ fontSize: fs(12), color: sub }}>{b.chapters} гл.</span>
                <ChevronRight size={14} color={sub} />
              </div>
            </button>
          ))}

          {/* Chapters grid */}
          {view === 'chapters' && (
            <div className="p-4 grid grid-cols-5 gap-2">
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map(ch => (
                <button
                  key={ch}
                  onClick={() => { setChapter(ch); setView('verses') }}
                  className="aspect-square rounded-xl flex items-center justify-center font-semibold active:opacity-70"
                  style={{ background: card, color: text, fontSize: fs(15), border: `1px solid ${border}` }}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}

          {/* Verses list — tap to toggle, multi-select */}
          {view === 'verses' && verses.map(v => {
            const isSelected = selected.has(v.id)
            return (
              <button
                key={v.verse}
                className="w-full flex items-start gap-3 px-4 py-3 border-b active:opacity-70"
                style={{
                  borderColor: border,
                  background: isSelected ? primary + '18' : 'transparent',
                }}
                onClick={() => toggleVerse(v)}
              >
                <span
                  className="flex items-center justify-center flex-shrink-0 rounded mt-0.5"
                  style={{
                    width: 22, height: 22,
                    border: `2px solid ${isSelected ? primary : border}`,
                    background: isSelected ? primary : 'transparent',
                  }}
                >
                  {isSelected
                    ? <Check size={14} color="#fff" />
                    : <span style={{ fontSize: fs(11), color: sub }}>{v.verse}</span>}
                </span>
                <p
                  className="flex-1 text-left leading-relaxed"
                  style={{ fontSize: fs(14), color: text }}
                >
                  {v.text}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
