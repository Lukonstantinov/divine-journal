import React, { useEffect, useState } from 'react'
import { useTheme } from '../App'
import {
  ThemeId, THEMES, CATEGORIES, VERSE_FONTS, ACHIEVEMENTS, AchievementStats,
  FOLDER_COLORS, calcStreak, fmtRelTime, catColor, catLabel,
} from '../types'
import { db, getSetting, setSetting } from '../db'
import { Sun, Moon, Coffee, BookOpen, Download, Upload, Trash2 } from 'lucide-react'
import GraphView from './GraphView'

const FONT_SCALES = [
  { id: 0.85, label: 'Мал' },
  { id: 1, label: 'Норм' },
  { id: 1.15, label: 'Бол' },
  { id: 1.3, label: 'Огр' },
]

interface DetailedStats {
  totalEntries: number
  bookmarks: number
  completedReadings: number
  totalReadingPlan: number
  entryStreak: number
  fastingDays: number
  savedFromReading: number
  catCounts: Record<string, number>
  monthlyData: { label: string; count: number }[]
}

export default function SettingsScreen() {
  const { theme, themeId, setThemeId, fontScale, setFontScale, bibleFont, setBibleFont } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const [stats, setStats] = useState<DetailedStats>({
    totalEntries: 0, bookmarks: 0, completedReadings: 0, totalReadingPlan: 0,
    entryStreak: 0, fastingDays: 0, savedFromReading: 0, catCounts: {}, monthlyData: [],
  })
  const [achievements, setAchievements] = useState<{ id: string; unlocked_at: string }[]>([])

  // Appearance settings
  const [showVerseUsage, setShowVerseUsage] = useState(false)
  const [verseBadgeColor, setVerseBadgeColor] = useState('#8B4513')
  const [verseBadgeOpacity, setVerseBadgeOpacity] = useState(1.0)
  const [noteColorOpacity, setNoteColorOpacity] = useState(0.10)
  const [fastingBorderColor, setFastingBorderColor] = useState('#9C27B0')

  // Auto-backup
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)
  const [autoBackupInterval, setAutoBackupInterval] = useState('weekly')
  const [autoBackupMaxFiles, setAutoBackupMaxFiles] = useState(10)
  const [lastBackupDate, setLastBackupDate] = useState('')
  const [backupHistory, setBackupHistory] = useState<{ date: string; size: number }[]>([])

  // Graph
  const [showGraph, setShowGraph] = useState(false)

  const [exportMsg, setExportMsg] = useState('')
  const [importMsg, setImportMsg] = useState('')

  const loadStats = async () => {
    const [allEntries, allBookmarks, allReadingPlan, allFasting, allHistory, allAchievements] = await Promise.all([
      db.entries.toArray(),
      db.bookmarks.count(),
      db.reading_plan.toArray(),
      db.fasting.toArray(),
      db.daily_reading_history.toArray(),
      db.achievements.toArray(),
    ])

    // Category breakdown
    const catCounts: Record<string, number> = {}
    for (const e of allEntries) {
      catCounts[e.category] = (catCounts[e.category] ?? 0) + 1
    }

    // Monthly data — last 6 months
    const monthlyData: { label: string; count: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const count = allEntries.filter(e => e.created_at.slice(0, 7) === ym).length
      const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
      monthlyData.push({ label: monthNames[d.getMonth()], count })
    }

    // Streak from entry dates
    const entryDates = allEntries.map(e => e.created_at.slice(0, 10))
    const entryStreak = calcStreak(entryDates)

    // Fasting days total
    let fastingDays = 0
    for (const f of allFasting) {
      const start = new Date(f.start_date)
      const end = new Date(f.end_date)
      fastingDays += Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    }

    // Saved from reading (count of entries created from daily reading modal)
    const savedFromReading = parseInt(await getSetting('saved_from_reading_count', '0')) || 0

    const completedReadings = allReadingPlan.filter(r => r.completed).length

    setStats({
      totalEntries: allEntries.length,
      bookmarks: allBookmarks,
      completedReadings,
      totalReadingPlan: allReadingPlan.length,
      entryStreak,
      fastingDays,
      savedFromReading,
      catCounts,
      monthlyData,
    })
    setAchievements(allAchievements)

    // Check and unlock achievements
    const achievementStats: AchievementStats = {
      totalEntries: allEntries.length,
      entryStreak,
      savedFromReading,
      fastingDays,
      completedReadings,
    }
    for (const a of ACHIEVEMENTS) {
      if (a.check(achievementStats) && !allAchievements.find(u => u.id === a.id)) {
        await db.achievements.put({ id: a.id, unlocked_at: new Date().toISOString(), title: a.title, description: a.description })
      }
    }
  }

  const loadSettings = async () => {
    setShowVerseUsage((await getSetting('show_verse_usage', '0')) === '1')
    setVerseBadgeColor(await getSetting('verse_badge_color', '#8B4513'))
    setVerseBadgeOpacity(parseFloat(await getSetting('verse_badge_opacity', '1')) || 1)
    setNoteColorOpacity(parseFloat(await getSetting('note_color_opacity', '0.10')) || 0.10)
    setFastingBorderColor(await getSetting('fasting_border_color', '#9C27B0'))
    setAutoBackupEnabled((await getSetting('autoBackupEnabled', '0')) === '1')
    setAutoBackupInterval(await getSetting('autoBackupInterval', 'weekly'))
    setAutoBackupMaxFiles(parseInt(await getSetting('autoBackupMaxFiles', '10')) || 10)
    setLastBackupDate(await getSetting('lastAutoBackupDate', ''))
    try {
      const hist = JSON.parse(localStorage.getItem('divine_backup_history') ?? '[]')
      setBackupHistory(Array.isArray(hist) ? hist : [])
    } catch { setBackupHistory([]) }
  }

  useEffect(() => {
    loadStats()
    loadSettings()
  }, [])

  const exportData = async () => {
    try {
      const [entries, bookmarks, readingPlan, dailyNotes, fasting, folders, achs] = await Promise.all([
        db.entries.toArray(),
        db.bookmarks.toArray(),
        db.reading_plan.toArray(),
        db.daily_notes.toArray(),
        db.fasting.toArray(),
        db.folders.toArray(),
        db.achievements.toArray(),
      ])
      const data = JSON.stringify({ version: '5.8', entries, bookmarks, readingPlan, dailyNotes, fasting, folders, achievements: achs }, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `divine-journal-backup-${dateStr}.json`
      a.click()
      URL.revokeObjectURL(url)

      // Store in backup history
      const newEntry = { date: new Date().toISOString(), size: data.length }
      const hist = [newEntry, ...backupHistory].slice(0, autoBackupMaxFiles)
      setBackupHistory(hist)
      localStorage.setItem('divine_backup_history', JSON.stringify(hist))
      await setSetting('lastAutoBackupDate', dateStr)
      setLastBackupDate(dateStr)

      setExportMsg('Экспорт выполнен!')
      setTimeout(() => setExportMsg(''), 3000)
    } catch {
      setExportMsg('Ошибка экспорта')
    }
  }

  const importData = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.entries?.length) {
          await db.entries.clear()
          await db.entries.bulkAdd(data.entries.map((e: Record<string, unknown>) => { const { id: _, ...rest } = e; return rest }))
        }
        if (data.bookmarks?.length) {
          await db.bookmarks.clear()
          await db.bookmarks.bulkAdd(data.bookmarks.map((b: Record<string, unknown>) => { const { id: _, ...rest } = b; return rest }))
        }
        if (data.folders?.length) {
          await db.folders.clear()
          await db.folders.bulkAdd(data.folders.map((f: Record<string, unknown>) => { const { id: _, ...rest } = f; return rest }))
        }
        setImportMsg('Данные импортированы!')
        setTimeout(() => setImportMsg(''), 3000)
        loadStats()
      } catch {
        setImportMsg('Ошибка импорта')
      }
    }
    input.click()
  }

  const clearAll = async () => {
    if (!confirm('Удалить все данные? Это действие нельзя отменить.')) return
    await Promise.all([
      db.entries.clear(), db.bookmarks.clear(), db.reading_plan.clear(),
      db.daily_notes.clear(), db.fasting.clear(), db.folders.clear(),
    ])
    loadStats()
  }

  const { bg, card, border, text, subtext: sub, primary, accent } = theme

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mx-3 mb-4 rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${border}` }}>
      <div className="px-4 py-2 border-b" style={{ borderColor: border }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: sub }}>{title}</p>
      </div>
      {children}
    </div>
  )

  const maxMonthly = Math.max(...stats.monthlyData.map(m => m.count), 1)
  const totalCatEntries = (Object.values(stats.catCounts) as number[]).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ background: card, borderColor: border }}>
        <h1 className="font-bold" style={{ fontSize: fs(18), color: text }}>Настройки</h1>
      </div>

      <div className="flex-1 scroll-area pt-4 pb-4">

        {/* ── Statistics ─────────────────────────────── */}
        <Section title="Статистика">
          {/* Overview row */}
          <div className="flex divide-x" style={{ divideColor: border } as never}>
            {[
              { label: 'Записей', value: stats.totalEntries },
              { label: 'Закладок', value: stats.bookmarks },
              { label: 'Прочитано', value: stats.completedReadings },
              { label: 'Серия', value: stats.entryStreak },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1 flex flex-col items-center py-3">
                <span className="font-bold text-xl" style={{ color: primary }}>{value}</span>
                <span className="text-xs" style={{ color: sub }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Category bars */}
          {stats.totalEntries > 0 && (
            <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: border }}>
              <p className="text-xs font-semibold mb-2" style={{ color: sub }}>По категориям</p>
              <div className="flex flex-col gap-1.5">
                {CATEGORIES.map(c => {
                  const count = (stats.catCounts[c.id] as number) ?? 0
                  const pct = Math.round((count / totalCatEntries) * 100)
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="w-20 text-xs truncate flex-shrink-0" style={{ color: c.color }}>{c.label}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: border }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                      </div>
                      <span className="text-xs w-8 text-right flex-shrink-0" style={{ color: sub }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Monthly bar chart */}
          {stats.monthlyData.some(m => m.count > 0) && (
            <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: border }}>
              <p className="text-xs font-semibold mb-3" style={{ color: sub }}>Активность (6 мес.)</p>
              <div className="flex items-end gap-1.5 h-20">
                {stats.monthlyData.map(m => (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm" style={{
                      height: `${Math.round((m.count / maxMonthly) * 64)}px`,
                      background: primary,
                      opacity: m.count > 0 ? 1 : 0.2,
                      minHeight: m.count > 0 ? 4 : 2,
                    }} />
                    <span className="text-[9px]" style={{ color: sub }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reading plan progress */}
          {stats.totalReadingPlan > 0 && (
            <div className="px-4 pb-3 border-t" style={{ borderColor: border }}>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs" style={{ color: sub }}>📖 План чтения</span>
                <span className="text-xs font-semibold" style={{ color: primary }}>
                  {stats.completedReadings}/{stats.totalReadingPlan} ({Math.round(stats.completedReadings / stats.totalReadingPlan * 100)}%)
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: border }}>
                <div className="h-full rounded-full" style={{ background: primary, width: `${Math.round(stats.completedReadings / stats.totalReadingPlan * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Fasting days */}
          {stats.fastingDays > 0 && (
            <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: border }}>
              <span className="text-xs" style={{ color: sub }}>🙏 Дней поста</span>
              <span className="font-bold" style={{ color: primary }}>{stats.fastingDays}</span>
            </div>
          )}
        </Section>

        {/* ── Achievements ───────────────────────────── */}
        <Section title="Достижения">
          <div className="p-3 grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map(a => {
              const unlocked = achievements.find(u => u.id === a.id)
              return (
                <div
                  key={a.id}
                  className="rounded-xl p-3"
                  style={{
                    background: unlocked ? primary + '15' : bg,
                    border: `1px solid ${unlocked ? primary : border}`,
                    opacity: unlocked ? 1 : 0.5,
                  }}
                >
                  <span className="text-2xl block mb-1">{a.icon}</span>
                  <p className="font-semibold text-xs leading-tight" style={{ color: unlocked ? primary : text }}>{a.title}</p>
                  <p className="text-[10px] mt-0.5 leading-tight" style={{ color: sub }}>{a.description}</p>
                  {unlocked && (
                    <p className="text-[9px] mt-1" style={{ color: primary }}>
                      {new Date(unlocked.unlocked_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Theme ──────────────────────────────────── */}
        <Section title="Тема">
          <div className="flex p-3 gap-3">
            {([
              { id: 'light', Icon: Sun, label: 'Светлая' },
              { id: 'dark', Icon: Moon, label: 'Тёмная' },
              { id: 'sepia', Icon: Coffee, label: 'Сепия' },
            ] as { id: ThemeId; Icon: typeof Sun; label: string }[]).map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setThemeId(id)}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl active:opacity-70"
                style={{
                  background: themeId === id ? primary : THEMES[id].bg,
                  border: `2px solid ${themeId === id ? primary : border}`,
                }}
              >
                <Icon size={18} color={themeId === id ? '#fff' : THEMES[id].text} />
                <span className="text-xs font-medium" style={{ color: themeId === id ? '#fff' : THEMES[id].text }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* ── Font scale ─────────────────────────────── */}
        <Section title="Размер текста">
          <div className="flex p-3 gap-2">
            {FONT_SCALES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFontScale(id)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold active:opacity-70"
                style={{
                  background: fontScale === id ? primary : 'transparent',
                  color: fontScale === id ? '#fff' : sub,
                  border: `1px solid ${fontScale === id ? primary : border}`,
                  fontSize: id * 13,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        {/* ── Bible font (10 fonts) ───────────────────── */}
        <Section title="Шрифт Библии">
          <div className="p-3 flex flex-col gap-2">
            {VERSE_FONTS.map(({ id, label, family }) => (
              <button
                key={id}
                onClick={() => setBibleFont(id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl active:opacity-70"
                style={{
                  background: bibleFont === id ? primary + '20' : 'transparent',
                  border: `1px solid ${bibleFont === id ? primary : border}`,
                }}
              >
                <BookOpen size={16} color={bibleFont === id ? primary : sub} />
                <span style={{ fontSize: fs(14), color: bibleFont === id ? primary : text, fontFamily: family }}>{label}</span>
                {bibleFont === id && <span className="ml-auto text-xs" style={{ color: primary }}>✓</span>}
              </button>
            ))}
          </div>
        </Section>

        {/* ── Bible verse usage badges ────────────────── */}
        <Section title="Библия — Использование стихов">
          <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': '1' } as never}>
            {/* Toggle */}
            <div className="flex items-center justify-between px-4 py-3">
              <span style={{ fontSize: fs(14), color: text }}>Показывать счётчик</span>
              <button
                onClick={async () => {
                  const next = !showVerseUsage
                  setShowVerseUsage(next)
                  await setSetting('show_verse_usage', next ? '1' : '0')
                }}
                className="w-12 h-6 rounded-full transition-colors relative active:opacity-70"
                style={{ background: showVerseUsage ? primary : border }}
              >
                <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
                  style={{ left: showVerseUsage ? '26px' : '2px' }} />
              </button>
            </div>

            {/* Badge color */}
            {showVerseUsage && (
              <div className="px-4 py-3" style={{ borderTop: `1px solid ${border}` }}>
                <p className="text-xs mb-2" style={{ color: sub }}>Цвет значка</p>
                <div className="flex gap-2 flex-wrap">
                  {FOLDER_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={async () => { setVerseBadgeColor(c); await setSetting('verse_badge_color', c) }}
                      className="w-7 h-7 rounded-full border-2 active:opacity-70"
                      style={{ background: c, borderColor: verseBadgeColor === c ? '#000' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Badge opacity */}
            {showVerseUsage && (
              <div className="px-4 py-3" style={{ borderTop: `1px solid ${border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs" style={{ color: sub }}>Непрозрачность значка</p>
                  <span className="text-xs font-semibold" style={{ color: primary }}>{Math.round(verseBadgeOpacity * 100)}%</span>
                </div>
                <input
                  type="range" min="25" max="100" step="5"
                  value={Math.round(verseBadgeOpacity * 100)}
                  onChange={async e => {
                    const v = parseInt(e.target.value) / 100
                    setVerseBadgeOpacity(v)
                    await setSetting('verse_badge_opacity', String(v))
                  }}
                  className="w-full accent-primary"
                  style={{ accentColor: primary } as never}
                />
              </div>
            )}
          </div>
        </Section>

        {/* ── Note appearance ─────────────────────────── */}
        <Section title="Внешний вид записей">
          {/* Note color opacity */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs" style={{ color: sub }}>Прозрачность цвета заметки</p>
              <span className="text-xs font-semibold" style={{ color: primary }}>{Math.round(noteColorOpacity * 100)}%</span>
            </div>
            <input
              type="range" min="5" max="20" step="1"
              value={Math.round(noteColorOpacity * 100)}
              onChange={async e => {
                const v = parseInt(e.target.value) / 100
                setNoteColorOpacity(v)
                await setSetting('note_color_opacity', String(v))
              }}
              className="w-full"
              style={{ accentColor: primary } as never}
            />
          </div>

          {/* Fasting border color */}
          <div className="px-4 pb-3 border-t" style={{ borderColor: border }}>
            <p className="text-xs mb-2 pt-3" style={{ color: sub }}>Цвет рамки поста</p>
            <div className="flex gap-2 flex-wrap">
              {[...FOLDER_COLORS, '#9C27B0', '#E91E63'].map(c => (
                <button
                  key={c}
                  onClick={async () => { setFastingBorderColor(c); await setSetting('fasting_border_color', c) }}
                  className="w-7 h-7 rounded-full border-2 active:opacity-70"
                  style={{ background: c, borderColor: fastingBorderColor === c ? '#000' : 'transparent' }}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* ── Graph view ──────────────────────────────── */}
        <Section title="Граф связей">
          <button
            onClick={() => setShowGraph(true)}
            className="flex items-center gap-3 px-4 py-3 w-full active:opacity-70"
          >
            <span className="text-xl">🕸️</span>
            <span style={{ fontSize: fs(14), color: text }}>Открыть граф связей</span>
            <span className="ml-auto text-xs" style={{ color: sub }}>→</span>
          </button>
        </Section>

        {/* ── Auto-backup ─────────────────────────────── */}
        <Section title="Автоматическое резервирование">
          <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': '1' } as never}>
            {/* Toggle */}
            <div className="flex items-center justify-between px-4 py-3">
              <span style={{ fontSize: fs(14), color: text }}>Автобэкап</span>
              <button
                onClick={async () => {
                  const next = !autoBackupEnabled
                  setAutoBackupEnabled(next)
                  await setSetting('autoBackupEnabled', next ? '1' : '0')
                }}
                className="w-12 h-6 rounded-full transition-colors relative active:opacity-70"
                style={{ background: autoBackupEnabled ? primary : border }}
              >
                <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
                  style={{ left: autoBackupEnabled ? '26px' : '2px' }} />
              </button>
            </div>

            {/* Interval */}
            {autoBackupEnabled && (
              <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: `1px solid ${border}` }}>
                <span className="text-xs" style={{ color: sub }}>Интервал</span>
                <select
                  value={autoBackupInterval}
                  onChange={async e => { setAutoBackupInterval(e.target.value); await setSetting('autoBackupInterval', e.target.value) }}
                  className="flex-1 bg-transparent text-xs border rounded px-2 py-1"
                  style={{ color: text, borderColor: border }}
                >
                  <option value="daily">Ежедневно</option>
                  <option value="weekly">Еженедельно</option>
                  <option value="monthly">Ежемесячно</option>
                </select>
              </div>
            )}

            {/* Last backup */}
            {lastBackupDate && (
              <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: `1px solid ${border}` }}>
                <span className="text-xs" style={{ color: sub }}>Последний бэкап</span>
                <span className="text-xs" style={{ color: primary }}>{lastBackupDate}</span>
              </div>
            )}

            {/* Backup history */}
            {backupHistory.length > 0 && (
              <div className="px-4 py-3" style={{ borderTop: `1px solid ${border}` }}>
                <p className="text-xs font-semibold mb-2" style={{ color: sub }}>История ({backupHistory.length})</p>
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                  {backupHistory.map((h, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span style={{ color: sub }}>{fmtRelTime(h.date)}</span>
                      <span style={{ color: sub }}>{(h.size / 1024).toFixed(1)} КБ</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── Data ────────────────────────────────────── */}
        <Section title="Данные">
          <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': '1' } as never}>
            <button onClick={exportData} className="flex items-center gap-3 px-4 py-3 active:opacity-70">
              <Download size={18} color={primary} />
              <span style={{ fontSize: fs(14), color: text }}>Экспорт данных</span>
              {exportMsg && <span className="ml-auto text-xs" style={{ color: '#22c55e' }}>{exportMsg}</span>}
            </button>
            <button onClick={importData} className="flex items-center gap-3 px-4 py-3 active:opacity-70"
              style={{ borderTop: `1px solid ${border}` }}>
              <Upload size={18} color={primary} />
              <span style={{ fontSize: fs(14), color: text }}>Импорт данных</span>
              {importMsg && <span className="ml-auto text-xs" style={{ color: importMsg.includes('Ошибка') ? '#ef4444' : '#22c55e' }}>{importMsg}</span>}
            </button>
            <button onClick={clearAll} className="flex items-center gap-3 px-4 py-3 active:opacity-70"
              style={{ borderTop: `1px solid ${border}` }}>
              <Trash2 size={18} color="#ef4444" />
              <span style={{ fontSize: fs(14), color: '#ef4444' }}>Удалить все данные</span>
            </button>
          </div>
        </Section>

        {/* About */}
        <div className="mx-3 mb-6 text-center">
          <p className="text-xs" style={{ color: sub }}>Духовный Дневник</p>
          <p className="text-xs" style={{ color: sub }}>Версия 5.8 (Web)</p>
        </div>
      </div>

      {/* Graph modal */}
      {showGraph && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: bg }}>
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
            style={{ background: card, borderColor: border }}>
            <span className="font-semibold" style={{ color: text }}>Граф связей</span>
            <button onClick={() => setShowGraph(false)} className="active:opacity-70">
              <span style={{ color: sub, fontSize: 20 }}>✕</span>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <GraphView onClose={() => setShowGraph(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
