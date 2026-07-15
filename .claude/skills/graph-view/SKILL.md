---
name: graph-view
description: Spec for the force-directed graph canvas — Memmory-style pastel node painting, dotted gradient thread edges, hover/click interactions, and the node-focus HUD. Read before touching GraphView.jsx or FocusHud.jsx.
---

# Graph view

Library: `react-force-graph-2d` (canvas + d3-force). It provides zoom/pan/drag/hover/click — use its props, never reimplement. All colors come from `visual-style` tokens via `lib/palette.js`.

## Node painting (nodeCanvasObject)

Soft matte pastel sphere, radius `r = 4 + importance * 2`, colored by class accent:
1. Faint glow: `ctx.shadowColor = accent; ctx.shadowBlur = 12` (22 when highlighted, 0 when dimmed).
2. Sphere: radial gradient centered `(x - r*0.3, y - r*0.3)` — accent mixed ~55% toward white → accent → accent darkened ~25%. No specular dot, no gloss.
3. Ring: 1px circle at `r + 1.5`, `rgba(242,240,236,0.35)`.
4. Label — v3 policy (proximity + edges + selection):
   - hovered or selected: always show `what` + year pill.
   - **A memory is selected → every other label is hidden** (hovered one excepted). The graph goes quiet around the chosen memory.
   - otherwise labels appear by PROXIMITY: label alpha ramps with the node's SCREEN radius (`screenR = r * globalScale`): threshold `screenR > 26 - importance * 3` (important memories earn labels earlier), ramp width ±6. At full-view zoom only the most important clear it — priority preserved; zooming toward a cluster makes its names bloom.
   - **Screen-edge fade**: labels fade to 0 within 140px of any viewport edge (linear), so names never cling to the borders.
   - **Post-entrance fade**: after the intro float lands, labels fade in globally over ~800ms (multiply a global labelFade 0→1 starting at intro end). Labels must never pop.
   - Text is SCREEN-CONSTANT: world font size = `10 / globalScale` (year pill 9), and every layout constant around it (offsets, pill box, overlap-rect padding) scales by `1/globalScale` too. Orbs grow with zoom while names stay 10 screen px — names read as getting smaller as you zoom in, per user request. The greedy anti-overlap pass still runs last with matching geometry.

States:
- **Dimmed** (filtered out / non-matching query): `globalAlpha 0.10`, no glow, no label.
- **Highlighted** (query match / selected year): near-white core with accent halo — the site's white node dots on the dusk card.
- **Selected**: thin dotted ring at `r + 7` (`setLineDash([0.5,3])`) in the peach accent `#F5D6BC`.

## Edge painting (linkCanvasObject)

Memmory threads — fine dotted curved gradient lines (see visual-style for the exact recipe):
- `lineCap 'round'`; dash `[0.5, 3]`; gradient stroke source→target: dawn stops `#9DB4DE → #ECB890 → #C79BCB`; strongest edges (weight ≥ 10) use the saturated stops `#5681CC → #E68A45 → #A451BE` and 1.8px; others 1.0–1.4px scaling with weight.

### Edge prominence (v3 — cluster cores were unreadable when every edge shouted equally)

The eye should read structure at rest and detail on demand:
- **At rest**: alpha scales with weight — `alpha = 0.05 + 0.5 * ((weight - 6) / 8)^2`, capped 0.55. Weak intra-cluster edges become a whisper of texture; only strong bonds draw lines the eye follows.
- **Node hovered or selected**: that node's edges all rise to alpha 0.65; every other edge falls to 0.03. Neighbor endpoints keep their orbs at full alpha so the ego-network pops.
- **Link hovered**: that single link at alpha 0.85 and +0.4px width.
- Either endpoint dimmed (filters/query) → alpha 0.015 — connections into the turned-off world are almost invisible.

### Link hover = "what is this connection?"

- Use the library's `linkLabel` for the tooltip (same dusk-glass HTML styling as the node tooltip): a "SHARED" eyebrow header, then the edge's `shared` values as one line each with its type — e.g. "Sarah (person) / Happy (feeling) / Barcelona (place)".
- Track hover with `onLinkHover`. IMPORTANT geometry note: the library's built-in link hit-testing follows its own `linkCurvature` model — so set the `linkCurvature={0.2}` prop and paint the curve from the SAME control points the library computes (it stores them on `link.__controlPoints` when linkCurvature is set), instead of computing a manual control point. Otherwise the hover hitbox and the visible curve diverge. Set `linkHoverPrecision` ≈ 6 so the thin threads are comfortably hoverable.
- Hovered node still shows its aggregate tooltip listing each neighbor edge's `shared` reasons.

## Physics & spacing (v2 — the v1 layout was a cramped clump)

