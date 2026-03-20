import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme, NavTarget } from '../App'
import { BIBLE_VERSES } from '../data/BibleVerses'
import { Search, X } from 'lucide-react'

interface Props {
  navigateToBible: (target: NavTarget) => void
}

interface SearchResult {
  id: string
  book: string
  chapter: number
  verse: number
  text: string
}

export default function SearchScreen({ navigateToBible }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const bg = theme.bg
  const card = theme.card
  const border = theme.border
  const text = theme.text
  const sub = theme.subtext
  const primary = theme.primary

  const doSearch = useCallback((q: string) => {
    const trimmed = q.trim().toLowerCase()
    if (trimmed.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    // Search in a microtask to avoid blocking render
    setTimeout(() => {
      const matches: SearchResult[] = []
      for (let i = 0; i < BIBLE_VERSES.length && matches.length < 100; i++) {
        const v = BIBLE_VERSES[i]
        if (v.text.toLowerCase().includes(trimmed) || v.id.toLowerCase().includes(trimmed)) {
          matches.push({ id: v.id, book: v.book, chapter: v.chapter, verse: v.verse, text: v.text })
        }
      }
      setResults(matches)
      setSearching(false)
    }, 0)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text
    const q = query.trim().toLowerCase()
    const idx = text.toLowerCase().indexOf(q)
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#ffeb3b', color: '#000', borderRadius: 2, padding: '0 1px' }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Search header */}
      <div className="px-3 py-3 border-b flex-shrink-0" style={{ background: card, borderColor: border }}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: bg, border: `1px solid ${border}` }}
        >
          <Search size={16} color={sub} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: Math.max(16, fs(15)), color: text }}
            placeholder="Поиск по Библии..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query.length > 0 && (
            <button onClick={() => { setQuery(''); setResults([]) }} className="active:opacity-70">
              <X size={16} color={sub} />
            </button>
          )}
        </div>
        {results.length > 0 && (
          <p className="text-xs mt-2 px-1" style={{ color: sub }}>
            {results.length === 100 ? 'Первые 100 результатов' : `${results.length} результатов`}
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 scroll-area">
        {query.length < 2 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 px-8">
            <Search size={32} color={sub} />
            <p className="text-center" style={{ color: sub, fontSize: fs(14) }}>
              Введите минимум 2 символа для поиска по тексту Библии
            </p>
          </div>
        )}
        {searching && (
          <div className="flex items-center justify-center h-20">
            <p style={{ color: sub, fontSize: fs(14) }}>Поиск...</p>
          </div>
        )}
        {!searching && query.length >= 2 && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p style={{ color: sub, fontSize: fs(14) }}>Ничего не найдено</p>
          </div>
        )}
        {results.map(r => (
          <button
            key={r.id}
            className="w-full text-left px-4 py-3 border-b active:opacity-70"
            style={{ borderColor: border }}
            onClick={() => navigateToBible({ book: r.book, chapter: r.chapter, verse: r.verse })}
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-semibold" style={{ color: primary }}>
                {r.book} {r.chapter}:{r.verse}
              </span>
            </div>
            <p className="leading-snug allow-select" style={{ fontSize: fs(14), color: text }}>
              {highlightText(r.text, query)}
            </p>
          </button>
        ))}
        {results.length > 0 && <div className="h-4" />}
      </div>
    </div>
  )
}
