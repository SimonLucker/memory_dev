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