- Collision: add `forceCollide(node => r(node) + 16, iterations 2)` — the +16 reserves label air. d3-force-3d's `forceCollide` is re-exported by the graph ref's `d3Force('collide', ...)` slot.
- Charge: `-250` (was -120; too weak).
- Links: `distance ≈ 50 + 240/weight` (strong pairs sit closer but never touching), `strength ≈ Math.min(0.5, weight/12)` — weak edges must NOT drag clusters together.
- `d3VelocityDecay ≈ 0.75` for slow, viscous motion.
- On first `onEngineStop`: `zoomToFit(600, 100)` once, so the whole graph greets the user framed with air around it.

## Alive & depth (2.5D)

The scene should feel like drifting through a memory space, not a frozen chart:

- **Perpetual gentle drift**: keep the simulation warm — `d3AlphaTarget ≈ 0.02`, `d3AlphaDecay 0` (or `cooldownTime Infinity`) so nodes never fully stop; combined with velocityDecay 0.75 this reads as slow floating, not jitter. This also guarantees continuous canvas redraws for the animations below. Verify exact prop names against the installed package: /tmp/mg/node_modules/react-force-graph-2d/dist/react-force-graph-2d.d.ts (bash).
- **Breathing**: in `nodeCanvasObject`, modulate radius `r * (1 + 0.05 * sin(t/1400 + phase))` and glow blur `±30%` with `t = performance.now()` and `phase = hash(node.id)` so orbs pulse out of sync, like slow breathing.
- **Depth layers**: assign each node a stable pseudo-depth `depth = clamp(0.55 + 0.45*(importance-1)/4 + (hash01(id)-0.5)*0.06, 0.55, 1)` — depth follows size: bigger/more important orbs are foreground and parallax most, small ones recede (NEVER name this field `z` -- x/y/z/vx/vy/vz/fx/fy/fz/index are d3-force-3d's reserved node fields and the engine mutates them; a `z` depth field gets corrupted into negative radii and crashes createRadialGradient with IndexSizeError, freezing the whole render loop); multiply radius and node alpha by `depth`. Far nodes are smaller, fainter, slightly desaturated — cheap parallax depth.
- **Dust field**: behind the graph canvas, one absolutely-positioned `<canvas>` (own rAF loop, ~70 particles): tiny 1-2px paper-colored dots at alpha 0.05-0.18 drifting slowly upward-left with sin wobble, wrapping at edges. Plus 2-3 huge blurred radial nebula blobs (peach/lavender at alpha ~0.05) painted once. This layer never interacts — `pointer-events: none`.
- Everything slow: nothing on screen should complete a cycle faster than ~8s. Calm, zen, meditative.

## Parallax (Phase 2 — 2.5D becomes real depth)

Both-trigger parallax, asymmetric by design: mouse drift whisper-subtle (~12px), pan/zoom camera parallax really pronounced (0.6 factor). layers separate on pan/zoom AND drift with mouse when idle. Zen rule: eased, slow, a few px — felt more than seen.

- **Per-node world offset**, applied identically in `nodeCanvasObject`, label placement, AND `nodePointerAreaPaint` (hitboxes must follow the pixels):
  `off = (1 - node.depth) * (camCenter * 0.6 + mouseWorld) * (1 - anchor)` where `anchor` ∈ [0,1] is a per-node value EASED each frame (lerp ~0.15/frame in `onRenderFramePre`) toward 1 ONLY while the node is selected (centerAt/FocusHud need true coords), else toward 0. NEVER anchor on hover or highlight — hitboxes already follow the painted offset, and anchoring makes hovered orbs visibly slide back to their pre-parallax position. Anchored nodes glide to their true position (aligning FocusHud and interactions) instead of snapping — an instant snap makes nodes leap out from under the cursor, un-hovering themselves in a flicker loop. Store it in a custom field like `node.anchorA` (never engine-owned fields: x/y/z/vx/vy/vz/fx/fy/fz/index).
  - `camCenter` = world coords of the viewport center, computed once per frame in `onRenderFramePre` via `fg.screen2GraphCoords(w/2, h/2)` — panning makes far orbs lag behind near ones.
  - `mouseWorld` = normalized mouse position (`[-0.5,0.5]²` over the container, lerp-smoothed with ~0.06/frame easing) times `12 / k` (constant ~12 screen px — mouse term is deliberately whisper-subtle; camera term carries the drama). Track via one `mousemove` listener.
- Links: paint each endpoint at its own offset position. The library's link-hover hit-test stays on true coords — acceptable at this amplitude (small for mouse (~5px); during pans the offset is large but hover during a drag isn't a real interaction — link hover is fuzziest at screen edges, exact at center).
- **DustField layers**: split motes into far (~35, smaller, slower, alpha low) and near (~35, bigger, faster) layers + nebula (slowest). Each layer offsets by the same smoothed mouse vector times a per-layer factor (nebula 5px, far 10px, near 20px screen amplitude — mouse only). Dust is decoration only — no camera term needed there.

