import React, { useEffect, useRef, useState } from 'react'
import { Tab } from '../types'
import { useTheme } from '../App'
import { BookOpen, BookMarked, Calendar, Settings, Search, type LucideIcon } from 'lucide-react'

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'journal', label: 'Дневник', Icon: BookOpen },
  { id: 'bible', label: 'Библия', Icon: BookMarked },
  { id: 'calendar', label: 'Календарь', Icon: Calendar },
  { id: 'search', label: 'Поиск', Icon: Search },
  { id: 'settings', label: 'Настройки', Icon: Settings },
]

export default function TabBar({ activeTab, onTabChange }: Props) {
  const { theme } = useTheme()
  const [poppedTab, setPoppedTab] = useState<Tab | null>(null)
  const prevTab = useRef(activeTab)

  // Pop the icon that just became active
  useEffect(() => {
    if (prevTab.current !== activeTab) {
      setPoppedTab(activeTab)
      prevTab.current = activeTab
      const t = setTimeout(() => setPoppedTab(null), 280)
      return () => clearTimeout(t)
    }
  }, [activeTab])

  return (
    <div className="flex-shrink-0 pb-safe px-3 pt-1.5" style={{ background: theme.bg }}>
      <div
        className="tab-bar-float flex items-stretch justify-around px-1 py-1.5"
        style={{ background: theme.tabBar, border: `1px solid ${theme.tabBarBorder}` }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          const color = active ? '#fff' : theme.subtext
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="press flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-2xl"
              style={{
                background: active ? theme.primary : 'transparent',
                color,
                transition: 'background 0.18s ease, color 0.18s ease',
              }}
            >
              <Icon
                size={19}
                color={color}
                strokeWidth={active ? 2.4 : 2}
                className={poppedTab === id ? 'tab-icon-pop' : undefined}
              />
              <span className="text-[9px] font-semibold tracking-tight">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
