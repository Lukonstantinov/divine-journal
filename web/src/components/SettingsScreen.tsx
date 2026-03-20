import React, { useEffect, useState } from 'react'
import { useTheme } from '../App'
import { ThemeId, THEMES } from '../types'
import { db, getSetting, setSetting } from '../db'
import { Sun, Moon, Coffee, Type, BookOpen, Download, Upload, Trash2 } from 'lucide-react'

const BIBLE_FONTS = [
  { id: 'serif', label: 'Serif (Georgia)' },
  { id: 'sans', label: 'Sans (Inter)' },
  { id: 'mono', label: 'Mono' },
  { id: 'lora', label: 'Lora' },
  { id: 'palatino', label: 'Palatino' },
]

const FONT_SCALES = [
  { id: 0.85, label: 'Мал' },
  { id: 1, label: 'Норм' },
  { id: 1.15, label: 'Бол' },
  { id: 1.3, label: 'Огр' },
]

export default function SettingsScreen() {
  const { theme, themeId, setThemeId, fontScale, setFontScale, bibleFont, setBibleFont } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const [stats, setStats] = useState({ entries: 0, bookmarks: 0, readings: 0 })
  const [exportMsg, setExportMsg] = useState('')
  const [importMsg, setImportMsg] = useState('')

  useEffect(() => {
    Promise.all([
      db.entries.count(),
      db.bookmarks.count(),
      db.reading_plan.filter(r => r.completed).count(),
    ]).then(([e, b, r]) => setStats({ entries: e, bookmarks: b, readings: r }))
  }, [])

  const exportData = async () => {
    try {
      const [entries, bookmarks, readingPlan, dailyNotes, fasting, folders, achievements] = await Promise.all([
        db.entries.toArray(),
        db.bookmarks.toArray(),
        db.reading_plan.toArray(),
        db.daily_notes.toArray(),
        db.fasting.toArray(),
        db.folders.toArray(),
        db.achievements.toArray(),
      ])
      const data = JSON.stringify({ version: '5.7', entries, bookmarks, readingPlan, dailyNotes, fasting, folders, achievements }, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `divine-journal-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
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
      } catch {
        setImportMsg('Ошибка импорта')
      }
    }
    input.click()
  }

  const clearAll = async () => {
    if (!confirm('Удалить все данные? Это действие нельзя отменить.')) return
    await Promise.all([
      db.entries.clear(),
      db.bookmarks.clear(),
      db.reading_plan.clear(),
      db.daily_notes.clear(),
      db.fasting.clear(),
      db.folders.clear(),
    ])
    setStats({ entries: 0, bookmarks: 0, readings: 0 })
  }

  const bg = theme.bg
  const card = theme.card
  const border = theme.border
  const text = theme.text
  const sub = theme.subtext
  const primary = theme.primary

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mx-3 mb-4 rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${border}` }}>
      <div className="px-4 py-2 border-b" style={{ borderColor: border }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: sub }}>{title}</p>
      </div>
      {children}
    </div>
  )

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ background: card, borderColor: border }}>
        <h1 className="font-bold" style={{ fontSize: fs(18), color: text }}>Настройки</h1>
      </div>

      <div className="flex-1 scroll-area pt-4">
        {/* Stats */}
        <Section title="Статистика">
          <div className="flex divide-x" style={{ divideColor: border } as never}>
            {[
              { label: 'Записей', value: stats.entries },
              { label: 'Закладок', value: stats.bookmarks },
              { label: 'Прочитано', value: stats.readings },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1 flex flex-col items-center py-3">
                <span className="font-bold text-xl" style={{ color: primary }}>{value}</span>
                <span className="text-xs" style={{ color: sub }}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Theme */}
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

        {/* Font scale */}
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

        {/* Bible font */}
        <Section title="Шрифт Библии">
          <div className="p-3 flex flex-col gap-2">
            {BIBLE_FONTS.map(({ id, label }) => (
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
                <span style={{ fontSize: fs(14), color: bibleFont === id ? primary : text }}>{label}</span>
                {bibleFont === id && <span className="ml-auto text-xs" style={{ color: primary }}>✓</span>}
              </button>
            ))}
          </div>
        </Section>

        {/* Data */}
        <Section title="Данные">
          <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': '1' } as never}>
            <button
              onClick={exportData}
              className="flex items-center gap-3 px-4 py-3 active:opacity-70"
            >
              <Download size={18} color={primary} />
              <span style={{ fontSize: fs(14), color: text }}>Экспорт данных</span>
              {exportMsg && <span className="ml-auto text-xs" style={{ color: '#22c55e' }}>{exportMsg}</span>}
            </button>
            <button
              onClick={importData}
              className="flex items-center gap-3 px-4 py-3 active:opacity-70"
              style={{ borderTop: `1px solid ${border}` }}
            >
              <Upload size={18} color={primary} />
              <span style={{ fontSize: fs(14), color: text }}>Импорт данных</span>
              {importMsg && <span className="ml-auto text-xs" style={{ color: importMsg.includes('Ошибка') ? '#ef4444' : '#22c55e' }}>{importMsg}</span>}
            </button>
            <button
              onClick={clearAll}
              className="flex items-center gap-3 px-4 py-3 active:opacity-70"
              style={{ borderTop: `1px solid ${border}` }}
            >
              <Trash2 size={18} color="#ef4444" />
              <span style={{ fontSize: fs(14), color: '#ef4444' }}>Удалить все данные</span>
            </button>
          </div>
        </Section>

        {/* About */}
        <div className="mx-3 mb-6 text-center">
          <p className="text-xs" style={{ color: sub }}>Духовный Дневник</p>
          <p className="text-xs" style={{ color: sub }}>Версия 5.7 (Web)</p>
        </div>
      </div>
    </div>
  )
}
