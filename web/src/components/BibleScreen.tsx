import React, { useEffect, useRef, useState } from 'react'
import { useTheme, NavTarget } from '../App'
import { BIBLE_BOOKS, BIBLE_VERSES } from '../data/BibleVerses'
import { db } from '../db'
import { ChevronLeft, ChevronRight, Bookmark, BookmarkCheck } from 'lucide-react'

interface Props {
  navTarget: NavTarget | null
  clearNavTarget: () => void
}

type View = 'books' | 'chapters' | 'verses'

export default function BibleScreen({ navTarget, clearNavTarget }: Props) {
  const { theme, fontScale, bibleFont } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const [view, setView] = useState<View>('books')
  const [filter, setFilter] = useState<'all' | 'old' | 'new'>('all')
  const [selectedBook, setSelectedBook] = useState<string | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [scrollToVerse, setScrollToVerse] = useState<number | null>(null)
  const verseRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const listRef = useRef<HTMLDivElement>(null)

  const loadBookmarks = async () => {
    const bms = await db.bookmarks.toArray()
    setBookmarks(new Set(bms.map(b => b.verse_id)))
  }

  useEffect(() => { loadBookmarks() }, [])

  // Handle navigation from outside
  useEffect(() => {
    if (!navTarget) return
    setSelectedBook(navTarget.book)
    setSelectedChapter(navTarget.chapter)
    setView('verses')
    if (navTarget.verse) setScrollToVerse(navTarget.verse)
    clearNavTarget()
  }, [navTarget, clearNavTarget])

  // Scroll to verse after render
  useEffect(() => {
    if (!scrollToVerse) return
    const timer = setTimeout(() => {
      const el = verseRefs.current[scrollToVerse]
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setScrollToVerse(null)
    }, 200)
    return () => clearTimeout(timer)
  }, [scrollToVerse, view])

  const toggleBookmark = async (verseId: string) => {
    if (bookmarks.has(verseId)) {
      const bm = await db.bookmarks.where('verse_id').equals(verseId).first()
      if (bm?.id) await db.bookmarks.delete(bm.id)
    } else {
      await db.bookmarks.add({ verse_id: verseId, created_at: new Date().toISOString() })
    }
    loadBookmarks()
  }

  const filteredBooks = BIBLE_BOOKS.filter(b =>
    filter === 'all' || b.testament === filter
  )

  const bookObj = BIBLE_BOOKS.find(b => b.name === selectedBook)
  const chapterCount = bookObj?.chapters ?? 0

  const verses = selectedBook && selectedChapter
    ? BIBLE_VERSES.filter(v => v.book === selectedBook && v.chapter === selectedChapter)
    : []

  const goNextChapter = () => {
    if (!selectedBook || !selectedChapter) return
    if (selectedChapter < chapterCount) {
      setSelectedChapter(selectedChapter + 1)
      listRef.current?.scrollTo(0, 0)
    } else {
      // next book
      const idx = BIBLE_BOOKS.findIndex(b => b.name === selectedBook)
      if (idx < BIBLE_BOOKS.length - 1) {
        setSelectedBook(BIBLE_BOOKS[idx + 1].name)
        setSelectedChapter(1)
        listRef.current?.scrollTo(0, 0)
      }
    }
  }

  const goPrevChapter = () => {
    if (!selectedBook || !selectedChapter) return
    if (selectedChapter > 1) {
      setSelectedChapter(selectedChapter - 1)
      listRef.current?.scrollTo(0, 0)
    } else {
      const idx = BIBLE_BOOKS.findIndex(b => b.name === selectedBook)
      if (idx > 0) {
        const prevBook = BIBLE_BOOKS[idx - 1]
        setSelectedBook(prevBook.name)
        setSelectedChapter(prevBook.chapters)
        listRef.current?.scrollTo(0, 0)
      }
    }
  }

  const bibleFontFamily = {
    serif: 'Georgia, Cambria, serif',
    sans: 'Inter, sans-serif',
    mono: 'JetBrains Mono, monospace',
    lora: 'Lora, Georgia, serif',
    palatino: 'Palatino Linotype, Palatino, serif',
  }[bibleFont] ?? 'Georgia, serif'

  const bg = theme.bg
  const card = theme.card
  const border = theme.border
  const text = theme.text
  const sub = theme.subtext
  const primary = theme.primary

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div className="flex-shrink-0 border-b" style={{ background: card, borderColor: border }}>
        <div className="flex items-center px-4 py-3 gap-2">
          {view !== 'books' && (
            <button
              className="active:opacity-70 mr-1"
              onClick={() => {
                if (view === 'verses') setView('chapters')
                else if (view === 'chapters') setView('books')
              }}
            >
              <ChevronLeft size={22} color={primary} />
            </button>
          )}
          <h1 className="font-bold flex-1" style={{ fontSize: fs(18), color: text }}>
            {view === 'books' && 'Библия'}
            {view === 'chapters' && selectedBook}
            {view === 'verses' && `${selectedBook} ${selectedChapter}`}
          </h1>
        </div>

        {view === 'books' && (
          <div className="flex gap-2 px-4 pb-3">
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
      </div>

      {/* Books list */}
      {view === 'books' && (
        <div className="flex-1 scroll-area">
          {filteredBooks.map(book => (
            <button
              key={book.name}
              className="w-full flex items-center justify-between px-4 py-3 border-b active:opacity-70"
              style={{ borderColor: border }}
              onClick={() => { setSelectedBook(book.name); setView('chapters') }}
            >
              <div className="text-left">
                <p style={{ fontSize: fs(15), color: text, fontWeight: 500 }}>{book.name}</p>
                <p style={{ fontSize: fs(12), color: sub }}>{book.chapters} гл.</p>
              </div>
              <ChevronRight size={16} color={sub} />
            </button>
          ))}
        </div>
      )}

      {/* Chapter grid */}
      {view === 'chapters' && (
        <div className="flex-1 scroll-area p-4">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: chapterCount }, (_, i) => i + 1).map(ch => (
              <button
                key={ch}
                onClick={() => { setSelectedChapter(ch); setView('verses') }}
                className="aspect-square rounded-xl flex items-center justify-center font-semibold active:opacity-70"
                style={{
                  background: card,
                  color: text,
                  fontSize: fs(15),
                  border: `1px solid ${border}`,
                }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Verses */}
      {view === 'verses' && (
        <>
          <div ref={listRef} className="flex-1 scroll-area px-4 py-3">
            {verses.map(v => {
              const verseId = v.id
              const bookmarked = bookmarks.has(verseId)
              return (
                <div
                  key={v.verse}
                  ref={el => { verseRefs.current[v.verse] = el }}
                  className="flex gap-2 py-1.5 border-b"
                  style={{ borderColor: border + '60' }}
                >
                  <span
                    className="flex-shrink-0 font-semibold mt-0.5"
                    style={{ fontSize: fs(12), color: sub, minWidth: 20 }}
                  >
                    {v.verse}
                  </span>
                  <p
                    className="flex-1 leading-relaxed"
                    style={{ fontSize: fs(15), color: text, fontFamily: bibleFontFamily }}
                  >
                    {v.text}
                  </p>
                  <button
                    className="flex-shrink-0 mt-0.5 active:opacity-70"
                    onClick={() => toggleBookmark(verseId)}
                  >
                    {bookmarked
                      ? <BookmarkCheck size={16} color={primary} />
                      : <Bookmark size={16} color={border} />
                    }
                  </button>
                </div>
              )
            })}
            <div className="h-4" />
          </div>

          {/* Prev / Next chapter nav */}
          <div
            className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t"
            style={{ background: card, borderColor: border }}
          >
            <button
              onClick={goPrevChapter}
              className="flex items-center gap-1 active:opacity-70"
              style={{ color: selectedChapter === 1 && BIBLE_BOOKS[0]?.name === selectedBook ? sub : primary }}
            >
              <ChevronLeft size={18} />
              <span style={{ fontSize: fs(13) }}>Назад</span>
            </button>
            <button
              onClick={() => setView('chapters')}
              className="active:opacity-70"
              style={{ color: sub, fontSize: fs(13) }}
            >
              {selectedBook} {selectedChapter}
            </button>
            <button
              onClick={goNextChapter}
              className="flex items-center gap-1 active:opacity-70"
              style={{ color: primary }}
            >
              <span style={{ fontSize: fs(13) }}>Вперёд</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
