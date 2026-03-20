import React, { useCallback, useEffect, useState } from 'react'
import { useTheme, NavTarget } from '../App'
import { db, ReadingPlan } from '../db'
import { MONTHS, WDAYS, fmtDate, fmtDateRu } from '../types'
import { ChevronLeft, ChevronRight, CheckCircle, Circle } from 'lucide-react'

interface Props {
  navigateToBible: (target: NavTarget) => void
}

export default function CalendarScreen({ navigateToBible }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string>(fmtDate(today))
  const [readings, setReadings] = useState<ReadingPlan[]>([])
  const [dailyNote, setDailyNote] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)

  const load = useCallback(async () => {
    const y = year, m = month + 1
    const prefix = `${y}-${String(m).padStart(2, '0')}`
    const rds = await db.reading_plan.where('date').startsWith(prefix).toArray()
    setReadings(rds)

    const note = await db.daily_notes.where('date').equals(selectedDate).first()
    setDailyNote(note?.notes ?? '')
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

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid (Mon-start)
  const firstDay = new Date(year, month, 1)
  const startDow = (firstDay.getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const readingsByDate = readings.reduce<Record<string, ReadingPlan[]>>((acc, r) => {
    acc[r.date] = [...(acc[r.date] ?? []), r]
    return acc
  }, {})

  const dayReadings = readingsByDate[selectedDate] ?? []
  const todayStr = fmtDate(today)

  const bg = theme.bg
  const card = theme.card
  const border = theme.border
  const text = theme.text
  const sub = theme.subtext
  const primary = theme.primary

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ background: card, borderColor: border }}>
        <button onClick={prevMonth} className="active:opacity-70 p-1">
          <ChevronLeft size={20} color={primary} />
        </button>
        <h1 className="font-bold" style={{ fontSize: fs(17), color: text }}>
          {MONTHS[month]} {year}
        </h1>
        <button onClick={nextMonth} className="active:opacity-70 p-1">
          <ChevronRight size={20} color={primary} />
        </button>
      </div>

      <div className="flex-1 scroll-area">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 px-2 pt-3 pb-1">
          {WDAYS.map(d => (
            <div key={d} className="text-center text-xs font-semibold" style={{ color: sub }}>
              {d}
            </div>
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

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className="aspect-square flex flex-col items-center justify-center rounded-xl active:opacity-70"
                style={{
                  background: isSelected ? primary : isToday ? primary + '20' : 'transparent',
                  border: isToday && !isSelected ? `1.5px solid ${primary}` : undefined,
                }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ color: isSelected ? '#fff' : text }}
                >
                  {day}
                </span>
                {(hasSome || hasAll) && (
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-0.5"
                    style={{ background: isSelected ? '#fff' : hasAll ? '#22c55e' : '#f59e0b' }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Day detail */}
        <div className="mx-3 mt-4 rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="px-4 pt-3 pb-2 border-b" style={{ borderColor: border }}>
            <p className="font-semibold" style={{ fontSize: fs(14), color: text }}>
              {fmtDateRu(selectedDate)}
            </p>
          </div>

          {/* Daily note */}
          <div className="px-4 py-3 border-b" style={{ borderColor: border }}>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: sub }}>
              Заметки
            </p>
            {noteEditing ? (
              <div>
                <textarea
                  className="w-full bg-transparent resize-none leading-relaxed"
                  style={{ fontSize: fs(14), color: text, minHeight: 80 }}
                  value={dailyNote}
                  onChange={e => setDailyNote(e.target.value)}
                  autoFocus
                  placeholder="Напишите заметку..."
                />
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={saveNote}
                    className="text-xs px-3 py-1 rounded-lg active:opacity-70"
                    style={{ background: primary, color: '#fff' }}
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setNoteEditing(false)}
                    className="text-xs active:opacity-70"
                    style={{ color: sub }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setNoteEditing(true)}
                className="w-full text-left active:opacity-70"
              >
                <p style={{ fontSize: fs(14), color: dailyNote ? text : sub }}>
                  {dailyNote || 'Нажмите, чтобы добавить заметку...'}
                </p>
              </button>
            )}
          </div>

          {/* Readings */}
          <div className="px-4 py-3">
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: sub }}>
              Чтение
            </p>
            {dayReadings.length === 0 ? (
              <p style={{ fontSize: fs(13), color: sub }}>Нет записей чтения</p>
            ) : (
              dayReadings.map(r => (
                <button
                  key={r.id}
                  className="w-full flex items-center gap-3 py-2 active:opacity-70"
                  onClick={() => toggleReading(r)}
                >
                  {r.completed
                    ? <CheckCircle size={18} color="#22c55e" />
                    : <Circle size={18} color={sub} />
                  }
                  <span
                    className="flex-1 text-left"
                    style={{
                      fontSize: fs(14),
                      color: r.completed ? sub : text,
                      textDecoration: r.completed ? 'line-through' : 'none',
                    }}
                    onClick={e => { e.stopPropagation(); navigateToBible({ book: r.book, chapter: r.chapter }) }}
                  >
                    {r.book} {r.chapter}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="h-4" />
      </div>
    </div>
  )
}
