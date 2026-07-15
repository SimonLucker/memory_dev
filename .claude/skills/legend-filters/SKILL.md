---
name: legend-filters
description: Spec for the bottom-left legend (class colors, counts, visibility toggles) and the attribute filter system (people, places, feelings, music — everything filterable). Read before touching Legend.jsx or filter state.
---

# Legend & filters (bottom-left)

Dark glass panel, top-left header "LEGEND", like the video.

## Class rows

One row per memory class: colored orb dot (CSS radial-gradient) + count chip + class name.
- Click row → toggle that class's visibility. Hidden class: row text dimmed to alpha 0.4 (exactly how the video dims "Services"/"Regulations"), and its nodes/edges dim in the graph.
- Counts always reflect the *unfiltered* dataset.

## Everything filterable

Below the class rows, two summary rows in video style (icon + label + % chip):
- "People" and "Feelings" rows showing count of currently active filters, expandable (simple `<details>` or a toggled div — laziest thing) into chip lists: every person / place / feeling / artist from `buildVocab`. Clicking a chip toggles it as a filter.
- Filter logic lives in App.jsx: a memory is visible iff its class is enabled AND it matches every active attribute filter (AND semantics). Query-bar matches (see query-search) combine with these the same way.
- Active chips: class-accent border (visual-style theme accents). No filter = everything visible.

Keep it one component + App state `{hiddenClasses:Set, filters:[{type,value}]}`. No context, no reducer.
