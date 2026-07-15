---
name: query-search
description: Spec for the bottom-right query bar — stats row, "Ask a question..." input, and the local (no-AI) query parser that maps natural language to attribute filters. Read before touching QueryBar.jsx or lib/search.js.
---

# Query bar & local search (bottom-right)

Dark glass panel like the video: stats row on top, pill-shaped input below, chip row at bottom.

## Stats row (video's KPI bar)

Four small stats derived from the *currently visible* memories: Memories (count), People (distinct), Top feeling, Avg importance (as %). Muted label over value, thin separators.

## Input

Pill input, placeholder "Ask a question...", circular dawn-gradient send button. Enter or click = run query. An "x" clears it. Bottom chip row: result count chip only, shown while a query is active (the "My memories" chip was removed by user request).

## Parser — parseQuery(text, vocab) in lib/search.js

No AI, no NLP library. Token matching against the data's own vocabulary:

1. Lowercase, strip punctuation, split on whitespace.
2. Drop stopwords: all, the, my, memories, memory, with, in, at, of, show, me, find, from, and, that, are etc. (small hardcoded list).
3. Match each remaining token against vocab (people, feelings, classes, places, artists). Also match multi-word vocab entries against the raw string (e.g. "sarah's house").
4. Year tokens: /^(19|20)\d{2}$/ → year filter.
5. Result: `{ filters: [{type:'feeling', value:'happy'}, {type:'who', value:'lisa'}], unmatched: [...] }`.

Example: "all happy memories with Lisa" → drop [all, memories, with] → happy = feeling, lisa = person → AND filter.

## Behavior

- Matching memories highlighted (white-hot glow per graph-view), everything else dimmed. Edges follow endpoints.
- Query filters AND with legend/timeline filters.
- Zero matches: input border warns amber, count chip "0 matches", graph untouched (nothing dims).
- `unmatched` tokens are silently ignored (they were probably filler words).

parseQuery must be a pure function — testable with `node -e` in isolation.
