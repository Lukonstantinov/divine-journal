import React, { useState } from 'react'
import { useTheme } from '../App'
import { VERSE_COLORS, VERSE_FONTS, VerseData } from '../types'
import { X, Check } from 'lucide-react'

interface Props {
  verse: VerseData & { boxColor?: string; fontFamily?: string }
  onSave: (updates: { boxColor?: string; fontFamily?: string }) => void
  onClose: () => void
}

export default function VerseFormatModal({ verse, onSave, onClose }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)

  const [boxColor, setBoxColor] = useState(verse.boxColor ?? 'gold')
  const [fontId, setFontId] = useState(verse.fontFamily ?? 'serif')
  const [showFonts, setShowFonts] = useState(false)

  const { bg, card, border, text, subtext: sub, primary } = theme

  const selectedColor = VERSE_COLORS.find(c => c.id === boxColor) ?? VERSE_COLORS[0]
  const selectedFont = VERSE_FONTS.find(f => f.id === fontId) ?? VERSE_FONTS[0]

  const handleSave = () => {
    onSave({ boxColor, fontFamily: fontId })
    onClose()
  }

  return (
    <div className="ios-modal z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="flex flex-col mt-auto rounded-t-2xl overflow-hidden"
        style={{ background: bg, maxHeight: 'calc(var(--app-height, 100dvh) * 0.85)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: border, background: card }}
        >
          <button onClick={onClose} className="active:opacity-70"><X size={20} color={sub} /></button>
          <span className="font-semibold" style={{ color: text, fontSize: fs(16) }}>Форматирование стиха</span>
          <button onClick={handleSave} className="active:opacity-70"><Check size={20} color={primary} /></button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-area p-4 flex flex-col gap-5">
          {/* Preview */}
          <div
            className="px-4 py-3 rounded-xl"
            style={{ background: selectedColor.bg, borderLeft: `4px solid ${selectedColor.border}` }}
          >
            <p
              className="italic leading-relaxed"
              style={{ fontSize: fs(14), color: text, fontFamily: selectedFont.family }}
            >
              {verse.text}
            </p>
            <p className="text-xs mt-1" style={{ color: sub }}>
              {verse.book} {verse.chapter}:{verse.verse}
            </p>
          </div>

          {/* Box color picker */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: sub }}>
              Цвет блока
            </p>
            <div className="grid grid-cols-3 gap-2">
              {VERSE_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setBoxColor(c.id)}
                  className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl active:opacity-70"
                  style={{
                    background: c.bg,
                    border: `2px solid ${boxColor === c.id ? c.border : border}`,
                  }}
                >
                  <div className="w-4 h-4 rounded-full" style={{ background: c.border }} />
                  <span className="text-xs font-medium" style={{ color: text }}>{c.label}</span>
                  {boxColor === c.id && <span className="text-[10px]" style={{ color: c.border }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Font picker */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: sub }}>
              Шрифт
            </p>
            <button
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl active:opacity-70"
              style={{ background: card, border: `1px solid ${border}` }}
              onClick={() => setShowFonts(v => !v)}
            >
              <span style={{ fontFamily: selectedFont.family, fontSize: fs(15), color: text }}>
                Аа — {selectedFont.label}
              </span>
              <span style={{ color: sub, fontSize: 12 }}>{showFonts ? '▲' : '▼'}</span>
            </button>
            {showFonts && (
              <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
                {VERSE_FONTS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setFontId(f.id); setShowFonts(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 border-b last:border-0 active:opacity-70"
                    style={{ borderColor: border, background: fontId === f.id ? primary + '18' : 'transparent' }}
                  >
                    <span style={{ fontFamily: f.family, fontSize: fs(16), color: text, flex: 1, textAlign: 'left' }}>Аа</span>
                    <span style={{ fontSize: fs(13), color: fontId === f.id ? primary : sub }}>{f.label}</span>
                    {fontId === f.id && <Check size={14} color={primary} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
