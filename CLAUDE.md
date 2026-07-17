# Memory Graph — project orchestration

A React + Vite prototype that visualizes personal memories as a force-directed graph. Interactions and layout follow the FuseLab "Control AI Policy Platform" concept video (force graph, left year timeline, bottom-left legend, bottom-right query bar, node-focus HUD). The visual design follows **memmory.vercel.app** — the product this is for: dusk plum/indigo scene, soft dawn-pastel accents (blue/peach/lavender), matte pastel orb nodes, and fine dotted gradient threads for edges. Tokens live in `.claude/skills/visual-style/SKILL.md`, sampled from the live site.

Nodes = memories. Edges = attributes two memories share (people, class, place, feeling, music). Everything is filterable.

## Version control

Repo: https://github.com/SimonLucker/memory_dev.git (remote `origin`). **After every completed and verified iteration** (feature landed, bug fixed, review passed), the orchestrator commits with a Conventional Commits message — terse, imperative, why over what, no AI attribution. One commit per completed unit of work, not per file. The orchestrator cannot push (no GitHub auth in the sandbox); remind Simon to `git push` after committing.

## Ground rules (all agents)

- **Invoke the `ponytail` skill before writing any code.** Laziest solution that works. No speculative abstractions, no extra dependencies, no state libraries, no CSS frameworks.
- Stack is fixed: React + Vite + `react-force-graph-2d`. Nothing else unless a skill says so.
- Read the relevant `.claude/skills/*/SKILL.md` before implementing a feature — they contain the spec, design tokens, and algorithms.
- All derived data (edges, vocab, years) is computed client-side from `src/data/memories.json`. The only server pieces are dev-only vite middlewares (`vite.config.js`): JSON/layout persistence, photo upload, and the AI proxy (Azure OpenAI chat + Deepgram transcription; keys in `.env`, see `.env.example`; mock chat when no key). Later target: Supabase (Postgres + storage + edge functions) behind the same fetch paths.

## Target file layout

## POC pipeline (early fall)

Three views, switched by the top-center pills, in pipeline order **Memorialize → Vault → Cortex**; one shared memories state in App feeds all three:

- **Memorialize** (`components/Memorialize.jsx`): chat guide (photo / voice / text in, one clarifying question at a time) that ends in a memory-JSON draft card → "Save to vault" appends it via `App.addMemory` (id minted, who-names resolved, graph position seeded near strongest neighbours, persisted to JSON + layout file).
- **Vault** (`components/Vault.jsx`): scannable card list of all memories, newest first, text filter; freshly memorialized card is highlighted; click opens the memory in the Cortex.
- **Cortex**: the existing graph.

```
src/
  App.jsx              # composition + shared state (filters, selection, query, views, pipeline)
  components/
    Memorialize.jsx    # memorialization chat (create memories)
    Vault.jsx          # memory vault list
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
