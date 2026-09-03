// v2 jsonb rows -> v3 relational tables, plus Isabel's demo space.
// Run AFTER supabase/migrations/0001_v3.sql (it renames memories -> memories_v2).
//   node scripts/migrate-v3.mjs [--dry-run]
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from the env or .env.
// Idempotent: every write is an upsert on the primary key.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromV2 } from '../src/data/bridge.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dry = process.argv.includes('--dry-run')

// minimal .env loader, same as seed-supabase.mjs
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
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function get(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers })
  if (!r.ok) throw new Error(`GET ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`)
  return r.json()
}
async function upsert(table, rows) {
  if (!rows.length || dry) return
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${URL}/rest/v1/${table}`, {
      method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(rows.slice(i, i + 500)),
    })
    if (!r.ok) throw new Error(`POST ${table}: ${r.status} ${(await r.text()).slice(0, 300)}`)
  }
}

const PERSONS = [
  { id: 'p1', name: 'Glenn' }, { id: 'p2', name: 'Maya' },
  { id: 'p3', name: 'Simon Akkerman' }, { id: 'p4', name: 'Simon Gullstrøm' }, { id: 'p5', name: 'Isabel' },
]
const now = new Date().toISOString()

// Every space: the user rows first (memories.owner_id points at them).
const users = PERSONS.map(p => ({ id: p.id, name: p.name, first_name: p.name.split(' ')[0], avatar_url: null, is_user: true, space_id: p.id }))
const out = { people: [...users], memories: [], memory_people: [], moments: [], questions: [], recaps: [] }

for (const p of PERSONS.slice(0, 4)) {
  const rows = await get(`memories_v2?person_id=eq.${p.id}&select=data&order=id.asc`)
  for (const { data } of rows) {
    const r = fromV2(data, p.id, now)
    out.memories.push(r.memory); out.moments.push(...r.moments)
    out.memory_people.push(...r.links); out.people.push(...r.people)
  }
  console.log(`${p.id}: ${rows.length} v2 memories`)
}

// Isabel's bundled demo space, as is.
const isabel = JSON.parse(readFileSync(join(root, 'src/data/demo/isabel.json'), 'utf8'))
out.people.push(...isabel.people.filter(x => !x.is_user))
out.memories.push(...isabel.memories); out.moments.push(...isabel.moments)
out.memory_people.push(...isabel.links); out.questions.push(...isabel.questions); out.recaps.push(...isabel.recaps)

// Contact rows repeat per memory; one row per id is enough.
const seen = new Set()
out.people = out.people.filter(x => !seen.has(x.id) && seen.add(x.id))

for (const [table, rows] of Object.entries(out)) console.log(`${table}: ${rows.length}`)
if (dry) { console.log('dry run, nothing written'); process.exit(0) }

// Insert order follows the foreign keys.
for (const table of ['people', 'memories', 'memory_people', 'moments', 'questions', 'recaps']) await upsert(table, out[table])
console.log('Done.')
