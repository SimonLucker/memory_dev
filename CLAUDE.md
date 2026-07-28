# Memmory — project orchestration

A React + Vite prototype of the Memmory app: a calm, mobile-first memory keeper. The app fills the viewport on phones; on wider screens it renders as a centered phone-proportioned column (max-width ~430px, cream backdrop) so it always matches the phone mockups.

**Master spec: `memmory-design-v2/design-foundation.md` (v2.5).** Sections 4, 6, 9 are binding; section 8 is the non-negotiable rule sheet; section 7 the copy bank (strings verbatim); section 3 the locked vocabulary; section 2 exact tokens. The visual twin with phone mockups is `memmory-design-v2/design-direction-v2.html` — its inline CSS holds exact mockup values. The spec wins over any existing code or old skill docs.

## Locked view names

Three panes, swiped or dot-tapped, Capture is home: **Vault** (pane 0) with a round top-right view toggle that folds out to the [List | Cortex] pill (v2.5), **Capture** (pane 1), **Cards** (pane 2). Overlays: **Memory** (opened memory detail), **Slideshow**, **Profile** (sheet from the avatar). The words "Memorialize", "Memorialization" and "Chat" are retired and never appear in UI copy or new identifiers.

## Version control

Repo: https://github.com/SimonLucker/memory_dev.git (remote `origin`). **After every completed and verified iteration** (feature landed, bug fixed, review passed), the orchestrator commits with a Conventional Commits message — terse, imperative, why over what, no AI attribution. One commit per completed unit of work, not per file. The orchestrator cannot push (no GitHub auth in the sandbox); remind Simon to `git push` after committing.

## Ground rules (all agents)

- **Invoke the `ponytail` skill before writing any code.** Laziest solution that works. No speculative abstractions, no extra dependencies, no state libraries, no CSS frameworks.
- Stack is fixed: React + Vite + `react-force-graph-2d`. Nothing else unless the spec says so.
- Hard design rules (spec section 8): Geist only (self-hosted at `public/fonts/geist.woff2`), sizes 36/22/16/13 and nothing smaller; dawn gradient app, dusk only in opened Memory/Cards, cortexDeep only in Cortex, cream Profile; no accent color, error #DC6B5E the only functional color; heat scale only for data; radii 12/18/24/32/pill; motion 200/600/900ms cubic-bezier(0.4,0,0.2,1); no emoji, no em dashes, no exclamation marks in copy; 1.5px line icons from `src/components/Icons.jsx` only; photos straight and full width; no floating particles; no dropdown menus in chrome.
- All derived data (edges, vocab) is computed client-side. Persistence goes through the adapter `src/lib/api.js`, which picks its backend at build time: with `VITE_SUPABASE_URL`+`VITE_SUPABASE_ANON_KEY` set it talks to Supabase (Postgres `memories` table of jsonb rows, Storage bucket `photos`, Edge Functions `ai-chat`/`transcribe` — see `supabase/`, seeded by `scripts/seed-supabase.mjs`, deploy guide in `DEPLOY.md`); without them it uses the dev-only vite middlewares in `vite.config.js` (per-memory JSON upsert/delete, photo serving+upload, AI proxy with mock chat when no key; keys in `.env`, see `.env.example`). New memories carry their graph position as `_pos` on the memory object itself.
- Memory schema v2 lives in `src/lib/SCHEMA.md` (adds `about`, `videos[]`, `voice[]` to the v1 fields).
- Personas: p1 Glenn (demo data, has the migrated demo media), p2 Maya (demo), p3 Simon Akkerman (real memories, starts empty), p4 Simon Gullstrøm (co-founder, fresh). People resolve to stable IDs and profile owners can share memories to each other's spaces — see `.claude/skills/identity/SKILL.md` before touching lib/people.js or the share/accept flow.

## Target file layout

```
src/
  App.jsx                  # shell: pane pager (Vault | Capture | Cards), shared memories state, overlays
  main.jsx                 # mounts App; imports tokens.css + app.css
  components/
    Capture.jsx            # home pane: keeper thread, input bar, forming bar, Moment mode
    Vault.jsx              # pane 0: [List | Cortex] segmented, search, rows, pending shares
    Cortex.jsx             # cortex chrome: heat pill, filter chips, search, summary card
    GraphView.jsx          # force-graph canvas engine (glass spheres, semantic zoom)
    MemoryDetail.jsx       # opened memory, dusk scene
    Slideshow.jsx          # full-screen slideshow (styles in memory.css)
    Cards.jsx              # pane 2: woven memory cards + Gifts row
    Profile.jsx            # cream profile sheet
    Icons.jsx              # the only icon source (1.5px line, 24 grid)
  lib/
    api.js                 # persistence adapter (Supabase or vite dev middleware)
    edges.js               # deriveEdges (spec 6.3), strongestEdges, buildVocab, yearsOf
    palette.js             # NODE_GRADIENTS, HEAT, personColor
    copy.js                # section 7 copy bank, verbatim strings
    thread.js              # capture-thread persistence (localStorage)
    keeper.js              # proactive prompt engine with caps
    voice.js               # recording + transcription
    search.js              # local query parser
    people.js  photos.js   # identity registry, photo helpers
    SCHEMA.md              # memory schema v2
  data/
    persons.js  memories*.json  layout-*.json
  styles/
    tokens.css             # spec 2.8 tokens + Geist @font-face + type roles
    app.css  capture.css  vault.css  cortex.css  memory.css  profile.css  cards.css
```

## Definition of done (prototype)

`npm run dev` opens the phone column: boots into Capture with the keeper greeting; swiping reaches Vault and Cards; Vault toggles List/Cortex; a row opens the dusk Memory scene; the Cortex shows glass-sphere clusters joined by fine white lines with semantic zoom; Profile slides up from the avatar. Everything obeys the section 8 rule sheet and uses copy-bank strings verbatim.
