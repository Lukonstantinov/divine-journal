import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme, NavTarget } from '../App'
import { db, Entry, Folder } from '../db'
import {
  Block, CATEGORIES, catColor, catLabel, fmtDate, fmtDateRu,
  genId, getDailyVerseIndex, parseBlocks,
} from '../types'
import { Plus, X, ChevronDown, ChevronUp, Folder as FolderIcon, Trash2, Edit3, Check, BookOpen } from 'lucide-react'

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
  const [activeFolderId, setActiveFolderId] = useState<number | null | 'all'>('all')
  const [dailyVerse, setDailyVerse] = useState<{ id: string; text: string } | null>(null)
  const [verseExpanded, setVerseExpanded] = useState(true)

  // Editor state
  const [editing, setEditing] = useState<Entry | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [edTitle, setEdTitle] = useState('')
  const [edCat, setEdCat] = useState('мысль')
  const [edBlocks, setEdBlocks] = useState<Block[]>([])
  const [edFolderId, setEdFolderId] = useState<number | null>(null)

  // Viewer
  const [viewing, setViewing] = useState<Entry | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    const [ents, fols] = await Promise.all([
      db.entries.orderBy('created_at').reverse().toArray(),
      db.folders.orderBy('sort_order').toArray(),
    ])
    setEntries(ents)
    setFolders(fols)
  }, [])

  useEffect(() => {
    load()
    getAllVerses().then(verses => {
      if (verses.length) {
        setDailyVerse(verses[getDailyVerseIndex(verses.length)])
      }
    })
  }, [load])

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
    setEdBlocks(prev => [...prev, { id: genId(), type: 'text', content: '' }])
  }

  const filteredEntries = entries.filter(e => {
    if (activeFolderId === 'all') return true
    return e.folder_id === activeFolderId
  })

  const bg = theme.bg
  const card = theme.card
  const border = theme.border
  const text = theme.text
  const sub = theme.subtext
  const primary = theme.primary

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

      {/* Daily verse banner */}
      {dailyVerse && (
        <div className="mx-3 mt-3 rounded-xl overflow-hidden flex-shrink-0" style={{ background: card, borderWidth: 1, borderColor: border, borderStyle: 'solid' }}>
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

      {/* Entries list */}
      <div className="flex-1 scroll-area px-3 pt-3 pb-2">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <BookOpen size={32} color={sub} />
            <p style={{ color: sub, fontSize: fs(14) }}>Нет записей. Нажмите + чтобы начать.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredEntries.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                theme={theme}
                fontScale={fontScale}
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
        <div className="fixed inset-0 z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="flex flex-col mt-auto rounded-t-2xl overflow-hidden"
            style={{ background: bg, maxHeight: '92vh' }}
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
                style={{ fontSize: fs(16), color: text, borderColor: border }}
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

              {/* Text blocks */}
              {edBlocks.map((block, idx) => (
                <div key={block.id}>
                  {block.type === 'text' && (
                    <textarea
                      ref={idx === edBlocks.length - 1 ? textareaRef : undefined}
                      className="w-full bg-transparent resize-none leading-relaxed"
                      style={{ fontSize: fs(15), color: text, minHeight: 120 }}
                      placeholder="Напишите здесь..."
                      value={block.content}
                      onChange={e => updateBlock(block.id, e.target.value)}
                      rows={6}
                    />
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
          </div>
        </div>
      )}

      {/* Viewer Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="flex flex-col mt-auto rounded-t-2xl overflow-hidden"
            style={{ background: bg, maxHeight: '92vh' }}
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
            <div className="flex-1 scroll-area p-4">
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
                <div key={block.id}>
                  {block.type === 'text' && (
                    <p className="leading-relaxed whitespace-pre-wrap" style={{ fontSize: fs(15), color: text }}>
                      {block.content}
                    </p>
                  )}
                  {block.type === 'verse' && (() => {
                    try {
                      const v = JSON.parse(block.content)
                      return (
                        <div className="my-3 px-3 py-2 rounded-lg border-l-4" style={{ background: card, borderColor: primary }}>
                          <p className="italic" style={{ fontSize: fs(14), color: text, fontFamily: 'Georgia, serif' }}>{v.text}</p>
                          <p className="text-xs mt-1" style={{ color: sub }}>{v.book} {v.chapter}:{v.verse}</p>
                        </div>
                      )
                    } catch { return null }
                  })()}
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

function EntryCard({ entry, theme, fontScale, onTap, onEdit, onDelete }: {
  entry: Entry
  theme: ReturnType<typeof useTheme>['theme']
  fontScale: number
  onTap: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const fs = (base: number) => Math.round(base * fontScale)
  const [expanded, setExpanded] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const blocks = parseBlocks(entry.content)
  const preview = blocks.find(b => b.type === 'text')?.content?.slice(0, 120) ?? ''

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: theme.card, border: `1px solid ${theme.border}` }}
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
