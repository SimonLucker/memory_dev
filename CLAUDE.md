# Memory Graph — project orchestration

A React + Vite prototype that visualizes personal memories as a force-directed graph. Interactions and layout follow the FuseLab "Control AI Policy Platform" concept video (force graph, left year timeline, bottom-left legend, bottom-right query bar, node-focus HUD). The visual design follows **memmory.vercel.app** — the product this is for: dusk plum/indigo scene, soft dawn-pastel accents (blue/peach/lavender), matte pastel orb nodes, and fine dotted gradient threads for edges. Tokens live in `.claude/skills/visual-style/SKILL.md`, sampled from the live site.

Nodes = memories. Edges = attributes two memories share (people, class, place, feeling, music). Everything is filterable.

## Ground rules (all agents)

- **Invoke the `ponytail` skill before writing any code.** Laziest solution that works. No speculative abstractions, no extra dependencies, no state libraries, no CSS frameworks.
- Stack is fixed: React + Vite + `react-force-graph-2d`. Nothing else unless a skill says so.
- Read the relevant `.claude/skills/*/SKILL.md` before implementing a feature — they contain the spec, design tokens, and algorithms.
- All derived data (edges, vocab, years) is computed client-side from `src/data/memories.json`. No backend.

## Target file layout

```
src/
  App.jsx              # composition + shared state (filters, selection, query)
  components/
    GraphView.jsx      # force graph canvas (skill: graph-view)
    Timeline.jsx       # left year rail + sparkline (skill: timeline)
    Legend.jsx         # bottom-left legend + filters (skill: legend-filters)
    QueryBar.jsx       # bottom-right stats + ask-a-question (skill: query-search)
    FocusHud.jsx       # node focus overlay (skill: graph-view)
  lib/
    edges.js           # edge derivation (skill: memory-schema)
    search.js          # local query parser (skill: query-search)
  data/memories.json   # sample data (skill: memory-schema)
  styles.css           # design tokens (skill: visual-style)
```

## Delegation map

| Task | Agent | Model |
|---|---|---|
| Graph canvas, node painting, physics, focus HUD | `graph-engine` | opus |
| Timeline, legend, query bar, stats, layout/CSS | `ui-panels` | sonnet |
| Data model, sample data, edge derivation, query parser | `data-wrangler` | sonnet |
| Review every diff before merge | `simplicity-reviewer` | opus |

## Definition of done (prototype)

`npm run dev` opens a page with the layout and interactions of the video but the *feel* of Memmory: a calm, meditative dusk space — soft plum haze with warm dawn glows, nothing harsh or techy. ~40 matte pastel orb memories clustered by connections and joined by fine dotted gradient threads, hover shows shared-attribute tooltip, click focuses a node with HUD + detail card, timeline filters by year, legend toggles classes, typing "all happy memories with Lisa" dims everything except happy memories involving Lisa.
