import React, { useMemo, useState } from 'react'
import { useTheme } from '../App'
import { BIBLE_BOOKS, BIBLE_VERSES } from '../data/BibleVerses'
import { VerseData } from '../types'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'

interface Props {
  onSelect: (verse: VerseData) => void
  onClose: () => void
}

type View = 'books' | 'chapters' | 'verses'

export default function VersePicker({ onSelect, onClose }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const [view, setView] = useState<View>('books')
  const [book, setBook] = useState<string | null>(null)
  const [chapter, setChapter] = useState<number | null>(null)
  const [selected, setSelected] = useState<VerseData | null>(null)
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

  const handleSelectVerse = (v: typeof BIBLE_VERSES[0]) => {
    const data: VerseData = {
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
      text: v.text,
    }
    setSelected(data)
  }

  const handleInsert = () => {
    if (selected) onSelect(selected)
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
              if (view === 'verses') { setView('chapters'); setSelected(null) }
              else if (view === 'chapters') setView('books')
              else onClose()
            }}
            className="active:opacity-70"
          >
            {view === 'books' ? <X size={20} color={sub} /> : <ChevronLeft size={20} color={primary} />}
          </button>
          <span className="font-semibold" style={{ color: text, fontSize: fs(16) }}>
            {view === 'books' && 'Выбрать стих'}
            {view === 'chapters' && book}
            {view === 'verses' && `${book} ${chapter}`}
          </span>
          <button
            onClick={handleInsert}
            disabled={!selected}
            className="active:opacity-70 flex items-center gap-1"
            style={{ color: selected ? primary : sub }}
          >
            <Check size={20} />
          </button>
        </div>

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

          {/* Verses list */}
          {view === 'verses' && verses.map(v => {
            const isSelected = selected?.verse === v.verse && selected?.chapter === v.chapter && selected?.book === v.book
            return (
              <button
                key={v.verse}
                className="w-full flex items-start gap-3 px-4 py-3 border-b active:opacity-70"
                style={{
                  borderColor: border,
                  background: isSelected ? primary + '18' : 'transparent',
                }}
                onClick={() => handleSelectVerse(v)}
              >
                <span
                  className="font-semibold flex-shrink-0 mt-0.5"
                  style={{ fontSize: fs(12), color: isSelected ? primary : sub, minWidth: 20 }}
                >
                  {v.verse}
                </span>
                <p
                  className="flex-1 text-left leading-relaxed"
                  style={{ fontSize: fs(14), color: isSelected ? text : text }}
                >
                  {v.text}
                </p>
                {isSelected && <Check size={16} color={primary} className="flex-shrink-0 mt-0.5" />}
              </button>
            )
          })}
        </div>

        {/* Selected verse preview */}
        {selected && (
          <div
            className="flex-shrink-0 px-4 py-3 border-t"
            style={{ background: card, borderColor: border }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: primary }}>
              Выбрано: {selected.book} {selected.chapter}:{selected.verse}
            </p>
            <p className="italic line-clamp-2" style={{ fontSize: fs(13), color: text, fontFamily: 'Georgia, serif' }}>
              {selected.text}
            </p>
            <button
              onClick={handleInsert}
              className="mt-2 w-full py-2 rounded-xl font-semibold active:opacity-70"
              style={{ background: primary, color: '#fff', fontSize: fs(14) }}
            >
              Вставить стих
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
