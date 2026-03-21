import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme, NavTarget } from '../App'
import { db, Entry, Folder, Fasting, getSetting } from '../db'
import {
  Block, CATEGORIES, HIGHLIGHT_COLORS, StyleRange, applyRanges,
  catColor, catLabel, fmtDate, fmtDateRu,
  genId, getDailyVerseIndex, parseBlocks, calcStreak,
} from '../types'
import { Plus, X, ChevronDown, ChevronUp, Folder as FolderIcon, Trash2, Edit3, Check, BookOpen, Calendar } from 'lucide-react'
import RTToolbar, { ActiveFormats } from './RTToolbar'

// HighlightedText: render a text block with styled inline spans
function HighlightedText({ content, ranges, fontSize, color }: {
  content: string
  ranges?: StyleRange[]
  fontSize: number
  color: string
}) {
  const spans = applyRanges(content, ranges)
  return (
    <span>
      {spans.map((sp, i) => {
        const hlColor = sp.highlight
          ? HIGHLIGHT_COLORS.find(h => h.id === sp.highlight)?.color
          : undefined
        return (
          <span key={i} style={{
            fontWeight: sp.bold ? '700' : undefined,
            fontStyle: sp.italic ? 'italic' : undefined,
            textDecoration: sp.underline ? 'underline' : undefined,
            backgroundColor: hlColor,
            fontSize,
            color,
          }}>
            {sp.text}
          </span>
        )
      })}
    </span>
  )
}

// Lazy-load Bible verses to avoid blocking render
let _allVerses: { id: string; text: string }[] | null = null
async function getAllVerses() {
  if (_allVerses) return _allVerses
  const { BIBLE_VERSES } = await import('../data/BibleVerses')
  _allVerses = (BIBLE_VERSES as Array<{ id: string; text: string }>)
  return _allVerses
}

interface Props {
  navigateToBible: (target: NavTarget) => void
}

