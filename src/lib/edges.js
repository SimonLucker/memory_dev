// Pure data-derivation functions for the memory graph. No React, no deps.

// deriveEdges: for every pair of memories, sum shared-attribute weights.
// Prune to keep the graph readable: keep an edge iff weight >= 6 (strong on
// its own) OR it's one of either endpoint's top-2 edges by weight (so every
// node keeps its best connections even if none hit the strong threshold).
export function deriveEdges(memories) {
  const candidates = [];

  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const a = memories[i];
      const b = memories[j];
      const shared = [];
      let weight = 0;

      // shared people, 3 each
      const bWho = b.who || [];
      for (const person of a.who || []) {
        if (bWho.some((p) => p.id === person.id)) {
          weight += 3;
          shared.push({ type: 'who', value: person.name });
        }
      }

      // same place, 2
      if (a.where && a.where === b.where) {
        weight += 2;
        shared.push({ type: 'where', value: a.where });
      }

      // same class, 1
      if (a.class && a.class === b.class) {
        weight += 1;
        shared.push({ type: 'class', value: a.class });
      }

      // feeling overlap, 1 each
      const bFeelings = b.feeling || [];
      for (const feeling of a.feeling || []) {
        if (bFeelings.includes(feeling)) {
          weight += 1;
          shared.push({ type: 'feeling', value: feeling });
        }
      }

      // same music artist, 1
      if (a.music && b.music && a.music.artist && a.music.artist === b.music.artist) {
        weight += 1;
        shared.push({ type: 'artist', value: a.music.artist });
      }

      if (weight > 0) {
        candidates.push({ source: a.id, target: b.id, weight, shared });
      }
    }
  }

  // top-2 edges (by weight) touching each node, so every node stays connected
  const byNode = new Map();
  for (const edge of candidates) {
    for (const id of [edge.source, edge.target]) {
      if (!byNode.has(id)) byNode.set(id, []);
      byNode.get(id).push(edge);
    }
  }
  const keep = new Set();
  for (const list of byNode.values()) {
    list.sort((a, b) => b.weight - a.weight);
    for (const edge of list.slice(0, 2)) keep.add(edge);
  }

  return candidates.filter((edge) => edge.weight >= 6 || keep.has(edge));
}

function uniqueLower(values) {
  return [...new Set(values.filter(Boolean).map((v) => v.toLowerCase()))];
}

// buildVocab: distinct, lowercased values used by the query parser and filter chips.
export function buildVocab(memories) {
  const people = [];
  const classes = [];
  const places = [];
  const feelings = [];
  const artists = [];

  for (const m of memories) {
    for (const person of m.who || []) people.push(person.name);
    classes.push(m.class);
    places.push(m.where);
    for (const feeling of m.feeling || []) feelings.push(feeling);
    if (m.music && m.music.artist) artists.push(m.music.artist);
  }

  return {
    people: uniqueLower(people),
    classes: uniqueLower(classes),
    places: uniqueLower(places),
    feelings: uniqueLower(feelings),
    artists: uniqueLower(artists),
  };
}

// yearsOf: sorted list of distinct years present in the data.
export function yearsOf(memories) {
  const years = memories.map((m) => Number(m.when.slice(6, 10)));
  return [...new Set(years)].sort((a, b) => a - b);
}

// Edge budget for readability at scale (LGL-style): when a graph is edge-dense, show only
// a skeleton = MAXIMUM spanning tree (guarantees every cluster stays connected) plus the
// strongest remaining edges up to ~1.8 per node. Returns a Set of "source|target" keys,
// or null when the graph is sparse enough to show everything (small graphs untouched).
export function edgeBudget(edges, nodeCount) {
  // Per-node allowance DECAYS with scale: anchored at 3.0/node for a 40-memory graph
  // (proven readable and fast), falling with sqrt(n) to a floor of 1.6/node so huge
  // graphs stay light. 40→3.0, 100→1.9, 241→1.6.
  const perNode = Math.min(3.0, Math.max(1.6, 3.0 * Math.sqrt(40 / nodeCount)));
  const budget = Math.round(nodeCount * perNode);
  if (edges.length <= budget * 1.1) return null; // sparse enough — draw everything
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
    return x;
  };
  const sorted = [...edges].sort((a, b) => b.weight - a.weight);
  for (const e of sorted) { parent.set(e.source, e.source); parent.set(e.target, e.target); }
  const keep = new Set();
  // Kruskal, maximizing weight: the strongest tree that spans every component.
  for (const e of sorted) {
    const rs = find(e.source);
    const rt = find(e.target);
    if (rs !== rt) { parent.set(rs, rt); keep.add(e.source + '|' + e.target); }
  }
  // Fill with the strongest non-tree edges up to the budget.
  for (const e of sorted) {
    if (keep.size >= budget) break;
    keep.add(e.source + '|' + e.target);
  }
  return keep;
}

// Connector edges: the bridges between clusters. Clusters = connected components of the
// "strong graph" (edges with weight >= strongMin). Any edge joining two different strong
// components is a connector; keep the top 2 by weight per component pair. These must
// never fade to invisibility — without them the graph reads as disconnected islands
// even though the connections exist.
export function connectorKeys(edges, strongMin = 6) {
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
    return x;
  };
  for (const e of edges) {
    if (!parent.has(e.source)) parent.set(e.source, e.source);
    if (!parent.has(e.target)) parent.set(e.target, e.target);
  }
  for (const e of edges) {
    if (e.weight >= strongMin) {
      const a = find(e.source);
      const b = find(e.target);
      if (a !== b) parent.set(a, b);
    }
  }
  const pairs = new Map(); // "compA~compB" -> edges sorted by weight
  for (const e of edges) {
    const a = find(e.source);
    const b = find(e.target);
    if (a === b) continue;
    const key = a < b ? a + '~' + b : b + '~' + a;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(e);
  }
  const keep = new Set();
  for (const list of pairs.values()) {
    list.sort((x, y) => y.weight - x.weight);
    for (const e of list.slice(0, 2)) keep.add(e.source + '|' + e.target);
  }
  return keep;
}
