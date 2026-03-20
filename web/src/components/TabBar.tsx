import React from 'react'
import { Tab } from '../types'
import { useTheme } from '../App'
import { BookOpen, BookMarked, Calendar, Settings, type LucideIcon } from 'lucide-react'

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'journal', label: 'Дневник', Icon: BookOpen },
  { id: 'bible', label: 'Библия', Icon: BookMarked },
  { id: 'calendar', label: 'Календарь', Icon: Calendar },
  { id: 'settings', label: 'Настройки', Icon: Settings },
]

export default function TabBar({ activeTab, onTabChange }: Props) {
  const { theme } = useTheme()

  return (
    <div
      className="tab-bar-height flex-shrink-0 flex items-start justify-around border-t"
      style={{ background: theme.tabBar, borderColor: theme.tabBarBorder }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = activeTab === id
        const color = active ? theme.primary : theme.subtext
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 pt-2 active:opacity-70"
            style={{ color }}
          >
            <Icon size={22} color={color} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
