// Cortex force-graph canvas — design-foundation.md v2.4 section 6.3 (BINDING).
// Dark glass spheres (NODE_GRADIENTS), solid 1px white lines capped at each
// node's 3 strongest, semantic zoom (far constellations / mid clusters+lines /
// near photo nodes), max 7 white pill labels, depth + parallax kept from v1.
// No dust particles, no tooltips, no legend colors, no dotted threads.
import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide, forceX, forceY } from 'd3-force-3d'
import { strongestEdges } from '../lib/edges.js'
import { NODE_GRADIENTS } from '../lib/palette.js'
import { whenToTs } from '../lib/thread.js'

const TAU = Math.PI * 2
const FONT = "'Geist', -apple-system, 'SF Pro Text', Roboto, sans-serif"
const INK = '#1F2937'
// spec 6.3: 1 shared link → .25, 2 → .4, 3+ → .55
const lineAlpha = w => (w >= 3 ? 0.55 : w === 2 ? 0.4 : 0.25)

// Entrance: memories drift in from the field centre, fading up. 900ms = motion slow.
const INTRO_MS = 700
const INTRO_STAGGER = 400
const INTRO_TOTAL = INTRO_MS + INTRO_STAGGER
const easeOut = p => 1 - (1 - p) ** 3

// Labels: quiet map (spec 6.3). Motion tokens only (motion-fast = 200ms).
// They wait for every node to finish arriving, then fade in; a pan/zoom
// bumps the quiet mark forward so they hide while moving and only settle
// back once the camera has been still for MOTION_FAST.
const MOTION_FAST = 200
const CAM_EPS = 0.5

// stable 0..1 per id (FNV-1a) → depth jitter + breathing phase
function hash01(id) {
  let h = 2166136261
  const s = String(id)
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}

// --- Dark glass sphere sprite, baked once per class (shadowBlur is the canvas
// hot path — one drawImage per node keeps 200 nodes smooth). Values from the
// mockup's .node CSS: radial light→mid→deep at 33%/27%, specular point, 1px
// light ring, deep drop shadow.
const SR = 40
const spriteCache = new Map()
function sphereSprite(cls) {
  let sp = spriteCache.get(cls)
  if (sp) return sp
  const stops = NODE_GRADIENTS[cls] || NODE_GRADIENTS.Travel
  const size = Math.ceil(SR * 4.4)
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const c = cv.getContext('2d')
  const cx = size / 2
  const cy = size / 2 - SR * 0.18
  // deep drop shadow (mockup: 0 12px 26px rgba(0,0,0,0.5))
  c.shadowColor = 'rgba(0,0,0,0.5)'
  c.shadowOffsetY = SR * 0.35
  c.shadowBlur = SR * 0.76
  c.fillStyle = stops[2]
  c.beginPath(); c.arc(cx, cy, SR, 0, TAU); c.fill()
  c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0
  // glass body: light top-left stop → mid at 38% → deep rim
  const g = c.createRadialGradient(cx - SR * 0.34, cy - SR * 0.46, SR * 0.08, cx - SR * 0.08, cy - SR * 0.08, SR * 1.35)
  g.addColorStop(0, stops[0]); g.addColorStop(0.38, stops[1]); g.addColorStop(1, stops[2])
  c.beginPath(); c.arc(cx, cy, SR, 0, TAU); c.fillStyle = g; c.fill()
  // one small specular point
  const s = c.createRadialGradient(cx - SR * 0.3, cy - SR * 0.56, 0, cx - SR * 0.3, cy - SR * 0.56, SR * 0.22)
  s.addColorStop(0, 'rgba(255,255,255,0.95)'); s.addColorStop(1, 'rgba(255,255,255,0)')
  c.beginPath(); c.arc(cx - SR * 0.3, cy - SR * 0.56, SR * 0.22, 0, TAU); c.fillStyle = s; c.fill()
  // thin 1px light ring
  c.beginPath(); c.arc(cx, cy, SR + 0.75, 0, TAU)
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.2)'; c.stroke()
  sp = { cv, size, cx, cy }
  spriteCache.set(cls, sp)
  return sp
}

// Photo preload cache. Returns the image only once loaded; repaint runs every
// frame anyway, so nodes upgrade sphere → photo as soon as the file arrives.
const photoCache = new Map()
function photoOf(src) {
  let img = photoCache.get(src)
  if (!img) { img = new Image(); img.src = src; photoCache.set(src, img) }
  return img.complete && img.naturalWidth ? img : null
}