## Label anti-overlap (Phase 2)

Labels must never overlap each other. Greedy priority culling, recomputed each frame in `onRenderFramePre`:

1. Gather label candidates per the existing declutter rules (hovered/selected always; else importance/zoom-ramped).
2. Sort by priority: hovered first, then selected, then importance desc, then id (stable tiebreak — prevents flicker).
3. For each candidate compute its screen-space label rect (measureText + pill, at the node's parallax-offset position, +4px padding); keep it only if it intersects no already-kept rect.
4. Store the surviving id set in a ref; `nodeCanvasObject` draws a label only if its id survived.

Deterministic, no state, one array per frame. The slow drift means labels appear/disappear rarely; the stable sort keeps winners winning.

## Precomputed layout (build-time physics)

`scripts/compute-layout.mjs [--person pX]` runs the runtime force config PLUS anisotropic gravity (forceX/forceY toward origin, Y ~2x X so the layout settles a screen-shaped oval; per-person strengths, override via GRAVX/GRAVY env) for 300 ticks and writes `src/data/layout-pX.json`. Without gravity, disconnected clusters repel into vast empty gulfs — collision still guarantees breathing room, so gravity compresses empty space, not memories (`{id:[x,y]}`). persons.js ships it; GraphView seeds node positions from it and sets `warmupTicks = allSeeded ? 0 : 200` — the synchronous warmup loop blocked the main thread ~0.5s at 241 nodes (the choppy person switch). Re-run the script whenever a person's memories change; unknown nodes fall back to runtime warmup.

## Edge budget (readability at scale)

`edgeBudget(edges, nodeCount)` in edges.js: null (draw everything) while `edges ≤ 3.2/node`; beyond that, a Set of "src|tgt" keys = MAXIMUM spanning tree (Kruskal — guarantees every cluster stays connected, the "outer cluster connectivity" ask) + strongest extras to `1.8/node`. paintLink skips non-budget edges at rest but ALWAYS shows ego/gathered/hovered edges AND connectors (`connectorKeys(edges)`: top-2 edges per pair of strong-graph components, alpha floor 0.32 — cluster bridges must never fade into invisible islands) — detail on demand, skeleton at rest (LGL-style, literature-backed). Threads also render zoom-constant: dash `[0.5,3]/zs` and `width/zs` with `zs = max(1, globalScale)^0.85`, so zoomed-in threads stay fine dotted lines instead of blobs.

## Entrance (first load)

No physics flopping on load. Pre-settle the layout with `warmupTicks` ≈ 200 (engine runs before first paint) AND set `autoPauseRedraw={false}` — with warmup the engine can report stopped, and autoPause then freezes all painting until the first user interaction (symptom: blank page that springs to life on a wheel/drag). This scene animates every frame regardless, so auto-pausing is never wanted. `zoomToFit` right after mount (the tick-120 wait is obsolete once warmup pre-settles). Then float the memories in: for ~1.6s, each node paints at `settled + dir * 260 * (1 - easeOutCubic(p))` where `dir` = unit vector from the graph centroid (nodes drift inward from just outside), `p` = clamped progress with a per-node stagger (`hash01(id) * 0.5s`), alpha ramping 0→depth. Labels and interactions wait until the intro ends (skip hover/pointer paint while p < 1). Dust/nebula unaffected.

## Focus repel (selection breathing room)

While a memory is selected, its neighbors ease away to give it air. CRITICAL ENGINE GOTCHA: with `warmupTicks` set, force-graph's layout engine permanently stops after the synchronous warmup (`update()` pauses it; nothing restarts live ticking), so custom d3 forces for ambient motion NEVER run. All liveliness (home wobble ±6 world units, focus repel, restore-on-deselect) is instead driven from `onRenderFramePre`: each node eases (`0.035/frame`) toward a moving target = `home + wobble(t) [+ radial push]`, where push = `34 * (1 - dist/R)`, `R = 170`, computed from HOME positions (stable). Direct position easing, no velocities, skipped while a node is user-dragged (`fx != null` → rehome) and during the entrance float. Never register d3 forces expecting live ticks.

## Filter gather (constellation focus)

When ANY filter narrows the set (legend class toggle, attribute chips, year/month, or a query with matches), the matching memories drift toward the layout centroid and their mutual connections light up; removing filters lets them float home (the liveliness easing handles both directions for free):
- `gatherIds` = query highlightIds if non-null, else visibleIds when it's a strict subset of all memories, else null.
- Gathered targets PRESERVE the natural force-layout shape: subset compacted around its own centroid toward a COUNT-BASED target radius (`targetR = 34*sqrt(n)`, `shrink = min(0.8, targetR/spreadRMS)`) and recentered on the layout centroid — few matches huddle tight, many keep comfortable spread, independent of how scattered the matches originally were. (A phyllotaxis spiral was tried and scrapped: it scrambles neighbors, so every internal thread crosses the ball — chaos at 58 matches.) Overlap with dimmed "off" orbs is deliberately ignored. Gather easing 0.09/frame; wobble halves while gathered. Focus-repel distances are measured against BASE TARGETS (gathered or home) with R 120 while gathered, 170 otherwise — home-based distances are meaningless mid-gather.
- Edge boost: when both endpoints are gathered, `alpha = min(0.75, alpha*1.6 + 0.05)` (+0.2px) — brighter but the WEIGHT HIERARCHY stays intact (heavy pronounced, light faded, same as the unfiltered default; a flat boost flattened everything into spaghetti).

## Selected-node crosshair (canvas, not DOM)

The rotating dashed crosshair + gauges must track the NODE, not the viewport center — pans and zooms leave it glued to the memory until deselect. Ponytail answer: draw it in `nodeCanvasObject` for the selected node (world coords = free tracking):
- Rotating dotted ring at `r + 10`: `setLineDash([0.5, 3])`, rotation phase `t / 8000 * TAU` (slow, zen), peach.
- Four corner brackets just outside it, static.
- Two thin arc gauges: importance (n/5) and connections (n/maxConnections), dawn-gradient strokes, subtle tick marks.
- Small caption under the node: "IMPORTANCE n/5 · k/max LINKS" in the eyebrow style (9.5px upper, letter-spaced, paper @ 0.7).
- FocusHud.jsx keeps ONLY the detail card + ✕ (drop its SVG gauges/brackets entirely).

## Camera bounds

The cluster must never leave the screen: `minZoom 0.5`, `maxZoom 8` props, plus a gentle rubber-band — debounce (~250ms) on BOTH `onZoom` and `onZoomEnd` (gesture-end alone is unreliable for synthetic input), then clamp the camera center so ≥160 screen px of the node bbox stays visible: `cx ∈ [minX - w/2k + 160/k, maxX + w/2k - 160/k]` (same for y); if it moved >1 world unit, `centerAt(clamped, 300)`. NO guard flag: the clamped centerAt's own zoom events re-check and no-op once in bounds (self-terminating). A time-window guard once let rapid gestures escape; a bare bbox+120 clamp once let the cluster park invisibly at a screen corner.

## Detail card photo

`memory.photos` is an array. Hero = photos[0] as `<img>` (radius 14, slight tilt, object-fit cover, height 150), gradient placeholder when empty or onError. If photos.length > 1, a thumbnail strip below the hero (up to 4 thumbs, 48px, radius 8, 6px gap); clicking a thumb swaps it into the hero (local useState fine).

## Focus HUD (FocusHud.jsx)

On node click: `centerAt(node.x, node.y, 600)` + `zoom(3, 600)`, then an absolutely-positioned overlay:
- Two thin SVG arc gauges around the node: importance (n/5) and connection count (n/max). Stroke = dawn gradient, tick marks paper @ 0.35.
- Four dotted corner brackets around the node (same dash as edges).
- The close ✕ and the card must be clickable: if any HUD wrapper uses `pointer-events: none` (to let graph gestures pass through), interactive children must restore `pointer-events: auto`. ✕ calls the same deselect path as background click.
- Detail card: `max-height` capped so it NEVER overlaps the query bar (bottom-right panel) — e.g. `top: 24px; right: 24px; max-height: calc(100vh - 300px); overflow-y: auto` with a thin styled scrollbar. Long summaries scroll inside the card.
- Detail card to the side, dusk glass panel: photo (radius 14px, slight rotation), then sections in the site's card style — tiny UPPERCASE letter-spaced labels with a pastel square dot ("WHO WAS THERE", "FEELING", "MUSIC", "WHY"), people/feeling chips as themed translucent pills, summary in paper text.
- Click empty canvas: `zoom(1.2, 600)`, HUD unmounts.

## Verification gotcha (browser automation)

Chrome suspends requestAnimationFrame for HIDDEN tabs. An automation-driven background tab
renders NOTHING on the graph canvas (blank screenshots) even though the app is perfectly
healthy — the loop starts the moment the tab becomes visible. Before diagnosing "blank
canvas" bugs from automated screenshots, check `document.visibilityState === 'visible'`.
A whole afternoon went to this once.
