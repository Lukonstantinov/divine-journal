import React, { useEffect, useRef, useState } from 'react'
import { useTheme } from '../App'
import { Entry, Folder, db } from '../db'
import { parseBlocks, catColor, calcStreak } from '../types'
import { X, RefreshCw } from 'lucide-react'

interface GraphNode {
  id: string
  type: 'entry' | 'folder'
  label: string
  color: string
  x: number
  y: number
  radius: number
  entryId?: number
  folderId?: number
}

interface GraphEdge {
  from: string
  to: string
  strength: number
}

const CANVAS_W = Math.min(typeof window !== 'undefined' ? window.innerWidth - 32 : 350, 500)
const CANVAS_H = 440

function extractKeywords(title: string): string[] {
  const stopwords = new Set([
    'и', 'в', 'на', 'с', 'по', 'к', 'из', 'о', 'а', 'но', 'или', 'что',
    'как', 'это', 'то', 'же', 'уже', 'так', 'был', 'не', 'он', 'она', 'они',
    'мне', 'мы', 'вы', 'ты', 'я', 'бог', 'господь', 'его', 'её', 'им', 'за',
    'при', 'для', 'до', 'от', 'без', 'все', 'всё', 'свой', 'ещё',
  ])
  return title.toLowerCase().split(/\s+/)
    .map(w => w.replace(/[^а-яёa-z]/gi, ''))
    .filter(w => w.length >= 3 && !stopwords.has(w))
}

function computeGraph(entries: Entry[], folders: Folder[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  // Folder nodes
  for (const f of folders) {
    nodes.push({
      id: `folder_${f.id}`,
      type: 'folder',
      label: f.name.slice(0, 12),
      color: f.color,
      x: CANVAS_W / 2 + (Math.random() - 0.5) * CANVAS_W * 0.6,
      y: CANVAS_H / 2 + (Math.random() - 0.5) * CANVAS_H * 0.6,
      radius: 14,
      folderId: f.id,
    })
  }

  // Entry nodes (limited to 40)
  const entrySlice = entries.slice(0, 40)
  for (const e of entrySlice) {
    nodes.push({
      id: `entry_${e.id}`,
      type: 'entry',
      label: e.title.slice(0, 18),
      color: catColor(e.category),
      x: CANVAS_W / 2 + (Math.random() - 0.5) * CANVAS_W * 0.6,
      y: CANVAS_H / 2 + (Math.random() - 0.5) * CANVAS_H * 0.6,
      radius: 10,
      entryId: e.id,
    })
  }

  // Folder-membership edges
  for (const e of entrySlice) {
    if (e.folder_id) {
      edges.push({ from: `entry_${e.id}`, to: `folder_${e.folder_id}`, strength: 0.5 })
    }
  }

  // Shared-verse edges
  const verseMap: Record<string, string[]> = {}
  for (const e of entrySlice) {
    try {
      const verses: Array<{ book: string; chapter: number; verse: number }> = JSON.parse(e.linked_verses || '[]')
      for (const v of verses) {
        const key = `${v.book}_${v.chapter}_${v.verse}`
        if (!verseMap[key]) verseMap[key] = []
        verseMap[key].push(`entry_${e.id}`)
      }
      // Also check verse blocks
      const blocks = parseBlocks(e.content)
      for (const b of blocks) {
        if (b.type === 'verse') {
          try {
            const vd = JSON.parse(b.content)
            const key = `${vd.book}_${vd.chapter}_${vd.verse}`
            if (!verseMap[key]) verseMap[key] = []
            if (!verseMap[key].includes(`entry_${e.id}`)) verseMap[key].push(`entry_${e.id}`)
          } catch {}
        }
      }
    } catch {}
  }
  for (const ids of Object.values(verseMap)) {
    if (ids.length < 2) continue
    for (let i = 0; i < ids.length - 1; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        edges.push({ from: ids[i], to: ids[j], strength: 0.7 })
      }
    }
  }

  // Same-category edges (only if count < 8 to avoid clutter)
  const catMap: Record<string, string[]> = {}
  for (const e of entrySlice) {
    if (!catMap[e.category]) catMap[e.category] = []
    catMap[e.category].push(`entry_${e.id}`)
  }
  for (const ids of Object.values(catMap)) {
    if (ids.length < 2 || ids.length > 8) continue
    for (let i = 0; i < ids.length - 1; i++) {
      edges.push({ from: ids[i], to: ids[i + 1], strength: 0.3 })
    }
  }

  // Keyword edges
  const keywordMap: Record<string, string[]> = {}
  for (const e of entrySlice) {
    const kws = extractKeywords(e.title)
    for (const kw of kws) {
      if (!keywordMap[kw]) keywordMap[kw] = []
      keywordMap[kw].push(`entry_${e.id}`)
    }
  }
  for (const ids of Object.values(keywordMap)) {
    if (ids.length < 2 || ids.length > 8) continue
    for (let i = 0; i < ids.length - 1; i++) {
      edges.push({ from: ids[i], to: ids[i + 1], strength: 0.4 })
    }
  }

  // Force-directed layout — 60 iterations
  const nodeMap: Record<string, GraphNode> = {}
  for (const n of nodes) nodeMap[n.id] = n

  for (let iter = 0; iter < 60; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
        const force = 600 / (dist * dist)
        const fx = (dx / dist) * force, fy = (dy / dist) * force
        a.x -= fx; a.y -= fy
        b.x += fx; b.y += fy
      }
    }
    // Attraction along edges
    for (const edge of edges) {
      const a = nodeMap[edge.from], b = nodeMap[edge.to]
      if (!a || !b) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
      const force = dist * 0.008 * edge.strength
      const fx = (dx / dist) * force, fy = (dy / dist) * force
      a.x += fx; a.y += fy
      b.x -= fx; b.y -= fy
    }
    // Keep within bounds
    const pad = 20
    for (const n of nodes) {
      n.x = Math.max(pad, Math.min(CANVAS_W - pad, n.x))
      n.y = Math.max(pad, Math.min(CANVAS_H - pad, n.y))
    }
  }

  return { nodes, edges }
}

