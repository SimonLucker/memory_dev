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
  "photo": "photos/m001.jpg",
  "summary": "One-sentence auto summary.",
  "importance": 4
}
```

- `when` is `DD-MM-YYYY HH:mm`. Parse with string split, no date library. Year = `when.slice(6,10)`.
- `feeling` is an array (video schema shows "Happy - Nostalgic").
- `summary` and `importance` are marked auto-generated in the source schema — fill them in sample data anyway.
- `importance` 1–5 → node radius.
- `photo` may be a placeholder path; UI shows a colored placeholder block if missing.

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
