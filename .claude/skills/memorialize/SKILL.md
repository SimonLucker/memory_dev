---
name: memorialize
description: Spec for the Memorialization chat — the guided create-a-memory flow (system-prompt contract, draft extraction, multi-photo pipeline, voice, song verification, save into App.addMemory). Read before touching Memorialize.jsx.
---

# Memorialization (Memorialize.jsx)

The pipeline's first stop (**Memorialize** → Vault → Cortex): a warm chat that turns a photo / voice note / typed words into a memory-JSON draft, then saves it into the vault. Props: `{ personName, onSave, onPlay }`. `onSave` is `App.addMemory`.

## Chat flow

UI messages are `{ role, text, images? }` (`images` = data-URL array). `send()` appends the user turn, clears input+photos, calls `api.chat(toApi(next))`, then extracts a spoken reply + optional draft. `toApi` prepends the system message and maps each UI turn to OpenAI chat format — turns with images become multi-part `content` (`text` part + `image_url` parts), text-only turns are a plain string. Auto-scroll to `endRef` on every `messages/busy/draft` change.

## System-prompt contract (`systemPrompt(personName)`)

The guide's behavior is entirely prompt-driven — do not add client logic that duplicates it. The hard rules, in order of how easily the model breaks them:
- **ONE short question at a time**, never a list, at most 3-4 total. 1-3 warm plain sentences, no bullets.
- **Just-now date default**: `when` is `DD-MM-YYYY HH:mm`; the prompt injects `today()` as "right now" and instructs: if the user gives no date/time, assume it just happened and use now — do NOT ask "when" unless their words imply it wasn't today. (This is why most drafts land with today's date and the flow feels short.)
- **NEVER announce readiness without the json block.** The model must produce the memory IMMEDIATELY in the same reply: one closing sentence → a fenced ```json block → one short "anything to add or change?" question. It may not say "your memory is ready" in a reply that lacks the block (that would strand the UI with no draft to save).
- **Re-emit on corrections**: if the user then asks for a change, the model replies with the COMPLETE updated json block again (same shape). The client always parses the latest block, so partial edits would lose fields.
- JSON shape is fixed (class enum, what/when/where/why, `who:[{name}]`, `feeling:[]`, `music:{name,artist}|null`, summary, importance 1-5). Feelings vocabulary is a closed set (Happy, Nostalgic, Proud, Excited, Calm, Grateful, Sad, Bittersweet, Free).

## Draft extraction + dedupeLines

`extractDraft(text)` regex-matches the first ```json fenced block and `JSON.parse`s it (returns `null` on no-match or bad JSON — never throws). The block is STRIPPED from the spoken bubble (`content.replace(/```json[\s\S]*?```/, '')`) so the user sees prose, not raw JSON. `dedupeLines` collapses consecutive identical lines — the model sometimes emits the same sentence twice in a row; without this the bubble reads it twice. A parsed draft → `setDraft(d)`, which renders the draft card.

## Multi-photo pick pipeline (`pickPhoto`)

`<input type="file" accept="image/*" multiple>`. iPhone camera shots arrive as ~4000px HEIC/JPEG monsters. Each file is **re-encoded through a canvas at pick time**:
- Load via `URL.createObjectURL` → `<img>`; scale so the longest side ≤ 1600px (`Math.min(1, 1600/max(w,h))`); draw to a canvas; export `toDataURL('image/jpeg', 0.85)`.
- **Why**: (1) canvas `drawImage` bakes in EXIF rotation (raw phone photos are often sideways), (2) bounds the pixel size, (3) the resulting data URL is small enough to travel through the AI chat AND the upload endpoint. HEIC that the browser can't decode → `img.onerror` fallback reads the raw file via `FileReader` (undecodable but still uploadable).
- Pending picks live in `photos` (data-URL array) as removable thumbnails in the composer; `e.target.value = ''` after so re-picking the same file re-fires `onChange`.

## Voice → transcribe → editable input

🎙 toggles `MediaRecorder`. On stop: build a Blob, `api.transcribe(blob)` (Deepgram via backend). The transcript is APPENDED into the text input (`setInput(prev => prev + ' ' + transcript)`) — it is NOT auto-sent. The user reviews/edits, then hits send. Errors surface in `notice`; mic-denied shows a gentle "type instead" message. `dev:phone` HTTPS exists because `getUserMedia` needs a secure context off localhost.

## Song verification (`songCheck`)

The moment a draft with `music` appears, a `useEffect` (keyed on `music.name`/`music.artist`) calls `api.findTrack` against the Apple catalog and sets `songCheck`: `loading` → `found` (has `previewUrl`, shows the matched track+artist) / `missing`. **Why before save**: a wrong AI song guess is caught — and made playable — before it's committed; `missing` nudges the user to correct it or save as-is. This is separate from `onPlay` (the mini player) and from FocusHud's `SongRow` — all three route through `api.findTrack`.

## Auto-growing composer

The `<textarea>` (`taRef`) resets `height='auto'` then `= min(scrollHeight, 160)` on every `input` change — grows with the text, caps at 160px, and shrinks back automatically because sending clears the input. Enter sends (Shift+Enter = newline).

## Save pipeline (`saveDraft` → onSave → App.addMemory)

On "Save to vault": every image shared anywhere in the conversation is uploaded (`fetch(dataURL).blob()` → `api.uploadPhoto`, which returns a bundle-relative path in dev or a Storage public URL remote — see backend-api). `onSave({ ...draft, photos: uploaded })`. App.addMemory then:
- mints the id (`m###` for p1, `p{n}m###` otherwise, one past the current max),
- `resolveWho` maps plain names to `{id,name}` (reusing existing same-named ids, minting `p##` for new),
- defaults `photos:[]` / `music:null`,
- **seeds `_pos`**: averages the layout positions of the up-to-3 strongest new neighbours (via `deriveEdges`) plus jitter, so the Cortex places it near its cluster without a full re-layout,
- persists via `api.upsertMemory`, sets `newId`, and jumps to the Vault (where the fresh card highlights + scrolls into view).

Backend routing (Supabase vs dev middleware), upload paths, and error rules all live in the **backend-api** skill.
