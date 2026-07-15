---
name: memory-schema
description: The memory JSON schema, sample data generation rules, and the edge derivation algorithm (edges = shared attributes). Read before touching memories.json or lib/edges.js.
---

# Memory schema & edges

## Schema (one memory)

```json
{
  "id": "m001",
  "class": "Friends",
  "when": "20-07-2026 22:30",
  "what": "Friends gathering",
  "where": "Sarah's house",
  "why": "Sarah's Birthday",
  "who": [{"id": "p01", "name": "Sarah"}, {"id": "p02", "name": "Nick"}],
  "feeling": ["Happy", "Nostalgic"],
  "music": {"name": "Song Name", "artist": "Artist"},
  "photos": ["photos/m001.jpg", "photos/m001_2.jpg"],
  "summary": "One-sentence auto summary.",
  "importance": 4
}
```

- `when` is `DD-MM-YYYY HH:mm`. Parse with string split, no date library. Year = `when.slice(6,10)`.
- `feeling` is an array (video schema shows "Happy - Nostalgic").
- `summary` and `importance` are marked auto-generated in the source schema — fill them in sample data anyway.
- `importance` 1–5 → node radius.
- `photos` is an ARRAY (0..n paths under public/photos/). UI: first photo is the hero; extras render as a thumbnail strip; gradient placeholder when empty. scripts/fetch-photos.mjs seeds one per memory; scripts/add-photos.mjs adds more (`node scripts/add-photos.mjs m001:4 m007:3` or `--spread N`).

## Sample data rules (memories.json)

- ~40 memories, dates spread 2016–2026, uneven per year (makes the timeline sparkline interesting).
- Classes and counts roughly: Friends 12, Family 10, Travel 8, Work 6, Milestones 4. Class = node color (see visual-style).
- Person pool of ~12 recurring names (Sarah, Nick, Lisa, Mom, Dad, Emma, Tom, ...). Reuse people across memories so clusters form. Lisa must appear in several memories with feeling "Happy" (the demo query is "all happy memories with Lisa").
- ~10 recurring places, ~8 feelings (Happy, Nostalgic, Proud, Excited, Calm, Grateful, Sad, Bittersweet), music artists occasionally repeated.

## Edge derivation — deriveEdges(memories)

For every pair of memories, collect shared attributes:

| shared | weight each | edge type |
|---|---|---|
| person in `who` | 3 | strong |
| same `where` | 2 | medium |
| class equal | 1 | weak |
| feeling overlap | 1 per feeling | weak |
| same music artist | 1 | weak |

- Sum weights. v2 pruning (v1's ≥2 threshold produced 243 edges for 40 nodes — an unreadable near-clique): keep an edge iff `weight >= 6` OR it is one of either endpoint's top-2 edges by weight (keeps every node connected). Measured on the v1 dataset this floor yields ~120 edges. Target 80–130 for ~40 nodes.
- Edge object: `{ source, target, weight, shared: [{type, value}, ...] }`. The `shared` list is user-facing ("what these memories have in common").
- Also export `buildVocab(memories)` → `{ people:[], classes:[], places:[], feelings:[], artists:[] }` (lowercased) for the query parser and filter chips.


## Multi-person (Phase: scale test)

- `src/data/persons.js` is the manifest: `[{ id: 'p1', name: 'Simon', memories: <import memories.json> }, { id: 'p2', name: 'Maya', memories: <import memories-p2.json> }]`.
- Person 2 ("Maya", world traveler): 241 memories, ids `p2m001`–`p2m241`, years 2016–2026, class mix Travel 95 / Friends 65 / Work 35 / Family 30 / Milestones 16. Own people pool (~28), places (~35, global cities), same 8-feeling set + "Free". Photos start empty; the photo CLIs accept `--person p2` (targets memories-p2.json, photo files keep the memory-id prefix so both persons share public/photos/).
- Switching persons swaps the whole memories array — every derived structure (edges, vocab, years, counts) recomputes; selection/filters/query reset. All App memos must depend on the active memories.
- The switcher is a top-right dusk-glass pill (both names, dawn-gradient highlight on the active one). The focus card starts below it (top offset ~68px).

## Editing (prototype persistence)

The memory card has a ✎ button: edit mode exposes what/where/why/summary/importance. Saving
updates App state (memories are useState seeded from the JSON — every derived structure
recomputes) and POSTs the person's full array to `/__save-memories`, a dev-server middleware
(vite.config.js) that writes the source JSON back to disk. The vite watcher ignores
`src/data/memories*.json` so saves don't trigger a full reload. Production builds have no
endpoint — the fetch fails gracefully and edits stay in-memory. Layout is NOT recomputed on
edit (positions stay stable); re-run scripts/compute-layout.mjs if edits change edges enough
to matter. In-place edits must NOT replay the entrance float (GraphView firstDataRef guard).
