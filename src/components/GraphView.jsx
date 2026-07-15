import { useRef, useMemo, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide } from 'd3-force-3d'; // same module force-graph runs its sim on
import FocusHud from './FocusHud.jsx';
import DustField from './DustField.jsx';
import { CLASS_COLORS, DAWN, DAWN_SAT, PAPER, PEACH } from '../lib/palette.js';

const TAU = Math.PI * 2;

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
function hash01(id) {
  let h = 2166136261;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
// linear label-alpha ramp: 0 at (thr-0.15), 1 at (thr+0.15)
const ramp = (s, thr) => Math.max(0, Math.min(1, (s - (thr - 0.15)) / 0.3));

// display labels for edge `shared` type codes (edges.js emits who/where/class/feeling/artist)
const TYPE_LABEL = { who: 'person', where: 'place', class: 'class', feeling: 'feeling', artist: 'music' };

export default function GraphView({
  memories,
  edges,
  visibleIds,
  highlightIds,
  selectedId,
  onSelect,
}) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const didFitRef = useRef(false); // one-shot initial zoomToFit (engine stays warm, so onEngineStop never fires)
  const tickRef = useRef(0);
  // Parallax per-frame scratch (see Parallax Phase 2 in graph-view/SKILL.md).
  const camRef = useRef({ x: 0, y: 0 });        // world coords of viewport center
  const mouseTargetRef = useRef({ x: 0, y: 0 }); // raw normalized mouse [-0.5,0.5]
  const mouseSmoothRef = useRef({ x: 0, y: 0 }); // lerp-smoothed, shared with DustField
  const mouseWorldRef = useRef({ x: 0, y: 0 });  // smoothed mouse * 12/k, world units
  const labelIdsRef = useRef(new Set());         // ids whose label survived the anti-overlap pass
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
      return { id: m.id, mem: m, depth, phase: hh * TAU, anchorA: 0 };
    }),
    links: edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight, shared: e.shared })),
  }), [memories, edges]);

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
      map.get(e.source)?.push({ shared: e.shared, weight: e.weight });
      map.get(e.target)?.push({ shared: e.shared, weight: e.weight });
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
    // Perpetual gentle drift: charge/link forces are scaled by alpha and die as the
    // sim cools, so this custom force ignores alpha — each orb bobs around the home
    // position it settled at (~16s cycle), never faster, never escaping.
    const nodes = graphData.nodes;
    fg.d3Force('drift', () => {
      const t = performance.now();
      for (const n of nodes) {
        if (n.x == null) continue;
        if (n.hx == null && didFitRef.current) { n.hx = n.x; n.hy = n.y; } // record home after settle
        if (n.hx == null) continue;
        n.vx += (n.hx - n.x) * 0.002 + 0.015 * Math.sin(t / 2600 + n.phase * 7);
        n.vy += (n.hy - n.y) * 0.002 + 0.015 * Math.cos(t / 3100 + n.phase * 5);
      }
    });
    didFitRef.current = false;
    tickRef.current = 0;
    fg.d3ReheatSimulation();
  }, [graphData]);

  // Center + zoom on selection; zoom back out when cleared.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (selectedId) {
      const node = nodeById.get(selectedId);
      if (node && node.x != null) {
        fg.centerAt(node.x, node.y, 600);
        fg.zoom(3, 600);
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

  // Greedy priority label culling — recomputed each frame in onRenderFramePre. Rects live
  // in world units (measureText, radii, offsets all share that space), so world-space
  // non-overlap ⟺ screen-space non-overlap under the uniform canvas transform.
  const computeLabelSet = (ctx, globalScale) => {
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const cand = [];
    for (const node of graphData.nodes) {
      if (node.x == null || isDimmed(node)) continue;
      const selected = node.id === selectedId;
      const active = node.id === hoverId;
      const imp = node.mem.importance || 1;
      let showYear = false;
      let prio;
      if (active) { prio = 3; showYear = true; }
      else if (selected) { prio = 2; showYear = true; }
      else {
        if (ramp(globalScale, imp >= 4 ? 1.1 : 2.2) <= 0.01) continue;
        prio = isHighlighted(node) ? 1 : 0;
      }
      cand.push({ node, focused: active || selected || isHighlighted(node), showYear, imp, prio, id: String(node.id) });
    }
    // hovered > selected > importance desc > id (stable tiebreak kills flicker)
    cand.sort((a, b) => b.prio - a.prio || b.imp - a.imp || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const t = performance.now();
    const kept = [];
    const survivors = new Set();
    for (const c of cand) {
      const { node, focused, showYear, imp } = c;
      const r = Math.max(0.5, (4 + imp * 2) * (1 + 0.05 * Math.sin(t / 1400 + node.phase)) * (focused ? 1 : node.depth));
      const off = offsetOf(node);
      const lx = node.x + off.x + r + 6;
      const ny = node.y + off.y;
      const wtxt = ctx.measureText(node.mem.what).width;
      const rect = { l: lx - 4, r: lx + wtxt + 4, t: ny - 9, b: showYear ? ny + 19 : ny + 9 };
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
    const c = fg.screen2GraphCoords(size.w / 2, size.h / 2);
    if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) camRef.current = c;
    const s = mouseSmoothRef.current;
    const tg = mouseTargetRef.current;
    s.x += (tg.x - s.x) * 0.06; // ~0.06/frame easing
    s.y += (tg.y - s.y) * 0.06;
    const k = globalScale || 1;
    mouseWorldRef.current = { x: (s.x * 12) / k, y: (s.y * 12) / k }; // ~12 screen px at any zoom
    // Ease each node's parallax anchor toward 1 while it's the focus (hover/select/highlight),
    // else toward 0 — so focused orbs glide to true position instead of snapping (hover-jump bug).
    for (const n of graphData.nodes) {
      const anchored = n.id === hoverId || n.id === selectedId || (highlightIds && highlightIds.has(n.id));
      n.anchorA += ((anchored ? 1 : 0) - n.anchorA) * 0.15;
    }
    computeLabelSet(ctx, globalScale);
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
    const nx = node.x + off.x;
    const ny = node.y + off.y;

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
      ctx.globalAlpha = 0.1 * node.depth;
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, TAU);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.globalAlpha = alphaZ; // depth fade (full for focused node + its neighbors)

    // 1. faint glow, pulsing gently in time with the breath
    const glowPulse = 1 + 0.3 * osc;
    ctx.shadowColor = focused ? PEACH : accent;
    ctx.shadowBlur = (focused ? 22 : 12) * glowPulse;

    // 2. matte sphere — radial gradient, light from top-left, no specular dot.
    //    Recede toward dusk with depth (cheap desaturation of far orbs).
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

    // 3. hairline ring
    ctx.beginPath();
    ctx.arc(nx, ny, r + 1.5, 0, TAU);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(242,240,236,0.35)';
    ctx.stroke();

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

    // 4. DECLUTTERED label (graph-view/SKILL.md step 4) + anti-overlap: hovered/selected →
    //    what + year pill; else importance>=4 past 1.1, others past 2.2, alpha-fading across
    //    ±0.15. Draw only if this id survived the greedy rect pass (onRenderFramePre) this frame.
    let labelAlpha;
    let showYear = false;
    if (active || selected) {
      labelAlpha = 1;
      showYear = true;
    } else {
      labelAlpha = ramp(globalScale, (m.importance || 1) >= 4 ? 1.1 : 2.2);
    }
    if (labelAlpha > 0.01 && labelIdsRef.current.has(node.id)) {
      const lx = nx + r + 6;
      ctx.globalAlpha = labelAlpha;
      ctx.textBaseline = 'middle';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillStyle = PAPER;
      ctx.fillText(m.what, lx, ny);

      if (showYear) {
        const year = m.when.slice(6, 10);
        ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const pw = ctx.measureText(year).width + 8;
        const py = ny + 9;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(lx, py - 6, pw, 12, 4);
        ctx.fill();
        ctx.fillStyle = PAPER;
        ctx.fillText(year, lx + 4, py);
      }
    }

    ctx.restore();
  };

  // pointer/hit area matches the visible orb — including its parallax offset (hitboxes
  // must follow the pixels; focused nodes get zero offset so they stay pinned).
  const paintNodePointer = (node, color, ctx) => {
    if (node.x == null) return;
    const off = offsetOf(node);
    const r = 4 + (node.mem.importance || 1) * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x + off.x, node.y + off.y, r + 2, 0, TAU);
    ctx.fill();
  };

  // --- edge paint: fine dotted curved gradient thread ---
  const paintLink = (link, ctx) => {
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
    if (isDimmed(s) || isDimmed(t)) alpha = 0.04; // filtered/query-dimmed endpoint wins
    if (link === hoverLink) { alpha = 0.85; width += 0.4; } // hovered link loudest
    width = Math.max(0.1, width); // guard: stroke width never non-positive

    // Parallax: paint each endpoint from its own offset position (hover hit-test stays on
    // true coords — fine at this ≤~10px amplitude). Shift the control point by the mean
    // endpoint offset so the curve keeps its shape.
    const so = offsetOf(s);
    const to = offsetOf(t);
    const sx = s.x + so.x;
    const sy = s.y + so.y;
    const tx = t.x + to.x;
    const ty = t.y + to.y;
    const mox = (so.x + to.x) / 2;
    const moy = (so.y + to.y) / 2;

    const grad = ctx.createLinearGradient(sx, sy, tx, ty);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.5, stops[1]);
    grad.addColorStop(1, stops[2]);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = grad;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.setLineDash([0.5, 3]);
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

  // --- hover tooltip: neighbor shared-attribute reasons ---
  const nodeLabel = (node) => {
    const nbrs = neighbors.get(node.id) || [];
    const rows = nbrs
      .slice(0, 8)
      .map((n) => `<div style="opacity:.85;margin-top:2px">${esc(n.shared.map((x) => x.value).join(' · '))}</div>`)
      .join('');
    return (
      `<div style="font:11px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#F2F0EC;` +
      `background:rgba(30,24,44,0.82);border:1px solid rgba(255,255,255,0.14);` +
      `backdrop-filter:blur(8px);border-radius:12px;padding:8px 10px;max-width:220px">` +
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
      `backdrop-filter:blur(8px);border-radius:12px;padding:8px 10px;max-width:220px">` +
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
        d3VelocityDecay={0.75}
        cooldownTime={Infinity}
        onEngineTick={() => {
          // Keep the sim perpetually warm (above) means onEngineStop never fires — so frame
          // the whole graph once, after the initial spread has settled (~120 ticks).
          if (didFitRef.current) return;
          if (++tickRef.current > 120) {
            didFitRef.current = true;
            fgRef.current?.zoomToFit(600, 100);
          }
        }}
      />
      {selectedNode && (
        <FocusHud
          memory={selectedNode.mem}
          connections={(neighbors.get(selectedNode.id) || []).length}
          maxConnections={maxConnections}
          cx={size.w / 2}
          cy={size.h / 2}
          nodeScreenR={(4 + (selectedNode.mem.importance || 1) * 2) * 3}
          onClose={() => onSelect(null)}
        />
      )}
    </div>
  );
}
