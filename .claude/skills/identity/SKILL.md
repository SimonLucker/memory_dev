---
name: identity
description: Spec for the person-ID system — the people registry (lib/people.js), name→ID resolution with disambiguation, and the cross-profile share→accept flow. Read before touching lib/people.js, resolveWho/addMemory/acceptShare in App.jsx, the disambiguation picker in Memorialize.jsx, or the pending section in Vault.jsx.
---

# Identity & sharing (the ID-to-ID system)

People are first-class: a tagged person resolves to a **stable ID**, and tagging
a registered profile owner sends them the memory to accept into their own space.
Built 2026-07-22 as the first step toward real user accounts and push messages.

## Research grounding (why it's shaped this way)

- **Entity resolution best practice**: match deterministically on exact
  identifiers (full name / alias) and put a **human in the loop for ambiguous
  matches** instead of guessing — fuzzy auto-merge is where identity systems go
  wrong. Hence: exact alias table + a multiple-choice picker, no scoring.
- **Facebook's tag-review model**: content someone tags you in enters a
  **pending queue** and only appears in your space after you approve it. Hence:
  pending copies with Accept/Decline in the recipient's Vault, never silent
  insertion into their graph.

## The registry — `src/lib/people.js` (THE modular seam)

```js
REGISTRY = [
  { id: 'p1', name: 'Glenn' },
  { id: 'p2', name: 'Maya' },
  { id: 'p3', name: 'Simon Akkerman', aliases: ['simon a', 'simon akkerman'] },
  { id: 'p4', name: 'Simon Gullstrøm', aliases: ['simon g', 'simon gullstrom', 'simon gullstrøm'] },
]
```

- Registered person **id = profile id** (`PERSONS` in data/persons.js). That
  equality IS the ID-to-ID link: a `who` entry `{id:'p4'}` means "the actual
  person who owns space p4", not a per-profile minted contact.
- `resolvePerson(name)` → `{match}` (lowercased trimmed name equals a full name
  or alias) | `{ambiguous: [candidates]}` (equals the first name of 2+
  registered people, e.g. "simon") | `null` (unregistered — falls back to the
  old per-profile directory in `resolveWho`, which reuses or mints `p01`-style
  contact ids).
- `firstName(name)` helper; the app is first-name basis everywhere except the
  switcher (`short` field on PERSONS: "Simon A" / "Simon G").
- **Upgrade path**: swap REGISTRY for a server table (real user ids, emails,
  push tokens); keep `resolvePerson`'s contract and nothing else changes.

## Resolution & disambiguation

- `App.resolveWho` checks `resolvePerson` FIRST (registry beats the local
  directory), then dedupes by id — "Simon G" + "Simon Gullstrøm" in one memory
  is one person.
- Memorialize draft card: any who-name that resolves ambiguous renders a
  "Which Simon?" row (song-check styling) with chip buttons — one per candidate,
  "(you)" suffix on the active profile, plus "Someone else" (keeps the plain
  name, resolved-as-is via a local Set). **Save is disabled until every name is
  resolved.** Picking rewrites the name in draft state; actual id assignment
  still happens in resolveWho at save.
- Ceiling (accepted): the FocusHud edit path has no picker — an ambiguous bare
  "Simon" typed there falls through to old directory behavior.

## Share → accept

- `App.addMemory`, after minting the author's memory: for each `who` entry
  whose id is a registered profile (`memMap[w.id]` exists) and ≠ author, mint a
  copy into that space: recipient's own id sequence, **`who` flipped** (the
  sharer replaces the recipient — in your copy of the memory, the sharer is who
  was there), `_pos` removed, `_pending: { from: 'Simon Akkerman' }`. Persisted
  via the normal `api.upsertMemory(recipientId, copy)` — works identically on
  Supabase and the dev JSON backend; no schema change.
- Pending memories are **invisible everywhere** except the Vault inbox:
  `memories = all.filter(m => !m._pending)` feeds cortex/edges/stats/counts;
  `pending` goes only to Vault.
- Vault: "Shared with you" section above the list (hidden while searching or
  fav-filtering) — vault-card markup + `from <name>` + Accept / Decline
  (`.ghost-btn`). Accept (`App.acceptShare`): drop `_pending`, set
  `_from: <sharer name>`, seed `_pos` via the shared `seedPos` helper, upsert.
  Decline = `deleteMemory`. Accepted cards show `· shared by <_from>` in the
  meta line (Vault + FocusHud).
- Badges: PersonSwitch chips and the mobile person menu show a `.pending-dot`
  count (dawn gradient, dark ink); person counts exclude pending.
- No live push yet: the recipient sees shares after app open/reload (Supabase
  load-on-start). Push notifications are what the registry upgrade is for.

## Known ceilings (ponytail comments in App.jsx)

- Counter-minted copy ids can collide across concurrent sessions → real
  per-user id service later.
- Sharing is **create-only**: tagging a registered person via the FocusHud edit
  pencil links the id but does not send a copy — revisit with real accounts.
- Anyone can open any profile (no auth) — acceptable for the POC demo.
