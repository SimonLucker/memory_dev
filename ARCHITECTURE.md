# Memmory v3 architecture

The gallery redesign of the web prototype. Master spec: `docs/design-foundation-v3.md` (sections 3, 4, 5, 8 binding; section 7 copy bank verbatim). Visual twin: `docs/reference/roadmap-2026-08-21.html` (live at https://memmory-design.vercel.app) and the photos in `docs/reference/images/`. Where this file and the spec disagree, the spec wins. Where the spec talks about the Expo app (`app/home.tsx`, `theme.ts`, `story.ts`), read it as prose: the target is this React + Vite app.

Decisions already taken with Simon (do not re-ask): target is this web app; relational Supabase schema with auth-ready RLS, persona switcher stays; retired surfaces (Vault, Cortex, Cards, the dusk MemoryDetail, Slideshow) are kept behind `?legacy=1`, no nav entry; new demo persona p5 Isabel owns the roadmap demo world, p1 Glenn, p2 Maya, p3 Simon A, p4 Simon G stay; shared memories are real between registered personas; capture big buttons are built, toggle in Profile, default on; migrations are SQL files Simon runs himself; song row keeps Spotify look with the Apple 30s preview as inline playback.

## 1. Subsystems: one folder each

```
src/
  core/        shell, navigation, tokens, icons, copy, showcase plumbing      owner: integrator
  data/        schema, adapter, store, selectors, demo seed, v2 bridge       owner: data builder (wave 0)
  home/        Home screen                                                   owner: home builder
  memories/    Memories grid                                                 owner: memories builder
  story/       memory story + shared memory (people row, badges, filter)     owner: story builder
  recap/       full screen recap player + beat composer                      owner: recap builder
  capture/     Capture sheet frame + the unchanged capture engine            owner: capture builder
  profile/     Profile sheet (cream)                                         owner: profile builder
  legacy/      v2.5 surfaces behind ?legacy=1 (Vault, Cortex, GraphView,
               Cards, MemoryDetail, Slideshow, edges, palette, cards,
               insights, search + their css)                                 owner: nobody (must keep compiling)
  lib/         thread.js keeper.js voice.js synthesize.js photos.js
               avatar.js people.js settings.js (unchanged engine libs)       owner: integrator
tools/         shot.mjs (screenshots + JSON log), gauntlet.mjs (shot matrix per module), status.mjs
supabase/      migrations/0001_v3.sql, functions/ (unchanged)
scripts/       migrate-v3.mjs (jsonb rows -> relational), seed-isabel.mjs
docs/          design-foundation-v3.md, reference/, shots/, STATUS.json
```

Ownership rule: a builder edits only its own folder plus `src/<module>/showcase.js`. Anything in `core/`, `data/`, `lib/`, `tools/`, `index.html`, `vite.config.js`, `package.json` is a request to the integrator (write it in the builder's report under "Core requests"). Never edit another module's folder.

Every module folder contains: `index.jsx` (the default export component), `<module>.css` (all class names prefixed with the module's short prefix, see section 7), `showcase.js` (scenes for the verification loop), and nothing else unless the module needs helpers (`story/compose.js`, `recap/beats.js`).

## 2. Two color worlds, one shell

The gallery (Home, Memories, story, shared, recap) is dark: ground `#101014`, cards `#1D1D25`, inputs in cards `#14141A`, text `#FFFFFF` always at full saturation. The Capture sheet is the only light room (Dawn gradient, slate text). Profile is cream. Tokens: `src/core/tokens.css` (section 2.9 of the spec, verbatim, plus the Geist `@font-face`). Type roles are CSS classes `.t-display .t-headline .t-body .t-label`; sizes 30/20/16/12 only, tab labels and photo badges 11, meta lines may use 12.5/13.5/11.5/10.5 where section 5 names them, nothing else.

Desktop: the app renders as a centered phone column (`.phone`, 430px max, 100dvh) on a pure black page (`#000`, outside the app so not a "background" in the spec's sense). On phones the column is the viewport.

## 3. Navigation model (`core/App.jsx`, `core/nav.js`)

```
state = {
  personId: 'p1'..'p5',
  tab: 'home' | 'memories',
  stack: [ { kind: 'story', id, filter?: personId|null, origin?: DOMRect }
         | { kind: 'viewer', id, index }
         | { kind: 'recap', id } ],          // push/pop; last entry is on top
  sheet: null | 'capture' | 'profile',     // modal sheets over everything
}
```

- Launch is always `tab: 'home'`, empty stack, no sheet. Never the chat.
- `nav` API handed to every module as props (no context, no router library): `openStory(id, originRect?)`, `openViewer(id, index)`, `openRecap(id)`, `back()`, `openCapture()`, `closeSheet()`, `openProfile()`, `setTab(name)`, `showMemories()`, `showPerson(personId)`.
- `showPerson(personId)` is the one nav call that also writes screen state: it sets the Memories filter to `{ people: [personId] }`, then `showMemories()` (closes the sheet, empties the stack, tab `memories`). The filter itself lives in `App` and reaches the grid as `<Memories filter setFilter />` (`filter` defaults to `{}`, shape `{ people?: string[], q?: string }`); `setFilter` lets the grid clear or widen it.
- URL hash mirrors the top of the stack for deep links and screenshots: `#/memory/:id`, `#/recap/:id`, `#/memories`, `#/capture`, `#/profile`. On load the hash is applied once. Nothing else is routed.
- Tab bar (`core/TabBar.jsx`): Home (house icon) · raised capture button (54px white circle, black plus, lifted 22px, shadow `0 8px 18px rgba(0,0,0,0.45)`) · Memories (grid icon). Labels 11/600, active tab 4px dot beneath. Hairline `rgba(255,255,255,0.14)` on the top edge only. Hidden while the stack is non-empty or a sheet is open. Height `56px + env(safe-area-inset-bottom)`; screens pad their bottom by the same amount (`--tabbar-h`).
- Pushes slide in from the right in 600ms `var(--ease)`; `back()` reverses. The story opened from a tile is the signature 900ms animation: the story module receives `origin` (the tile's rect) and grows from it (transform scale + translate from the rect to full column, hero photo fading from the tile). Reduced motion: opacity only.
- Sheets slide up in 600ms, top corners radius 32, closed by their own chevron-down button (never a scrim tap alone). The Capture sheet stays MOUNTED for the app's lifetime (hidden by transform when closed) so in-flight uploads, the forming timer and the keeper tick survive; only `open` toggles. Profile mounts on open.
- Both tabs stay mounted; the inactive one is `hidden` via `display:none` so scroll positions survive.
- `window.__state` is kept in sync with the nav state (read by `tools/shot.mjs`), and `window.__ready = true` is set by `core/ready.js` after the first paint with fonts loaded and the first data load settled (or failed).

## 4. Data model (`data/`)

### 4.1 Tables (`supabase/migrations/0001_v3.sql`)

```
people          id text pk, name text, first_name text, avatar_url text,
                is_user bool default false, space_id text (the persona whose contact list this is; = id for users),
                created_at
memories        id text pk, owner_id text -> people, title text, place text,
                starts_at timestamptz, ends_at timestamptz, about text, class text, feeling text[],
                music jsonb {name, artist}, importance int, cover_moment_id text, favorite bool,
                demo bool default false, legacy jsonb (untouched v2 fields: _pos, why, summary, videos demo flags),
                created_at, updated_at
moments         id text pk, memory_id text -> memories on delete cascade,
                kind text check in ('photo','video','voice','text','answer'),
                src text, poster text, duration real, transcript text, text text,
                generated_by text -> people, question_id text, captured_at timestamptz, position int,
                demo bool default false, created_at
memory_people   memory_id, person_id, role text check in ('contributor','tagged'), pk (memory_id, person_id)
questions       id text pk, memory_id -> memories cascade, person_id (who is asked), text text,
                asked_at timestamptz, answered_at timestamptz
recaps          id text pk, memory_id -> memories cascade, beats jsonb, song jsonb, created_at
threads         (unchanged) person_id, id, data jsonb           -- capture engine, one row per message
profiles        (unchanged) person_id pk, data jsonb
app_settings    key text pk, value jsonb                         -- row 'auth_required' = false
```

Ids stay text and keep the existing minting (`m001`, `p2m014`; new: `<space>_<base36 ts>`), so nothing in the capture engine changes. A memory belongs to exactly one owner; a shared memory is a memory with one or more `contributor` rows in `memory_people`; contributors add moments with `generated_by = their id`. `tagged` rows are people who were there but are not users (Mom, Elena). A person row for a non-user lives in the tagging persona's space (`space_id`).

Story order is `moments.position` then `captured_at` (capture order; the composer never reorders). `cover_moment_id` null means the first photo.

### 4.2 RLS, auth-ready

One function `app.current_person()` returns `auth.jwt() ->> 'person_id'` when a JWT carries it, else null. One function `app.open()` returns `not (select value::bool from app_settings where key = 'auth_required')`. Every policy is `using (app.open() or <ownership test>)`. Today the row is `false` and the anon key sees everything, exactly as now. Flipping the row to `true` (after Supabase Auth issues JWTs with `person_id`) enforces: people visible in own space or when is_user; memories visible to owner and contributors; moments and questions and recaps through their memory; threads and profiles by person_id. Storage bucket `photos` stays public-read, anon-upload (unchanged).

### 4.3 Adapter (`data/api.js`)

Same dual-backend idea as v2, but one generic contract so the dev backend stays tiny:

```
loadSpace(personId) -> { people, memories, moments, links, questions, recaps }
    remote: ONE PostgREST call per table set, embedded:
      memories?select=*,moments(*),memory_people(*),questions(*),recaps(*)&or=(owner_id.eq.<pid>,memory_people.person_id.eq.<pid>)
      people?or=(space_id.eq.<pid>,is_user.eq.true)
    dev: GET /__db?space=<pid>  (vite middleware reads src/data/db/*.json and filters the same way)
upsert(table, rows[])   remote: POST with Prefer: resolution=merge-duplicates   dev: POST /__db {table, upsert}
remove(table, id)       remote: DELETE ?id=eq.                                  dev: POST /__db {table, delete}
uploadPhoto(blob) uploadAudio(blob) ask(messages) transcribe(blob) findTrack(music) appleMusicSearchUrl   (unchanged)
loadThreadRemote upsertThreadMsgs upsertThreadMsg loadProfile upsertProfile                              (unchanged)
```

Writes are optimistic: the store updates first, the adapter call is fire-and-forget with the existing retry ladder; failures log a warning, never block the UI. Batched: one `upsert` call per table per save (a saved memory is memory + moments + links in three calls, not one per moment).

### 4.4 Store and selectors (`data/store.js`, `data/select.js`)

`App` holds one normalized `db` object (`{people:{}, memories:{}, moments:{}, links:[], questions:{}, recaps:{}}` keyed by id) for the active persona, filled by `loadSpace`. Pure selectors, all memoized by input identity:

```
memoriesOf(db, pid)               -> Memory[] the persona owns or contributes to, newest first, demo last (5.2 rule 4)
storyOf(db, id)                   -> { memory, blocks: Block[], people: Person[], shared: bool, question: Question|null, related: Memory[] }
    Block = { kind: 'hero'|'pair'|'photo'|'video'|'voice'|'text'|'song'|'related'|'question', moments: Moment[], by: Person }
    composed in capture order: first photo becomes the hero; consecutive photos pair up two by two; a lone trailing photo is full width; voice and text blocks stay where they were captured; the song row sits after the last media block; related and question always last.
homeOf(db, pid, now)              -> { hero: Memory (newest with a recap or the newest shared, else newest), cards: HomeCard[], latest: Memory[3] }
    HomeCard kinds: 'year-ago' (a memory dated now-1y within 3 days), 'question' (oldest unanswered question), 'contributed' (a moment by someone else in the last 7 days, once per memory). Max three cards, in that priority.
sharedOf(db, id)                  -> people row (owner first as 'You', then contributors and tagged people in first-moment order)
relatedOf(db, id, n=3)            -> earlier memories sharing a person or a place, strongest first (people shared count desc, then place, then recency)
recapOf(db, id)                   -> Beat[] from `recaps` when present, else composed: one beat per photo/video in story order, 5s each, a voice moment attaches to the beat that follows it and stretches it to the voice duration, a text moment becomes a quote on the next beat, song = memory.music
countOf(db, pid)                  -> number for "12 memories"
```

### 4.5 Bridge to the unchanged capture engine (`data/bridge.js`)

The capture engine still produces v2 memory objects (`what, where, when 'DD-MM-YYYY HH:MM', who[{id,name}], feeling[], music, about, photos[], voice[{src,duration,transcript}], videos[{src,duration,poster}], _unsynthesized`). `fromV2(memory, ownerId, now) -> {memory, moments, links, people}` and `toV2(db, memoryId) -> v2 object` keep both worlds in sync. `App.addMemory(draft)` and `App.updateMemory(v2)` keep their v2 signatures; internally they convert, diff against the store and upsert only the changed rows. Legacy surfaces read `toV2` arrays.

### 4.6 Demo seed and personas

`src/data/demo/isabel.json` is a full space (`people, memories, moments, links, questions, recaps`) for p5 Isabel, built from the roadmap: The house in Greece (shared: Isabel, Elena, Leo, Jonas, Sam and two tagged people, July 12 to 19, Paros; Jonas voice note 0:32; song Ta Paidia tou Peiraia · Melina Mercouri; hand-composed recap), Dinner at Marco's (June 14, Amsterdam; voice 0:19 "Best pasta of my life. Marco finally met Sofia."; song Caruso · Lucio Dalla; question "What did you and Marco talk about after Sofia left?"), three earlier nights with Marco, That evening in Valldemossa (dated a year before this September so Home shows it this week), Grandma's laughter (May 3, Stockholm, video poster), Siv after the groomer (May 18), Morning swim (May 24), and enough more to reach 12. Photos are copied from `docs/reference/images/` to `public/photos/isabel/`. Demo voice notes have no audio file (`demo: true`): the card renders transcript and duration, play is a no-op that never errors. Nothing AI-generated.

Personas: `p1 Glenn, p2 Maya, p3 Simon Akkerman, p4 Simon Gullstrøm, p5 Isabel` in `data/personas.js`. p1 and p2 keep their v2 JSON and are converted with `fromV2` at load in dev (`scripts/migrate-v3.mjs` does the same against Supabase rows for the deployed app). Isabel's data is bundled, so the showcase never needs the network.

## 5. Modules and their contracts

Props are the whole contract. `db`, `nav`, `now` and `personId` come from App; modules never fetch and never write to storage directly except through the two actions they are given.

```
<Home db personId now nav />                                    src/home
<Memories db personId nav />                                    src/memories
<Story db personId id filter origin nav answer(questionId, {text|voice}) addMoment(memoryId, moment) />   src/story
<Recap db id nav onClose />                                     src/recap
<CaptureSheet open person memories(v2) addMemory updateMemory nav settings />   src/capture
<Profile person persons db onClose switchPerson settings setSetting />          src/profile
```

Module facts (from section 5 of the spec; read the section before building):

- home: wordmark 16/700 + avatar 30px; greeting display 30/600, time of day by `now` ("Good morning." before 12, "Good afternoon." before 18, else "Good evening."; the copy bank only lists the morning line, the other two follow the same shape); hero card 4:3.6, radius 24, photoScrim, avatar stack 22px, play 42px; activity rows padding 9, thumb 48 radius 12, label 11/600, line 13.5/400; Latest label 12/600 + three square tiles radius 14. Tap card = story, tap play = recap. Never an input field, never an empty state asking for content (an empty persona shows the demo world's hero? No: an empty persona shows a hero from the persona's newest memory; with zero memories the hero card becomes the Latest row of demo content from Isabel marked demo, and nothing asks for input).
- memories: title 30/600 + count 12/500; two-column square tiles radius 18; a memory with several people (owner + at least one other person) takes full width 16:9.5 with an avatar stack in the caption; captions title 14/600 + meta 11.5/500 ("June 14 · Amsterdam"); real first, demo last; empty state copy "Nothing here yet. Start capturing a memory."; tap = story with origin rect.
- story: header back button (32px circle, surface, chevron-left), title 22/600, meta 12/500; blocks gap 12: hero radius 20 16:10.5, pairs radius 18, voice card radius 20 padding 14 (32px play, static waveform 2px bars, duration 12/600, "What you said" 11/600 or "Jonas said", transcript 15.5/400, real audio when present), song row radius 18 (Spotify mark 26px green circle, "Playing then" 11/600, "Caruso · Lucio Dalla" 13.5/400, tap plays the Apple preview and offers the open link), related row (three stacked 34px thumbs radius 10, "Related memories", "3 earlier nights with Marco"), question card last (26px mic chip, "A question for you", question 17/400, surfaceDeep pill input with placeholder "What do you remember?", mic icon, white "Save" pill; after saving the confirmation is exactly "Saved."). Shared additions: people row of pill chips ("Everyone" first, selected = white bg dark text; person chips avatar 22 + first name 12/600; horizontal scroll with a chip cut at the edge), photo badges (scrim pill bottom-left inset 8, avatar 16 + first name 10/600, names who generated the moment), "Watch the story" pill (30px white play + 12/600). Tap a photo = viewer (edge to edge, swipe between, tap closes). Story is the 900ms signature animation from `origin`.
- recap: full screen modal on ground; photo fills, slow Ken Burns for the beat length, crossfade 900ms; scrim top and bottom; progress segments 2.5px gap 4 white 0.35 played solid; auto advance, tap right next, tap left back; voice plays over pictures; text moments appear as a quote; caption pill (24px avatar + first name 13/600) bottom left; song credit bottom center (Spotify mark 15px + "Title · Artist" 10.5/600); ends on the last beat and closes, no summary card. Close button top right (32px circle).
- capture: the engine (`capture/Capture.jsx`, moved from components, behaviour unchanged) inside a sheet frame: Dawn gradient, top radius 32, header (34px white circle chevron-down close left, "Capture" 16/600 slate center, avatar right), dock with `env(safe-area-inset-bottom)`, big buttons above the dock (58px white circles with soft shadow, labels "Hold to talk" and "Camera" 11/600 slate; the mic circle is hold-to-record with the same gesture as the bar mic, the camera circle taps for photo and holds for video) shown when `settings.bigButtons !== false`. The forming bar reads "2 moments · one memory" + "Save now". After a save the sheet shows "Saved" or "Saved as one memory" in the thread (copy bank) and stays open; the thread never empties.
- profile: v2 sheet re-housed (cream, radius 32 top, portrait, name, fact line, counts row, top people, gauge, three questions, Face ID visual, privacy row "Private by default. Your memories are never posted anywhere.", sign out, viewing-as persona picker) plus the "Big capture buttons" switch and the music service segmented. No "memory cards" count (retired): show memories and people.

## 6. Verification loop (`tools/`, `docs/STATUS.json`)

`node tools/shot.mjs "<path>" --out <name> [--vp phone|phoneSmall|phoneLarge|desktop] [--dpr 2] [--clock ISO] [--full] [--tap sel] [--scroll px] [--reduced-motion]` loads the dev server (`http://127.0.0.1:5173`), waits for `window.__ready`, writes `docs/shots/<name>.png` and `<name>.json` (console errors, page errors, failed requests, perf, `window.__state`). Exit code 1 on any error. Nobody claims a screen works without a shot file to point at.

Showcase mode: `/?showcase=<module>&scene=<name>&now=<ISO>&persona=p5`. `core/showcase.js` reads the query, loads the bundled Isabel space (no network), freezes `now`, sets the persona, applies the scene from `src/<module>/showcase.js` (`export const scenes = { default: { stack, sheet, tab, ...}, ... }`) and mounts the normal App. So a showcase is the real app in a known state, not a mock. Required scenes per module: home `morning|afternoon|evening|empty-persona`, memories `default|empty`, story `solo|shared|shared-filtered|viewer`, recap `default|quote-beat`, capture `open|forming|recording|big-buttons-off`, profile `default`.

`node tools/gauntlet.mjs <module>` runs every scene of a module at phone/phoneSmall/desktop, dpr 2 and 3, morning and evening, and writes `docs/shots/<module>/*` plus `docs/shots/<module>/summary.json` (errors and failed requests across the matrix). The critic reads that plus the PNGs.

`docs/STATUS.json` is the single scoreboard:

```
{ "updated": ISO, "modules": { "<name>": { "score": 0-10, "round": n, "pass": bool, "errors": n,
  "issues": [ { "rank": 1, "severity": "blocker|major|nit", "text": "...", "shot": "docs/shots/..." } ],
  "shots": ["..."], "notes": "..." } } }
```

Pass = score >= 8.5 and zero console errors, page errors or failed requests in the gauntlet. Scores are never inflated; a failed round is recorded as a failed round. The loop always resumes from the module with the lowest score.

## 7. Conventions

- Class prefixes: core `app- tab- sheet-`, home `hm-`, memories `mg-`, story `st-`, recap `rc-`, capture `cap- cs-` (cs- for the sheet frame), profile `pf-`, legacy untouched.
- Icons only from `core/Icons.jsx` (1.5px line, 24 grid; adds `Home`, `Grid`, `Pause`, `Play` fills as needed). Emoji as UI is forbidden.
- Copy only from `core/copy.js` (section 7 bank verbatim, one flat export per string). No em dashes, no exclamation marks, no "Memmory says".
- Motion: `--motion-fast/normal/slow` and `--ease` only. Text never fades out; content moves. `prefers-reduced-motion` turns movement into opacity.
- Photos always straight, full width of their block, rounded, `object-fit: cover`, with `loading="lazy"` below the fold and explicit aspect ratios so nothing jumps.
- No new dependencies. React + Vite + the existing libs. Playwright is a dev dependency for `tools/` only.
- ponytail applies to every line: the laziest correct solution, no speculative abstraction. If a module needs a helper the store does not offer, ask the integrator instead of duplicating data logic.

## 8. Waves

- Wave 0 (integrator + data builder): `core/` shell, tokens, icons, copy, nav, ready and showcase plumbing; `data/` schema SQL, adapter, store, selectors, bridge, Isabel seed, personas; `legacy/` move behind the flag; `tools/gauntlet.mjs`; app loads into Home with a placeholder Home so the server stays loadable.
- Wave 1 (six builders in parallel): home, memories, story, recap, capture, profile. Each ships its scenes and a report with shots.
- Wave 2 (critic per module, up to four rounds each): brutal AAA art director, writes no code, takes its own shots across the gauntlet matrix, checks contract, console, perf, scores 0-10, writes the ranked issue list into STATUS.json; builders fix and go again.
- Wave 3 (integrator): end-to-end flows (capture a memory and see its story; add a moment to a shared memory as another persona; answer a question; watch a recap), `scripts/migrate-v3.mjs`, README and DEPLOY updates, commit to `dev` on Simon's Mac with the SQL he needs to run.
