---
name: timeline
description: Spec for the left vertical year timeline with memory-density sparkline and year selection. Read before touching Timeline.jsx.
---

# Timeline (left rail)

Vertical rail fixed to the left edge, like the video's 2016–2024 column.

- Years: derived from data (`buildVocab` or a `yearsOf(memories)` helper) — min year → max year, evenly spaced top to bottom, muted grey 11px labels.
- Sparkline: one inline `<svg>` behind the labels — horizontal bars/ridges per month proportional to memory count that month (video shows a jagged density ridge hugging the edge). Muted grey, alpha 0.4.
- Selected year: pill outline around the label (dawn-gradient border, positioned like the video's "2020" pill) plus a small tick connecting to the rail.
- Interaction: click a year → App state `selectedYear`; graph highlights that year's memories and dims the rest; click again → deselect (null = all years).
- Optional (only if trivial): scroll-wheel over the rail steps through years.
- No library. One component, one svg, ~100 lines.
