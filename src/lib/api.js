// Storage adapter — ONE fetch contract, two backends.
//
// Remote (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set, e.g. the Vercel build):
//   memories  → Supabase Postgres via PostgREST (person_id, id, data jsonb)
//   photos    → Supabase Storage bucket "photos" (public URLs)
//   AI + STT  → Supabase Edge Functions ai-chat / transcribe (keys live there)
// Dev (no env): the vite middlewares in vite.config.js, JSON files on disk.
//
// New-memory graph positions travel INSIDE the memory as `_pos: [x, y]` — no
// layout table, no layout-file writes; the static layout JSONs seed the base.

const SB_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const remote = Boolean(SB_URL && SB_KEY)

const sbHeaders = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
}

const ok = async r => {
  if (!r.ok) throw new Error(`${r.status} ${await r.text().then(t => t.slice(0, 200)).catch(() => '')}`)
  return r
}

// → array of memory objects for a person (remote source of truth), or null in dev
// (dev seeds from the bundled JSON imports).
export async function loadMemories(personId) {
  if (!remote) return null
  const r = await ok(await fetch(
    `${SB_URL}/rest/v1/memories?person_id=eq.${personId}&select=data&order=id.asc`,
    { headers: sbHeaders }))
  return (await r.json()).map(row => row.data)
}

export async function upsertMemory(personId, memory) {
  if (remote) {
    await ok(await fetch(`${SB_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ person_id: personId, id: memory.id, data: memory }),
    }))
  } else {
    await fetch('/__save-memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: personId, upsert: memory }),
    }).catch(() => console.warn('save endpoint unavailable — edit kept in memory only'))
  }
}

export async function removeMemory(personId, id) {
  if (remote) {
    await ok(await fetch(`${SB_URL}/rest/v1/memories?person_id=eq.${personId}&id=eq.${id}`, {
      method: 'DELETE',
      headers: sbHeaders,
    }))
  } else {
    await fetch('/__save-memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: personId, delete: id }),
    }).catch(() => {})
  }
}

// → the src to store in memory.photos: a public URL (remote) or a
// bundle-relative path (dev).
export async function uploadPhoto(blob) {
  if (remote) {
    const name = `new_${Date.now()}.${blob.type.includes('png') ? 'png' : 'jpg'}`
    await ok(await fetch(`${SB_URL}/storage/v1/object/photos/${name}`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
    }))
    return `${SB_URL}/storage/v1/object/public/photos/${name}`
  }
  const r = await ok(await fetch('/__upload-photo', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob }))
  return (await r.json()).path
}

// → assistant message content string. Throws with a readable message on failure.
export async function chat(messages) {
  const url = remote ? `${SB_URL}/functions/v1/ai-chat` : '/__ai/chat'
  const r = await fetch(url, {
    method: 'POST',
    headers: { ...(remote ? sbHeaders : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const data = await r.json().catch(() => ({}))
  if (data.error) throw new Error(data.error)
  // Anything without content is a misconfiguration (wrong URL, gateway error…):
  // surface the raw response instead of letting callers crash on undefined.
  if (typeof data.content !== 'string') throw new Error('Unexpected AI response: ' + JSON.stringify(data).slice(0, 200))
  return data.content
}

// → transcript string ('' when unavailable; notice carries the reason).
export async function transcribe(blob) {
  const url = remote ? `${SB_URL}/functions/v1/transcribe` : '/__ai/transcribe'
  const r = await fetch(url, {
    method: 'POST',
    headers: { ...(remote ? sbHeaders : {}), 'Content-Type': blob.type || 'audio/webm' },
    body: blob,
  })
  const data = await r.json().catch(() => ({}))
  if (!('transcript' in data) && !data.error) {
    return { transcript: '', error: 'Unexpected transcribe response: ' + JSON.stringify(data).slice(0, 120) }
  }
  return data
}
