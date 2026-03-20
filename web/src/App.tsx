import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { ThemeId, ThemeColors, THEMES, Tab } from './types'
import { getSetting, setSetting } from './db'
import TabBar from './components/TabBar'
import JournalScreen from './components/JournalScreen'
import BibleScreen from './components/BibleScreen'
import CalendarScreen from './components/CalendarScreen'
import SearchScreen from './components/SearchScreen'
import SettingsScreen from './components/SettingsScreen'

interface ThemeCtx {
  theme: ThemeColors
  themeId: ThemeId
  setThemeId: (id: ThemeId) => void
  fontScale: number
  setFontScale: (s: number) => void
  bibleFont: string
  setBibleFont: (f: string) => void
  noteOpacity: number
  setNoteOpacity: (v: number) => void
  fastingBorderColor: string
  setFastingBorderColor: (v: string) => void
  showVerseUsage: boolean
  setShowVerseUsage: (v: boolean) => void
  badgeColor: string
  setBadgeColor: (v: string) => void
  badgeOpacity: number
  setBadgeOpacity: (v: number) => void
}

export const ThemeContext = createContext<ThemeCtx>({
  theme: THEMES.light,
  themeId: 'light',
  setThemeId: () => {},
  fontScale: 1,
  setFontScale: () => {},
  bibleFont: 'serif',
  setBibleFont: () => {},
  noteOpacity: 0.10,
  setNoteOpacity: () => {},
  fastingBorderColor: '#9C27B0',
  setFastingBorderColor: () => {},
  showVerseUsage: false,
  setShowVerseUsage: () => {},
  badgeColor: '#8B4513',
  setBadgeColor: () => {},
  badgeOpacity: 1,
  setBadgeOpacity: () => {},
})

export const useTheme = () => useContext(ThemeContext)

export interface NavTarget {
  book: string
  chapter: number
  verse?: number
  highlightTerm?: string
}

export default function App() {
  const [themeId, setThemeIdState] = useState<ThemeId>('light')
  const [fontScale, setFontScaleState] = useState(1)
  const [bibleFont, setBibleFontState] = useState('serif')
  const [noteOpacity, setNoteOpacityState] = useState(0.10)
  const [fastingBorderColor, setFastingBorderColorState] = useState('#9C27B0')
  const [showVerseUsage, setShowVerseUsageState] = useState(false)
  const [badgeColor, setBadgeColorState] = useState('#8B4513')
  const [badgeOpacity, setBadgeOpacityState] = useState(1)
  const [tab, setTab] = useState<Tab>('journal')
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null)
  const [ready, setReady] = useState(false)
  const [swUpdate, setSwUpdate] = useState(false)

  useEffect(() => {
    Promise.all([
      getSetting('theme', 'light'),
      getSetting('fontScale', '1'),
      getSetting('bibleFont', 'serif'),
      getSetting('note_color_opacity', '0.10'),
      getSetting('fasting_border_color', '#9C27B0'),
      getSetting('show_verse_usage', '0'),
      getSetting('verse_badge_color', '#8B4513'),
      getSetting('verse_badge_opacity', '1'),
    ]).then(([t, fs, bf, nop, fbc, svu, vbc, vbo]) => {
      setThemeIdState(t as ThemeId)
      setFontScaleState(parseFloat(fs) || 1)
      setBibleFontState(bf)
      setNoteOpacityState(parseFloat(nop) || 0.10)
      setFastingBorderColorState(fbc || '#9C27B0')
      setShowVerseUsageState(svu === '1')
      setBadgeColorState(vbc || '#8B4513')
      setBadgeOpacityState(parseFloat(vbo) || 1)
      setReady(true)
    })
  }, [])

  const setThemeId = (id: ThemeId) => { setThemeIdState(id); setSetting('theme', id) }
  const setFontScale = (s: number) => { setFontScaleState(s); setSetting('fontScale', String(s)) }
  const setBibleFont = (f: string) => { setBibleFontState(f); setSetting('bibleFont', f) }
  const setNoteOpacity = (v: number) => { setNoteOpacityState(v); setSetting('note_color_opacity', String(v)) }
  const setFastingBorderColor = (v: string) => { setFastingBorderColorState(v); setSetting('fasting_border_color', v) }
  const setShowVerseUsage = (v: boolean) => { setShowVerseUsageState(v); setSetting('show_verse_usage', v ? '1' : '0') }
  const setBadgeColor = (v: string) => { setBadgeColorState(v); setSetting('verse_badge_color', v) }
  const setBadgeOpacity = (v: number) => { setBadgeOpacityState(v); setSetting('verse_badge_opacity', String(v)) }

  const navigateToBible = useCallback((target: NavTarget) => {
    setNavTarget(target)
    setTab('bible')
  }, [])

  // Listen for service worker updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.addEventListener('updatefound', () => {
          const newSw = reg.installing
          newSw?.addEventListener('statechange', () => {
            if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
              setSwUpdate(true)
            }
          })
        })
      })
    }
  }, [])

  const theme = THEMES[themeId]

  // Update theme-color meta tag for iOS status bar
  useEffect(() => {
    const metas = document.querySelectorAll('meta[name="theme-color"]')
    metas.forEach(m => m.setAttribute('content', theme.bg))
  }, [theme.bg])

  if (!ready) {
    return (
      <div className="flex items-center justify-center" style={{ background: THEMES.light.bg, height: 'var(--app-height, 100dvh)' }}>
        <div className="text-primary text-lg font-semibold">Духовный Дневник</div>
      </div>
    )
  }

  const ctx: ThemeCtx = {
    theme, themeId, setThemeId,
    fontScale, setFontScale,
    bibleFont, setBibleFont,
    noteOpacity, setNoteOpacity,
    fastingBorderColor, setFastingBorderColor,
    showVerseUsage, setShowVerseUsage,
    badgeColor, setBadgeColor,
    badgeOpacity, setBadgeOpacity,
  }

  return (
    <ThemeContext.Provider value={ctx}>
      <div
        className="flex flex-col select-none"
        style={{ background: theme.bg, color: theme.text, height: 'var(--app-height, 100dvh)' }}
      >
        {/* Status bar spacer */}
        <div className="pt-safe flex-shrink-0" style={{ background: theme.bg }} />

        {/* Service worker update banner */}
        {swUpdate && (
          <div
            className="flex items-center justify-between px-4 py-2 flex-shrink-0"
            style={{ background: theme.primary, color: '#fff' }}
          >
            <span className="text-xs font-medium">Доступно обновление</span>
            <button
              className="text-xs font-bold px-3 py-1 rounded-lg active:opacity-70"
              style={{ background: 'rgba(255,255,255,0.2)' }}
              onClick={() => window.location.reload()}
            >
              Обновить
            </button>
          </div>
        )}

        {/* Screen content */}
        <div className="content-area flex-1 overflow-hidden">
          {tab === 'journal' && <JournalScreen navigateToBible={navigateToBible} />}
          {tab === 'bible' && <BibleScreen navTarget={navTarget} clearNavTarget={() => setNavTarget(null)} />}
          {tab === 'calendar' && <CalendarScreen navigateToBible={navigateToBible} />}
          {tab === 'search' && <SearchScreen navigateToBible={navigateToBible} />}
          {tab === 'settings' && <SettingsScreen />}
        </div>

        {/* Tab bar */}
        <TabBar activeTab={tab} onTabChange={setTab} />
      </div>
    </ThemeContext.Provider>
  )
}
