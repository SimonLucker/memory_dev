# Deploying Memmory (Supabase + Vercel)

The app has two modes, decided at build time by two env vars:

- **Dev (laptop)**: no `VITE_SUPABASE_*` set → vite dev endpoints, JSON files on disk. Nothing changes.
- **Deployed (phone, anywhere)**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set → Supabase Postgres (memories), Storage (photos), Edge Functions (AI chat + speech-to-text).

Profiles: **Glenn** (p1, the old demo data), **Maya** (p2), **Simon** (p3, starts empty — your real memories).

## 1 · Supabase (~10 min)

1. Go to [supabase.com](https://supabase.com) → sign up → **New project** (pick a region near you, e.g. eu-central). Wait ~2 min for provisioning.
2. Left sidebar → **SQL Editor** → paste the whole contents of `supabase/schema.sql` → **Run**. This creates the `memories` table, its access policy, and the public `photos` bucket.
3. Left sidebar → **Project Settings → API**. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** API key
4. Deploy the two edge functions (terminal, in the project folder):

   ```sh
   brew install supabase/tap/supabase
   supabase login                        # opens browser
   supabase link --project-ref abcdefgh  # the id from your Project URL
   supabase secrets set \
     AZURE_OPENAI_ENDPOINT=https://retailaipocpeo.openai.azure.com/ \
     AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini \
     AZURE_OPENAI_API_VERSION=preview \
     AZURE_OPENAI_API_KEY=YOUR_AZURE_KEY \
     DEEPGRAM_API_KEY=YOUR_DEEPGRAM_KEY
   supabase functions deploy ai-chat --no-verify-jwt
   supabase functions deploy transcribe --no-verify-jwt
   ```

5. Seed Glenn's and Maya's memories into the database (one-time):

   ```sh
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co \
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY \
   node scripts/seed-supabase.mjs
   ```

   Tip: leave the `VITE_SUPABASE_*` lines in `.env` empty — filling them flips
   `npm run dev` on the laptop to the live database too (occasionally useful,
   usually surprising).

## 2 · Vercel (~5 min)

1. `git push` — Vercel deploys from GitHub.
2. [vercel.com](https://vercel.com) → sign up with GitHub → **Add New… → Project** → import `memory_dev`. Framework preset auto-detects Vite; defaults are fine.
3. Before hitting Deploy, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon key
4. **Deploy**. You get a URL like `memory-dev.vercel.app`.

## 3 · Phone

Open the URL in Safari → Share → **Add to Home Screen**. Real HTTPS, so the
microphone works with no certificate warnings, from any network.

## Notes

- Old demo photos ship inside the app bundle; new photos you memorialize go to
  Supabase Storage as public URLs. New memories carry their graph position in
  `_pos` — no re-layout needed anywhere.
- Access model is POC-grade: anyone with the URL can read *and write* (the anon
  key is in the page). Keep the link private; Supabase Auth is the next step
  before sharing it.
- Redeploys: just `git push` — Vercel rebuilds automatically.
