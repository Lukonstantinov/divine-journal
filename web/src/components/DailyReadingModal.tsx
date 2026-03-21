import React, { useEffect, useState } from 'react'
import { useTheme } from '../App'
import { getFullDailyReading, DailyReadingResult, CustomPattern } from '../data/DailyReading'
import { db } from '../db'
import { getSetting, setSetting } from '../db'
import { VerseData, genId, fmtDate } from '../types'
import { X, ChevronDown, ChevronUp, BookOpen, Share2 } from 'lucide-react'

interface Props {
  onClose: () => void
  onSaveToJournal: (title: string, verseData: VerseData) => void
  onMarkRead: (streak: number) => void
}

export default function DailyReadingModal({ onClose, onSaveToJournal, onMarkRead }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)
  const { bg, card, border, text, subtext: sub, primary } = theme

  const [reading, setReading] = useState<DailyReadingResult | null>(null)
  const [isRead, setIsRead] = useState(false)
  const [psalmExpanded, setPsalmExpanded] = useState<Record<number, boolean>>({})
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    const today = new Date()
    loadData(today)
  }, [])

  const loadData = async (today: Date) => {
    const patternStr = await getSetting('daily_custom_pattern', '')
    let customPattern: CustomPattern | undefined
    try { if (patternStr) customPattern = JSON.parse(patternStr) } catch {}

    const result = getFullDailyReading(today, customPattern)
    setReading(result)

    const todayStr = fmtDate(today)
    const hist = await db.daily_reading_history.where('date').equals(todayStr).first()
    setIsRead(!!hist?.completed)
  }

  const markAsRead = async () => {
    if (isRead) return
    const todayStr = fmtDate(new Date())
    const existing = await db.daily_reading_history.where('date').equals(todayStr).first()
    if (!existing) {
      await db.daily_reading_history.add({ date: todayStr, completed: true, verse_id: reading?.verseOfDay.reference ?? '' })
    } else {
      await db.daily_reading_history.update(existing.id!, { completed: true })
    }
    setIsRead(true)

    // Calculate streak
    const all = await db.daily_reading_history.filter(h => h.completed).toArray()
    const dates = all.map(h => h.date).sort().reverse()
    let streak = 0
    let cur = new Date()
    cur.setHours(0, 0, 0, 0)
    for (const ds of dates) {
      const d = new Date(ds + 'T00:00:00')
      const diff = Math.round((cur.getTime() - d.getTime()) / 86400000)
      if (diff <= 1) { streak++; cur = d }
      else break
    }
    onMarkRead(streak)
  }

  const handleSave = (title: string, verseData: VerseData) => {
    onSaveToJournal(title, verseData)
    // Increment saved_from_reading_count
    getSetting('saved_from_reading_count', '0').then(v => setSetting('saved_from_reading_count', String(parseInt(v) + 1)))
    setSavedMsg('Сохранено ✓')
    setTimeout(() => setSavedMsg(null), 2000)
  }

  const handleShare = async (refText: string, verseText: string) => {
    const shareText = `"${verseText}" — ${refText}`
    if (navigator.share) {
      try { await navigator.share({ text: shareText }) } catch {}
    } else {
      await navigator.clipboard.writeText(shareText)
      setSavedMsg('Скопировано ✓')
      setTimeout(() => setSavedMsg(null), 2000)
    }
  }

  if (!reading) {
    return (
      <div className="ios-modal z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="flex flex-col mt-auto rounded-t-2xl items-center justify-center py-10" style={{ background: bg }}>
          <BookOpen size={32} color={sub} />
          <p className="mt-3" style={{ color: sub }}>Загрузка...</p>
        </div>
      </div>
    )
  }

  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

  return (
    <div className="ios-modal z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="flex flex-col mt-auto rounded-t-2xl overflow-hidden"
        style={{ background: bg, maxHeight: 'calc(var(--app-height, 100dvh) * 0.94)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: border, background: card }}
        >
          <button onClick={onClose} className="active:opacity-70"><X size={20} color={sub} /></button>
          <span className="font-semibold" style={{ color: text, fontSize: fs(16) }}>Ежедневное чтение</span>
          <div style={{ width: 20 }} />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scroll-area px-4 py-4 flex flex-col gap-5">
          {savedMsg && (
            <div className="text-center py-1.5 rounded-xl text-sm font-medium" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
              {savedMsg}
            </div>
          )}

          {/* Verse of the day */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: primary }}>
              ✨ Стих дня
            </p>
            <div className="rounded-xl px-4 py-3" style={{ background: card, border: `1px solid ${border}` }}>
              <p className="italic leading-relaxed" style={{ fontSize: fs(15), color: text, fontFamily: 'Georgia, serif' }}>
                {cap(reading.verseOfDay.text)}
              </p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs font-semibold" style={{ color: primary }}>{reading.verseOfDay.reference}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleShare(reading.verseOfDay.reference, reading.verseOfDay.text)}
                    className="active:opacity-70 p-1"
                  >
                    <Share2 size={14} color={sub} />
                  </button>
                  <button
                    onClick={() => handleSave(reading.verseOfDay.reference, {
                      book: reading.verseOfDay.book, chapter: reading.verseOfDay.chapter,
                      verse: reading.verseOfDay.verse, text: reading.verseOfDay.text,
                    })}
                    className="text-xs px-2 py-0.5 rounded-lg active:opacity-70"
                    style={{ background: primary + '22', color: primary, border: `1px solid ${primary}33` }}
                  >
                    + В журнал
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Date-pattern verses */}
          {reading.datePatternVerses.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: sub }}>
                📅 Стихи дня
              </p>
              <div className="flex flex-col gap-2">
                {reading.datePatternVerses.map((v, i) => (
                  <div key={i} className="rounded-xl px-4 py-3" style={{ background: card, border: `1px solid ${border}` }}>
                    <p className="italic leading-relaxed" style={{ fontSize: fs(14), color: text, fontFamily: 'Georgia, serif' }}>
                      {cap(v.text)}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs" style={{ color: sub }}>{v.reference}</p>
                      <button
                        onClick={() => handleSave(v.reference, { book: v.book, chapter: v.chapter, verse: v.verse, text: v.text })}
                        className="text-xs px-2 py-0.5 rounded-lg active:opacity-70"
                        style={{ background: primary + '22', color: primary }}
                      >
                        + В журнал
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Psalms */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: sub }}>
              🎵 Псалмы на сегодня
            </p>
            {reading.psalms.length === 0 ? (
              <p style={{ color: sub, fontSize: fs(13) }}>Псалмы не найдены</p>
            ) : (
              reading.psalms.map(psalm => (
                <div key={psalm.chapter} className="mb-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
                  <button
                    className="w-full flex items-center justify-between px-4 py-2.5 active:opacity-70"
                    style={{ background: card }}
                    onClick={() => setPsalmExpanded(prev => ({ ...prev, [psalm.chapter]: !prev[psalm.chapter] }))}
                  >
                    <span className="font-semibold" style={{ fontSize: fs(14), color: text }}>{psalm.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: sub }}>{psalm.verses.length} ст.</span>
                      {psalmExpanded[psalm.chapter] ? <ChevronUp size={14} color={sub} /> : <ChevronDown size={14} color={sub} />}
                    </div>
                  </button>
                  {psalmExpanded[psalm.chapter] && (
                    <div className="px-4 py-3" style={{ background: bg }}>
                      {psalm.verses.map(v => (
                        <div key={v.number} className="flex gap-2 py-0.5">
                          <span className="flex-shrink-0 text-xs font-semibold mt-0.5" style={{ color: sub, minWidth: 18 }}>{v.number}</span>
                          <p className="leading-relaxed" style={{ fontSize: fs(14), color: text, fontFamily: 'Georgia, serif' }}>{v.text}</p>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const full = psalm.verses.map(v => `${v.number} ${v.text}`).join('\n')
                          handleSave(psalm.title, {
                            book: 'Псалтирь', chapter: psalm.chapter, verse: 1, text: full,
                          })
                        }}
                        className="mt-2 text-xs px-3 py-1 rounded-lg active:opacity-70"
                        style={{ background: primary + '22', color: primary, border: `1px solid ${primary}33` }}
                      >
                        + В журнал
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </section>

          {/* Proverbs */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: sub }}>
              💡 Притчи на сегодня
            </p>
            {reading.proverbs.length === 0 ? (
              <p style={{ color: sub, fontSize: fs(13) }}>Притчи не найдены</p>
            ) : (
              <div className="flex flex-col gap-2">
                {reading.proverbs.map((p, i) => (
                  <div key={i} className="rounded-xl px-4 py-3" style={{ background: card, border: `1px solid ${border}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          background: p.type === 'by_day' ? primary + '22' : '#2E7D32' + '22',
                          color: p.type === 'by_day' ? primary : '#2E7D32',
                        }}
                      >
                        {p.type === 'by_day' ? 'По дню' : 'Случайная'}
                      </span>
                    </div>
                    <p className="italic leading-relaxed" style={{ fontSize: fs(14), color: text, fontFamily: 'Georgia, serif' }}>
                      {cap(p.text)}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs" style={{ color: sub }}>{p.reference}</p>
                      <button
                        onClick={() => handleSave(p.reference, { book: 'Притчи', chapter: p.chapter, verse: p.verse, text: p.text })}
                        className="text-xs px-2 py-0.5 rounded-lg active:opacity-70"
                        style={{ background: primary + '22', color: primary }}
                      >
                        + В журнал
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="h-4" />
        </div>

        {/* Mark as read button */}
        <div className="flex-shrink-0 px-4 py-3 border-t" style={{ borderColor: border, background: card }}>
          <button
            onClick={markAsRead}
            disabled={isRead}
            className="w-full py-3 rounded-xl font-semibold active:opacity-70"
            style={{
              background: isRead ? '#A5D6A7' : '#2E7D32',
              color: '#fff',
              fontSize: fs(15),
              opacity: isRead ? 0.8 : 1,
            }}
          >
            {isRead ? '✓ Прочитано' : '✅ Отметить прочитанным'}
          </button>
        </div>
      </div>
    </div>
  )
}
