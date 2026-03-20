import React, { useCallback, useEffect, useState } from 'react'
import { useTheme, NavTarget } from '../App'
import { db, ReadingPlan, Fasting, Entry } from '../db'
import { BIBLE_BOOKS } from '../data/BibleVerses'
import { MONTHS, WDAYS, fmtDate, fmtDateRu, parseBlocks, catLabel, catColor } from '../types'
import { ChevronLeft, ChevronRight, CheckCircle, Circle, Plus, X, Check, Trash2, BookOpen } from 'lucide-react'

interface Props {
  navigateToBible: (target: NavTarget) => void
}

type PlanPreset = 'bible-year' | 'nt-90' | 'psalms-month' | 'gospels'

function generatePlan(preset: PlanPreset, startDate: Date): Array<{ date: string; book: string; chapter: number }> {
  const results: Array<{ date: string; book: string; chapter: number }> = []
  const addDays = (d: Date, n: number) => {
    const r = new Date(d); r.setDate(r.getDate() + n); return r
  }
  const fmt = (d: Date) => fmtDate(d)

  let books: string[] = []
  if (preset === 'bible-year') {
    books = BIBLE_BOOKS.map(b => b.name)
  } else if (preset === 'nt-90') {
    books = BIBLE_BOOKS.filter(b => b.testament === 'new').map(b => b.name)
  } else if (preset === 'psalms-month') {
    books = ['Псалтирь']
  } else if (preset === 'gospels') {
    books = ['Матфея', 'Марка', 'Луки', 'Иоанна']
  }

  const allChapters: Array<{ book: string; chapter: number }> = []
  for (const bname of books) {
    const bobj = BIBLE_BOOKS.find(b => b.name === bname)
    if (!bobj) continue
    for (let ch = 1; ch <= bobj.chapters; ch++) {
      allChapters.push({ book: bname, chapter: ch })
    }
  }

  const totalDays = preset === 'bible-year' ? 365 : preset === 'nt-90' ? 90 : preset === 'psalms-month' ? 30 : 30
  const perDay = Math.ceil(allChapters.length / totalDays)
  let chapIdx = 0
  for (let day = 0; day < totalDays && chapIdx < allChapters.length; day++) {
    const date = fmt(addDays(startDate, day))
    for (let i = 0; i < perDay && chapIdx < allChapters.length; i++, chapIdx++) {
      results.push({ date, ...allChapters[chapIdx] })
    }
  }
  return results
}

