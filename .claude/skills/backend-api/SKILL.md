---
name: backend-api
description: Spec for the persistence + AI layer — the dual-backend contract (lib/api.js), the vite dev middlewares, and the Supabase schema + edge functions. Read before touching lib/api.js, vite.config.js, supabase/, or scripts/seed-supabase.mjs.
---

# Backend / API layer

One fetch contract, two interchangeable backends, chosen at BUILD TIME. `lib/api.js` is the only thing the components call — they never know which backend answers. Deployment steps (create project, set secrets, deploy functions, seed) live in **DEPLOY.md**, not here.

## Dual-backend contract (build-time switch)

`remote = Boolean(SB_URL && SB_KEY)`, evaluated once from `import.meta.env.VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`:
- **Remote** (both set — e.g. the Vercel build): Supabase. `memories` → Postgres via PostgREST, photos → Storage bucket `photos` (public URLs), AI/STT → Edge Functions `ai-chat` / `transcribe`, music → `music-search`.
- **Dev** (unset): the vite middlewares in `vite.config.js`, reading/writing JSON files and `public/photos` on disk, proxying AI with keys from `.env`.

Every `api.js` function branches on `remote`. The client-side fetch SHAPES are the shared contract — the dev middlewares deliberately mirror the edge functions request/response for request `music-search`, `ai-chat`, `transcribe` so swapping backends changes nothing in the components.

**URL-paste guard**: `SB_URL` strips a trailing `/rest|/functions|/storage/v1` and any trailing slash — people paste a service endpoint onto the project URL, and this tolerates it instead of producing double-pathed 404s.

## Per-memory upsert / delete

Not a whole-array PUT — one memory at a time:
- Remote upsert: `POST /rest/v1/memories` with `Prefer: resolution=merge-duplicates` (PK is `(person_id, id)`), body `{person_id, id, data: memory}`.
- Remote delete: `DELETE …?person_id=eq.&id=eq.`.
- Dev: `POST /__save-memories` with `{person, upsert}` or `{person, delete: id}`; the middleware reads the person's JSON file (`memories.json` for p1, `memories-{person}.json` otherwise), splices, writes back pretty-printed.
- Dev writes fail SILENTLY on production builds (no endpoint) — `.catch(() => console.warn(...))`, edits stay in memory. `loadMemories` returns `null` in dev (App seeds from bundled JSON) and the remote source of truth otherwise.

`_pos` (new-memory graph position) rides INSIDE `memory.data` — no layout table, no layout-file writes. The static `layout-pX.json` files only seed base positions for demo data.

## Photo upload paths (two shapes)

`uploadPhoto(blob)` returns the string to store in `memory.photos`:
- Remote → upload to Storage `photos/new_{ts}.{ext}`, return the **public URL** `${SB_URL}/storage/v1/object/public/photos/{name}`.
- Dev → `POST /__upload-photo` (raw bytes), middleware writes `public/photos/new_{ts}.{ext}` and returns a **bundle-relative path** `photos/{name}` (Vite's `base:'./'` resolves it).

So `photos[]` mixes seeded bundle-relative paths and (remote) absolute Storage URLs — both render as `<img src>` directly.

### Why `/photos` has its own dev middleware

Vite's built-in public-file serving relies on a watcher-fed file list, and the watcher DELIBERATELY ignores `public/photos/**` (uploads must not trigger a page reload). Consequence: a photo uploaded mid-session isn't in Vite's list and falls through to the index.html SPA fallback (you'd get HTML, not an image, until a server restart). The `/photos` middleware reads the file straight off disk to close that blind spot. It rejects `..` and nested paths (only flat filenames).

### Module-cache invalidation on save

The same watcher-ignore means a saved `memories*.json` won't hot-reload — good (no mid-edit reload) — but Vite's module graph then serves the STALE import on the next full reload. So `/__save-memories` calls `server.moduleGraph.onFileChange(memFile)` by hand after writing. Without it, a manual refresh shows pre-edit data.

## Error-surfacing rules

Callers must never crash on `undefined`. Enforced in `api.js`:
- `chat()`: if `data.error` → throw it; if `data.content` isn't a string → throw `'Unexpected AI response: ' + raw` (a misconfig — wrong URL, gateway error — surfaces as a readable notice, never a silent undefined that blows up `extractDraft`).
- `transcribe()`: if neither `transcript` nor `error` present → return a synthetic `{transcript:'', error:'Unexpected transcribe response…'}`. Deepgram-missing returns `{transcript:'', error}`, not a throw.
- `findTrack()`: any failure → `null` (music is best-effort; a dead lookup must never break save or focus).
- `ok(r)` helper throws `"{status} {body-slice}"` on non-2xx for the Supabase calls.

## Music-search retry ladder (server-side)

`findTrack` posts `{artist, name, country}` (country from `navigator.language`, US fallback). The backend (both `/__music` and the `music-search` edge fn) walks a ladder, taking the first hit that has a `previewUrl`:
1. `artist + title` in the user's store,
2. `title` alone in the user's store,
3. `artist + title` in the **US** store (widest catalog).

Returns a trimmed `{trackName, artistName, previewUrl, artworkUrl100, trackViewUrl}` or `null`. **Why server-side**: browser content blockers eat `itunes.apple.com`, the legacy JSONP path is flaky, and store region must be chosen server-side. Never call iTunes directly from the client. See **music-preview** for how the result is played.

## Vite dev middlewares (vite.config.js)

`devApi(env)` registers: `/__save-memories`, `/photos`, `/__upload-photo`, `/__ai/chat`, `/__music`, `/__ai/transcribe`. All POST endpoints 405 on non-POST. Keys come from `loadEnv` (`.env`, never shipped to the browser). Notable:
- `/__ai/chat` → Azure OpenAI. Handles both the `preview`/v1 surface (`/openai/v1/chat/completions`) and legacy deployments path (`/openai/deployments/{dep}/…?api-version=`). **No key → `mockChat`**: a scripted 3-question flow that emits a valid memory JSON so the whole pipeline is demoable offline (returns `{content, mock:true}`).
- `/__ai/transcribe` → Deepgram `nova-3`, content-type preserved from the request.
- `HTTPS=1` (`dev:phone`) adds `basicSsl()` so Safari on a phone grants mic access (secure-context requirement off localhost).
- Watcher ignores `src/data/memories*.json`, `src/data/layout-*.json`, `public/photos/**`.

## Supabase (supabase/)

- `schema.sql`: one `memories` table, jsonb `data` column = the memory object (the app schema IS the DB schema; no migrations while it evolves). PK `(person_id, id)`. POC access model: RLS on, but an `anon full access` policy — anyone with the URL+anon key can read/write. Public `photos` bucket with anon read+insert. Add Supabase Auth before sharing widely.
- Three edge functions (`ai-chat`, `transcribe`, `music-search`), each a `Deno.serve` with CORS preflight, mirroring the dev middleware behavior; secrets via `Deno.env`. Deploy with `--no-verify-jwt` (the anon key is the gate).
- `scripts/seed-supabase.mjs`: one-time push of the bundled demo memories (p1 Glenn, p2 Maya) into the table, injecting each memory's precomputed layout position as `_pos` so the deployed app never needs the layout JSONs. p3 (Simon) starts empty ON PURPOSE — the fresh real-memory profile. Reads `.env` with a tiny hand-rolled loader (no dep). Run with the two `VITE_SUPABASE_*` vars set.
