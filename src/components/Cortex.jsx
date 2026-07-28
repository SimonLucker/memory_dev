// Cortex — the map view inside Vault (spec 6.3, BINDING). Heat pill on top,
// the glass-node field in the middle, quiet filter chips + search at the
// bottom. No ask-bar: conversational answers live only in Capture.
import { useEffect, useMemo, useRef, useState } from 'react'
import GraphView from './GraphView.jsx'
import { Search } from './Icons.jsx'
import { HEAT } from '../lib/palette.js'
import { whenToTs } from '../lib/thread.js'
import { CORTEX_SEARCH_PLACEHOLDER } from '../lib/copy.js'
import '../styles/cortex.css'

const CATS = ['People', 'Places', 'Feelings', 'Years']

const lerpHex = (a, b, t) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16)
  const ch = n => [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const [ar, ag, ab] = ch(A), [br, bg, bb] = ch(B)
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`
}
const heatColor = u => {
  const x = Math.max(0, Math.min(0.999, u)) * (HEAT.length - 1)
  const i = Math.floor(x)
  return lerpHex(HEAT[i], HEAT[i + 1], x - i)
}

export default function Cortex({ memories, edges, layout, openMemory }) {
  const apiRef = useRef({})
  const cardEl = useRef(null)
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [openCat, setOpenCat] = useState(null)
  const [sel, setSel] = useState({ People: [], Places: [], Feelings: [], Years: [] })

  // ONE continuous bar: smooth gradient across the heat scale by capture
  // density over time. No segments, no gaps.
  const heat = useMemo(() => {
    if (!memories.length) return null
    const ts = memories.map(m => whenToTs(m.when)).sort((a, b) => a - b)
    const t0 = ts[0]
    const t1 = Math.max(ts[ts.length - 1], t0 + 1)
    const N = 28
    const d = new Array(N).fill(0)
    const s2 = 2 * 0.06 * 0.06
    for (const t of ts) {
      const p = (t - t0) / (t1 - t0)
      for (let i = 0; i < N; i++) { const c = (i + 0.5) / N; d[i] += Math.exp(-((p - c) ** 2) / s2) }
    }
    const max = Math.max(...d) || 1
    const stops = d.map((v, i) => `${heatColor(v / max)} ${((i / (N - 1)) * 100).toFixed(1)}%`)
    // at most 4 year labels beneath
    const y0 = new Date(t0).getFullYear()
    const y1 = new Date(t1).getFullYear()
    const all = []
    for (let y = y0; y <= y1; y++) all.push(y)
    const pick = all.length <= 4 ? all : [0, 1, 2, 3].map(i => all[Math.round((i * (all.length - 1)) / 3)])
    const years = [...new Set(pick)].map(y => ({
      y,
      frac: Math.max(0, Math.min(1, (new Date(y, 0, 1).getTime() - t0) / (t1 - t0))),
    }))
    return { css: `linear-gradient(90deg, ${stops.join(', ')})`, t0, t1, years }
  }, [memories])

  const seek = e => {
    if (!heat) return
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    apiRef.current.panToTime?.(heat.t0 + f * (heat.t1 - heat.t0))
  }

  // chip values, most frequent first (years chronological)
  const values = useMemo(() => {
    const p = new Map(), pl = new Map(), f = new Map(), y = new Map()
    const bump = (map, v) => v && map.set(v, (map.get(v) || 0) + 1)
    for (const m of memories) {
      for (const w of m.who || []) bump(p, w.name)
      bump(pl, m.where)
      for (const fe of m.feeling || []) bump(f, fe)
      bump(y, m.when.slice(6, 10))
    }
    const top = map => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
    return { People: top(p), Places: top(pl), Feelings: top(f), Years: [...y.keys()].sort() }
  }, [memories])

  // search match = title / place / people; chips AND across categories
  const visibleIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q && !CATS.some(c => sel[c].length)) return null
    const ids = new Set()
    for (const m of memories) {
      const names = (m.who || []).map(p => p.name)
      if (q && ![m.what, m.where, ...names].some(s => s && s.toLowerCase().includes(q))) continue
      if (sel.People.length && !names.some(n => sel.People.includes(n))) continue
      if (sel.Places.length && !sel.Places.includes(m.where)) continue
      if (sel.Feelings.length && !(m.feeling || []).some(fe => sel.Feelings.includes(fe))) continue
      if (sel.Years.length && !sel.Years.includes(m.when.slice(6, 10))) continue
      ids.add(m.id)
    }
    return ids
  }, [memories, query, sel])

  // typing centers the matching nodes (chips only filter)
  useEffect(() => {
    if (!query.trim() || !visibleIds || !visibleIds.size) return
    const t = setTimeout(() => apiRef.current.centerOnIds?.([...visibleIds]), 450)
    return () => clearTimeout(t)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVal = (cat, v) =>
    setSel(s => ({ ...s, [cat]: s[cat].includes(v) ? s[cat].filter(x => x !== v) : [...s[cat], v] }))

  const selMem = selectedId ? memories.find(m => m.id === selectedId) : null
  const thumb = selMem && (selMem.photos?.[0] || selMem.videos?.[0]?.poster)

  return (
    <div className="cortex">
      {heat && (
        <div className="cortex-top">
          <div className="cortex-heat" style={{ background: heat.css }}
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); seek(e) }}
            onPointerMove={e => { if (e.buttons) seek(e) }} />
          <div className="cortex-years">
            {heat.years.map(({ y, frac }) => (
              <span key={y} className="type-label" style={{ left: `${frac * 100}%` }}>{y}</span>
            ))}
          </div>
        </div>
      )}

      <div className="cortex-field">
        <GraphView memories={memories} edges={edges} layout={layout}
          visibleIds={visibleIds} selectedId={selectedId} onSelect={setSelectedId}
          apiRef={apiRef} cardEl={cardEl} />
        {selMem && (
          <button ref={cardEl} className="cortex-card" onClick={() => openMemory(selMem.id)}>
            {thumb && <img src={thumb} alt="" />}
            <span className="cortex-card-text">
              <span className="cortex-card-title">{selMem.what}</span>
              {selMem.where && <span className="cortex-card-place">{selMem.where}</span>}
            </span>
          </button>
        )}
      </div>

      <div className="cortex-bottom">
        {openCat && (
          <div className="cortex-values">
            {values[openCat].map(v => (
              <button key={v} className={sel[openCat].includes(v) ? 'on' : ''}
                onClick={() => toggleVal(openCat, v)}>{v}</button>
            ))}
          </div>
        )}
        <div className="cortex-cats">
          {CATS.map((c, i) => (
            <span key={c} className="cortex-cat-wrap">
              {i > 0 && <span className="cortex-cat-dot">·</span>}
              <button
                className={(openCat === c ? 'open ' : '') + (sel[c].length ? 'active' : '')}
                onClick={() => setOpenCat(o => (o === c ? null : c))}>
                {c}
              </button>
            </span>
          ))}
        </div>
        <label className="cortex-search">
          <Search size={18} />
          <input value={query} placeholder={CORTEX_SEARCH_PLACEHOLDER}
            onChange={e => setQuery(e.target.value)} />
        </label>
      </div>
    </div>
  )
}