export default function GraphView({ memories, edges, layout, visibleIds, selectedId, onSelect, apiRef, cardEl }) {
  const fgRef = useRef(null)
  const boxRef = useRef(null)
  const [size, setSize] = useState({ w: 360, h: 480 })
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: Math.max(1, e.contentRect.width), h: Math.max(1, e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const graphData = useMemo(() => {
    const nodes = memories.map(m => {
      const hh = hash01(m.id)
      const imp = m.importance || 1
      const depth = Math.min(1, Math.max(0.55, 0.55 + 0.45 * ((imp - 1) / 2) + (hh - 0.5) * 0.08))
      const node = { id: m.id, mem: m, depth, phase: hh * TAU, ts: whenToTs(m.when), anchorA: 0 }
      const pos = layout && layout[m.id]
      if (pos) { node.x = pos[0]; node.y = pos[1] }
      return node
    })
    // spec 6.3: each node renders at most its three strongest connections
    const keep = new Set()
    for (const n of nodes) for (const e of strongestEdges(n.id, edges)) keep.add(e)
    const links = [...keep].map(e => ({ source: e.source, target: e.target, weight: e.weight }))
    return { nodes, links }
  }, [memories, layout, edges])

  const nodeById = useMemo(() => new Map(graphData.nodes.map(n => [n.id, n])), [graphData])

  const rOf = n => (5 + (n.mem.importance || 1) * 3) * (0.72 + 0.28 * n.depth)

  // Precomputed layouts stay put. Unseeded nodes — or organic `_pos` seeds
  // (each new memory lands within ~60px of its neighbours, so a grown profile
  // is one overlapping ball) — need the warmup sim to spread before first paint.
  const needsSim = useMemo(() => {
    const ns = graphData.nodes
    if (!ns.length) return false
    if (ns.some(n => n.x == null)) return true
    let hits = 0
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[i].x - ns[j].x, dy = ns[i].y - ns[j].y
        const rr = rOf(ns[i]) + rOf(ns[j]) + 4
        if (dx * dx + dy * dy < rr * rr) hits++
      }
    }
    return hits > ns.length * 0.2
  }, [graphData])

  // per-frame scratch
  const engineReadyRef = useRef(false) // true once the lib ingested data + ran warmup
  const camRef = useRef({ x: 0, y: 0 })
  const fitRef = useRef({ done: false, k: 1, cx: 0, cy: 0 })
  const introRef = useRef(0)      // performance.now() when the entrance began
  const introFadeRef = useRef(0)  // 0→1, gates lines
  const labelsRef = useRef({ at: 0, items: [], prev: new Set() })
  const quietRef = useRef(Infinity)   // labels may start fading in once now() passes this
  const prevCamRef = useRef(null)     // last frame's {x,y,k}, to detect pan/zoom

  // Physics: only matters for unseeded data (warmup). Seeded layouts stay put;
  // motion afterwards is the home-wobble loop in framePre, not the sim.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    // Link pull scales down with node degree (d3's own default heuristic):
    // a fully interlinked component must not collapse into a ball.
    const endId = e => (e && typeof e === 'object' ? e.id : e)
    const deg = new Map()
    for (const l of graphData.links) {
      deg.set(endId(l.source), (deg.get(endId(l.source)) || 0) + 1)
      deg.set(endId(l.target), (deg.get(endId(l.target)) || 0) + 1)
    }
    fg.d3Force('link').distance(l => 60 + 180 / l.weight)
      .strength(l => Math.min(0.5, 1 / Math.min(deg.get(endId(l.source)) || 1, deg.get(endId(l.target)) || 1)))
    fg.d3Force('charge').strength(-240)
    fg.d3Force('collide', forceCollide(n => rOf(n) + 14).iterations(3))
    fg.d3Force('gx', forceX(0).strength(0.06))
    fg.d3Force('gy', forceY(0).strength(0.12))
    engineReadyRef.current = false
    fitRef.current.done = false
    introRef.current = 0
    labelsRef.current = { at: 0, items: [], prev: new Set() }
    quietRef.current = Infinity
    prevCamRef.current = null
  }, [graphData])

  // Parallax kept from v1: far (small) nodes lag the camera. Selected node
  // anchors (offset → 0) so its card stays glued.
  const offsetOf = n => {
    const F = fitRef.current
    const f = (1 - n.depth) * (1 - n.anchorA) * 0.5
    return { x: f * (camRef.current.x - F.cx), y: f * (camRef.current.y - F.cy) }
  }

  const introOf = n => {
    const start = introRef.current
    if (!start) return { ix: 0, iy: 0, a: 0 }
    const el = performance.now() - start - hash01(n.id) * INTRO_STAGGER
    const p = Math.max(0, Math.min(1, el / INTRO_MS))
    if (p >= 1) return { ix: 0, iy: 0, a: 1 }
    const F = fitRef.current
    const dx = (n.hx ?? n.x) - F.cx
    const dy = (n.hy ?? n.y) - F.cy
    const len = Math.hypot(dx, dy) || 1
    const k = (1 - easeOut(p)) * 170
    return { ix: (dx / len) * k, iy: (dy / len) * k, a: p }
  }

  // Semantic zoom thresholds, relative to the fitted frame. Default lands mid
  // (web on); pinch out for constellations, in for photos.
  const zones = k => {
    const fk = fitRef.current.k || 1
    return {
      far: k < fk * 0.72,
      lineA: Math.max(0, Math.min(1, (k - fk * 0.72) / (fk * 0.18))),
      photoA: Math.max(0, Math.min(1, (k - fk * 3) / (fk * 0.9))),
    }
  }

  const isDimmed = n => !!(visibleIds && !visibleIds.has(n.id))

  const framePre = (ctx, k) => {
    const fg = fgRef.current
    if (!fg) return
    const F = fitRef.current
    if (!F.done) {
      const nodes = graphData.nodes
      if (!nodes.length) { F.done = true; return }
      // wait for the engine (data ingest + warmup are debounced): capturing
      // hx/hy from raw _pos seeds froze grown profiles as an overlapping ball —
      // the wobble easing dragged every node back to its pre-warmup seed
      if (!engineReadyRef.current || nodes[0].x == null) return
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const n of nodes) {
        n.hx = n.x; n.hy = n.y
        if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x
        if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y
      }
      F.cx = (minX + maxX) / 2
      F.cy = (minY + maxY) / 2
      F.k = Math.max(0.35, Math.min(1.6,
        0.9 * Math.min(size.w / (maxX - minX + 180), size.h / (maxY - minY + 180))))
      fg.centerAt(F.cx, F.cy, 0)
      fg.zoom(F.k, 0)
      F.done = true
      introRef.current = performance.now()
      // labels stay quiet until every node has finished arriving (spec: only
      // after the fit/engine settle, never mid-entrance)
      quietRef.current = introRef.current + INTRO_TOTAL
    }
    const c = fg.screen2GraphCoords(size.w / 2, size.h / 2)
    if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) camRef.current = c
    // a real pan/zoom (not the internal breathing/wobble, which never moves
    // the camera) pushes the quiet mark forward: labels hide, then re-fade
    // MOTION_FAST after the camera has been still again
    if (prevCamRef.current) {
      const pc = prevCamRef.current
      const moved = Math.abs(camRef.current.x - pc.x) > CAM_EPS ||
        Math.abs(camRef.current.y - pc.y) > CAM_EPS || Math.abs(k - pc.k) > 0.002
      if (moved) quietRef.current = performance.now() + MOTION_FAST
    }
    prevCamRef.current = { x: camRef.current.x, y: camRef.current.y, k }
    const el = introRef.current ? performance.now() - introRef.current : -1
    introFadeRef.current = el < 0 ? 0 : Math.min(1, el / INTRO_TOTAL)
    const t = performance.now()
    for (const n of graphData.nodes) {
      n.anchorA += ((n.id === selectedId ? 1 : 0) - n.anchorA) * 0.15
      // gentle home wobble (aliveness) once the entrance has landed
      if (el >= INTRO_TOTAL && n.hx != null) {
        const tx = n.hx + 5 * Math.sin(t / 2700 + n.phase * 7)
        const ty = n.hy + 5 * Math.cos(t / 3200 + n.phase * 5)
        n.x += (tx - n.x) * 0.04
        n.y += (ty - n.y) * 0.04
      }
    }
    // approaching near zoom: start preloading first photos
    if (k > (F.k || 1) * 2) {
      for (const n of graphData.nodes) {
        const src = n.mem.photos && n.mem.photos[0]
        if (src) photoOf(src)
      }
    }
  }

  // --- lines: SOLID, 1 screen px, white, terminate at node edges, mid zoom in ---
  const paintLink = (l, ctx, k) => {
    const s = l.source, t = l.target
    if (!s || typeof s !== 'object' || s.x == null || !t || typeof t !== 'object' || t.x == null) return
    const { lineA } = zones(k)
    if (lineA <= 0) return
    let alpha = lineAlpha(l.weight) * lineA * introFadeRef.current
    if (isDimmed(s) || isDimmed(t)) alpha *= 0.12
    if (alpha <= 0.01) return
    const so = offsetOf(s), si = introOf(s)
    const to = offsetOf(t), ti = introOf(t)
    const sx = s.x + so.x + si.ix, sy = s.y + so.y + si.iy
    const tx = t.x + to.x + ti.ix, ty = t.y + to.y + ti.iy
    const dx = tx - sx, dy = ty - sy
    const d = Math.hypot(dx, dy) || 1
    // trim to the node edge (0.94 keeps the end under the opaque sphere through
    // its breathing) — a line must never float in empty space
    const rs = rOf(s) * 0.94, rt = rOf(t) * 0.94
    if (d <= rs + rt + 2) return
    const ux = dx / d, uy = dy / d
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1 / k
    ctx.beginPath()
    ctx.moveTo(sx + ux * rs, sy + uy * rs)
    ctx.lineTo(tx - ux * rt, ty - uy * rt)
    ctx.stroke()
    ctx.restore()
  }

  // --- nodes: glass sphere sprite; photo circle from near zoom ---
  const paintNode = (node, ctx, k) => {
    if (node.x == null) return
    const m = node.mem
    const off = offsetOf(node)
    const intro = introOf(node)
    const nx = node.x + off.x + intro.ix
    const ny = node.y + off.y + intro.iy
    const breath = 1 + 0.04 * Math.sin(performance.now() / 1500 + node.phase)
    const r = rOf(node) * breath * (1 + 0.22 * node.anchorA) // tapped node scales up
    node.px = nx; node.py = ny; node.pr = r
    const dimmed = isDimmed(node)
    ctx.save()
    // spheres stay near-opaque so the dark-glass deep rim survives (depth
    // expresses itself through size and parallax, not transparency)
    ctx.globalAlpha = (dimmed ? 0.12 : 0.85 + 0.15 * node.depth) * intro.a
    const sp = sphereSprite(m.class)
    const sc = r / SR
    ctx.drawImage(sp.cv, nx - sp.cx * sc, ny - sp.cy * sc, sp.size * sc, sp.size * sc)
    const { photoA } = zones(k)
    if (photoA > 0 && !dimmed) {
      const src = m.photos && m.photos[0]
      const img = src && photoOf(src)
      if (img) {
        ctx.globalAlpha = photoA * intro.a
        ctx.save()
        ctx.beginPath(); ctx.arc(nx, ny, r, 0, TAU); ctx.clip()
        const s0 = Math.min(img.naturalWidth, img.naturalHeight)
        ctx.drawImage(img, (img.naturalWidth - s0) / 2, (img.naturalHeight - s0) / 2, s0, s0,
          nx - r, ny - r, r * 2, r * 2)
        ctx.restore()
        // light ring around the photo (mockup: 1.5px rgba 0.45)
        ctx.beginPath(); ctx.arc(nx, ny, r, 0, TAU)
        ctx.lineWidth = Math.min(1.5, 1.5 / k * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'
        ctx.stroke()
      }
    }
    if (node.id === selectedId) {
      ctx.globalAlpha = intro.a
      ctx.beginPath(); ctx.arc(nx, ny, r + 4 / k, 0, TAU)
      ctx.lineWidth = 1 / k
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.stroke()
    }
    ctx.restore()
  }

  const paintPointer = (node, color, ctx) => {
    if (node.px == null || introFadeRef.current < 1) return
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.px, node.py, (node.pr || rOf(node)) + 6, 0, TAU)
    ctx.fill()
  }

  // --- labels: white pills, screen space, max 7, priority favorites > size >
  // recency, never overlapping a node or label, fully on screen or not at all ---
  const toScreen = (x, y, k) => ({
    x: (x - camRef.current.x) * k + size.w / 2,
    y: (y - camRef.current.y) * k + size.h / 2,
  })

  // Theme pill anchor: centered on the class's nodes, below their bounding box.
  const themePos = (nodes, theme, k, h) => {
    const ns = nodes.filter(n => n.mem.class === theme)
    if (!ns.length) return null
    let ax = 0, maxY = -Infinity
    for (const n of ns) {
      const s = toScreen(n.px, n.py, k)
      ax += s.x
      maxY = Math.max(maxY, s.y + n.pr * k)
    }
    return { sx: ax / ns.length, sy: maxY + 12 + h / 2 }
  }

  const computeLabels = (ctx, k) => {
    const L = labelsRef.current
    const { far, photoA } = zones(k)
    const onScreen = graphData.nodes.filter(n => {
      if (n.px == null || isDimmed(n)) return false
      const s = toScreen(n.px, n.py, k)
      return s.x > -40 && s.x < size.w + 40 && s.y > -40 && s.y < size.h + 40
    })
    let cand
    if (far) {
      // constellations: theme (class) labels at each cluster's centroid
      const byClass = new Map()
      for (const n of onScreen) {
        if (!byClass.has(n.mem.class)) byClass.set(n.mem.class, [])
        byClass.get(n.mem.class).push(n)
      }
      cand = [...byClass.entries()]
        .filter(([, ns]) => ns.length >= 2)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([cls]) => ({ theme: cls, text: cls }))
    } else {
      // mid: only the largest on-screen nodes earn labels (relative gate, so
      // labels appear at any fitted zoom); near: every photo node may
      const maxR = onScreen.reduce((a, n) => Math.max(a, rOf(n) * k), 0)
      const gate = n => photoA > 0 || rOf(n) * k >= maxR * 0.8 || n.mem.favorite
      cand = onScreen.filter(gate).sort((a, b) =>
        (b.mem.favorite ? 1 : 0) - (a.mem.favorite ? 1 : 0) ||
        (b.mem.importance || 1) - (a.mem.importance || 1) ||
        (L.prev.has(b.id) ? 1 : 0) - (L.prev.has(a.id) ? 1 : 0) || // hysteresis: no flicker
        b.ts - a.ts)
        .map(n => ({ node: n, text: n.mem.what }))
    }
    const items = []
    const rects = []
    const seen = new Set() // a label never repeats
    ctx.font = `${far ? '600 16px' : '500 13px'} ${FONT}`
    for (const c of cand) {
      if (items.length >= 7) break
      if (seen.has(c.text)) continue
      const w = ctx.measureText(c.text).width + 24
      const h = far ? 32 : 27
      let sx, sy
      if (c.theme) {
        // theme pill hangs below the constellation's bounding box; classes
        // interleave at far zoom so the node-overlap test is skipped for these
        // (label-label and fully-on-screen rules still apply)
        const p = themePos(onScreen, c.theme, k, h)
        if (!p) continue
        sx = p.sx; sy = p.sy
      } else {
        const s = toScreen(c.node.px, c.node.py, k)
        sx = s.x; sy = s.y + c.node.pr * k + 10 + h / 2
      }
      const rect = { l: sx - w / 2, r: sx + w / 2, t: sy - h / 2, b: sy + h / 2 }
      // fits fully on screen or does not render
      if (rect.l < 4 || rect.r > size.w - 4 || rect.t < 4 || rect.b > size.h - 4) continue
      // never overlaps a node (its own node sits above the pill, excluded)
      let ok = true
      if (!c.theme) for (const n of onScreen) {
        if (c.node === n) continue
        const s = toScreen(n.px, n.py, k)
        const rr = n.pr * k
        if (rect.l < s.x + rr && rect.r > s.x - rr && rect.t < s.y + rr && rect.b > s.y - rr) { ok = false; break }
      }
      if (!ok) continue
      // never overlaps another label
      for (const o of rects) {
        if (rect.l < o.r + 4 && rect.r > o.l - 4 && rect.t < o.b + 4 && rect.b > o.t - 4) { ok = false; break }
      }
      if (!ok) continue
      rects.push(rect)
      seen.add(c.text)
      items.push({ ...c, w, h })
    }
    L.items = items
    L.prev = new Set(items.filter(i => i.node).map(i => i.node.id))
    L.at = performance.now()
  }

  const framePost = (ctx, k) => {
    const F = fitRef.current
    if (!F.done) return
    // summary card follows the tapped node (positioned directly, no re-render)
    const el = cardEl && cardEl.current
    if (el && selectedId) {
      const n = nodeById.get(selectedId)
      if (n && n.px != null) {
        const s = toScreen(n.px, n.py, k)
        const rk = n.pr * k
        const w = el.offsetWidth || 190
        const h = el.offsetHeight || 58
        let x = s.x + rk + 12
        if (x + w > size.w - 8) x = s.x - rk - 12 - w
        if (x < 8) x = Math.min(size.w - w - 8, Math.max(8, s.x - w / 2))
        const y = Math.max(8, Math.min(size.h - h - 8, s.y - h / 2))
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
        el.style.opacity = 1
      }
    }
    // quiet map: hidden until settled (post-entrance, post-pan/zoom), then a
    // plain MOTION_FAST fade-in — never mid-motion, never mid-arrival
    const fade = Math.min(1, (performance.now() - quietRef.current) / MOTION_FAST)
    if (fade <= 0) return
    const dpr = window.devicePixelRatio || 1
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // draw pills in crisp screen px
    if (performance.now() - labelsRef.current.at > 150) computeLabels(ctx, k)
    const { far } = zones(k)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const it of labelsRef.current.items) {
      if (!!it.theme !== far) continue // zoom level flipped since the last pass
      let sx, sy
      if (it.theme) {
        const p = themePos(graphData.nodes.filter(n => n.px != null && !isDimmed(n)), it.theme, k, it.h)
        if (!p) continue
        sx = p.sx; sy = p.sy
      } else {
        if (it.node.px == null || isDimmed(it.node)) continue
        const s = toScreen(it.node.px, it.node.py, k)
        sx = s.x; sy = s.y + it.node.pr * k + 10 + it.h / 2
      }
      if (sx - it.w / 2 < 2 || sx + it.w / 2 > size.w - 2 || sy - it.h / 2 < 2 || sy + it.h / 2 > size.h - 2) continue
      ctx.globalAlpha = fade
      ctx.shadowColor = 'rgba(0,0,0,0.2)'
      ctx.shadowOffsetY = 2
      ctx.shadowBlur = 6
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.beginPath()
      ctx.roundRect(sx - it.w / 2, sy - it.h / 2, it.w, it.h, 999)
      ctx.fill()
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
      ctx.fillStyle = INK
      ctx.font = `${it.theme ? '600 16px' : '500 13px'} ${FONT}`
      ctx.fillText(it.text, sx, sy + 0.5)
    }
    ctx.restore()
  }

  // Imperative surface for the Cortex chrome (heat drag, search centering).
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      // search: center + frame the matching nodes
      centerOnIds(ids) {
        const fg = fgRef.current
        if (!fg) return
        const ns = ids.map(id => nodeById.get(id)).filter(n => n && n.x != null)
        if (!ns.length) return
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const n of ns) {
          if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x
          if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y
        }
        const F = fitRef.current
        fg.centerAt((minX + maxX) / 2, (minY + maxY) / 2, 600)
        fg.zoom(Math.max(F.k * 0.9, Math.min(F.k * 2.6,
          0.85 * Math.min(size.w / (maxX - minX + 140), size.h / (maxY - minY + 140)))), 600)
      },
      // heat pill drag: pan toward the memories of that period
      panToTime(t) {
        const fg = fgRef.current
        if (!fg) return
        const near = [...graphData.nodes].filter(n => n.x != null)
          .sort((a, b) => Math.abs(a.ts - t) - Math.abs(b.ts - t)).slice(0, 8)
        if (!near.length) return
        let ax = 0, ay = 0
        for (const n of near) { ax += n.x; ay += n.y }
        fg.centerAt(ax / near.length, ay / near.length, 200)
      },
    }
  }, [apiRef, nodeById, graphData, size])

  return (
    <div ref={boxRef} className="cortex-canvas">
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        onRenderFramePre={framePre}
        onRenderFramePost={framePost}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintPointer}
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={paintLink}
        linkPointerAreaPaint={() => {}}
        onEngineStop={() => { engineReadyRef.current = true }}
        onNodeClick={n => onSelect(n.id)}
        onBackgroundClick={() => onSelect(null)}
        enableNodeDrag={false}
        d3VelocityDecay={0.75}
        warmupTicks={needsSim ? 300 : 0}
        cooldownTicks={0}
        autoPauseRedraw={false}
        minZoom={0.2}
        maxZoom={12}
      />
    </div>
  )
}
