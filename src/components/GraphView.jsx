import { useRef, useMemo, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide, forceX, forceY } from 'd3-force-3d'; // same module force-graph runs its sim on
import FocusHud from './FocusHud.jsx';
import { edgeBudget, connectorKeys } from '../lib/edges.js';
import DustField from './DustField.jsx';
import { CLASS_COLORS, DAWN, DAWN_SAT, PAPER, PEACH } from '../lib/palette.js';

const TAU = Math.PI * 2;

// Entrance float (graph-view/SKILL.md → Entrance): each orb drifts in from just outside the
// centroid over ~1.1s, with a per-node stagger up to 0.5s (1.6s total), alpha ramping 0→depth.
const INTRO_MS = 1100;
const INTRO_STAGGER = 500;
const INTRO_TOTAL = INTRO_MS + INTRO_STAGGER;
const INTRO_DIST = 260;
const easeOutCubic = (p) => 1 - (1 - p) ** 3;

// --- tiny color helpers (pure) — accept #hex or rgb() so mix() results can be re-mixed ---
function hexToRgb(h) {
  if (h[0] === 'r') return h.slice(4, -1).split(',').map((v) => parseInt(v, 10));
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// mix `a` toward `b` by t (0..1)
function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const darken = (a, t) => mix(a, '#000000', t);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// stable 0..1 hash from a node id (FNV-1a) → per-node depth + breathing phase, fixed across renders
// --- Orb sprite atlas (perf): shadowBlur + radial gradients are the canvas hot-path
// killers at 241 nodes/frame (dropped frames during the entrance). Each orb look is
// baked ONCE to a small offscreen canvas (per class-accent x importance x depth-band,
// plus a highlight variant) at 3x resolution; painting becomes a single drawImage with
// breathing as a cheap destination scale. Past zoom 2.5 the vector path takes over so
// close-ups stay crisp (few nodes are on screen that deep).
const SPRITE_SCALE = 3;
const GLOW_PAD = 16;
const spriteCache = new Map();
function orbSprite(accent, imp, band, highlighted) {
  const key = accent + '|' + imp + '|' + band + (highlighted ? '|H' : '');
  let sp = spriteCache.get(key);
  if (sp) return sp;
  const r = (4 + imp * 2) * band;
  const half = Math.ceil((r + GLOW_PAD) * SPRITE_SCALE);
  const cv = document.createElement('canvas');
  cv.width = cv.height = half * 2;
  const c = cv.getContext('2d');
  c.scale(SPRITE_SCALE, SPRITE_SCALE);
  const cx = half / SPRITE_SCALE;
  c.shadowColor = highlighted ? PEACH : accent;
  c.shadowBlur = highlighted ? 22 : 12;
  const far = mix(accent, '#8B85A0', (1 - band) * 0.5);
  const grad = c.createRadialGradient(cx - r * 0.3, cx - r * 0.3, r * 0.1, cx, cx, r);
  if (highlighted) {
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.5, mix(accent, '#ffffff', 0.4));
    grad.addColorStop(1, accent);
  } else {
    grad.addColorStop(0, mix(far, '#ffffff', 0.55));
    grad.addColorStop(0.55, far);
    grad.addColorStop(1, darken(far, 0.25));
  }
  c.beginPath();
  c.arc(cx, cx, r, 0, TAU);
  c.fillStyle = grad;
  c.fill();
  c.shadowBlur = 0;
  c.beginPath();
  c.arc(cx, cx, r + 1.5, 0, TAU);
  c.lineWidth = 1;
  c.strokeStyle = 'rgba(242,240,236,0.35)';
  c.stroke();
  sp = { cv, worldHalf: r + GLOW_PAD, r };
  spriteCache.set(key, sp);
  return sp;
}
const bandOf = (depth) => (depth > 0.9 ? 1 : depth > 0.7 ? 0.8 : 0.6);

