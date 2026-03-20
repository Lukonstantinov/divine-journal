import React, { createContext, useContext, useEffect, useState } from 'react'
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

  const navigateToBible = (target: NavTarget) => {
    setNavTarget(target)
    setTab('bible')
  }

  const theme = THEMES[themeId]

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: THEMES.light.bg }}>
        <div className="text-primary text-lg font-semibold">Духовный Дневник</div>
      </div>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId, fontScale, setFontScale, bibleFont, setBibleFont }}>
      <div
        className="flex flex-col h-full select-none"
        style={{ background: theme.bg, color: theme.text }}
      >
        {/* Status bar spacer */}
        <div className="pt-safe flex-shrink-0" style={{ background: theme.bg }} />

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
