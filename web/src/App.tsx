import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { ThemeId, ThemeColors, THEMES, Tab } from './types'
import { getSetting, setSetting } from './db'
import TabBar from './components/TabBar'
import JournalScreen from './components/JournalScreen'
import BibleScreen from './components/BibleScreen'
import CalendarScreen from './components/CalendarScreen'
import SettingsScreen from './components/SettingsScreen'

interface ThemeCtx {
  theme: ThemeColors
  themeId: ThemeId
  setThemeId: (id: ThemeId) => void
  fontScale: number
  setFontScale: (s: number) => void
  bibleFont: string
  setBibleFont: (f: string) => void
}

export const ThemeContext = createContext<ThemeCtx>({
  theme: THEMES.light,
  themeId: 'light',
  setThemeId: () => {},
  fontScale: 1,
  setFontScale: () => {},
  bibleFont: 'serif',
  setBibleFont: () => {},
})

export const useTheme = () => useContext(ThemeContext)

export interface NavTarget {
  book: string
  chapter: number
  verse?: number
}

export default function App() {
  const [themeId, setThemeIdState] = useState<ThemeId>('light')
  const [fontScale, setFontScaleState] = useState(1)
  const [bibleFont, setBibleFontState] = useState('serif')
  const [tab, setTab] = useState<Tab>('journal')
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null)
  const [ready, setReady] = useState(false)
  const [swUpdate, setSwUpdate] = useState(false)

  useEffect(() => {
    Promise.all([
      getSetting('theme', 'light'),
      getSetting('fontScale', '1'),
      getSetting('bibleFont', 'serif'),
    ]).then(([t, fs, bf]) => {
      setThemeIdState(t as ThemeId)
      setFontScaleState(parseFloat(fs) || 1)
      setBibleFontState(bf)
      setReady(true)
    })
  }, [])

  const setThemeId = (id: ThemeId) => {
    setThemeIdState(id)
    setSetting('theme', id)
  }
  const setFontScale = (s: number) => {
    setFontScaleState(s)
    setSetting('fontScale', String(s))
  }
  const setBibleFont = (f: string) => {
    setBibleFontState(f)
    setSetting('bibleFont', f)
  }

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

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId, fontScale, setFontScale, bibleFont, setBibleFont }}>
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
          {tab === 'settings' && <SettingsScreen />}
        </div>

        {/* Tab bar */}
        <TabBar activeTab={tab} onTabChange={setTab} />
      </div>
    </ThemeContext.Provider>
  )
}
