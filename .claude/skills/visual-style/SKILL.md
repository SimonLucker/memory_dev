---
name: visual-style
description: Design tokens sampled live from memmory.vercel.app (the product this prototype is for). Colors, edge/thread recipe, panels, typography. Every component must use these values. Read before writing any CSS or canvas colors.
---

# Visual style — Memmory design language

Sampled from the real site's computed CSS. Keep the FuseLab video's *layout and interactions* (graph, left timeline, legend, query bar, focus HUD) but skin everything in Memmory's language: a dark "dusk" scene, soft dawn-pastel accents, fine dotted gradient threads. The target feel is a zen, meditative space — dreamy and warm, like drifting through your own memories at dusk. Not a tech dashboard: no neon, no teal, no gold, no hard edges; slow soft transitions, generous negative space, everything slightly hazy.

## Scene (dusk — the app's own dark mode, from the memory-card mock)

- Background: `linear-gradient(168deg, #443A62 0%, #2F2545 46%, #16111F 100%)`
  plus two soft radial glows: peach `rgba(245,214,188,0.22)` bleeding from the top, purple `rgba(196,152,203,0.20)` from the bottom. Never flat black.
- Text on dusk: paper `#F2F0EC`; muted `rgba(242,240,236,0.55)`.
- Light-mode tokens (for reference/chips only): cream `#FAF7F2`, paper `#F2F0EC`, ink `#1F2937`, ink-deep `#111827`.

## The dawn gradient (brand signature)

`linear-gradient(165deg, #C8D4EC 0%, #F5D6BC 56%, #E0C5DC 100%)` — blue → peach → pink-lavender. Use it for the query send button, active highlights, and edge strokes (below).

## Theme accents (5 pastels, from the site's --th/--tb/--tbd vars)

| class | accent | translucent fill | border |
|---|---|---|---|
| Travel | `#9DB4DE` blue | `rgba(125,155,212,0.16)` | `rgba(150,175,225,0.32)` |
| Work | `#62C088` green | `rgba(70,170,112,0.15)` | `rgba(95,190,135,0.34)` |
| Friends | `#ECB890` peach | `rgba(236,176,132,0.16)` | `rgba(240,190,155,0.34)` |
| Milestones | `#C79BCB` purple | `rgba(190,130,200,0.17)` | `rgba(205,150,210,0.34)` |
| Family | `#D29DAE` rose | `rgba(214,150,170,0.16)` | `rgba(224,165,182,0.34)` |

## Edges = threads (exact recipe from the site's cluster SVG)

Memmory draws connections as fine dotted curved threads, not solid lines:

- Curved paths (quadratic Bézier — use `linkCurvature ≈ 0.2` in force-graph).
- `lineWidth 1.3`, `lineCap round`, dash `setLineDash([0.5, 3])` (1px dots), `globalAlpha 0.30`.
- Stroke is a linear gradient along the line from source to target with the dawn stops `#9DB4DE → #ECB890 → #C79BCB` (`ctx.createLinearGradient(x1,y1,x2,y2)`).
- Weight variants: strong (weight ≥ 5) 1.8px @ alpha 0.55 using the saturated stops `#5681CC → #E68A45 → #A451BE`; medium 1.3px @ 0.30; weak 1.0px @ 0.20. Dimmed edges: alpha 0.06.

## Nodes (Memmory version of the orbs)

Soft matte pastel spheres, not glossy metal:
- Radial gradient: white-tinted accent (mix ~55% toward #fff) at top-left → class accent → accent darkened ~25% at edge.
- Faint glow: `shadowBlur 12`, shadowColor = accent, only on hover/highlight bump to 22 with a cream `#F5D6BC` tinge.
- 1px ring `rgba(242,240,236,0.35)` at r+1.5.
- Highlighted (query match): near-white core like the site's white node dots, accent halo.
- Dimmed: `globalAlpha 0.10`, no glow.

## Panels, cards, chips

- Dusk glass panel (legend, query bar, HUD card, tooltips): `rgba(255,255,255,0.07)`, border `1px solid rgba(255,255,255,0.14)`, radius 16px, `backdrop-filter: blur(8px)`.
- Themed inner panels (detail card sections): the translucent fill + border pair of the class, radius 14px.
- Chips: pill radius 999px, small pastel dot (10px, radius 4px — slightly squircle) + label. On dusk: themed translucent chip; active chip uses the accent border at full opacity.
- Shadows are soft and low: `rgba(17,24,39,0.06) 0 8px 24px`.
- Photo thumbnails: radius 14-20px, slight rotation (-3° to 3°) for the scattered-polaroid feel.

## Typography

- System sans stack (SF Pro look): `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Section/eyebrow labels: 9.5-11px, UPPERCASE, letter-spacing 1.5-2px, preceded by a small pastel square dot — used for legend header, HUD sections, timeline years.
- Node labels on canvas: 10px sans, paper #F2F0EC; counts/badges in dark pill `rgba(0,0,0,0.45)`.
- Headlines (empty states etc.): bold, tight, ink on light / paper on dusk.

## Misc

- iMessage blue `#0A84FF`: reserve for the query input send state / user-typed chips (the "you said this" color).
- Play/positive green: `#34C759`.
- Timeline sparkline: paper at alpha 0.35; selected year pill: dawn-gradient border.

One `styles.css` with all of these as CSS custom properties, mirrored in a tiny `lib/palette.js` for canvas code so CSS and canvas never drift.