export default function JournalScreen({ navigateToBible }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const [entries, setEntries] = useState<Entry[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [fastings, setFastings] = useState<Fasting[]>([])
  const [activeFolderId, setActiveFolderId] = useState<number | null | 'all'>('all')
  const [dailyVerse, setDailyVerse] = useState<{ id: string; text: string } | null>(null)
  const [verseExpanded, setVerseExpanded] = useState(true)
  const [searchQ, setSearchQ] = useState('')

  // "On This Day" memories
  const [memories, setMemories] = useState<Entry[]>([])
  const [showMemories, setShowMemories] = useState(true)

  // Reading plan progress
  const [planProgress, setPlanProgress] = useState<{
    total: number; completed: number; nextBook?: string; nextChapter?: number
  } | null>(null)

  // Appearance settings
  const [noteOpacity, setNoteOpacity] = useState(0.10)
  const [fastingBorderColor, setFastingBorderColor] = useState('#9C27B0')

  // Editor state
  const [editing, setEditing] = useState<Entry | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [edTitle, setEdTitle] = useState('')
  const [edCat, setEdCat] = useState('мысль')
  const [edBlocks, setEdBlocks] = useState<Block[]>([])
  const [edFolderId, setEdFolderId] = useState<number | null>(null)

  // Rich text editor state
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const [selRange, setSelRange] = useState({ start: 0, end: 0 })
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  // Viewer
  const [viewing, setViewing] = useState<Entry | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    const [ents, fols, fasts] = await Promise.all([
      db.entries.orderBy('created_at').reverse().toArray(),
      db.folders.orderBy('sort_order').toArray(),
      db.fasting.toArray(),
    ])
    setEntries(ents)
    setFolders(fols)
    setFastings(fasts)

    // "On This Day" memories — same MM-DD as today, but a previous year
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const yyyy = String(today.getFullYear())
    const mmdd = `${mm}-${dd}`
    const mems = ents.filter(e => {
      const d = e.created_at.slice(0, 10)
      return d.slice(5) === mmdd && d.slice(0, 4) !== yyyy
    })
    setMemories(mems)

    // Reading plan progress
    const allPlan = await db.reading_plan.toArray()
    if (allPlan.length > 0) {
      const total = allPlan.length
      const completed = allPlan.filter(r => r.completed).length
      const next = allPlan.find(r => !r.completed)
      setPlanProgress({ total, completed, nextBook: next?.book, nextChapter: next?.chapter })
    } else {
      setPlanProgress(null)
    }

    // Appearance settings
    const opacityStr = await getSetting('note_color_opacity', '0.10')
    setNoteOpacity(parseFloat(opacityStr) || 0.10)
    const fastingColor = await getSetting('fasting_border_color', '#9C27B0')
    setFastingBorderColor(fastingColor)
  }, [])

  useEffect(() => {
    load()
    getAllVerses().then(verses => {
      if (verses.length) {
        setDailyVerse(verses[getDailyVerseIndex(verses.length)])
      }
    })
  }, [load])

  // Check if entry date falls within a fasting period
  const isFastingEntry = (entry: Entry): boolean => {
    const d = entry.created_at.slice(0, 10)
    return fastings.some(f => d >= f.start_date && d <= f.end_date)
  }

  const openNew = () => {
    setEditing(null)
    setEdTitle('')
    setEdCat('мысль')
    setEdBlocks([{ id: genId(), type: 'text', content: '' }])
    setEdFolderId(activeFolderId === 'all' || activeFolderId === null ? null : activeFolderId as number)
    setShowEditor(true)
  }

  const openEdit = (e: Entry) => {
    setEditing(e)
    setEdTitle(e.title)
    setEdCat(e.category)
    setEdBlocks(parseBlocks(e.content))
    setEdFolderId(e.folder_id)
    setShowEditor(true)
  }

  const save = async () => {
    const textContent = edBlocks.map(b => b.content).join('\n').trim()
    if (!edTitle.trim() && !textContent) return

    const title = edTitle.trim() || textContent.slice(0, 50) || 'Запись'
    const content = JSON.stringify(edBlocks)
    const now = new Date().toISOString()

    if (editing?.id) {
      await db.entries.update(editing.id, {
        title, content, category: edCat, folder_id: edFolderId,
      })
    } else {
      await db.entries.add({
        title, content, category: edCat,
        created_at: now, linked_verses: '[]',
        folder_id: edFolderId, color: null,
      })
    }
    setShowEditor(false)
    load()
  }

  const del = async (id: number) => {
    await db.entries.delete(id)
    load()
  }

  const updateBlock = (id: string, content: string) => {
    setEdBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b))
  }

  const addBlock = () => {
    const id = genId()
    setEdBlocks(prev => [...prev, { id, type: 'text', content: '' }])
    setTimeout(() => textareaRefs.current[id]?.focus(), 50)
  }

  const addDivider = () => {
    setEdBlocks(prev => {
      const divider: Block = { id: genId(), type: 'divider', content: '' }
      const idx = prev.findIndex(b => b.id === activeBlockId)
      if (idx >= 0) {
        const next = [...prev]
        next.splice(idx + 1, 0, divider)
        return next
      }
      return [...prev, divider]
    })
  }

  const removeBlock = (id: string) => {
    setEdBlocks(prev => prev.filter(b => b.id !== id))
  }

  // Detect active formats at the current cursor/selection position
  const getActiveFormats = (): ActiveFormats => {
    const block = edBlocks.find(b => b.id === activeBlockId)
    if (!block?.ranges?.length) return {}
    const pos = selRange.start
    const formats: ActiveFormats = {}
    for (const r of block.ranges) {
      if (r.start <= pos && pos <= r.end) {
        if (r.bold) formats.bold = true
        if (r.italic) formats.italic = true
        if (r.underline) formats.underline = true
        if (r.fontSize) formats.fontSize = r.fontSize
        if (r.highlight) formats.highlight = r.highlight
      }
    }
    return formats
  }

  // Apply a format to the selected range of the active text block
  const applyFormat = (type: 'bold' | 'italic' | 'underline' | 'fontSize' | 'highlight', value?: string | null) => {
    if (!activeBlockId) return
    const { start, end } = selRange
    if (start === end && type !== 'fontSize') return
    const newRange: StyleRange = { start, end }
    if (type === 'bold') newRange.bold = true
    else if (type === 'italic') newRange.italic = true
    else if (type === 'underline') newRange.underline = true
    else if (type === 'fontSize') newRange.fontSize = value ?? undefined
    else if (type === 'highlight' && value) newRange.highlight = value
    else return // null highlight = clear (handled by not adding range)
    setEdBlocks(prev => prev.map(b =>
      b.id === activeBlockId ? { ...b, ranges: [...(b.ranges ?? []), newRange] } : b
    ))
  }

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (activeFolderId !== 'all' && e.folder_id !== activeFolderId) return false
      if (searchQ) {
        const q = searchQ.toLowerCase()
        const titleMatch = e.title.toLowerCase().includes(q)
        const contentMatch = (() => {
          try {
            const blocks = JSON.parse(e.content) as Block[]
            return blocks.some(b => b.type === 'text' && b.content.toLowerCase().includes(q))
          } catch { return e.content.toLowerCase().includes(q) }
        })()
        if (!titleMatch && !contentMatch) return false
      }
      return true
    })
  }, [entries, activeFolderId, searchQ])

  const { bg, card, border, text, subtext: sub, primary, accent } = theme

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: border, background: card }}>
        <h1 className="font-bold" style={{ fontSize: fs(18), color: text }}>Духовный Дневник</h1>
        <button
          onClick={openNew}
          className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-70"
          style={{ background: primary }}
        >
          <Plus size={18} color="#fff" />
        </button>
      </div>

      {/* Reading plan progress card */}
      {planProgress && planProgress.total > 0 && (
        <div className="mx-3 mt-3 rounded-xl px-3 py-2 flex-shrink-0"
          style={{ background: card, border: `1px solid ${border}` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: fs(12), color: sub }}>
              📖 План чтения: {planProgress.completed}/{planProgress.total}
            </span>
            {planProgress.nextBook && (
              <span style={{ fontSize: fs(11), color: primary }}>
                Далее: {planProgress.nextBook} {planProgress.nextChapter}
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: border }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                background: primary,
                width: `${Math.round((planProgress.completed / planProgress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Daily verse banner */}
      {dailyVerse && (
        <div className="mx-3 mt-3 rounded-xl overflow-hidden flex-shrink-0" style={{ background: card, border: `1px solid ${border}` }}>
          <button
            className="w-full flex items-center justify-between px-3 py-2 active:opacity-70"
            onClick={() => setVerseExpanded(v => !v)}
          >
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: primary }}>Стих дня</span>
            {verseExpanded ? <ChevronUp size={14} color={sub} /> : <ChevronDown size={14} color={sub} />}
          </button>
          {verseExpanded && (
            <div className="px-3 pb-3">
              <p className="italic leading-snug" style={{ fontSize: fs(13), color: text, fontFamily: 'Georgia, serif' }}>
                {dailyVerse.text}
              </p>
              <p className="mt-1 text-[10px]" style={{ color: sub }}>{dailyVerse.id}</p>
            </div>
          )}
        </div>
      )}

      {/* "On This Day" memories */}
      {showMemories && memories.length > 0 && (
        <div className="mx-3 mt-3 rounded-xl px-3 pt-2 pb-3 flex-shrink-0"
          style={{ background: card, border: `1px solid ${accent}` }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} color={accent} />
              <span className="text-xs font-semibold" style={{ color: accent }}>В этот день</span>
            </div>
            <button onClick={() => setShowMemories(false)} className="active:opacity-70">
              <X size={14} color={sub} />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto scroll-area" style={{ scrollbarWidth: 'none' }}>
            {memories.map(mem => (
              <button
                key={mem.id}
                onClick={() => setViewing(mem)}
                className="flex-shrink-0 rounded-xl p-2.5 text-left active:opacity-70"
                style={{ width: 152, background: bg, border: `1px solid ${border}` }}
              >
                <p className="text-[10px] mb-1" style={{ color: sub }}>
                  {new Date(mem.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full inline-block mb-1"
                  style={{ background: catColor(mem.category) + '22', color: catColor(mem.category) }}
                >
                  {catLabel(mem.category)}
                </span>
                <p className="font-semibold truncate" style={{ fontSize: fs(12), color: text }}>{mem.title}</p>
                {(() => {
                  const pv = parseBlocks(mem.content).find(b => b.type === 'text')?.content?.slice(0, 80) ?? ''
                  return pv
                    ? <p className="mt-0.5 line-clamp-2 leading-tight" style={{ fontSize: fs(11), color: sub }}>{pv}</p>
                    : null
                })()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Folder chips */}
      {folders.length > 0 && (
        <div className="flex gap-2 px-3 pt-3 overflow-x-auto flex-shrink-0 scroll-area" style={{ scrollbarWidth: 'none' }}>
          <FolderChip
            label="Все"
            active={activeFolderId === 'all'}
            color={primary}
            onClick={() => setActiveFolderId('all')}
            theme={theme}
          />
          {folders.map(f => (
            <FolderChip
              key={f.id}
              label={f.name}
              active={activeFolderId === f.id}
              color={f.color}
              onClick={() => setActiveFolderId(activeFolderId === f.id ? 'all' : f.id!)}
              theme={theme}
            />
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="px-3 pt-2 flex-shrink-0">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: card, border: `1px solid ${border}` }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ fontSize: fs(13), color: text }}
            placeholder="Поиск по записям..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')} className="active:opacity-70">
              <X size={12} color={sub} />
            </button>
          )}
        </div>
      </div>

      {/* Entries list */}
      <div className="flex-1 scroll-area px-3 pt-3 pb-2">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <BookOpen size={32} color={sub} />
            <p style={{ color: sub, fontSize: fs(14) }}>
              {entries.length === 0 ? 'Нет записей. Нажмите + чтобы начать.' : 'Нет записей по фильтру.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredEntries.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                theme={theme}
                fontScale={fontScale}
                noteOpacity={noteOpacity}
                isFasting={isFastingEntry(entry)}
                fastingBorderColor={fastingBorderColor}
                onTap={() => setViewing(entry)}
                onEdit={() => openEdit(entry)}
                onDelete={() => entry.id && del(entry.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="flex flex-col mt-auto rounded-t-2xl overflow-hidden"
            style={{ background: bg, maxHeight: 'calc(var(--app-height, 100dvh) * 0.92)' }}
          >
            {/* Editor header */}
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: border, background: card }}>
              <button onClick={() => setShowEditor(false)} className="active:opacity-70">
                <X size={20} color={sub} />
              </button>
              <span className="font-semibold" style={{ color: text, fontSize: fs(16) }}>
                {editing ? 'Редактировать' : 'Новая запись'}
              </span>
              <button onClick={save} className="active:opacity-70">
                <Check size={20} color={primary} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scroll-area p-4 flex flex-col gap-3">
              {/* Title */}
              <input
                className="w-full font-semibold bg-transparent border-b pb-1"
                style={{ fontSize: Math.max(16, fs(16)), color: text, borderColor: border }}
                placeholder="Заголовок (необязательно)"
                value={edTitle}
                onChange={e => setEdTitle(e.target.value)}
              />

              {/* Category picker */}
              <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setEdCat(c.id)}
                    className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium active:opacity-70"
                    style={{
                      background: edCat === c.id ? c.color : 'transparent',
                      color: edCat === c.id ? '#fff' : c.color,
                      border: `1px solid ${c.color}`,
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Folder picker */}
              {folders.length > 0 && (
                <div className="flex gap-2 items-center overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  <FolderIcon size={14} color={sub} className="flex-shrink-0" />
                  <button
                    onClick={() => setEdFolderId(null)}
                    className="flex-shrink-0 px-3 py-1 rounded-full text-xs active:opacity-70"
                    style={{
                      background: edFolderId === null ? sub : 'transparent',
                      color: edFolderId === null ? '#fff' : sub,
                      border: `1px solid ${sub}`,
                    }}
                  >
                    Без папки
                  </button>
                  {folders.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setEdFolderId(f.id!)}
                      className="flex-shrink-0 px-3 py-1 rounded-full text-xs active:opacity-70"
                      style={{
                        background: edFolderId === f.id ? f.color : 'transparent',
                        color: edFolderId === f.id ? '#fff' : f.color,
                        border: `1px solid ${f.color}`,
                      }}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Text / divider blocks */}
              {edBlocks.map(block => (
                <div key={block.id}>
                  {block.type === 'text' && (
                    <div className="relative">
                      <textarea
                        ref={el => { textareaRefs.current[block.id] = el }}
                        className="w-full bg-transparent resize-none leading-relaxed allow-select"
                        style={{
                          fontSize: Math.max(16, fs(15)), color: text, minHeight: 100,
                          outline: activeBlockId === block.id ? `1px solid ${border}` : 'none',
                          borderRadius: 6, padding: activeBlockId === block.id ? 6 : 0,
                        }}
                        placeholder="Напишите здесь..."
                        value={block.content}
                        onChange={e => updateBlock(block.id, e.target.value)}
                        onFocus={() => setActiveBlockId(block.id)}
                        onSelect={e => {
                          const ta = e.target as HTMLTextAreaElement
                          setSelRange({ start: ta.selectionStart, end: ta.selectionEnd })
                        }}
                        rows={5}
                      />
                      {edBlocks.length > 1 && (
                        <button
                          onClick={() => removeBlock(block.id)}
                          className="absolute top-0 right-0 p-1 active:opacity-70"
                        >
                          <X size={12} color={sub} />
                        </button>
                      )}
                    </div>
                  )}
                  {block.type === 'divider' && (
                    <div className="flex items-center gap-2 my-1">
                      <div className="flex-1 h-px" style={{ background: border }} />
                      <button onClick={() => removeBlock(block.id)} className="active:opacity-70">
                        <X size={10} color={sub} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={addBlock}
                className="text-xs px-3 py-1.5 rounded-lg border active:opacity-70 self-start"
                style={{ color: primary, borderColor: primary }}
              >
                + Добавить блок
              </button>
            </div>

            {/* RTToolbar — sticky at bottom of editor */}
            <RTToolbar
              active={getActiveFormats()}
              onBold={() => applyFormat('bold')}
              onItalic={() => applyFormat('italic')}
              onUnderline={() => applyFormat('underline')}
              onFontSize={size => applyFormat('fontSize', size)}
              onHighlight={color => applyFormat('highlight', color)}
              onDivider={addDivider}
            />
          </div>
        </div>
      )}

      {/* Viewer Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="flex flex-col mt-auto rounded-t-2xl overflow-hidden"
            style={{ background: bg, maxHeight: 'calc(var(--app-height, 100dvh) * 0.92)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: border, background: card }}>
              <button onClick={() => setViewing(null)} className="active:opacity-70">
                <X size={20} color={sub} />
              </button>
              <span className="font-semibold flex-1 mx-3 truncate" style={{ color: text, fontSize: fs(16) }}>
                {viewing.title}
              </span>
              <button onClick={() => { setViewing(null); openEdit(viewing) }} className="active:opacity-70">
                <Edit3 size={18} color={primary} />
              </button>
            </div>
            <div className="flex-1 scroll-area p-4 allow-select">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: catColor(viewing.category) + '22', color: catColor(viewing.category) }}
                >
                  {catLabel(viewing.category)}
                </span>
                <span className="text-xs" style={{ color: sub }}>{fmtDateRu(viewing.created_at.slice(0, 10))}</span>
              </div>
              {parseBlocks(viewing.content).map(block => (
                <div key={block.id} className="mb-3">
                  {block.type === 'text' && (
                    <p className="leading-relaxed whitespace-pre-wrap" style={{ fontSize: fs(15), color: text }}>
                      <HighlightedText content={block.content} ranges={block.ranges} fontSize={fs(15)} color={text} />
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
                  {block.type === 'divider' && (
                    <div className="h-px my-1" style={{ background: border }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FolderChip({ label, active, color, onClick, theme }: {
  label: string; active: boolean; color: string; onClick: () => void
  theme: { text: string; card: string; border: string }
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium active:opacity-70"
      style={{
        background: active ? color : 'transparent',
        color: active ? '#fff' : color,
        border: `1px solid ${color}`,
      }}
    >
      {label}
    </button>
  )
}

function EntryCard({ entry, theme, fontScale, noteOpacity, isFasting, fastingBorderColor, onTap, onEdit, onDelete }: {
  entry: Entry
  theme: ReturnType<typeof useTheme>['theme']
  fontScale: number
  noteOpacity: number
  isFasting: boolean
  fastingBorderColor: string
  onTap: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const fs = (base: number) => Math.round(base * fontScale)
  const [expanded, setExpanded] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const blocks = parseBlocks(entry.content)
  const preview = blocks.find(b => b.type === 'text')?.content?.slice(0, 120) ?? ''

  // Compute card border/background based on color and fasting state
  const cardBg = entry.color
    ? `rgba(${hexToRgb(entry.color)}, ${noteOpacity})`
    : theme.card
  const cardBorder = isFasting
    ? `2px dashed ${fastingBorderColor}`
    : `1px solid ${theme.border}`

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: cardBg, border: cardBorder }}
    >
      <button className="w-full text-left px-4 pt-3 pb-2 active:opacity-80" onClick={onTap}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ fontSize: fs(15), color: theme.text }}>
              {entry.title}
            </p>
            {!expanded && preview && (
              <p className="mt-0.5 line-clamp-2 leading-snug" style={{ fontSize: fs(13), color: theme.subtext }}>
                {preview}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: catColor(entry.category) + '22', color: catColor(entry.category) }}
            >
              {catLabel(entry.category)}
            </span>
            <button
              className="p-1 active:opacity-70"
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            >
              {expanded ? <ChevronUp size={14} color={theme.subtext} /> : <ChevronDown size={14} color={theme.subtext} />}
            </button>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          <p className="text-xs mb-2" style={{ color: theme.subtext }}>
            {fmtDateRu(entry.created_at.slice(0, 10))}
          </p>
          {blocks.slice(0, 3).map(block => (
            <div key={block.id}>
              {block.type === 'text' && (
                <p className="leading-relaxed" style={{ fontSize: fs(14), color: theme.text }}>
                  {block.content.slice(0, 300)}{block.content.length > 300 ? '…' : ''}
                </p>
              )}
            </div>
          ))}
          <div className="flex gap-3 mt-3 border-t pt-2" style={{ borderColor: theme.border }}>
            <button
              className="flex items-center gap-1 text-xs active:opacity-70"
              style={{ color: theme.primary }}
              onClick={e => { e.stopPropagation(); onEdit() }}
            >
              <Edit3 size={12} /> Изменить
            </button>
            {!confirmDel ? (
              <button
                className="flex items-center gap-1 text-xs active:opacity-70"
                style={{ color: '#ef4444' }}
                onClick={e => { e.stopPropagation(); setConfirmDel(true) }}
              >
                <Trash2 size={12} /> Удалить
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <button
                  className="text-xs px-2 py-0.5 rounded active:opacity-70"
                  style={{ background: '#ef4444', color: '#fff' }}
                  onClick={e => { e.stopPropagation(); onDelete() }}
                >
                  Удалить
                </button>
                <button
                  className="text-xs active:opacity-70"
                  style={{ color: theme.subtext }}
                  onClick={e => { e.stopPropagation(); setConfirmDel(false) }}
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper: convert hex color to "R, G, B" string for rgba()
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '139, 69, 19'
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}
