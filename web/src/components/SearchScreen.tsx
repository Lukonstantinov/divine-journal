import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme, NavTarget } from '../App'
import { BIBLE_VERSES } from '../data/BibleVerses'
import { db, Entry } from '../db'
import { Block, CATEGORIES, catColor, catLabel, fmtDateRu, parseBlocks } from '../types'
import { Search, X, BookOpen, Notebook } from 'lucide-react'

interface Props {
  navigateToBible: (target: NavTarget) => void
}

interface BibleResult {
  id: string
  book: string
  chapter: number
  verse: number
  text: string
}

export default function SearchScreen({ navigateToBible }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const [activeTab, setActiveTab] = useState<'bible' | 'journal'>('bible')

  // ─── Bible search ───────────────────────────────
  const [bibleQuery, setBibleQuery] = useState('')
  const [bibleResults, setBibleResults] = useState<BibleResult[]>([])
  const [searching, setSearching] = useState(false)
  const bibleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bibleInputRef = useRef<HTMLInputElement>(null)

  // ─── Journal search ─────────────────────────────
  const [journalQuery, setJournalQuery] = useState('')
  const [journalResults, setJournalResults] = useState<Entry[]>([])
  const [filterCats, setFilterCats] = useState<string[]>([])
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [allEntries, setAllEntries] = useState<Entry[]>([])
  const journalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Viewer
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null)

  const { bg, card, border, text, subtext: sub, primary } = theme

  // Load all entries once for journal search
  useEffect(() => {
    db.entries.orderBy('created_at').reverse().toArray().then(setAllEntries)
  }, [])

  // Bible search
  const doBibleSearch = useCallback((q: string) => {
    const trimmed = q.trim().toLowerCase()
    if (trimmed.length < 2) { setBibleResults([]); setSearching(false); return }
    setSearching(true)
    setTimeout(() => {
      const matches: BibleResult[] = []
      for (let i = 0; i < BIBLE_VERSES.length && matches.length < 100; i++) {
        const v = BIBLE_VERSES[i]
        if (v.text.toLowerCase().includes(trimmed) || v.id.toLowerCase().includes(trimmed)) {
          matches.push({ id: v.id, book: v.book, chapter: v.chapter, verse: v.verse, text: v.text })
        }
      }
      setBibleResults(matches)
      setSearching(false)
    }, 0)
  }, [])

  useEffect(() => {
    if (bibleDebounceRef.current) clearTimeout(bibleDebounceRef.current)
    bibleDebounceRef.current = setTimeout(() => doBibleSearch(bibleQuery), 300)
    return () => { if (bibleDebounceRef.current) clearTimeout(bibleDebounceRef.current) }
  }, [bibleQuery, doBibleSearch])

  // Journal search (debounced, filtered via useMemo-equivalent)
  const applyJournalFilters = useCallback((entries: Entry[], q: string, cats: string[], from: string, to: string) => {
    const trimmed = q.trim().toLowerCase()
    return entries.filter(e => {
      if (cats.length > 0 && !cats.includes(e.category)) return false
      const d = e.created_at.slice(0, 10)
      if (from && d < from) return false
      if (to && d > to) return false
      if (trimmed.length < 2) return cats.length > 0 || from || to
      const titleMatch = e.title.toLowerCase().includes(trimmed)
      const contentMatch = (() => {
        try {
          return (JSON.parse(e.content) as Block[]).some(b => b.type === 'text' && b.content.toLowerCase().includes(trimmed))
        } catch { return e.content.toLowerCase().includes(trimmed) }
      })()
      return titleMatch || contentMatch
    })
  }, [])

  useEffect(() => {
    if (journalDebounceRef.current) clearTimeout(journalDebounceRef.current)
    journalDebounceRef.current = setTimeout(() => {
      setJournalResults(applyJournalFilters(allEntries, journalQuery, filterCats, filterDateFrom, filterDateTo))
    }, 300)
    return () => { if (journalDebounceRef.current) clearTimeout(journalDebounceRef.current) }
  }, [journalQuery, filterCats, filterDateFrom, filterDateTo, allEntries, applyJournalFilters])

  // Auto-focus Bible input when switching to that tab
  useEffect(() => {
    if (activeTab === 'bible') setTimeout(() => bibleInputRef.current?.focus(), 100)
  }, [activeTab])

  const highlightText = (str: string, query: string): React.ReactNode => {
    if (!query.trim()) return str
    const q = query.trim().toLowerCase()
    const idx = str.toLowerCase().indexOf(q)
    if (idx === -1) return str
    return (
      <>
        {str.slice(0, idx)}
        <mark style={{ background: '#ffeb3b', color: '#000', borderRadius: 2, padding: '0 1px' }}>
          {str.slice(idx, idx + q.length)}
        </mark>
        {str.slice(idx + q.length)}
      </>
    )
  }

  const journalHasQuery = journalQuery.trim().length >= 2 || filterCats.length > 0 || filterDateFrom || filterDateTo

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Tab switcher */}
      <div className="flex border-b flex-shrink-0" style={{ background: card, borderColor: border }}>
        {([
          { id: 'bible', label: 'Библия', Icon: BookOpen },
          { id: 'journal', label: 'Записи', Icon: Notebook },
        ] as { id: 'bible' | 'journal'; label: string; Icon: typeof BookOpen }[]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-2 py-3 active:opacity-70 border-b-2 transition-colors"
            style={{
              borderColor: activeTab === id ? primary : 'transparent',
              color: activeTab === id ? primary : sub,
            }}
          >
            <Icon size={16} />
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════ BIBLE TAB ═══════════════ */}
      {activeTab === 'bible' && (
        <>
          <div className="px-3 py-3 border-b flex-shrink-0" style={{ background: card, borderColor: border }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: bg, border: `1px solid ${border}` }}>
              <Search size={16} color={sub} />
              <input
                ref={bibleInputRef}
                className="flex-1 bg-transparent outline-none"
                style={{ fontSize: Math.max(16, fs(15)), color: text }}
                placeholder="Поиск по Библии..."
                value={bibleQuery}
                onChange={(e: { target: { value: string } }) => setBibleQuery(e.target.value)}
              />
              {bibleQuery && (
                <button onClick={() => { setBibleQuery(''); setBibleResults([]) }} className="active:opacity-70">
                  <X size={16} color={sub} />
                </button>
              )}
            </div>
            {bibleResults.length > 0 && (
              <p className="text-xs mt-2 px-1" style={{ color: sub }}>
                {bibleResults.length === 100 ? 'Первые 100 результатов' : `${bibleResults.length} результатов`}
              </p>
            )}
          </div>
          <div className="flex-1 scroll-area">
            {bibleQuery.length < 2 && (
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
            {!searching && bibleQuery.length >= 2 && bibleResults.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40">
                <p style={{ color: sub, fontSize: fs(14) }}>Ничего не найдено</p>
              </div>
            )}
            {bibleResults.map((r: BibleResult) => (
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
                  {highlightText(r.text, bibleQuery)}
                </p>
              </button>
            ))}
            {bibleResults.length > 0 && <div className="h-4" />}
          </div>
        </>
      )}

      {/* ═══════════════ JOURNAL TAB ═══════════════ */}
      {activeTab === 'journal' && (
        <>
          <div className="px-3 py-3 flex-shrink-0 border-b" style={{ background: card, borderColor: border }}>
            {/* Query input */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-2" style={{ background: bg, border: `1px solid ${border}` }}>
              <Search size={16} color={sub} />
              <input
                className="flex-1 bg-transparent outline-none"
                style={{ fontSize: Math.max(16, fs(15)), color: text }}
                placeholder="Поиск по записям..."
                value={journalQuery}
                onChange={(e: { target: { value: string } }) => setJournalQuery(e.target.value)}
              />
              {journalQuery && (
                <button onClick={() => setJournalQuery('')} className="active:opacity-70">
                  <X size={16} color={sub} />
                </button>
              )}
            </div>

            {/* Category filter chips */}
            <div className="flex gap-1.5 overflow-x-auto mb-2" style={{ scrollbarWidth: 'none' }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setFilterCats((prev: string[]) => prev.includes(c.id) ? prev.filter((x: string) => x !== c.id) : [...prev, c.id])}
                  className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs active:opacity-70"
                  style={{
                    background: filterCats.includes(c.id) ? c.color : 'transparent',
                    color: filterCats.includes(c.id) ? '#fff' : c.color,
                    border: `1px solid ${c.color}`,
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: sub }}>С:</span>
              <input type="date" value={filterDateFrom} onChange={(e: { target: { value: string } }) => setFilterDateFrom(e.target.value)}
                className="flex-1 bg-transparent border rounded px-1 py-0.5 text-xs"
                style={{ color: text, borderColor: border }} />
              <span style={{ color: sub }}>По:</span>
              <input type="date" value={filterDateTo} onChange={(e: { target: { value: string } }) => setFilterDateTo(e.target.value)}
                className="flex-1 bg-transparent border rounded px-1 py-0.5 text-xs"
                style={{ color: text, borderColor: border }} />
              {(filterCats.length > 0 || filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setFilterCats([]); setFilterDateFrom(''); setFilterDateTo('') }}
                  className="text-xs px-2 py-0.5 rounded active:opacity-70"
                  style={{ color: '#ef4444', border: `1px solid #ef4444` }}
                >×</button>
              )}
            </div>

            {journalHasQuery && (
              <p className="text-xs mt-2 px-1" style={{ color: sub }}>
                {journalResults.length} {journalResults.length === 1 ? 'запись' : journalResults.length < 5 ? 'записи' : 'записей'}
              </p>
            )}
          </div>

          <div className="flex-1 scroll-area">
            {!journalHasQuery ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 px-8">
                <Search size={32} color={sub} />
                <p className="text-center" style={{ color: sub, fontSize: fs(14) }}>
                  Введите запрос или выберите фильтры для поиска по записям
                </p>
              </div>
            ) : journalResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40">
                <p style={{ color: sub, fontSize: fs(14) }}>Ничего не найдено</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': '1' } as never}>
                {journalResults.map((entry: Entry) => (
                  <button
                    key={entry.id}
                    className="w-full text-left px-4 py-3 active:opacity-70"
                    style={{ borderBottom: `1px solid ${border}` }}
                    onClick={() => setViewingEntry(entry)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold truncate flex-1" style={{ fontSize: fs(14), color: text }}>
                        {highlightText(entry.title, journalQuery)}
                      </p>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: catColor(entry.category) + '22', color: catColor(entry.category) }}
                      >
                        {catLabel(entry.category)}
                      </span>
                    </div>
                    <p className="text-xs mb-1" style={{ color: sub }}>{fmtDateRu(entry.created_at.slice(0, 10))}</p>
                    {(() => {
                      const preview = parseBlocks(entry.content).find(b => b.type === 'text')?.content?.slice(0, 120) ?? ''
                      return preview ? (
                        <p className="line-clamp-2 leading-snug" style={{ fontSize: fs(13), color: sub }}>
                          {highlightText(preview, journalQuery)}
                        </p>
                      ) : null
                    })()}
                  </button>
                ))}
                <div className="h-4" />
              </div>
            )}
          </div>
        </>
      )}

      {/* Entry viewer modal */}
      {viewingEntry && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="flex flex-col mt-auto rounded-t-2xl overflow-hidden"
            style={{ background: bg, maxHeight: 'calc(var(--app-height, 100dvh) * 0.92)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
              style={{ borderColor: border, background: card }}>
              <button onClick={() => setViewingEntry(null)} className="active:opacity-70">
                <X size={20} color={sub} />
              </button>
              <span className="font-semibold flex-1 mx-3 truncate" style={{ color: text, fontSize: fs(16) }}>
                {viewingEntry.title}
              </span>
            </div>
            <div className="flex-1 scroll-area p-4 allow-select">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: catColor(viewingEntry.category) + '22', color: catColor(viewingEntry.category) }}
                >
                  {catLabel(viewingEntry.category)}
                </span>
                <span className="text-xs" style={{ color: sub }}>{fmtDateRu(viewingEntry.created_at.slice(0, 10))}</span>
              </div>
              {parseBlocks(viewingEntry.content).map(block => (
                <div key={block.id} className="mb-3">
                  {block.type === 'text' && (
                    <p className="leading-relaxed whitespace-pre-wrap" style={{ fontSize: fs(15), color: text }}>
                      {block.content}
                    </p>
                  )}
                  {block.type === 'verse' && (() => {
                    try {
                      const v = JSON.parse(block.content)
                      return (
                        <div className="px-3 py-2 rounded-lg border-l-4" style={{ background: card, borderColor: primary }}>
                          <p className="italic" style={{ fontSize: fs(14), color: text, fontFamily: 'Georgia, serif' }}>{v.text}</p>
                          <p className="text-xs mt-1" style={{ color: sub }}>{v.book} {v.chapter}:{v.verse}</p>
                        </div>
                      )
                    } catch { return null }
                  })()}
                  {block.type === 'divider' && <div className="h-px my-1" style={{ background: border }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
