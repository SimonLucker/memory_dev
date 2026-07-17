# Getting Memmory on your phone — step by step

**What we're doing:** right now the app only runs on your Mac. After these steps
it will run on the internet, so your phone can use it anywhere — no laptop needed.

Two free services do the work:

- **Supabase** stores your data: the memories, the photos you upload, and it
  runs the AI chat and speech-to-text for you (your Azure and Deepgram keys are
  stored there, safely out of the app itself).
- **Vercel** hosts the app: it turns your GitHub repository into a website with
  a proper https address.

Nothing about working on your laptop changes. `npm run dev` keeps using the
local files exactly like before.

**You'll need:** your Azure OpenAI key, your Deepgram key, and about 20 minutes.

---

## Part 1 — Create the Supabase project

1. Go to **supabase.com** and create an account (sign in with GitHub is easiest).
2. Click **New project**.
   - Name: anything, e.g. `memmory`.
   - Database password: it generates one — you won't need it, but save it somewhere.
   - Region: pick one close to you (e.g. *Central EU (Frankfurt)*).
3. Click **Create new project** and wait a minute or two while it sets up.

## Part 2 — Create the database table and photo storage

1. In the left sidebar, click **SQL Editor**.
2. On your Mac, open the file `supabase/schema.sql` from the project folder,
   copy **everything** in it, and paste it into the editor.
3. Click **Run** (bottom right). You should see *"Success. No rows returned"*.

That's the whole database setup: a table for memories and a bucket for photos.

## Part 3 — Copy your two project keys

1. In the left sidebar, click the gear icon → **Project Settings** → **API**.
2. You need two values from this page — keep it open, you'll paste them three times today:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string of letters under "Project API keys"

The part of the URL before `.supabase.co` (here `abcdefgh`) is your
**project ref** — you'll need it in the next part.

## Part 4 — Set up the AI functions (Terminal)

This part runs a few commands in Terminal. Open Terminal and go to the project:

```sh
cd ~/Documents/graph_prototype
```

**4a. Install the Supabase command-line tool** (one time only):

```sh
brew install supabase/tap/supabase
```

**4b. Log in and connect this folder to your project:**

```sh
supabase login
```

(a browser window opens — approve it)

```sh
supabase link --project-ref abcdefgh
```

(replace `abcdefgh` with YOUR project ref from Part 3; if it asks for a
database password, use the one from Part 1)

**4c. Store your AI keys in Supabase.** Copy this whole block, replace the two
`PASTE_..._HERE` parts, then paste it into Terminal and press enter:

```sh
supabase secrets set \
  AZURE_OPENAI_ENDPOINT=https://retailaipocpeo.openai.azure.com/ \
  AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini \
  AZURE_OPENAI_API_VERSION=preview \
  AZURE_OPENAI_API_KEY=PASTE_YOUR_AZURE_KEY_HERE \
  DEEPGRAM_API_KEY=PASTE_YOUR_DEEPGRAM_KEY_HERE
```

**4d. Publish the two AI functions:**

```sh
supabase functions deploy ai-chat --no-verify-jwt
supabase functions deploy transcribe --no-verify-jwt
```

Each should end with a success message.

## Part 5 — Copy Glenn's and Maya's memories into the database

One command, run once. Replace the two values with yours from Part 3:

```sh
VITE_SUPABASE_URL=https://abcdefgh.supabase.co \
VITE_SUPABASE_ANON_KEY=PASTE_YOUR_ANON_KEY_HERE \
node scripts/seed-supabase.mjs
```

You should see:

```
p1: seeded 43 memories
p2: seeded 241 memories
Done. (p3 / Simon starts empty on purpose.)
```

Your own profile (Simon) deliberately starts empty — you'll fill it from your phone.

## Part 6 — Put the app online with Vercel

1. First, push the code to GitHub. In Terminal:

   ```sh
   git push
   ```

2. Go to **vercel.com** → sign up → **Continue with GitHub**.
3. Click **Add New… → Project**. Find `memory_dev` in the list and click **Import**.
4. It detects the settings by itself (Framework: Vite). **Don't click Deploy yet.**
5. Open the **Environment Variables** section on that same screen and add two entries:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL from Part 3 |
   | `VITE_SUPABASE_ANON_KEY` | your anon key from Part 3 |

6. Now click **Deploy**. After a minute you get your address, something like
   `https://memory-dev.vercel.app`. Click it to check it loads.

## Part 7 — Put it on your phone

1. Open that address in **Safari on your iPhone**.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.

Done. It opens full-screen like an app, and the microphone and camera work
anywhere — home, work, on the train.

---

## Good to know

- **Making changes later:** any time we improve the app, just `git push` —
  Vercel rebuilds the site by itself within a minute or two.
- **Keep the link private.** There's no login yet, so anyone who has the
  address can see and change the memories. Adding accounts is the next step
  before you share it with anyone.
- **Laptop unchanged:** `npm run dev` still uses the local files, not the
  online database. (If you ever want the laptop to talk to the online database
  too, fill the two `VITE_SUPABASE_*` lines in `.env` — but leave them empty
  for normal work, it's confusing otherwise.)
- **If something fails:** copy the error message and paste it to Claude —
  most failures here are a typo in a key or a missed step, fixed in a minute.
