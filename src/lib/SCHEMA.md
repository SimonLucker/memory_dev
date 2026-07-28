# Memory schema v2 and thread model

Data contracts for the v2.4 rebuild (design-foundation.md). All derivation is
client-side; persistence goes through `src/lib/api.js`.

## Memory (one object per memory, arrays per person in `src/data/memories*.json`)

Existing fields, unchanged:

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `m001`, `p2m014`. Unique per person space. |
| `class` | string | Theme. One of `Family`, `Friends`, `Travel`, `Work`, `Milestones`. |
| `when` | string | `DD-MM-YYYY HH:MM`. Parse with `whenToTs` in `thread.js`. |
| `what` | string | Short title. |
| `where` | string | Place name. |
| `who` | `[{id, name}]` | People, resolved to stable ids via `lib/people.js`. |
| `feeling` | `string[]` | Feeling chips. |
| `music` | `{name, artist}` | Optional. |
| `importance` | number | 1-3. |
| `photos` | `string[]` | Paths under `public/`. Optional. |
| `favorite` | boolean | Optional. |
| `_pos` | `[x, y]` | Optional. Graph position travels inside the memory. |
| `_pending` | boolean | Optional. Not yet persisted. |
| `why`, `summary` | string | Legacy v1 fields, kept for backward compat. Superseded by `about`. |

New in v2:

| Field | Type | Notes |
|---|---|---|
| `about` | string | The story: one or two factual sentences (spec 6.4.7). When missing, derive from `summary` + `why` (that is what `scripts/migrate-v2.mjs` did). |
| `videos` | `[{src, duration, poster?, demo?}]` | Optional. `duration` in seconds. `poster` is a photo path for the thumb. |
| `voice` | `[{src, duration, transcript?, demo?}]` | Optional voice notes. `duration` in seconds. `transcript` is background metadata, never shown as the message. |

`demo: true` marks seeded demo media whose `src` does not exist on disk (video
srcs under `videos/`, voice srcs under `voice/`). Players must degrade
gracefully: show the poster frame and duration for videos, render the voice row
(and transcript) even when the audio cannot load. Never block on missing media.

## Edges (`lib/edges.js`, spec 6.3, exact)

An edge exists only when two memories share a **person**, a **place** or a
**theme** (class). `weight` = number of shared link types (1, 2 or 3).
`deriveEdges` returns every qualifying edge; the renderer draws at most each
node's three strongest connections via `strongestEdges(nodeId, edges, n = 3)`.

## Thread message model (`lib/thread.js`)

One Capture thread per person, persisted to localStorage under
`memmory.thread.<personId>` (prototype only; swap the `save` helper for the
`api.js` backend when threads go real).

```
Message = {
  id: string,          // minted by appendMessage when missing
  ts: number,          // epoch ms
  kind: 'user-text' | 'user-photo' | 'user-voice' | 'keeper' | 'memory-card'
      | 'prompt' | 'on-this-day' | 'moment-start' | 'moment-end',
  ...payload           // by kind, e.g.:
  //  user-text:   { text, state?: 'sending'|'failed' }
  //  user-photo:  { src }        user-voice: { src, duration, transcript? }
  //  keeper:      { text }       memory-card: { memoryId }
  //  prompt:      { promptId, text, quickReplies }   (from keeper.js)
  //  on-this-day: { memoryId }   moment-start/end: { name }
}
```

API: `loadThread(personId)` · `appendMessage(personId, msg)` ·
`updateMessage(personId, id, patch)` · `monthKey(ts)` (sticky month groups) ·
`seedThreadFromMemories(personId, memories)` builds a plausible history (one
`memory-card` message at each memory's own date; no-op if a thread exists).

## Keeper engine (`lib/keeper.js`, spec 6.7 + 6.8)

`evaluate({personId, memories, now?})` returns at most ONE prompt or `null`.
The caller renders it, then MUST call `markShown(personId, prompt)` (that is
what the caps count) and `dismiss(personId, prompt)` on swipe or Later
(dismissed prompt ids never return). State lives in localStorage
`memmory.keeper.<personId>`.

Enforced caps: max 2 proactive per day · quiet hours 22:00-08:00 · check-in max
twice a week · coaching max once a day and never twice on the same memory ·
same place trigger never twice a week · question rotation without repeats
within a week · dismissed never repeats. On this day has its own cap (one card,
morning only, gone by noon) and does not count against the 2/day nudge budget.

Real triggers implemented: quiet check-in (evening, no capture today),
golden-moment coaching (photos without voice in the latest memory), On this day
(memory ~a year ago, +/- 3 days). Place/dwell triggers need location signals
the prototype does not have, so they exist only as demo fires.

Demo (prototype only): `window.__memmory.fireNudge(kind)` with kind
`'place' | 'dwell' | 'checkin' | 'coach'` queues that prompt for the next
`evaluate()`, skipping only the time-of-day gates. All caps still apply; a
blocked demo fire logs its reason to the console.

## Voice (`lib/voice.js`)

`startRecording()` → `{ stop() → Promise<{blobUrl, duration, blob}> }`, 60s
hard stop. `transcribe(blob)` posts to the api.js transcription backend
(Supabase edge function or the `/__ai/transcribe` dev middleware) and resolves
to the text or `null` on any failure; it never throws and never blocks capture.
