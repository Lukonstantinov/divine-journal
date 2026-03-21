import React from 'react'
import { useTheme } from '../App'
import { BookOpen } from 'lucide-react'

interface Props {
  isRead: boolean
  streak: number
  onOpen: () => void
  fontScale: number
}

export default function DailyReadingCard({ isRead, streak, onOpen, fontScale }: Props) {
  const { theme } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)
  const { card, border, primary } = theme

  const bg = isRead ? '#E8F5E9' : '#FFF8E7'
  const accentColor = isRead ? '#2E7D32' : '#E65100'
  const borderColor = isRead ? '#A5D6A7' : '#FFCC80'

  return (
    <div
      className="mx-3 mt-2 rounded-xl flex items-center justify-between px-3 py-2 flex-shrink-0"
      style={{ background: bg, border: `1px solid ${borderColor}` }}
    >
      <div className="flex items-center gap-2">
        <BookOpen size={16} color={accentColor} />
        <div>
          <p className="font-semibold" style={{ fontSize: fs(13), color: accentColor }}>
            Ежедневное чтение
          </p>
          {streak > 0 && (
            <p style={{ fontSize: fs(11), color: accentColor + 'BB' }}>
              🔥 {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onOpen}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold active:opacity-70"
        style={{
          background: isRead ? '#A5D6A7' : accentColor,
          color: '#fff',
          fontSize: fs(12),
        }}
      >
        {isRead ? '✓ Готово' : 'Читать →'}
      </button>
    </div>
  )
}
