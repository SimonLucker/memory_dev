---
name: vault
description: Spec for the Memory Vault — the scannable card list (search, order-by, favorites, two-tap delete, fresh-memory highlight, photo→lightbox). Read before touching Vault.jsx.
---

# Memory Vault (Vault.jsx)

The middle stop of the pipeline (Memorialize → **Vault** → Cortex): every memory as a calm, scannable card. Newest first by default. Click a card → `onOpen(id)` opens it in the Cortex (App's `openInCortex`: selects the node, switches to `cortex`).

Props: `{ memories, newId, onOpen, onFav, onDelete, onPhoto, onPlay }`. No local memory copy — it reads App state and calls back up.

## Card anatomy

`<article className="vault-card">`, three columns:
- **Photo** (left): `m.photos[0]` as `<img className="vault-photo">` (`loading="lazy"`). No photos → `.placeholder` div with a `linear-gradient(145deg, accent55, accent22)` wash. Tapping the photo `stopPropagation()`s and calls `onPhoto(m.photos, 0)` (lightbox) — it must NOT open the card.
- **Body** (center): title row (class-color `.dot` + `<strong>{what}</strong>` + right-aligned `prettyWhen`), meta line (`where · feelings.join(', ')`), summary paragraph, then chips — one `.chip` per person, plus a `.chip.music` play button (`▶ {name}`, `stopPropagation` → `onPlay(m.music)`).
- **Side** (right): ♥ favorite button, a 5-pip importance meter (`.vault-imp`, each pip `opacity 0.9`/`0.18` by importance, tinted with the class accent — hidden on phones), and the delete button.

`accent = CLASS_COLORS[m.class] || '#9DB4DE'` (dawn blue fallback). Every card click bubbles to `onOpen` — every interactive child (photo, music, ♥, delete) MUST `e.stopPropagation()`.

## Time helpers (no date library)

`when` is `DD-MM-YYYY HH:mm` (see memory-schema). `sortKey(w) = year+month+day+time` slice-concatenated into a lexicographically sortable string. `prettyWhen` → "Jul 19, 2026". Never reach for a date lib.

## Search filter

`.vault-search` free-text box. Case-insensitive substring over the joined blob of `what, where, why, summary, class, feelings, people names, music name+artist` (`.filter(Boolean)` drops missing fields). Empty query → whole pool.

## Order-by system (`ORDERS` + `GROUP_KEYS`)

A `<select className="order-select">` with 7 orders. Two axes:
- **Time orders** (`new`, `old`): one unlabelled group. `new` = the base newest-first sort; `old` = `[...found].reverse()` (cheaper than re-sorting).
- **5 attribute groupings** (`class`, `people`, `feeling`, `music`, `place`): `GROUP_KEYS[order](m)` returns the group label(s) a memory belongs to. Results become alphabetical labelled sections (`.vault-group` header + count).

Rules baked into `GROUP_KEYS` and the group sort:
- **Multi-value duplication**: `people` and `feeling` return an ARRAY — the memory is listed under EVERY person / EVERY feeling it carries. A gathering with Sarah + Nick appears in both the "Sarah" and "Nick" sections. Single-value orders (`class`, `music`, `place`) return a one-element array.
- **"No …" fallbacks**: empty attribute → a `'No category' / 'No one tagged' / 'No feeling' / 'No music' / 'No place'` bucket. These SINK LAST — the group sort keys on `label.startsWith('No ')` first (`an - bn`), then `localeCompare`. Every "No …" section renders after all real ones.
- `music` groups by `artist || name || 'No music'`.

Base ordering feeding all of this is always newest-first (`found` sorts before grouping), so within a section cards stay chronological-ish by insertion.

## Favorites filter + heart

`onFav(id)` toggles `m.favorite` (App writes `{...m, favorite: !m.favorite}` and persists). The ♥ side-button reflects state via `.fav-btn.on`. Header has a `.fav-filter` toggle showing the favorite count (`favCount` off the FULL list, not the filtered pool — the badge is a stable total). When `favOnly`, the pool is pre-filtered to `m.favorite` before search. Empty states differ: favorites-on → "No favorites yet — tap ♥ on a memory."; otherwise → "Nothing matches — try another word."

## Two-tap delete with timed revert

Delete is destructive and touch screens have no hover, so it's a confirm-in-place:
- First tap on 🗑 → `setConfirmId(m.id)`; that card's button becomes a red `.del-btn.confirm` reading "Delete?".
- Second tap → `onDelete(m.id)` and clears confirm.
- **Auto-revert**: a `useEffect` on `confirmId` sets a 3s `setTimeout` back to `null` (cleared on change/unmount). **Why not mouseleave**: mouseleave never fires on touch, so a tapped-then-abandoned confirm would stay armed forever — a mistap two cards later could delete the wrong memory. The timer is the touch-safe revert. Only one card can be armed at a time (single `confirmId`).

## Fresh-memory highlight + scroll

After Memorialize saves, App sets `newId` and routes to the Vault. The matching card gets `.vault-card.fresh` and a `ref`; a `useEffect` on `newId` calls `scrollIntoView({ behavior: 'smooth', block: 'center' })` so the just-kept memory greets the user centered. `newId` clears when that memory is deleted or the person switches.

## Photo tap → lightbox contract

`onPhoto(photos, index)` (App's `openLightbox`) takes the memory's FULL `photos` array plus the start index. The Vault always passes `(m.photos, 0)` — the hero. The lightbox (in App) steps ← → through the whole array and swipes on touch; it normalizes a bare string into `[string]`. Keep the array+index shape: passing a single URL would break stepping.

## Rendering the groups

`groups` is `[[label|null, mems[]], ...]`. Render each with a `Fragment` keyed `label ?? 'time'`; labelled groups emit a `.vault-group` header; cards keyed `` `${label}|${m.id}` `` because the SAME memory id appears in multiple people/feeling sections — a bare `m.id` key would collide.
