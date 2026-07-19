# Memmory — Cortex prototype

A personal memory-keeping app. You give it a photo, a voice note, or a few
written words; it asks one gentle question at a time and turns the moment into a
structured memory — when, where, who, what, how it felt, the song that brings it
back. The memories collect in a vault, and the vault grows into a graph: your
life as a constellation of soft pastel orbs joined by fine dotted threads, one
orb per moment, a thread wherever two moments share a person, a place, a feeling.

This repo is the prototype behind the business case at
[memmory.vercel.app](https://memmory.vercel.app). It began as **Cortex**, the
force-directed memory graph — the calm, meditative dusk space you can drift
through and query — and grew forward into the two views that feed it. The whole
thing is iPhone-first: it installs to the home screen like a native app, the
microphone and camera work anywhere, and every memory can play a 30-second Apple
Music preview of its song.

The feel is deliberate and comes from the real product's design language: a dark
"dusk" scene of plum and indigo, warmed by a peach glow from the top and a purple
one from below; soft dawn-pastel accents (blue, peach, lavender) in a signature
gradient; matte pastel orbs, never glossy; connections drawn as dotted curved
threads, never hard lines. Nothing here is a tech dashboard — no neon, no charts,
no sharp edges.

## The three views

Switched by the pills at the top, in pipeline order **Memorialize → Vault →
Cortex**. One shared memories state in `App.jsx` feeds all three.

- **Memorialize** — an AI chat that helps you keep a memory. Photos, voice, or
  text go in; a warm guide asks one clarifying question at a time and ends with a
  memory-JSON draft card. "Save to vault" mints an id, resolves the people you
  named, seeds a graph position near the memory's strongest neighbours, and
  persists it. Voice is transcribed by Deepgram; the guide runs on Azure OpenAI
  (swappable). Without an AI key it falls back to a scripted stand-in so the
  pipeline still demos.
- **Vault** — a scannable card list of everything, newest first. Search,
  order-by (time both ways, category, people, feelings, music, places), favorite
  (♥) and delete. The freshly memorialized card is highlighted; tapping a card
  opens that memory in the Cortex.
- **Cortex** — the graph. Orbs clustered by connection, joined by threads whose
  weight and colour reflect how much two memories share. A left year timeline
  with a memory-density sparkline, a bottom-left legend that toggles classes and
  filters by any attribute (people, places, feelings, music), and a bottom-right
  query bar. Type "all happy memories with Lisa" and everything else dims. Click
  an orb to focus it — a HUD and detail card, editable in place.

## Three profiles

The person switcher (top-right pill) swaps the entire memories array; every
derived structure — edges, vocabulary, years, counts — recomputes.

- **Glenn** (`p1`) and **Maya** (`p2`) — demo data. Glenn has ~40 memories;
  Maya, a world traveler, has 241 (the scale test).
- **Simon** (`p3`) — starts empty on purpose. The real profile, filled from the
  phone through Memorialize. The app opens here, on Memorialize, capture-first.

## Architecture

**Client.** React + Vite, one page. The graph is `react-force-graph-2d` running
on `d3-force-3d`. No state library, no CSS framework, no UI kit — that's a
deliberate constraint (see conventions). Layout physics is precomputed at build
time so person-switching is instant; new memories carry their own graph position
as `_pos` on the memory object, so no runtime re-layout is needed.

Everything derived is computed client-side: `lib/edges.js` turns memories into
threads (edges are shared attributes, weighted and pruned) and builds the filter
vocabulary; `lib/search.js` is a local, no-AI parser that maps natural-language
questions to attribute filters; `lib/palette.js` mirrors the CSS design tokens
so canvas code and stylesheet never drift.

**Dual backend, one contract.** `src/lib/api.js` is a storage adapter that picks
its backend at build time. The client always calls the same functions
(`loadMemories`, `upsertMemory`, `removeMemory`, `uploadPhoto`, `chat`,
`transcribe`, `findTrack`); only the wiring behind them changes:

- *Local (dev).* No Supabase env vars set. Persistence, photo serving/upload, the
  AI proxy, transcription and the music lookup are all vite dev-server
  middlewares in `vite.config.js`, reading and writing the JSON files on disk.
  Your API keys live in `.env` and never reach the browser.
- *Deployed.* With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set, the app
  talks to Supabase — Postgres (a `memories` table of jsonb rows), a public
  `photos` Storage bucket, and Edge Functions (`ai-chat`, `transcribe`,
  `music-search`) that hold the AI keys server-side. Hosted on Vercel.

The bundled JSON gives an instant first paint; when deployed, the database
answer replaces it as soon as it arrives.

**Data model (brief).** One memory is a flat JSON object: `id`, `class` (its
colour — Travel, Work, Friends, Milestones, Family), `when` (`DD-MM-YYYY HH:mm`,
parsed by string slicing, no date library), `what` / `where` / `why`, a `who`
array of `{id, name}`, a `feeling` array, an optional `music`, a `photos` array,
`summary`, and `importance` (1–5, sets orb radius). Edges are derived, never
stored: for every pair of memories, shared people/place/class/feeling/artist are
summed into a weight, pruned to keep the graph readable, with a guarantee that
each person's memories form one connected web. Full spec, sample-data rules and
the edge algorithm are in `.claude/skills/memory-schema/SKILL.md`; the colours,
thread recipe and panel styles in `.claude/skills/visual-style/SKILL.md`.

## Getting started locally

```sh
npm install
npm run dev
```

Opens on `localhost`. Works out of the box with the bundled demo data. The AI
guide runs its offline stand-in until you add keys.

For real Memorialization, copy `.env.example` to `.env` and fill in your Azure
OpenAI and Deepgram keys. Leave the two `VITE_SUPABASE_*` lines empty for normal
local work — set them only when you want the laptop to talk to the deployed
database instead of local files.

```sh
cp .env.example .env   # then add AZURE_OPENAI_API_KEY and DEEPGRAM_API_KEY
```

To test on a real iPhone over your LAN:

```sh
npm run dev:phone
```

This serves over HTTPS with a self-signed certificate (`--host` for LAN access).
Safari needs a secure context to grant microphone access off localhost. Open the
printed `https://<your-mac-ip>:…` address on the phone and accept the
certificate warning.

Helper scripts (all optional, run by hand):

- `scripts/compute-layout.mjs` — recompute a person's settled graph layout
  (`node scripts/compute-layout.mjs --person p2`). Re-run when memories change
  enough to matter.
- `scripts/fetch-photos.mjs` / `scripts/add-photos.mjs` — seed stock photos into
  `public/photos/`.
- `scripts/seed-supabase.mjs` — one-time push of the demo profiles into a
  Supabase project (deployment step).

## Deployment

Getting Memmory onto the internet and onto your phone — Supabase for data + AI,
Vercel for hosting — is written out step by step, in plain language, in
[DEPLOY.md](DEPLOY.md). It covers the database schema, the Edge Functions, the
demo seed, the Vercel environment variables, and Add to Home Screen. Follow that;
this README doesn't repeat it.

## Project conventions

- **[CLAUDE.md](CLAUDE.md)** is the orchestration brief: what this is, the fixed
  stack, the ground rules, the delegation map, and the definition of done. Read
  it first when picking up work.
- **`.claude/skills/`** holds the specs. Each view and subsystem has a SKILL.md
  with its design tokens, layout and algorithms — `visual-style` (the sampled
  design language), `memory-schema` (data + edges), `graph-view`, `timeline`,
  `legend-filters`, `query-search`. Read the relevant skill before touching a
  feature; the components carry `// Skill: …` breadcrumbs pointing back.
- **Ponytail minimalism.** The laziest solution that works. No speculative
  abstractions, no extra dependencies, no state libraries, no CSS frameworks. The
  stack is fixed at React + Vite + `react-force-graph-2d`; anything more needs a
  skill to say so. Prefer one line to fifty, native platform features to
  dependencies.
- **Commits.** Conventional Commits — terse, imperative, why over what, no AI
  attribution. One commit per completed unit of work, not per file, after each
  verified iteration.

## Repo layout

```
memory_dev/
  index.html                     # PWA shell (home-screen app meta, theme colour)
  vite.config.js                 # dev-server middlewares: persistence, photos, AI, music
  .env.example                   # AI keys (local) + Supabase vars (deployed)
  CLAUDE.md                      # orchestration brief + conventions
  DEPLOY.md                      # step-by-step deployment
  src/
    App.jsx                      # composition + shared state (views, person, filters, query)
    main.jsx
    styles.css                   # design tokens as CSS custom properties
    components/
      Memorialize.jsx            # AI capture chat
      Vault.jsx                  # memory list (search, order-by, favorite, delete)
      GraphView.jsx              # the Cortex force-graph canvas
      FocusHud.jsx               # focused-node HUD + editable detail card
      Timeline.jsx               # left year rail + density sparkline
      Legend.jsx                 # class toggles + attribute filters
      QueryBar.jsx               # stats + ask-a-question
      PersonSwitch.jsx           # Glenn / Maya / Simon switcher
      DustField.jsx              # decorative dust + nebula behind the graph
    lib/
      api.js                     # storage adapter — Supabase or dev middlewares
      edges.js                   # edge derivation + vocabulary
      search.js                  # local natural-language query parser
      palette.js                 # canvas-side mirror of the CSS tokens
    data/
      memories.json              # Glenn (p1)
      memories-p2.json           # Maya (p2)
      memories-p3.json           # Simon (p3, starts empty)
      layout-p{1,2,3}.json       # precomputed graph positions
      persons.js                 # the three-profile manifest
  supabase/
    schema.sql                   # memories table + photos bucket + policies
    functions/
      ai-chat/                   # Azure OpenAI proxy (Memorialize)
      transcribe/                # Deepgram speech-to-text
      music-search/              # Apple catalog lookup
  scripts/
    seed-supabase.mjs            # seed demo profiles into Supabase
    compute-layout.mjs           # precompute a person's force layout
    fetch-photos.mjs             # seed one stock photo per memory
    add-photos.mjs               # add more photos to specific memories
  public/
    photos/                      # memory photos
    manifest.webmanifest, icon-*.png
```