export default function CalendarScreen({ navigateToBible }: Props) {
  const { theme, fontScale, fastingBorderColor } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string>(fmtDate(today))
  const [readings, setReadings] = useState<ReadingPlan[]>([])
  const [dailyNote, setDailyNote] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [fastings, setFastings] = useState<Fasting[]>([])
  const [activeFasting, setActiveFasting] = useState<Fasting | null>(null)
  const [monthEntries, setMonthEntries] = useState<Entry[]>([])

  // Modals
  const [showFastingModal, setShowFastingModal] = useState(false)
  const [fastingNote, setFastingNote] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [planPreset, setPlanPreset] = useState<PlanPreset>('bible-year')
  const [planStartDate, setPlanStartDate] = useState(fmtDate(today))
  const [planGenerating, setPlanGenerating] = useState(false)
  const [showAddReading, setShowAddReading] = useState(false)
  const [addBook, setAddBook] = useState(BIBLE_BOOKS[0]?.name ?? '')
  const [addChapter, setAddChapter] = useState(1)
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null)

  const load = useCallback(async () => {
    const y = year, m = month + 1
    const prefix = `${y}-${String(m).padStart(2, '0')}`
    const [rds, fsts, ents, note] = await Promise.all([
      db.reading_plan.where('date').startsWith(prefix).toArray(),
      db.fasting.toArray(),
      db.entries.toArray(),
      db.daily_notes.where('date').equals(selectedDate).first(),
    ])
    setReadings(rds)
    setFastings(fsts)
    setMonthEntries(ents.filter(e => e.created_at.startsWith(prefix)))
    setDailyNote(note?.notes ?? '')

    // Check for active fasting
    const todayStr = fmtDate(today)
    const af = fsts.find(f => f.start_date <= todayStr && (!f.end_date || f.end_date >= todayStr))
    setActiveFasting(af ?? null)
  }, [year, month, selectedDate])

  useEffect(() => { load() }, [load])

  const saveNote = async () => {
    const existing = await db.daily_notes.where('date').equals(selectedDate).first()
    if (existing?.id) {
      await db.daily_notes.update(existing.id, { notes: dailyNote })
    } else if (dailyNote.trim()) {
      await db.daily_notes.add({ date: selectedDate, notes: dailyNote })
    }
    setNoteEditing(false)
  }

  const toggleReading = async (r: ReadingPlan) => {
    if (r.id) {
      await db.reading_plan.update(r.id, { completed: !r.completed })
      load()
    }
  }

  const deleteReading = async (id: number) => {
    await db.reading_plan.delete(id)
    load()
  }

  const addReading = async () => {
    const bookObj = BIBLE_BOOKS.find(b => b.name === addBook)
    if (!bookObj) return
    const ch = Math.min(Math.max(1, addChapter), bookObj.chapters)
    await db.reading_plan.add({ date: selectedDate, book: addBook, chapter: ch, completed: false })
    setShowAddReading(false)
    load()
  }

  const startFasting = async () => {
    await db.fasting.add({
      start_date: fmtDate(today),
      end_date: '',
      notes: fastingNote.trim(),
      created_at: new Date().toISOString(),
    })
    setShowFastingModal(false)
    setFastingNote('')
    load()
  }

  const endFasting = async () => {
    if (!activeFasting?.id) return
    await db.fasting.update(activeFasting.id, { end_date: fmtDate(today) })
    load()
  }

  const deleteFasting = async (id: number) => {
    await db.fasting.delete(id)
    load()
  }

  const generateAndSavePlan = async () => {
    setPlanGenerating(true)
    const start = new Date(planStartDate + 'T00:00:00')
    const plan = generatePlan(planPreset, start)
    // Insert in batches
    await db.reading_plan.bulkAdd(plan.map(p => ({ ...p, completed: false })))
    setPlanGenerating(false)
    setShowPlanModal(false)
    load()
  }

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const firstDay = new Date(year, month, 1)
  const startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const readingsByDate = readings.reduce<Record<string, ReadingPlan[]>>((acc, r) => {
    acc[r.date] = [...(acc[r.date] ?? []), r]
    return acc
  }, {})

  const entriesByDate = monthEntries.reduce<Record<string, number>>((acc, e) => {
    const d = e.created_at.slice(0, 10)
    acc[d] = (acc[d] ?? 0) + 1
    return acc
  }, {})

  const isDateInFasting = (dateStr: string) =>
    fastings.some(f => f.start_date <= dateStr && (!f.end_date || f.end_date >= dateStr))

  const dayReadings = readingsByDate[selectedDate] ?? []
  const dayEntries = monthEntries.filter(e => e.created_at.startsWith(selectedDate))
  const todayStr = fmtDate(today)
  const dayFasting = fastings.filter(f => f.start_date <= selectedDate && (!f.end_date || f.end_date >= selectedDate))

  const bg = theme.bg
  const card = theme.card
  const border = theme.border
  const text = theme.text
  const sub = theme.subtext
  const primary = theme.primary

  const bookObj = BIBLE_BOOKS.find(b => b.name === addBook)
  const maxChapter = bookObj?.chapters ?? 1

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ background: card, borderColor: border }}>
        <button onClick={prevMonth} className="active:opacity-70 p-1">
          <ChevronLeft size={20} color={primary} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="font-bold" style={{ fontSize: fs(17), color: text }}>
            {MONTHS[month]} {year}
          </h1>
          {activeFasting && (
            <span className="text-xs mt-0.5" style={{ color: fastingBorderColor }}>● Пост активен</span>
          )}
        </div>
        <button onClick={nextMonth} className="active:opacity-70 p-1">
          <ChevronRight size={20} color={primary} />
        </button>
      </div>

      <div className="flex-1 scroll-area">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 px-2 pt-3 pb-1">
          {WDAYS.map(d => (
            <div key={d} className="text-center text-xs font-semibold" style={{ color: sub }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 px-2 gap-y-1">
          {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const m = String(month + 1).padStart(2, '0')
            const d = String(day).padStart(2, '0')
            const dateStr = `${year}-${m}-${d}`
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const rds = readingsByDate[dateStr] ?? []
            const hasAll = rds.length > 0 && rds.every(r => r.completed)
            const hasSome = rds.some(r => r.completed)
            const hasEntries = (entriesByDate[dateStr] ?? 0) > 0
            const hasFasting = isDateInFasting(dateStr)

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className="aspect-square flex flex-col items-center justify-center rounded-xl active:opacity-70 relative"
                style={{
                  background: isSelected ? primary : isToday ? primary + '20' : 'transparent',
                  border: hasFasting
                    ? `2px dashed ${fastingBorderColor}`
                    : isToday && !isSelected ? `1.5px solid ${primary}` : undefined,
                }}
              >
                <span className="text-sm font-semibold" style={{ color: isSelected ? '#fff' : text }}>
                  {day}
                </span>
                <div className="flex gap-0.5 mt-0.5">
                  {(hasSome || hasAll) && (
                    <div className="w-1 h-1 rounded-full" style={{ background: isSelected ? '#fff' : hasAll ? '#22c55e' : '#f59e0b' }} />
                  )}
                  {hasEntries && (
                    <div className="w-1 h-1 rounded-full" style={{ background: isSelected ? '#ffffffaa' : primary + '99' }} />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Day detail */}
        <div className="mx-3 mt-4 rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="px-4 pt-3 pb-2 border-b flex items-center justify-between" style={{ borderColor: border }}>
            <p className="font-semibold" style={{ fontSize: fs(14), color: text }}>
              {fmtDateRu(selectedDate)}
            </p>
            <div className="flex gap-2">
              {/* Fasting controls */}
              {!activeFasting ? (
                <button
                  onClick={() => setShowFastingModal(true)}
                  className="text-xs px-2 py-1 rounded-lg active:opacity-70"
                  style={{ border: `1px solid ${fastingBorderColor}`, color: fastingBorderColor }}
                >
                  + Пост
                </button>
              ) : (
                <button
                  onClick={endFasting}
                  className="text-xs px-2 py-1 rounded-lg active:opacity-70"
                  style={{ background: fastingBorderColor + '22', color: fastingBorderColor, border: `1px solid ${fastingBorderColor}` }}
                >
                  Завершить пост
                </button>
              )}
              <button
                onClick={() => setShowPlanModal(true)}
                className="text-xs px-2 py-1 rounded-lg active:opacity-70"
                style={{ border: `1px solid ${primary}`, color: primary }}
              >
                + План
              </button>
            </div>
          </div>

          {/* Fasting indicators for selected day */}
          {dayFasting.length > 0 && (
            <div className="px-4 py-2 border-b" style={{ borderColor: border }}>
              {dayFasting.map(f => (
                <div key={f.id} className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: fastingBorderColor }}>
                    🙏 Пост{f.notes ? `: ${f.notes}` : ''} ({f.start_date}{f.end_date ? ` → ${f.end_date}` : ' — продолжается'})
                  </span>
                  <button onClick={() => f.id && deleteFasting(f.id)} className="active:opacity-70 ml-2">
                    <Trash2 size={12} color={sub} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Daily note */}
          <div className="px-4 py-3 border-b" style={{ borderColor: border }}>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: sub }}>Заметки</p>
            {noteEditing ? (
              <div>
                <textarea
                  className="w-full bg-transparent resize-none leading-relaxed allow-select"
                  style={{ fontSize: Math.max(16, fs(14)), color: text, minHeight: 80 }}
                  value={dailyNote}
                  onChange={e => setDailyNote(e.target.value)}
                  autoFocus
                  placeholder="Напишите заметку..."
                />
                <div className="flex gap-3 mt-2">
                  <button onClick={saveNote} className="text-xs px-3 py-1 rounded-lg active:opacity-70" style={{ background: primary, color: '#fff' }}>
                    Сохранить
                  </button>
                  <button onClick={() => setNoteEditing(false)} className="text-xs active:opacity-70" style={{ color: sub }}>
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setNoteEditing(true)} className="w-full text-left active:opacity-70">
                <p style={{ fontSize: fs(14), color: dailyNote ? text : sub }}>
                  {dailyNote || 'Нажмите, чтобы добавить заметку...'}
                </p>
              </button>
            )}
          </div>

          {/* Readings */}
          <div className="px-4 py-3 border-b" style={{ borderColor: border }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: sub }}>Чтение</p>
              <button onClick={() => setShowAddReading(true)} className="active:opacity-70">
                <Plus size={14} color={primary} />
              </button>
            </div>
            {dayReadings.length === 0 ? (
              <p style={{ fontSize: fs(13), color: sub }}>Нет записей чтения</p>
            ) : (
              dayReadings.map(r => (
                <div key={r.id} className="flex items-center gap-2 py-1.5">
                  <button onClick={() => toggleReading(r)} className="active:opacity-70 flex-shrink-0">
                    {r.completed ? <CheckCircle size={18} color="#22c55e" /> : <Circle size={18} color={sub} />}
                  </button>
                  <span
                    className="flex-1 text-left cursor-pointer"
                    style={{ fontSize: fs(14), color: r.completed ? sub : text, textDecoration: r.completed ? 'line-through' : 'none' }}
                    onClick={() => navigateToBible({ book: r.book, chapter: r.chapter })}
                  >
                    {r.book} {r.chapter}
                  </span>
                  <button onClick={() => r.id && deleteReading(r.id)} className="active:opacity-70">
                    <Trash2 size={12} color={sub} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Entries for selected day */}
          {dayEntries.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: sub }}>
                Записи ({dayEntries.length})
              </p>
              {dayEntries.map(e => (
                <button
                  key={e.id}
                  className="w-full text-left py-2 border-b last:border-0 active:opacity-70"
                  style={{ borderColor: border }}
                  onClick={() => setViewingEntry(e)}
                >
                  <p className="font-medium truncate" style={{ fontSize: fs(13), color: text }}>{e.title}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: catColor(e.category) + '22', color: catColor(e.category) }}>
                    {catLabel(e.category)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="h-4" />
      </div>

      {/* Add reading modal */}
      {showAddReading && (
        <div className="ios-modal z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="flex flex-col mt-auto rounded-t-2xl overflow-hidden" style={{ background: bg }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: border, background: card }}>
              <button onClick={() => setShowAddReading(false)} className="active:opacity-70"><X size={20} color={sub} /></button>
              <span className="font-semibold" style={{ color: text, fontSize: fs(16) }}>Добавить чтение</span>
              <button onClick={addReading} className="active:opacity-70"><Check size={20} color={primary} /></button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: sub }}>Книга</p>
                <select
                  className="w-full p-2 rounded-lg"
                  style={{ background: card, color: text, border: `1px solid ${border}`, fontSize: fs(14) }}
                  value={addBook}
                  onChange={e => { setAddBook(e.target.value); setAddChapter(1) }}
                >
                  {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: sub }}>Глава (1–{maxChapter})</p>
                <input
                  type="number"
                  min={1}
                  max={maxChapter}
                  className="w-full p-2 rounded-lg"
                  style={{ background: card, color: text, border: `1px solid ${border}`, fontSize: Math.max(16, fs(14)) }}
                  value={addChapter}
                  onChange={e => setAddChapter(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fasting modal */}
      {showFastingModal && (
        <div className="ios-modal z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="flex flex-col mt-auto rounded-t-2xl overflow-hidden" style={{ background: bg }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: border, background: card }}>
              <button onClick={() => setShowFastingModal(false)} className="active:opacity-70"><X size={20} color={sub} /></button>
              <span className="font-semibold" style={{ color: text, fontSize: fs(16) }}>Начать пост</span>
              <button onClick={startFasting} className="active:opacity-70"><Check size={20} color={primary} /></button>
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold mb-2" style={{ color: sub }}>Описание (необязательно)</p>
              <input
                className="w-full p-2 rounded-lg bg-transparent"
                style={{ fontSize: Math.max(16, fs(14)), color: text, border: `1px solid ${border}` }}
                placeholder="Название или причина поста..."
                value={fastingNote}
                onChange={e => setFastingNote(e.target.value)}
                autoFocus
              />
              <p className="text-xs mt-3" style={{ color: sub }}>
                Начинается с сегодня ({fmtDateRu(fmtDate(today))}). Завершить можно в любой день.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reading plan generator modal */}
      {showPlanModal && (
        <div className="ios-modal z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="flex flex-col mt-auto rounded-t-2xl overflow-hidden" style={{ background: bg }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: border, background: card }}>
              <button onClick={() => setShowPlanModal(false)} className="active:opacity-70"><X size={20} color={sub} /></button>
              <span className="font-semibold" style={{ color: text, fontSize: fs(16) }}>Создать план чтения</span>
              <button onClick={generateAndSavePlan} disabled={planGenerating} className="active:opacity-70">
                <Check size={20} color={primary} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: sub }}>Preset</p>
                <div className="flex flex-col gap-2">
                  {([
                    { id: 'bible-year', label: 'Библия за год', desc: '~3-4 главы в день, 365 дней' },
                    { id: 'nt-90', label: 'Новый Завет за 90 дней', desc: '~3 главы в день' },
                    { id: 'psalms-month', label: 'Псалмы за месяц', desc: '5 псалмов в день, 30 дней' },
                    { id: 'gospels', label: 'Четыре Евангелия', desc: '~3 главы в день, 30 дней' },
                  ] as { id: PlanPreset; label: string; desc: string }[]).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPlanPreset(p.id)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl active:opacity-70"
                      style={{
                        background: planPreset === p.id ? primary + '20' : 'transparent',
                        border: `1px solid ${planPreset === p.id ? primary : border}`,
                      }}
                    >
                      <BookOpen size={16} color={planPreset === p.id ? primary : sub} />
                      <div className="text-left flex-1">
                        <p style={{ fontSize: fs(14), color: planPreset === p.id ? primary : text, fontWeight: 500 }}>{p.label}</p>
                        <p style={{ fontSize: fs(11), color: sub }}>{p.desc}</p>
                      </div>
                      {planPreset === p.id && <Check size={14} color={primary} />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: sub }}>Дата начала</p>
                <input
                  type="date"
                  className="w-full p-2 rounded-lg"
                  style={{ background: card, color: text, border: `1px solid ${border}`, fontSize: fs(14) }}
                  value={planStartDate}
                  onChange={e => setPlanStartDate(e.target.value)}
                />
              </div>
              {planGenerating && <p className="text-center text-sm" style={{ color: sub }}>Генерируется план...</p>}
            </div>
          </div>
        </div>
      )}

      {/* Entry viewer modal */}
      {viewingEntry && (
        <div className="ios-modal z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="flex flex-col mt-auto rounded-t-2xl overflow-hidden" style={{ background: bg, maxHeight: 'calc(var(--app-height, 100dvh) * 0.85)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: border, background: card }}>
              <button onClick={() => setViewingEntry(null)} className="active:opacity-70"><X size={20} color={sub} /></button>
              <span className="font-semibold flex-1 mx-3 truncate" style={{ color: text, fontSize: fs(16) }}>{viewingEntry.title}</span>
            </div>
            <div className="flex-1 scroll-area p-4 allow-select">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: catColor(viewingEntry.category) + '22', color: catColor(viewingEntry.category) }}>
                  {catLabel(viewingEntry.category)}
                </span>
                <span className="text-xs" style={{ color: sub }}>{fmtDateRu(viewingEntry.created_at.slice(0, 10))}</span>
              </div>
              {parseBlocks(viewingEntry.content).map(block => (
                <div key={block.id} className="mb-2">
                  {block.type === 'text' && (
                    <p className="leading-relaxed whitespace-pre-wrap" style={{ fontSize: fs(15), color: text }}
                      dangerouslySetInnerHTML={{ __html: block.content }}
                    />
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
                  {block.type === 'divider' && (
                    <hr style={{ borderColor: border, margin: '8px 0' }} />
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
