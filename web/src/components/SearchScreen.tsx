import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme, NavTarget } from '../App'
import { BIBLE_VERSES } from '../data/BibleVerses'
import { db, Entry } from '../db'
import { Block, CATEGORIES, catColor, catLabel, fmtDateRu, findAllMatches, highlightAllMatches, normalizeSearch, parseBlocks } from '../types'
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
  testament: 'old' | 'new'
}

const PAGE_SIZE = 50

export default function SearchScreen({ navigateToBible }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const [activeTab, setActiveTab] = useState<'bible' | 'journal'>('bible')

  // ─── Bible search ───────────────────────────────
  const [bibleQuery, setBibleQuery] = useState('')
  const [bibleResults, setBibleResults] = useState<BibleResult[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [testamentFilter, setTestamentFilter] = useState<'all' | 'old' | 'new'>('all')
  const [wholeWord, setWholeWord] = useState(false)
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

  // Bible search — scans every verse (no artificial result cap), matches
  // whole text, filters by testament, and normalizes ё/е so both spellings
  // match. Results are paginated for display via `visibleCount`.
  const doBibleSearch = useCallback((q: string, testament: 'all' | 'old' | 'new', ww: boolean) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) { setBibleResults([]); setSearching(false); return }
    setSearching(true)
    setTimeout(() => {
      const nq = normalizeSearch(trimmed)
      const matches: BibleResult[] = []
      for (let i = 0; i < BIBLE_VERSES.length; i++) {
        const v = BIBLE_VERSES[i]
        if (testament !== 'all' && v.testament !== testament) continue
        const normalizedText = normalizeSearch(v.text)
        const found = ww ? findAllMatches(v.text, trimmed, true).length > 0 : normalizedText.includes(nq)
        if (found) {
          matches.push({ id: v.id, book: v.book, chapter: v.chapter, verse: v.verse, text: v.text, testament: v.testament })
        }
      }
      setBibleResults(matches)
      setVisibleCount(PAGE_SIZE)
      setSearching(false)
    }, 0)
  }, [])

  useEffect(() => {
    if (bibleDebounceRef.current) clearTimeout(bibleDebounceRef.current)
    bibleDebounceRef.current = setTimeout(() => doBibleSearch(bibleQuery, testamentFilter, wholeWord), 300)
    return () => { if (bibleDebounceRef.current) clearTimeout(bibleDebounceRef.current) }
  }, [bibleQuery, testamentFilter, wholeWord, doBibleSearch])

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

  const highlightText = (str: string, query: string, ww = false): React.ReactNode =>
    highlightAllMatches(str, query, undefined, ww)

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
            className="flex-1 flex items-center justify-center gap-2 py-3 press active:opacity-70 border-b-2 transition-colors"
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
                <button onClick={() => { setBibleQuery(''); setBibleResults([]) }} className="press active:opacity-70">
                  <X size={16} color={sub} />
                </button>
              )}
            </div>

            {/* Testament + whole-word filters */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {(['all', 'old', 'new'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTestamentFilter(t)}
                  className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium press active:opacity-70"
                  style={{
                    background: testamentFilter === t ? primary : 'transparent',
                    color: testamentFilter === t ? '#fff' : sub,
                    border: `1px solid ${testamentFilter === t ? primary : border}`,
                  }}
                >
                  {t === 'all' ? 'Всё' : t === 'old' ? 'Ветхий Завет' : 'Новый Завет'}
                </button>
              ))}
              <button
                onClick={() => setWholeWord(w => !w)}
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium press active:opacity-70"
                style={{
                  background: wholeWord ? primary : 'transparent',
                  color: wholeWord ? '#fff' : sub,
                  border: `1px solid ${wholeWord ? primary : border}`,
                }}
              >
                Целое слово
              </button>
            </div>

            {bibleResults.length > 0 && (
              <p className="text-xs mt-2 px-1" style={{ color: sub }}>
                Найдено: {bibleResults.length}{bibleResults.length > visibleCount ? ` (показано ${visibleCount})` : ''}
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
            {bibleResults.slice(0, visibleCount).map((r: BibleResult) => (
              <button
                key={r.id}
                className="w-full text-left px-4 py-3 border-b press active:opacity-70"
                style={{ borderColor: border }}
                onClick={() => navigateToBible({ book: r.book, chapter: r.chapter, verse: r.verse, highlightTerm: bibleQuery.trim() })}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold" style={{ color: primary }}>
                    {r.book} {r.chapter}:{r.verse}
                  </span>
                </div>
                <p className="leading-snug allow-select" style={{ fontSize: fs(14), color: text }}>
                  {highlightText(r.text, bibleQuery, wholeWord)}
                </p>
              </button>
            ))}
            {bibleResults.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="w-full text-center py-3 press active:opacity-70"
                style={{ color: primary, fontSize: fs(13), fontWeight: 600 }}
              >
                Показать ещё ({Math.min(PAGE_SIZE, bibleResults.length - visibleCount)})
              </button>
            )}
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
                <button onClick={() => setJournalQuery('')} className="press active:opacity-70">
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
                  className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs press active:opacity-70"
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
                  className="text-xs px-2 py-0.5 rounded press active:opacity-70"
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
                    className="w-full text-left px-4 py-3 press active:opacity-70"
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
        <div className="fixed inset-0 z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="flex flex-col mt-auto rounded-t-2xl overflow-hidden sheet-panel"
            style={{ background: bg, maxHeight: 'calc(var(--app-height, 100dvh) * 0.92)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
              style={{ borderColor: border, background: card }}>
              <button onClick={() => setViewingEntry(null)} className="press active:opacity-70">
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
