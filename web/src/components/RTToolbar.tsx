import React, { useState } from 'react'
import { useTheme } from '../App'
import { HIGHLIGHT_COLORS } from '../types'
import { Bold, Italic, Underline, Type, Highlighter, Minus } from 'lucide-react'

export interface ActiveFormats {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: string
  highlight?: string
}

interface Props {
  active: ActiveFormats
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onFontSize: (size: string) => void
  onHighlight: (color: string | null) => void
  onDivider: () => void
}

const FONT_SIZES = [
  { id: 's',  label: 'А', style: { fontSize: 11 } },
  { id: 'n',  label: 'А', style: { fontSize: 14 } },
  { id: 'l',  label: 'А', style: { fontSize: 17 } },
  { id: 'xl', label: 'А', style: { fontSize: 20 } },
]

export default function RTToolbar({ active, onBold, onItalic, onUnderline, onFontSize, onHighlight, onDivider }: Props) {
  const { theme } = useTheme()
  const [showSizes, setShowSizes] = useState(false)
  const [showHighlights, setShowHighlights] = useState(false)

  const primary = theme.primary
  const sub = theme.subtext
  const card = theme.card
  const border = theme.border

  const btnStyle = (active: boolean) => ({
    background: active ? primary + '22' : 'transparent',
    color: active ? primary : sub,
    borderRadius: 8,
    padding: '6px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  })

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 border-t border-b overflow-x-auto"
      style={{ background: card, borderColor: border, scrollbarWidth: 'none' }}
    >
      {/* Bold */}
      <button style={btnStyle(!!active.bold)} onClick={onBold} className="active:opacity-70 flex-shrink-0">
        <Bold size={16} />
      </button>

      {/* Italic */}
      <button style={btnStyle(!!active.italic)} onClick={onItalic} className="active:opacity-70 flex-shrink-0">
        <Italic size={16} />
      </button>

      {/* Underline */}
      <button style={btnStyle(!!active.underline)} onClick={onUnderline} className="active:opacity-70 flex-shrink-0">
        <Underline size={16} />
      </button>

      <div className="w-px h-5 flex-shrink-0" style={{ background: border }} />

      {/* Font size */}
      <div className="relative flex-shrink-0">
        <button
          style={btnStyle(showSizes)}
          onClick={() => { setShowSizes(v => !v); setShowHighlights(false) }}
          className="active:opacity-70"
        >
          <Type size={16} />
        </button>
        {showSizes && (
          <div
            className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 rounded-xl shadow-lg z-50"
            style={{ background: card, border: `1px solid ${border}` }}
          >
            {FONT_SIZES.map(f => (
              <button
                key={f.id}
                onClick={() => { onFontSize(f.id); setShowSizes(false) }}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold active:opacity-70"
                style={{
                  ...f.style,
                  background: active.fontSize === f.id ? primary : 'transparent',
                  color: active.fontSize === f.id ? '#fff' : sub,
                  border: `1px solid ${active.fontSize === f.id ? primary : border}`,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Highlight */}
      <div className="relative flex-shrink-0">
        <button
          style={{
            ...btnStyle(showHighlights || !!active.highlight),
            borderBottom: active.highlight
              ? `3px solid ${HIGHLIGHT_COLORS.find(h => h.id === active.highlight)?.color ?? 'transparent'}`
              : undefined,
          }}
          onClick={() => { setShowHighlights(v => !v); setShowSizes(false) }}
          className="active:opacity-70"
        >
          <Highlighter size={16} />
        </button>
        {showHighlights && (
          <div
            className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 rounded-xl shadow-lg z-50"
            style={{ background: card, border: `1px solid ${border}` }}
          >
            {HIGHLIGHT_COLORS.map(h => (
              <button
                key={h.id}
                onClick={() => { onHighlight(h.id); setShowHighlights(false) }}
                className="w-7 h-7 rounded-full active:opacity-70"
                style={{
                  background: h.color,
                  border: `2px solid ${active.highlight === h.id ? primary : border}`,
                }}
                title={h.label}
              />
            ))}
            {/* Clear highlight */}
            <button
              onClick={() => { onHighlight(null); setShowHighlights(false) }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold active:opacity-70"
              style={{ background: 'transparent', color: sub, border: `1px solid ${border}` }}
              title="Убрать"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-5 flex-shrink-0" style={{ background: border }} />

      {/* Divider */}
      <button
        style={btnStyle(false)}
        onClick={onDivider}
        className="active:opacity-70 flex-shrink-0"
        title="Разделитель"
      >
        <Minus size={16} />
      </button>
    </div>
  )
}
