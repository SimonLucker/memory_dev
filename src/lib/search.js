// Local (no-AI) query parser + filters. Pure functions, no deps.

const STOPWORDS = new Set([
  'all', 'the', 'my', 'memories', 'memory', 'with', 'in', 'at', 'of', 'show',
  'me', 'find', 'from', 'and', 'that', 'are', 'a', 'an', 'is', 'was', 'were',
  'for', 'to', 'about', 'any',
]);

const YEAR_RE = /^(19|20)\d{2}$/;

function wordsOf(str) {
  return str.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

// parseQuery: lowercase + strip punctuation, drop stopwords, match remaining
// tokens (and multi-word vocab entries against the raw string) to produce
// attribute filters. { filters: [{type, value}], unmatched: [...] }
export function parseQuery(text, vocab) {
  const rawLower = (text || '').toLowerCase();
  const tokens = wordsOf(rawLower).filter((t) => !STOPWORDS.has(t));

  const filters = [];
  const seen = new Set();
  const consumed = new Set();

  function addFilter(type, value) {
    const key = `${type}:${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      filters.push({ type, value });
    }
  }

  const categories = [
    ['people', 'who'],
    ['classes', 'class'],
    ['places', 'where'],
    ['feelings', 'feeling'],
    ['artists', 'artist'],
  ];

  for (const [vocabKey, filterType] of categories) {
    for (const entry of (vocab && vocab[vocabKey]) || []) {
      if (entry.includes(' ')) {
        if (rawLower.includes(entry)) {
          addFilter(filterType, entry);
          wordsOf(entry).forEach((w) => consumed.add(w));
        }
      } else if (tokens.includes(entry)) {
        addFilter(filterType, entry);
        consumed.add(entry);
      }
    }
  }

  for (const token of tokens) {
    if (YEAR_RE.test(token)) {
      addFilter('year', token);
      consumed.add(token);
    }
  }

  const unmatched = tokens.filter((t) => !consumed.has(t));

  return { filters, unmatched };
}

// memoryMatches: does a single memory satisfy a single filter?
export function memoryMatches(memory, filter) {
  const value = filter.value;
  switch (filter.type) {
    case 'who':
      return (memory.who || []).some((p) => p.name.toLowerCase() === value);
    case 'feeling':
      return (memory.feeling || []).some((f) => f.toLowerCase() === value);
    case 'class':
      return (memory.class || '').toLowerCase() === value;
    case 'where':
      return (memory.where || '').toLowerCase() === value;
    case 'artist':
      return ((memory.music && memory.music.artist) || '').toLowerCase() === value;
    case 'year':
      return memory.when.slice(6, 10) === String(value);
    default:
      return false;
  }
}

// filterMemories: memories matching ALL filters (AND).
export function filterMemories(memories, filters) {
  if (!filters || filters.length === 0) return memories;
  return memories.filter((m) => filters.every((f) => memoryMatches(m, f)));
}
