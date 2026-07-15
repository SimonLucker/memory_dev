---
name: timeline
description: Spec for the left vertical year timeline with memory-density sparkline and year selection. Read before touching Timeline.jsx.
---

# Timeline (left rail)

Vertical rail fixed to the left edge, like the video's 2016–2024 column.

- Years: derived from data (`buildVocab` or a `yearsOf(memories)` helper) — min year → max year, evenly spaced top to bottom, muted grey 11px labels.
- Month ridge (v2): one inline `<svg>` — a continuous vertical line running from the first year to the last. For each month, the line's x-offset protrudes RIGHT into the screen proportional to that month's memory count (`x = 6 + count * 9`px, count 0 = flush on the base line). Smooth the path (simple quadratic joins are enough). On top of the path, draw a dot at every month that has ≥1 memory (`r = 2 + count`, capped 6), paper-colored, alpha 0.7, with a `<title>` tooltip like "Mar 2021 · 3 memories".
- **Dots must sit exactly ON the line** — render them as `<circle>`s in the SAME svg coordinate space as the path, and make the path actually pass through each month point (Catmull-Rom→bezier through the points, NOT quadratic-through-midpoints smoothing, which cuts corners so peaks miss their dots). Note the svg is stretched (`preserveAspectRatio="none"`), so HTML-overlay dots can never line up — everything in one svg.
- **Clickable months**: each dot is a click target (`pointer-events: all`, generous invisible hit radius ~8px): clicking calls `onSelectMonth({ year, month })`; clicking the active month again clears it. Month selection filters the graph like year selection (App owns the state; year-click clears month, month-click clears year). Active dot: dawn-gradient ring. Dawn-gradient stroke for the line at alpha 0.5.
- The rail widens to ~96px to give the ridge room — the legend must move right accordingly (legend `left` ≥ rail width + 16px). Month order: years descending? No — top = earliest year (keep current order).
- Selected year: pill outline around the label (dawn-gradient border, positioned like the video's "2020" pill) plus a small tick connecting to the rail.
- Interaction: click a year → App state `selectedYear`; graph highlights that year's memories and dims the rest; click again → deselect (null = all years).
- Optional (only if trivial): scroll-wheel over the rail steps through years.
- No library. One component, one svg, ~100 lines.
