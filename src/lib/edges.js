// Pure data-derivation functions for the memory graph. No React, no deps.

// deriveEdges — the spec 6.3 formula, exact:
// an edge exists ONLY when two memories share at least one of: a person, a
// place, a theme (class). Weight = the NUMBER OF SHARED LINK TYPES (1, 2 or 3).
// Derivation returns every qualifying edge; the renderer caps display at each
// node's three strongest connections via strongestEdges().
// `shared` lists the shared values for tooltips/HUD.
export function deriveEdges(memories) {
  const edges = []
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const a = memories[i]
      const b = memories[j]
      const shared = []
      let weight = 0

      const bWho = b.who || []
      const people = (a.who || []).filter((p) => bWho.some((q) => q.id === p.id))
      if (people.length) {
        weight++
        for (const p of people) shared.push({ type: 'who', value: p.name })
      }
      if (a.where && a.where === b.where) {
        weight++
        shared.push({ type: 'where', value: a.where })
      }
      if (a.class && a.class === b.class) {
        weight++
        shared.push({ type: 'class', value: a.class })
      }

      if (weight > 0) edges.push({ source: a.id, target: b.id, weight, shared })
    }
  }
  return edges
}

// Force-graph libraries mutate source/target from id strings into node objects.
const endId = (end) => (end && typeof end === 'object' ? end.id : end)

// The n strongest edges touching a node — spec 6.3: each node renders at most
// its three strongest connections.
export function strongestEdges(nodeId, edges, n = 3) {
  return edges
    .filter((e) => endId(e.source) === nodeId || endId(e.target) === nodeId)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, n)
}

// The lowercase attribute vocabulary parseQuery (lib/search.js) matches against.
export function buildVocab(memories) {
  const uniq = (a) => [...new Set(a.filter(Boolean))]
  return {
    people: uniq(memories.flatMap((m) => (m.who || []).map((p) => p.name.toLowerCase()))),
    classes: uniq(memories.map((m) => (m.class || '').toLowerCase())),
    places: uniq(memories.map((m) => (m.where || '').toLowerCase())),
    feelings: uniq(memories.flatMap((m) => (m.feeling || []).map((f) => f.toLowerCase()))),
    artists: uniq(memories.map((m) => (m.music?.artist || '').toLowerCase())),
  }
}

