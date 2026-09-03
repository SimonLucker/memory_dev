# Memmory — project orchestration (v3)

React + Vite prototype of Memmory, a calm mobile-first memory keeper. Phone-sized column on desktop, full viewport on phones.

**Master spec: `docs/design-foundation-v3.md`** (sections 3, 4, 5, 8 binding; 7 is the copy bank, verbatim). Visual twin: `docs/reference/roadmap-2026-08-21.html` + `docs/reference/mockups/*.png`. **Architecture and module contracts: `ARCHITECTURE.md`** (one folder per subsystem, nav model, data model, verification loop). Decisions already taken with Simon are listed at the top of ARCHITECTURE.md; do not re-ask them. The spec wins over code and over the Expo file paths it mentions.

## Layout

`src/core` shell, nav, tokens, icons, copy · `src/data` schema, adapter (Supabase or vite `/__db` middleware), store, selectors, v2 bridge, personas, Isabel demo seed · `src/home` `src/memories` `src/story` `src/recap` `src/capture` `src/profile` one screen each (`index.jsx`, `<module>.css`, `showcase.js`) · `src/legacy` the v2.5 app behind `?legacy=1` · `src/lib` unchanged engine libs (thread, keeper, voice, synthesize, photos, avatar, people, settings) · `tools/` shot.mjs, gauntlet.mjs, status.mjs, smoke-*.mjs · `docs/` spec, reference, CRITIC.md, STATUS.json, status/<module>.json, shots/ (gitignored).

## Ground rules (all agents)

- Invoke the `ponytail` skill before writing code. No new runtime dependencies. Plain JSX, no TypeScript.
- Edit only the folder you own. Core, data, lib, tools and vite.config.js go through the integrator.
- Nobody claims a screen works without a shot: `node tools/shot.mjs "<path>" --out <name>` (auto-starts the dev server on 127.0.0.1:5173), `node tools/gauntlet.mjs <module> --quick`. Read the PNG before reporting.
- Rule sheet: spec section 8 (also condensed in `docs/CRITIC.md`). Copy only from `src/core/copy.js`. Icons only from `src/core/Icons.jsx`. No em dashes, exclamation marks or emoji in UI.
- Token discipline: read only the files the task names, keep reports short, never re-read the spec when `docs/CRITIC.md` answers the question.

## Backend

Dual backend in `src/data/api.js`: Supabase (PostgREST + Storage + edge functions) when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, else the vite middlewares. Relational schema in `supabase/migrations/0001_v3.sql` (Simon runs it in the SQL editor; not applied yet), converter `scripts/migrate-v3.mjs`, schema notes `src/data/SCHEMA-v3.md`. Personas p1 Glenn, p2 Maya, p3 Simon A, p4 Simon G, p5 Isabel (demo world).

## Version control

Work happens in the cloud container at `/home/claude/work/graph_prototype`; verified iterations are committed there, then synced to Simon's Mac (`_sync/` tarball, `git commit` on branch `dev`). Simon pushes to `origin` himself. Conventional Commits, terse, no AI attribution.
