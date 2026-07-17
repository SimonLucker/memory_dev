// One-time seed: push the bundled demo memories (Glenn p1, Maya p2) into the
// Supabase memories table. Graph positions from the precomputed layout files are
// injected as _pos so the deployed app never needs the layout JSONs for these rows.
// Usage: VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/seed-supabase.mjs
// (or just have those two lines in .env — this script reads it.)
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// minimal .env loader — no dependency needed
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const URL = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.VITE_SUPABASE_ANON_KEY || ''
if (!URL || !KEY) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (env or .env) first.')
  process.exit(1)
}

const PERSONS = [
  { id: 'p1', mem: 'memories.json', layout: 'layout-p1.json' },
  { id: 'p2', mem: 'memories-p2.json', layout: 'layout-p2.json' },
]

for (const p of PERSONS) {
  const memories = JSON.parse(readFileSync(join(root, 'src/data', p.mem), 'utf8'))
  const layout = JSON.parse(readFileSync(join(root, 'src/data', p.layout), 'utf8'))
  const rows = memories.map((m) => ({
    person_id: p.id,
    id: m.id,
    data: { ...m, _pos: m._pos || layout[m.id] || undefined },
  }))
  const r = await fetch(`${URL}/rest/v1/memories`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })
  if (!r.ok) {
    console.error(`${p.id}: FAILED ${r.status}`, (await r.text()).slice(0, 300))
    process.exit(1)
  }
  console.log(`${p.id}: seeded ${rows.length} memories`)
}
console.log('Done. (p3 / Simon starts empty on purpose.)')