interface Props {
  onClose: () => void
}

export default function GraphView({ onClose }: Props) {
  const { theme, fontScale } = useTheme()
  const fs = (base: number) => Math.round(base * fontScale)
  const { bg, card, border, text, subtext: sub, primary } = theme

  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [loading, setLoading] = useState(true)

  const loadGraph = async () => {
    setLoading(true)
    setSelectedNode(null)
    const [entries, folders] = await Promise.all([
      db.entries.orderBy('created_at').reverse().toArray(),
      db.folders.toArray(),
    ])
    const { nodes: n, edges: e } = computeGraph(entries, folders)
    setNodes(n)
    setEdges(e)
    setLoading(false)
  }

  useEffect(() => { loadGraph() }, [])

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node)
  }

  return (
    <div className="ios-modal z-50 flex flex-col modal-backdrop" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="flex flex-col mt-auto rounded-t-2xl overflow-hidden"
        style={{ background: bg, maxHeight: 'calc(var(--app-height, 100dvh) * 0.9)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: border, background: card }}>
          <button onClick={onClose} className="active:opacity-70"><X size={20} color={sub} /></button>
          <span className="font-semibold" style={{ color: text, fontSize: fs(16) }}>Граф связей</span>
          <button onClick={loadGraph} className="active:opacity-70">
            <RefreshCw size={18} color={primary} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-area">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <p style={{ color: sub }}>Вычисление графа...</p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p style={{ color: sub, fontSize: fs(14) }}>Добавьте записи, чтобы увидеть граф</p>
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="flex gap-4 px-4 py-2 flex-wrap">
                {['мысль', 'молитва', 'откровение', 'благодарность'].map(cat => (
                  <div key={cat} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: catColor(cat) }} />
                    <span className="text-xs" style={{ color: sub }}>{cat}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: primary, background: 'transparent' }} />
                  <span className="text-xs" style={{ color: sub }}>папка</span>
                </div>
              </div>

              {/* SVG Graph */}
              <div className="mx-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
                <svg
                  width="100%"
                  viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                  style={{ background: card, display: 'block' }}
                >
                  {/* Edges */}
                  {edges.map((edge, i) => {
                    const a = nodes.find(n => n.id === edge.from)
                    const b = nodes.find(n => n.id === edge.to)
                    if (!a || !b) return null
                    return (
                      <line
                        key={i}
                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={border}
                        strokeWidth={1}
                        strokeOpacity={edge.strength * 0.8}
                      />
                    )
                  })}
                  {/* Nodes */}
                  {nodes.map(node => {
                    const isSelected = selectedNode?.id === node.id
                    return (
                      <g key={node.id} onClick={() => handleNodeClick(node)} style={{ cursor: 'pointer' }}>
                        <circle
                          cx={node.x} cy={node.y} r={node.radius + (isSelected ? 3 : 0)}
                          fill={node.type === 'folder' ? card : node.color + (isSelected ? 'ff' : '99')}
                          stroke={isSelected ? primary : node.color}
                          strokeWidth={node.type === 'folder' ? 2.5 : (isSelected ? 2 : 1)}
                        />
                        <text
                          x={node.x} y={node.y + node.radius + 11}
                          textAnchor="middle"
                          fontSize={9}
                          fill={isSelected ? primary : sub}
                          fontWeight={isSelected ? 'bold' : 'normal'}
                        >
                          {node.label}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Selected node info */}
              {selectedNode && (
                <div className="mx-3 mt-3 rounded-xl px-4 py-3" style={{ background: card, border: `1px solid ${border}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: selectedNode.color }} />
                    <p className="font-semibold" style={{ fontSize: fs(14), color: text }}>{selectedNode.label}</p>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: selectedNode.color + '22', color: selectedNode.color }}>
                      {selectedNode.type === 'folder' ? 'Папка' : 'Запись'}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: sub }}>
                    Связей: {edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).length}
                  </p>
                </div>
              )}
            </>
          )}

          <div className="h-4" />
        </div>
      </div>
    </div>
  )
}
