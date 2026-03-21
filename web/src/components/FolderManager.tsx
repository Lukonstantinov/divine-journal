import React, { useState } from 'react'
import { useTheme } from '../App'
import { Folder } from '../db'
import { FOLDER_COLORS, FOLDER_ICONS } from '../types'
import {
  X, Check, Trash2, Edit3, Plus, Folder as FolderIcon,
  BookOpen, Heart, Star, Flame, Sun, Moon, Feather, Bookmark,
} from 'lucide-react'

// Map icon id to Lucide component
const ICON_MAP: Record<string, React.ReactNode> = {
  folder: <FolderIcon size={18} />,
  'book-open': <BookOpen size={18} />,
  heart: <Heart size={18} />,
  star: <Star size={18} />,
  cross: <span className="text-base font-bold">✝</span>,
  flame: <Flame size={18} />,
  sun: <Sun size={18} />,
  moon: <Moon size={18} />,
  feather: <Feather size={18} />,
  bookmark: <Bookmark size={18} />,
}

interface Props {
  folders: Folder[]
  onAdd: (name: string, color: string, icon: string) => Promise<void>
  onEdit: (id: number, name: string, color: string, icon: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onClose: () => void
}

export default function FolderManager({ folders, onAdd, onEdit, onDelete, onClose }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)
  const { bg, card, border, text, subtext: sub, primary } = theme

  const [editingId, setEditingId] = useState<number | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(FOLDER_COLORS[0])
  const [icon, setIcon] = useState(FOLDER_ICONS[0])
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const openNew = () => {
    setIsNew(true)
    setEditingId(null)
    setName('')
    setColor(FOLDER_COLORS[0])
    setIcon(FOLDER_ICONS[0])
  }

  const openEdit = (f: Folder) => {
    setEditingId(f.id!)
    setIsNew(false)
    setName(f.name)
    setColor(f.color)
    setIcon(f.icon)
  }

  const cancelEdit = () => { setEditingId(null); setIsNew(false) }

  const handleSave = async () => {
    if (!name.trim()) return
    if (isNew) {
      await onAdd(name.trim(), color, icon)
    } else if (editingId !== null) {
      await onEdit(editingId, name.trim(), color, icon)
    }
    cancelEdit()
  }

  const FolderForm = () => (
    <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: bg, border: `1px solid ${border}` }}>
      <input
        className="w-full px-3 py-2 rounded-xl bg-transparent font-semibold"
        style={{ fontSize: Math.max(16, fs(15)), color: text, border: `1px solid ${border}` }}
        placeholder="Название папки..."
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
      />

      {/* Color picker */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: sub }}>Цвет</p>
        <div className="flex gap-2 flex-wrap">
          {FOLDER_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full active:opacity-70"
              style={{ background: c, border: `2px solid ${color === c ? text : 'transparent'}` }}
            />
          ))}
        </div>
      </div>

      {/* Icon picker */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: sub }}>Иконка</p>
        <div className="flex gap-2 flex-wrap">
          {FOLDER_ICONS.map(ic => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              className="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-70"
              style={{
                background: icon === ic ? color : card,
                color: icon === ic ? '#fff' : sub,
                border: `1px solid ${icon === ic ? color : border}`,
              }}
            >
              {ICON_MAP[ic]}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: card, border: `1px solid ${border}` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color, color: '#fff' }}>
          {ICON_MAP[icon]}
        </div>
        <span className="font-medium" style={{ color: text, fontSize: fs(14) }}>{name || 'Название папки'}</span>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 py-2 rounded-xl font-semibold active:opacity-70"
          style={{ background: primary, color: '#fff', fontSize: fs(14) }}
        >
          {isNew ? 'Создать' : 'Сохранить'}
        </button>
        <button
          onClick={cancelEdit}
          className="px-4 py-2 rounded-xl active:opacity-70"
          style={{ border: `1px solid ${border}`, color: sub, fontSize: fs(14) }}
        >
          Отмена
        </button>
      </div>
    </div>
  )

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
          <span className="font-semibold" style={{ color: text, fontSize: fs(16) }}>Папки</span>
          <button onClick={openNew} className="active:opacity-70">
            <Plus size={20} color={primary} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-area p-4 flex flex-col gap-3">
          {(isNew) && <FolderForm />}

          {folders.length === 0 && !isNew && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <FolderIcon size={32} color={sub} />
              <p style={{ color: sub, fontSize: fs(14) }}>Нет папок. Создайте первую!</p>
            </div>
          )}

          {folders.map(f => (
            <div key={f.id}>
              {editingId === f.id ? (
                <FolderForm />
              ) : (
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: card, border: `1px solid ${border}` }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: f.color, color: '#fff' }}
                  >
                    {ICON_MAP[f.icon] ?? <FolderIcon size={18} />}
                  </div>
                  <span className="flex-1 font-medium" style={{ color: text, fontSize: fs(14) }}>{f.name}</span>
                  <button onClick={() => openEdit(f)} className="p-1.5 active:opacity-70">
                    <Edit3 size={16} color={sub} />
                  </button>
                  {confirmDeleteId === f.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={async () => { await onDelete(f.id!); setConfirmDeleteId(null) }}
                        className="text-xs px-2 py-1 rounded-lg active:opacity-70"
                        style={{ background: '#ef4444', color: '#fff' }}
                      >
                        Удалить
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs px-2 py-1 rounded-lg active:opacity-70"
                        style={{ border: `1px solid ${border}`, color: sub }}
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(f.id!)} className="p-1.5 active:opacity-70">
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