function hash01(id) {
  let h = 2166136261;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
// display labels for edge `shared` type codes (edges.js emits who/where/class/feeling/artist)
const TYPE_LABEL = { who: 'person', where: 'place', class: 'class', feeling: 'feeling', artist: 'music' };

export default function GraphView({
  memories,
  layout,
  edges,
  visibleIds,
  highlightIds,
  selectedId,
  onSelect,
  onEdit,
  onPhotoTap,
  gatherActive,
}) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const firstDataRef = useRef(true);   // person-switch remounts (key) replay the intro; edits must not
  const didFitRef = useRef(false);      // one-shot: after warmup settles, frame the graph + start the float
  const introStartRef = useRef(0);      // performance.now() when the entrance float began (0 = not yet)
  const introActiveRef = useRef(true);  // true until the float finishes — gates labels + pointer/hover
  const introFadeRef = useRef(0);       // 0→1 global fade so edge threads appear with the float
  const labelFadeRef = useRef(0);       // 0→1 global fade ~800ms after the float lands — names fade in, never pop
  const centroidRef = useRef({ x: 0, y: 0 }); // settled-layout center; the float radiates outward from it
  // Parallax per-frame scratch (see Parallax Phase 2 in graph-view/SKILL.md).
  const camRef = useRef({ x: 0, y: 0 });        // world coords of viewport center
  const mouseTargetRef = useRef({ x: 0, y: 0 }); // raw normalized mouse [-0.5,0.5]
  const mouseSmoothRef = useRef({ x: 0, y: 0 }); // lerp-smoothed, shared with DustField
  const mouseWorldRef = useRef({ x: 0, y: 0 });  // smoothed mouse * 12/k, world units
  const labelIdsRef = useRef(new Set());         // ids whose label survived the anti-overlap pass
  const lastLabelPassRef = useRef(0);            // greedy label pass throttle (~6Hz)
  const [hoverId, setHoverId] = useState(null);
  const [hoverLink, setHoverLink] = useState(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Graph data built once from memories + edges. Nodes carry their memory object plus a
  // stable pseudo-depth `z` and breathing `phase` (see Alive & depth in graph-view/SKILL.md).
  const graphData = useMemo(() => ({
    nodes: memories.map((m) => {
      const hh = hash01(m.id);
      const imp = m.importance || 1;
      // depth follows size: importance 5 = foreground (1), importance 1 = background (0.55),
      // plus a whisper of stable jitter so planes don't lock. Bigger orb == nearer == moves most.
      const depth = Math.min(1, Math.max(0.55, 0.55 + 0.45 * ((imp - 1) / 4) + (hh - 0.5) * 0.06));
      // anchorA: per-node parallax anchor, eased toward 1 while focused (onRenderFramePre).
      const node = { id: m.id, mem: m, depth, phase: hh * TAU, anchorA: 0 };
      // Precomputed layout (scripts/compute-layout.mjs): seed the settled position so no
      // runtime warmup is needed — switching persons is instant and jank-free.
      const pos = layout && layout[m.id];
      if (pos) { node.x = pos[0]; node.y = pos[1]; }
      return node;
    }),
    links: edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight, shared: e.shared, bkey: e.source + '|' + e.target })),
  }), [memories, layout, edges]);

  // All nodes pre-positioned → zero warmup ticks (the synchronous warmup loop blocked the
  // main thread ~0.5s at 241 nodes — the choppy person-switch). Fallback 200 for new data
  // without a computed layout.
  const allSeeded = useMemo(() => graphData.nodes.every((n) => n.x != null), [graphData]);

  // Edge budget (edges.js → edgeBudget): at rest, dense graphs show only the maximum
  // spanning tree + strongest extras. Ego/gather/hover still reveal everything relevant.
  const budgetKeys = useMemo(() => edgeBudget(edges, memories.length), [edges, memories]);
  // Cluster bridges (edges.js → connectorKeys): never allowed to fade below visibility, so
  // the graph can't read as disconnected islands when connections genuinely exist.
  const connectorSet = useMemo(() => connectorKeys(edges), [edges]);

  const nodeById = useMemo(() => {
    const map = new Map();
    for (const n of graphData.nodes) map.set(n.id, n);
    return map;
  }, [graphData]);

  // neighbor lookup: id -> [{ shared, weight }] (for tooltip + connection counts)
  const neighbors = useMemo(() => {
    const map = new Map();
    for (const n of graphData.nodes) map.set(n.id, []);
    for (const e of edges) {
      map.get(e.source)?.push({ shared: e.shared, weight: e.weight, otherId: e.target });
      map.get(e.target)?.push({ shared: e.shared, weight: e.weight, otherId: e.source });
    }
    return map;
  }, [graphData, edges]);

  const maxConnections = useMemo(() => {
    let max = 1;
    for (const list of neighbors.values()) max = Math.max(max, list.length);
    return max;
  }, [neighbors]);

  // adjacency: id -> Set of neighbor ids (for ego-network: neighbor orbs stay full alpha)
  const adjacency = useMemo(() => {
    const map = new Map();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source).add(e.target);
      map.get(e.target).add(e.source);
    }
    return map;
  }, [edges]);

  // Physics v2 (graph-view/SKILL.md): un-cramp the clump, reserve label air, keep motion viscous.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const rOf = (n) => 4 + (n.mem.importance || 1) * 2;
    fg.d3Force('link')
      .distance((l) => 50 + 240 / l.weight)      // strong pairs sit closer, never touching
      .strength((l) => Math.min(0.5, l.weight / 12)); // weak edges must not drag clusters together
    fg.d3Force('charge').strength(-250);
    fg.d3Force('collide', forceCollide((n) => rOf(n) + 16).iterations(2)); // +16 = label air
    // Anisotropic gravity (parity with scripts/compute-layout.mjs): keeps disconnected
    // clusters from repelling into empty gulfs; stronger Y so the layout stays screen-shaped.
    fg.d3Force('gx', forceX(0).strength(0.06));
    fg.d3Force('gy', forceY(0).strength(0.13));
    // Perpetual gentle drift: charge/link forces are scaled by alpha and die as the
    // sim cools, so this custom force ignores alpha — each orb bobs around the home
    // position it settled at (~16s cycle), never faster, never escaping.
    const nodes = graphData.nodes;
    // warmupTicks pre-settles the layout with THESE forces: the graphData flush is debounced
    // ~1ms, so it runs after this effect configures them — no visible flop. Re-arm the
    // one-shot fit + entrance float for the (re)built data.
    if (firstDataRef.current) {
      firstDataRef.current = false;
      didFitRef.current = false;
      introStartRef.current = 0;
      introActiveRef.current = true;
      introFadeRef.current = 0;
    } else {
      // Subsequent graphData (an in-place memory edit, not a person switch — the person
      // switch remounts via key): keep the camera and skip the entrance float, but the
      // rebuilt nodes need homes for the liveliness pass.
      for (const n of graphData.nodes) {
        if (n.x != null) { n.hx = n.x; n.hy = n.y; }
      }
      didFitRef.current = true;
    }
    fg.d3ReheatSimulation();
  }, [graphData]);

  // Keep the focus-repel force's closure looking at the current selection without re-registering.

  // Center + zoom on selection; zoom back out when cleared.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (selectedId) {
      const node = nodeById.get(selectedId);
      if (node && node.x != null) {
        const K = 3;
        // Phones: park the node ~24% from the top so the bottom-sheet detail card
        // (max 52vh from the bottom) never covers it.
        const dy = size.w <= 700 ? (size.h / 2 - size.h * 0.24) / K : 0;
        fg.centerAt(node.x, node.y + dy, 600);
        fg.zoom(K, 600);
      }
    } else {
      fg.zoom(1.2, 600);
    }
  }, [selectedId, nodeById]);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Idle-drift parallax input: track normalized mouse over the container ([-0.5,0.5]²).
  // Smoothing happens per-frame in onRenderFramePre; here we only record the raw target.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      mouseTargetRef.current = {
        x: (e.clientX - rect.left) / rect.width - 0.5,
        y: (e.clientY - rect.top) / rect.height - 0.5,
      };
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  // --- state predicates (close over current props each render) ---
  const isDimmed = (node) => {
    if (!visibleIds.has(node.id)) return true;
    if (highlightIds && !highlightIds.has(node.id)) return true;
    return false;
  };
  const isHighlighted = (node) => !!(highlightIds && highlightIds.has(node.id));

  // Ego-network: the one node in focus (hover wins over selection). Its edges pop and
  // everything else recedes; its neighbor orbs stay full alpha so the network reads.
  const egoId = hoverId ?? selectedId ?? null;
  // Filter gather (graph-view/SKILL.md): the narrowed set drifts toward the centroid and its
  // internal threads glow. Query matches win; otherwise any strict-subset filter state.
  const gatherIds = useMemo(() => {
    if (highlightIds) return highlightIds;
    // Only POSITIVE narrowing gathers (query/chips/year/month). Hiding a legend class is
    // an exclusion — the rest of the graph should stay put, not fly to the center.
    if (gatherActive && visibleIds.size < memories.length) return visibleIds;
    return null;
  }, [highlightIds, visibleIds, memories, gatherActive]);
  // Gathered constellation targets: the matched subset keeps its NATURAL force-layout
  // shape (connected memories stay adjacent, threads stay short — a phyllotaxis spiral
  // scrambled neighbors and read as chaos), compacted by 0.55 around its own centroid
  // and recentered on the layout centroid. "Off" orbs are ignored (dim ghosts; overlap
  // with them is fine, per user).
  const gatherLayout = useMemo(() => {
    if (!gatherIds) return null;
    const list = graphData.nodes.filter((n) => gatherIds.has(n.id) && n.hx != null);
    if (!list.length) return null;
    let sx = 0, sy = 0;
    for (const n of list) { sx += n.hx; sy += n.hy; }
    const subC = { x: sx / list.length, y: sy / list.length };
    // Count-based tightness: aim the constellation at a radius ~ 34*sqrt(n) world units
    // (uniform spacing regardless of how scattered the matches originally were), so a
    // handful of memories huddle intimately while large sets keep a comfortable spread.
    let rr = 0;
    for (const n of list) rr += (n.hx - subC.x) ** 2 + (n.hy - subC.y) ** 2;
    const spreadR = Math.sqrt(rr / list.length) || 1;
    const targetR = 34 * Math.sqrt(list.length);
    const shrink = Math.min(0.8, targetR / spreadR);
    const c = centroidRef.current;
    // Collision relaxation ON THE TARGETS: memories fly to the center unobstructed, but
    // the composition they arrive at is already collision-free among the actives (dimmed
    // "off" orbs are ignored). One-time cost per filter change — nothing on the paint path.
    const items = list.map((n) => ({
      n,
      x: c.x + (n.hx - subC.x) * shrink,
      y: c.y + (n.hy - subC.y) * shrink,
      r: (4 + (n.mem.importance || 1) * 2) * n.depth + 7,
    }));
    for (let iter = 0; iter < 40; iter++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          const min = a.r + b.r;
          if (d >= min) continue;
          if (d < 0.01) { dx = Math.cos(a.n.phase); dy = Math.sin(a.n.phase); d = 1; }
          const push = (min - d) / 2 / d;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
          moved = true;
        }
      }
      if (!moved) break;
    }
    const map = new Map();
    for (const it of items) map.set(it.n.id, { gx: it.x, gy: it.y });
    return map;
  }, [gatherIds, graphData]);
  // Inside a LARGE gather the internal threads need the same discipline as the rest view:
  // the scale-decaying budget applied to the gathered subgraph (null for small gathers —
  // they keep showing everything).
  const gatherBudget = useMemo(() => {
    if (!gatherIds) return null;
    const sub = edges.filter((e) => gatherIds.has(e.source) && gatherIds.has(e.target));
    return edgeBudget(sub, gatherIds.size);
  }, [gatherIds, edges]);
  const egoNeighbors = egoId != null ? adjacency.get(egoId) : null;

  // --- parallax world offset (graph-view/SKILL.md → Parallax Phase 2) ---
  // off = (1 - depth) * (camCenter*0.6 + mouseWorld) * (1 - anchorA). anchorA is eased
  // per-node toward 1 while hovered/selected/highlighted (else 0) in onRenderFramePre, so a
  // focused orb GLIDES to its true position instead of snapping — an instant snap leaps the
  // orb out from under the cursor and un-hovers it in a flicker loop (the hover-jump bug).
  const offsetOf = (node) => {
    const f = (1 - node.depth) * (1 - node.anchorA);
    const cam = camRef.current;
    const mw = mouseWorldRef.current;
    return { x: f * (cam.x * 0.6 + mw.x), y: f * (cam.y * 0.6 + mw.y) };
  };

  // Entrance float offset + fade for one node (graph-view/SKILL.md → Entrance). Drifts in from
  // `dir * 260` (dir = centroid→home unit vector) easing to 0 over INTRO_MS after a per-node
  // stagger; `a` ramps 0→1 (multiplies the orb's depth alpha). Returns settled once landed.
  const introOf = (node) => {
    const start = introStartRef.current;
    if (!start) return { ix: 0, iy: 0, a: 0 };
    const el = performance.now() - start - hash01(node.id) * INTRO_STAGGER;
    const p = Math.max(0, Math.min(1, el / INTRO_MS));
    if (p >= 1) return { ix: 0, iy: 0, a: 1 };
    const hx = node.hx != null ? node.hx : node.x;
    const hy = node.hx != null ? node.hy : node.y;
    const c = centroidRef.current;
    const dx = hx - c.x;
    const dy = hy - c.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = (1 - easeOutCubic(p)) * INTRO_DIST;
    return { ix: (dx / len) * k, iy: (dy / len) * k, a: p };
  };

  // Camera bounds (graph-view/SKILL.md → Camera bounds): the cluster must always stay
  // meaningfully on screen (≥160 screen px visible). Debounced on any zoom/pan activity —
  // more reliable than gesture-end events, and self-terminating: the clamped centerAt's
  // own zoom events re-check and no-op once in bounds.
  const clampTimerRef = useRef(null);
  const clampNow = () => {
    const fg = fgRef.current;
    if (!fg) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of graphData.nodes) {
      if (n.x == null) continue;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    if (!Number.isFinite(minX)) return;
    const c = fg.screen2GraphCoords(size.w / 2, size.h / 2);
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
    const k = fg.zoom();
    const halfW = size.w / (2 * k);
    const halfH = size.h / (2 * k);
    const m = 160 / k; // at least this much cluster stays visible, in world units
    const cx = Math.min(maxX + halfW - m, Math.max(minX - halfW + m, c.x));
    const cy = Math.min(maxY + halfH - m, Math.max(minY - halfH + m, c.y));
    if (Math.abs(cx - c.x) > 1 || Math.abs(cy - c.y) > 1) fg.centerAt(cx, cy, 300);
  };
  const onZoomActivity = () => {
    clearTimeout(clampTimerRef.current);
    clampTimerRef.current = setTimeout(clampNow, 250);
  };

  // Shared label policy (graph-view/SKILL.md step 4, v3). Given a node's PAINTED world centre
  // (px,py) and the current zoom, returns { alpha, showYear }. Used by BOTH computeLabelSet
  // (anti-overlap) and paintNode so the two can never disagree.
  //  - hovered/selected: full, with year pill.
  //  - a memory is selected → every OTHER label is silenced (hovered excepted): the graph goes quiet.
  //  - else PROXIMITY: alpha ramps with screen radius screenR = (4+imp*2)*k across a ±6 band around
  //    threshold (26 - imp*3) — important orbs earn labels while zoomed out; zooming in blooms names.
  //  - then × 140px screen-edge fade (names never cling to the borders) × post-intro labelFade.
  const labelInfo = (node, px, py, globalScale) => {
    const imp = node.mem.importance || 1;
    const selected = node.id === selectedId;
    const active = node.id === hoverId;
    let base;
    let showYear = false;
    if (active || selected) { base = 1; showYear = true; }
    else if (selectedId != null) return { alpha: 0, showYear: false }; // selection quiets all others
    else {
      const screenR = (4 + imp * 2) * globalScale;
      base = Math.max(0, Math.min(1, (screenR - (26 - imp * 3 - 6)) / 12)); // ±6 ramp around 26-imp*3
    }
    if (base <= 0) return { alpha: 0, showYear };
    // world→screen: screenX = (worldX - camCenterX) * k + w/2 (camRef = viewport centre in world coords)
    const cam = camRef.current;
    const sx = (px - cam.x) * globalScale + size.w / 2;
    const sy = (py - cam.y) * globalScale + size.h / 2;
    const edge = Math.max(0, Math.min(1, Math.min(sx, size.w - sx, sy, size.h - sy) / 140));
    return { alpha: base * edge * labelFadeRef.current, showYear };
  };

  // Greedy priority label culling — recomputed each frame in onRenderFramePre. Rects live
  // in world units (measureText, radii, offsets all share that space), so world-space
  // non-overlap ⟺ screen-space non-overlap under the uniform canvas transform.
  const computeLabelSet = (ctx, globalScale) => {
    // Same screen-constant font scale as the label draw — rects must match the pixels.
    ctx.font = `${10 / Math.max(0.1, globalScale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const cand = [];
    for (const node of graphData.nodes) {
      if (node.x == null || isDimmed(node)) continue;
      const off = offsetOf(node);
      const px = node.x + off.x;
      const py = node.y + off.y;
      const info = labelInfo(node, px, py, globalScale);
      if (info.alpha <= 0.01) continue;
      const active = node.id === hoverId;
      const selected = node.id === selectedId;
      const imp = node.mem.importance || 1;
      const prio = active ? 3 : selected ? 2 : isHighlighted(node) ? 1 : 0;
      cand.push({ node, focused: active || selected || isHighlighted(node), showYear: info.showYear, imp, prio, id: String(node.id), px, py });
    }
    // hovered > selected > CURRENT HOLDERS (hysteresis — dense clusters flickered as
    // wobbling orbs flipped greedy winners every frame) > importance desc > stable id
    const prev = labelIdsRef.current;
    cand.sort((a, b) =>
      b.prio - a.prio ||
      (prev.has(b.id) ? 1 : 0) - (prev.has(a.id) ? 1 : 0) ||
      b.imp - a.imp ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const t = performance.now();
    const kept = [];
    const survivors = new Set();
    for (const c of cand) {
      const { node, focused, showYear, imp, px, py } = c;
      const r = Math.max(0.5, (4 + imp * 2) * (1 + 0.05 * Math.sin(t / 1400 + node.phase)) * (focused ? 1 : node.depth));
      const invK = 1 / Math.max(0.1, globalScale);
      const lx = px + r + 6 * invK;
      const ny = py;
      const wtxt = ctx.measureText(node.mem.what).width;
      const rect = { l: lx - 4 * invK, r: lx + wtxt + 4 * invK, t: ny - 9 * invK, b: showYear ? ny + 19 * invK : ny + 9 * invK };
      let ok = true;
      for (const k of kept) {
        if (rect.l < k.r && rect.r > k.l && rect.t < k.b && rect.b > k.t) { ok = false; break; }
      }
      if (ok) { kept.push(rect); survivors.add(node.id); }
    }
    labelIdsRef.current = survivors;
  };

  // Runs before every node/link paint: refresh camera center, smooth the mouse drift,
  // and rebuild the surviving-label set. Order matters — offsets read here feed the paints.
  const onRenderFramePre = (ctx, globalScale) => {
    const fg = fgRef.current;
    if (!fg) return;
    // First painted frame after warmup: snapshot each orb's settled home + the layout centroid
    // (the float radiates outward from it), frame the whole graph, and start the float clock.
    if (!didFitRef.current) {
      const nodes = graphData.nodes;
      if (nodes.length && nodes[0].x != null) {
        let sx = 0, sy = 0;
        for (const n of nodes) { n.hx = n.x; n.hy = n.y; sx += n.x; sy += n.y; }
        centroidRef.current = { x: sx / nodes.length, y: sy / nodes.length };
        introStartRef.current = performance.now();
        fg.zoomToFit(600, 100);
        didFitRef.current = true;
      }
    }
    // Entrance still running? gates labels + pointer/hover; threads fade in with introFade.
    const introEl = introStartRef.current ? performance.now() - introStartRef.current : -1;
    introActiveRef.current = introEl < 0 || introEl < INTRO_TOTAL;
    introFadeRef.current = introEl < 0 ? 0 : Math.min(1, introEl / INTRO_TOTAL);
    // Post-intro label fade: 0 until the float lands, then 0→1 over 800ms so names fade in, never pop.
    labelFadeRef.current = introEl < 0 ? 0 : Math.max(0, Math.min(1, (introEl - INTRO_TOTAL) / 800));
    const c = fg.screen2GraphCoords(size.w / 2, size.h / 2);
    if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) camRef.current = c;
    const s = mouseSmoothRef.current;
    const tg = mouseTargetRef.current;
    s.x += (tg.x - s.x) * 0.06; // ~0.06/frame easing
    s.y += (tg.y - s.y) * 0.06;
    const k = globalScale || 1;
    mouseWorldRef.current = { x: (s.x * 12) / k, y: (s.y * 12) / k }; // ~12 screen px at any zoom
    // Ease each node's parallax anchor toward 1 ONLY while selected — centerAt/FocusHud
    // need the true position. Hover must NOT anchor: hitboxes follow the painted offset,
    // and anchoring made hovered orbs visibly slide home after any pan/zoom.
    for (const n of graphData.nodes) {
      const anchored = n.id === selectedId;
      n.anchorA += ((anchored ? 1 : 0) - n.anchorA) * 0.15;
    }
    // Liveliness (engine-independent): force-graph's layout engine permanently stops after
    // warmupTicks (update() pauses it and only the synchronous warmup loop ran), so d3 forces
    // registered for ambient motion NEVER tick. Instead each node eases toward a moving
    // target = home + slow wobble (+ radial push away from the selected memory). Direct
    // position easing, no velocities — nothing can pause it except unmounting. Skipped
    // during the entrance float so it can't fight the intro offsets.
    if (!introActiveRef.current) {
      const tNow = performance.now();
      const selNode = selectedId ? nodeById.get(selectedId) : null;
      for (const n of graphData.nodes) {
        if (n.hx == null || n.x == null) continue;
        if (n.fx != null) { n.hx = n.fx; n.hy = n.fy ?? n.hy; continue; } // being dragged — rehome
        const g = gatherLayout ? gatherLayout.get(n.id) : null;
        const wob = g ? 2.5 : 6; // gathered constellation breathes more quietly
        const bx = g ? g.gx : n.hx;
        const by = g ? g.gy : n.hy;
        let tx = bx + wob * Math.sin(tNow / 2600 + n.phase * 7);
        let ty = by + wob * Math.cos(tNow / 3100 + n.phase * 5);
        if (selNode && n !== selNode && selNode.hx != null) {
          // Repel relative to BASE TARGETS (gathered or home), not raw homes — measuring
          // homes while gathered made the push meaningless inside the compacted set.
          const sg = gatherLayout ? gatherLayout.get(selNode.id) : null;
          const sbx = sg ? sg.gx : selNode.hx;
          const sby = sg ? sg.gy : selNode.hy;
          const dx = bx - sbx;
          const dy = by - sby;
          const dist = Math.hypot(dx, dy) || 1;
          const R = g ? 120 : 170; // tighter radius inside a compacted constellation
          if (dist < R) {
            const push = 34 * (1 - dist / R); // up to ~34 world units of breathing room
            tx += (dx / dist) * push;
            ty += (dy / dist) * push;
          }
        }
        const ease = g ? 0.09 : 0.035; // gathering is snappier; ambient drift stays zen
        n.x += (tx - n.x) * ease;
        n.y += (ty - n.y) * ease;
      }
    }
    // Labels wait until the entrance float finishes. The greedy pass runs at ~6Hz —
    // label sets don't need frame-rate updates and throttling removes per-frame churn.
    if (introActiveRef.current) {
      labelIdsRef.current = new Set();
      lastLabelPassRef.current = 0;
    } else if (performance.now() - lastLabelPassRef.current > 150) {
      lastLabelPassRef.current = performance.now();
      computeLabelSet(ctx, globalScale);
    }
  };

  // Selected-node crosshair (graph-view/SKILL.md → Selected-node crosshair). Drawn in canvas at
  // the orb's painted position (nx,ny) so it stays glued to the memory through pans/zooms — the
  // selected node eases its parallax anchor to 1, so nx,ny converge on the true position.
  const paintFocus = (node, ctx, nx, ny, r, invK = 1) => {
    const t = performance.now();
    const imp = node.mem.importance || 1;
    const conns = (neighbors.get(node.id) || []).length;

    ctx.save();
    ctx.lineCap = 'round';

    // 1. slow-rotating dotted ring just outside the orb
    ctx.save();
    ctx.translate(nx, ny);
    ctx.rotate((t / 8000) * TAU); // ~8s per turn, zen
    ctx.setLineDash([0.5, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = PEACH;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.5, r + 10), 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);

    // 2. two thin dawn-gradient arc gauges on top: importance (n/5), then connections (n/max)
    const grad = ctx.createLinearGradient(nx - r, ny - r, nx + r, ny + r);
    grad.addColorStop(0, DAWN[0]);
    grad.addColorStop(0.56, DAWN[1]);
    grad.addColorStop(1, DAWN[2]);
    const gauge = (rad, frac, ticks) => {
      rad = Math.max(0.5, rad);
      const a0 = -TAU / 4 - TAU * 0.2; // centered on top, sweeping 40% of the circle clockwise
      const span = TAU * 0.4;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(242,240,236,0.14)';
      ctx.beginPath();
      ctx.arc(nx, ny, rad, a0, a0 + span);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.arc(nx, ny, rad, a0, a0 + span * Math.max(0.001, Math.min(1, frac || 0)));
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(242,240,236,0.35)';
      for (let i = 0; i <= ticks; i++) {
        const a = a0 + (span * i) / ticks;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(nx + cs * (rad - 2.5), ny + sn * (rad - 2.5));
        ctx.lineTo(nx + cs * (rad + 2.5), ny + sn * (rad + 2.5));
        ctx.stroke();
      }
    };
    gauge(r + 14, imp / 5, 5);
    gauge(r + 19, conns / maxConnections, Math.min(maxConnections, 10));

    // 3. static corner brackets just outside the gauges
    const bd = r + 24;
    const bl = 5;
    ctx.strokeStyle = 'rgba(242,240,236,0.5)';
    ctx.lineWidth = 1;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = nx + dx * bd;
      const py = ny + dy * bd;
      ctx.beginPath();
      ctx.moveTo(px - dx * bl, py);
      ctx.lineTo(px, py);
      ctx.lineTo(px, py - dy * bl);
      ctx.stroke();
    }

    // 4. eyebrow caption under the node
    ctx.font = '9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    ctx.fillStyle = 'rgba(242,240,236,0.7)';
    if (window.innerWidth <= 700) {
      // Phone: float the gauge to the node's lower-left at screen-constant size —
      // anything straight below the node disappears under the bottom-sheet card.
      ctx.font = `${9.5 * invK}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`IMPORTANCE ${imp}/5`, nx - r - 18 * invK, ny + r + 4 * invK);
      ctx.fillText(`${conns}/${maxConnections} LINKS`, nx - r - 18 * invK, ny + r + 18 * invK);
    } else {
      ctx.fillText(`IMPORTANCE ${imp}/5  ·  ${conns}/${maxConnections} LINKS`, nx, ny + r + 32);
    }

    ctx.restore();
  };

  // --- node paint ---
  const paintNode = (node, ctx, globalScale) => {
    if (node.x == null) return;
    const m = node.mem;
    const accent = CLASS_COLORS[m.class] || DAWN[0];
    const dimmed = isDimmed(node);
    const highlighted = isHighlighted(node);
    const selected = node.id === selectedId;
    const active = node.id === hoverId;
    const focused = highlighted || selected || active;
    // neighbor of the currently focused node → part of its ego-network
    const inEgo = egoId != null && egoNeighbors != null && egoNeighbors.has(node.id);

    // Parallax: far orbs lag pan/zoom + drift with the idle mouse; a focused orb eases its
    // anchor toward 1 (offset → 0) so it glides to true position — FocusHud + hitbox pin
    // without the leap-out-from-cursor snap. Same offset feeds label + hitbox.
    const off = offsetOf(node);
    const intro = introOf(node); // entrance float-in offset + 0→1 alpha ramp
    const nx = node.x + off.x + intro.ix;
    const ny = node.y + off.y + intro.iy;

    // Alive: per-node breathing (desync via phase) + pseudo-depth (far = smaller/fainter).
    // THE focused node pops forward in size; its neighbor orbs only regain full alpha
    // (no size jump) so the ego-network reads without popping the whole cluster.
    const t = performance.now();
    const osc = Math.sin(t / 1400 + node.phase);
    const breath = 1 + 0.05 * osc;
    const sizeZ = focused ? 1 : node.depth; // NOT node.z — z is d3-force-3d's reserved spatial coord, mutated by the engine
    const alphaZ = focused || inEgo ? 1 : node.depth;
    const r = Math.max(0.5, (4 + (m.importance || 1) * 2) * breath * sizeZ); // guard: radial-gradient radius must stay > 0 (real Chrome throws IndexSizeError otherwise)

    ctx.save();

    if (dimmed) {
      ctx.globalAlpha = 0.1 * node.depth * intro.a;
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, TAU);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.globalAlpha = alphaZ * intro.a; // depth fade × entrance float-in

    if (globalScale <= 2.5) {
      // Sprite fast path: glow + gradient + hairline ring baked in; breathing rides the
      // destination size. One drawImage replaces the per-frame shadowBlur hot path.
      const sp = orbSprite(accent, m.importance || 1, highlighted ? 1 : bandOf(node.depth), highlighted);
      const scale = r / ((4 + (m.importance || 1) * 2) * (highlighted ? 1 : bandOf(node.depth)));
      const half = sp.worldHalf * scale;
      ctx.drawImage(sp.cv, nx - half, ny - half, half * 2, half * 2);
    } else {
      // Vector path (deep zoom): full-resolution glow, gradient and ring.
      const glowPulse = 1 + 0.3 * osc;
      ctx.shadowColor = focused ? PEACH : accent;
      ctx.shadowBlur = (focused ? 22 : 12) * glowPulse;
      const far = mix(accent, '#8B85A0', (1 - node.depth) * 0.5);
      const grad = ctx.createRadialGradient(
        nx - r * 0.3, ny - r * 0.3, r * 0.1,
        nx, ny, r,
      );
      if (highlighted) {
        grad.addColorStop(0, '#FFFFFF'); // near-white core (site's white node dots)
        grad.addColorStop(0.5, mix(accent, '#ffffff', 0.4));
        grad.addColorStop(1, accent);
      } else {
        grad.addColorStop(0, mix(far, '#ffffff', 0.55));
        grad.addColorStop(0.55, far);
        grad.addColorStop(1, darken(far, 0.25));
      }
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, TAU);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.shadowBlur = 0; // crisp rings/labels below

      ctx.beginPath();
      ctx.arc(nx, ny, r + 1.5, 0, TAU);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(242,240,236,0.35)';
      ctx.stroke();
    }

    // selected: dotted peach ring
    if (selected) {
      ctx.beginPath();
      ctx.setLineDash([0.5, 3]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = PEACH;
      ctx.arc(nx, ny, r + 7, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. DECLUTTERED label (graph-view/SKILL.md step 4, v3) — proximity ramp by screen radius,
    //    selection silences all but hovered, screen-edge + post-intro fades — all via the shared
    //    labelInfo helper (same one computeLabelSet uses). Draw only if this id survived the greedy
    //    rect pass (onRenderFramePre) this frame.
    const linfo = labelInfo(node, nx, ny, globalScale);
    if (linfo.alpha > 0.01 && labelIdsRef.current.has(node.id)) {
      // Screen-constant text (world size = screen px / k): orbs grow with zoom, names
      // don't — so relative to the content, names get smaller as you zoom in.
      const invK = 1 / Math.max(0.1, globalScale);
      const lx = nx + r + 6 * invK;
      ctx.globalAlpha = linfo.alpha;
      ctx.textBaseline = 'middle';
      ctx.font = `${10 * invK}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = PAPER;
      ctx.fillText(m.what, lx, ny);

      if (linfo.showYear) {
        const year = m.when.slice(6, 10);
        ctx.font = `${9 * invK}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        const pw = ctx.measureText(year).width + 8 * invK;
        const py = ny + 9 * invK;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(lx, py - 6 * invK, pw, 12 * invK, 4 * invK);
        ctx.fill();
        ctx.fillStyle = PAPER;
        ctx.fillText(year, lx + 4 * invK, py);
      }
    }

    // Node-anchored crosshair for the selected memory (after the entrance settles).
    if (selected && !introActiveRef.current) paintFocus(node, ctx, nx, ny, r, 1 / Math.max(0.1, globalScale));

    ctx.restore();
  };

  // pointer/hit area matches the visible orb — including its parallax offset (hitboxes
  // must follow the pixels; focused nodes get zero offset so they stay pinned).
  const paintNodePointer = (node, color, ctx) => {
    if (node.x == null || introActiveRef.current) return; // interactions wait for the float to finish
    const off = offsetOf(node);
    const r = 4 + (node.mem.importance || 1) * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x + off.x, node.y + off.y, r + 2, 0, TAU);
    ctx.fill();
  };

  // --- edge paint: fine dotted curved gradient thread ---
  const paintLink = (link, ctx, globalScale) => {
    const s = link.source;
    const t = link.target;
    if (!s || !t || s.x == null || t.x == null) return;
    const w = link.weight;

    // Colour/width by bond strength (spec: weight >= 10 saturated stops + 1.8px; else
    // dawn pastel scaling 1.0–1.4px). Prominence is carried by alpha below, not colour.
    let width;
    let stops;
    if (w >= 10) { width = 1.8; stops = DAWN_SAT; }
    else { width = 1.0 + (Math.min(w, 9) - 5) * 0.1; stops = DAWN; }

    // v3 prominence: whisper at rest (weak intra-cluster edges nearly vanish), the focused
    // node's ego-network pops, a hovered link is loudest of all.
    const wl = (w - 6) / 8;
    let alpha = Math.min(0.55, 0.05 + 0.5 * wl * wl);
    if (egoId != null) alpha = s.id === egoId || t.id === egoId ? 0.65 : 0.03;
    // Edge budget: outside ego/gather/hover, hide non-skeleton edges of dense graphs.
    const gatherPair = gatherIds && gatherIds.has(s.id) && gatherIds.has(t.id);
    const egoPair = egoId != null && (s.id === egoId || t.id === egoId);
    const connector = connectorSet.has(link.bkey);
    if (budgetKeys && !budgetKeys.has(link.bkey) && !connector && !gatherPair && !egoPair && link !== hoverLink) return;
    if (gatherPair && gatherBudget && !gatherBudget.has(link.bkey) && !connector && !egoPair && link !== hoverLink) return;
    if (connector) alpha = Math.max(alpha, 0.32); // bridges stay visible at rest
    if (gatherPair) {
      // Brighten but PRESERVE the weight hierarchy — a flat boost made every internal
      // thread equally loud and 58 gathered memories read as spaghetti.
      alpha = Math.min(0.75, alpha * 1.6 + 0.05);
      width += 0.2;
    }
    if (isDimmed(s) || isDimmed(t)) alpha = 0.015; // turned-off endpoint: almost invisible
    if (link === hoverLink) { alpha = 0.85; width += 0.4; } // hovered link loudest
    alpha *= introFadeRef.current; // threads fade in as the memories float into place
    width = Math.max(0.1, width); // guard: stroke width never non-positive

    // Parallax: paint each endpoint from its own offset position (hover hit-test stays on
    // true coords — fine at this ≤~10px amplitude). Shift the control point by the mean
    // endpoint offset so the curve keeps its shape.
    const so = offsetOf(s);
    const to = offsetOf(t);
    const si = introOf(s);
    const ti = introOf(t);
    const sx = s.x + so.x + si.ix;
    const sy = s.y + so.y + si.iy;
    const tx = t.x + to.x + ti.ix;
    const ty = t.y + to.y + ti.iy;
    const mox = (sx - s.x + tx - t.x) / 2; // shift control points by the mean endpoint offset
    const moy = (sy - s.y + ty - t.y) / 2;

    // Gradient strokes only where the eye lingers (strong bonds, hover, gather); weak
    // whisper threads use the solid mid-stop — indistinguishable at 1px/low alpha and it
    // avoids hundreds of createLinearGradient allocations per frame.
    let stroke;
    if (w >= 10 || link === hoverLink || gatherPair || connector) {
      const grad = ctx.createLinearGradient(sx, sy, tx, ty);
      grad.addColorStop(0, stops[0]);
      grad.addColorStop(0.5, stops[1]);
      grad.addColorStop(1, stops[2]);
      stroke = grad;
    } else {
      stroke = stops[1];
    }

    // Zoom-constant thread texture: dashes and width shrink in world units as you zoom
    // in, so threads stay fine dotted lines instead of blowing up into blobs.
    const zs = Math.max(1, globalScale) ** 0.85;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width / zs;
    ctx.lineCap = 'round';
    ctx.setLineDash([0.5 / zs, 3 / zs]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    // Curve from the library's own control points (computed from linkCurvature=0.2 before
    // this paint runs), shifted by the mean endpoint offset to track the parallax.
    const cp = link.__controlPoints;
    if (cp && cp.length === 2) ctx.quadraticCurveTo(cp[0] + mox, cp[1] + moy, tx, ty);
    else if (cp && cp.length === 4) ctx.bezierCurveTo(cp[0] + mox, cp[1] + moy, cp[2] + mox, cp[3] + moy, tx, ty);
    else ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();
  };

  // --- hover tooltip: grouped by WHAT is shared → which memories it connects to ---
  const nodeLabel = (node) => {
    const nbrs = neighbors.get(node.id) || [];
    const short = (txt) => (txt.length > 24 ? txt.slice(0, 23) + '…' : txt);
    const groups = new Map(); // "type|value" -> { value, names: [] }
    for (const n of nbrs) {
      const other = nodeById.get(n.otherId);
      if (!other) continue;
      for (const sv of n.shared) {
        const key = sv.type + '|' + sv.value;
        if (!groups.has(key)) groups.set(key, { value: sv.value, names: [] });
        const g = groups.get(key);
        if (!g.names.includes(other.mem.what)) g.names.push(other.mem.what);
      }
    }
    const rows = [...groups.values()]
      .sort((a, b) => b.names.length - a.names.length)
      .slice(0, 6)
      .map((g) => {
        const shown = g.names.slice(0, 3).map((x) => esc(short(x))).join(' · ');
        const more = g.names.length > 3 ? ` <span style="opacity:.45">+${g.names.length - 3}</span>` : '';
        return `<div style="margin-top:4px"><span style="font-weight:600">${esc(g.value)}</span>` +
          `<div style="opacity:.65;font-size:10.5px;line-height:1.35">${shown}${more}</div></div>`;
      })
      .join('');
    return (
      `<div style="font:11px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#F2F0EC;` +
      `background:rgba(30,24,44,0.82);border:1px solid rgba(255,255,255,0.14);` +
      `backdrop-filter:blur(8px);border-radius:12px;padding:8px 10px;max-width:250px">` +
      `<div style="font-weight:600;margin-bottom:4px">${esc(node.mem.what)}</div>` +
      (rows
        ? `<div style="font-size:8.5px;letter-spacing:1.5px;text-transform:uppercase;opacity:.5">Shares with</div>${rows}`
        : `<div style="opacity:.5">no connections</div>`) +
      `</div>`
    );
  };

  // --- link tooltip: "what is this connection?" — each shared value with its type ---
  const linkLabel = (link) => {
    const rows = (link.shared || [])
      .map((x) => `<div style="margin-top:2px">${esc(x.value)} <span style="opacity:.5">(${esc(TYPE_LABEL[x.type] || x.type)})</span></div>`)
      .join('');
    return (
      `<div style="font:11px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#F2F0EC;` +
      `background:rgba(30,24,44,0.82);border:1px solid rgba(255,255,255,0.14);` +
      `backdrop-filter:blur(8px);border-radius:12px;padding:8px 10px;max-width:250px">` +
      `<div style="font-size:8.5px;letter-spacing:1.5px;text-transform:uppercase;opacity:.5;margin-bottom:2px">Shared</div>` +
      (rows || `<div style="opacity:.5">—</div>`) +
      `</div>`
    );
  };

  const selectedNode = selectedId ? nodeById.get(selectedId) : null;

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <DustField w={size.w} h={size.h} mouse={mouseSmoothRef} />
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        onRenderFramePre={onRenderFramePre}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintNodePointer}
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={paintLink}
        linkCurvature={0.2}
        linkHoverPrecision={6}
        nodeLabel={nodeLabel}
        linkLabel={linkLabel}
        onNodeHover={(node) => setHoverId(node ? node.id : null)}
        onLinkHover={(link) => setHoverLink(link || null)}
        onNodeClick={(node) => onSelect(node.id)}
        onBackgroundClick={() => onSelect(null)}
        onZoom={onZoomActivity}
        onZoomEnd={onZoomActivity}
        d3VelocityDecay={0.75}
        warmupTicks={allSeeded ? 0 : 200}
        cooldownTime={Infinity}
        autoPauseRedraw={false} /* with warmupTicks the engine can report stopped → autoPause
          freezes ALL painting until first interaction (blank first load). We animate every
          frame anyway (intro, breathing, drift), so pausing is never wanted. */
        minZoom={0.5}
        maxZoom={8}
      />
      {selectedNode && (
        <FocusHud key={selectedNode.id} memory={selectedNode.mem} onEdit={onEdit} onPhotoTap={onPhotoTap} onClose={() => onSelect(null)} />
      )}
    </div>
  );
}
