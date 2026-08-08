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

// Tolerate the common paste mistake of a service path on the project URL.
const SB_URL = (import.meta.env.VITE_SUPABASE_URL || '')
  .replace(/\/(rest|functions|storage)\/v1\/?$/, '')
  .replace(/\/$/, '')
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

// Memory Cards — same dual-backend pattern as memories. Remote: Supabase
// `cards` table (person_id, id, data jsonb). Dev: the /__cards middleware,
// JSON files src/data/cards-<pid>.json. → array of card objects, [] on any
// failure (a missing table or endpoint must never break the pane).
export async function loadCards(personId) {
  try {
    if (remote) {
      const r = await ok(await fetch(
        `${SB_URL}/rest/v1/cards?person_id=eq.${personId}&select=data&order=id.asc`,
        { headers: sbHeaders }))
      return (await r.json()).map(row => row.data)
    }
    const r = await fetch(`/__cards?person=${personId}`)
    return r.ok ? await r.json() : []
  } catch { return [] }
}

export async function upsertCard(personId, card) {
  if (remote) {
    await ok(await fetch(`${SB_URL}/rest/v1/cards`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ person_id: personId, id: card.id, data: card }),
    }))
  } else {
    await fetch('/__cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: personId, upsert: card }),
    }).catch(() => console.warn('cards endpoint unavailable — card kept in memory only'))
  }
}

// Profile settings (avatar URL, later: music pref etc.) — dual-backend like
// cards. Remote: Supabase `profiles` table (person_id pk, data jsonb). Dev:
// /__profiles middleware, src/data/profiles.json. → object or null; a missing
// table or endpoint must never break anything.
export async function loadProfile(personId) {
  try {
    if (remote) {
      const r = await ok(await fetch(
        `${SB_URL}/rest/v1/profiles?person_id=eq.${personId}&select=data`,
        { headers: sbHeaders }))
      const rows = await r.json()
      return rows[0]?.data || null
    }
    const r = await fetch(`/__profiles?person=${personId}`)
    return r.ok ? await r.json() : null
  } catch { return null }
}

export async function upsertProfile(personId, data) {
  const merged = { ...(await loadProfile(personId)), ...data }
  if (remote) {
    await ok(await fetch(`${SB_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ person_id: personId, data: merged }),
    }))
  } else {
    await fetch('/__profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: personId, data: merged }),
    }).catch(() => {})
  }
  return merged
}

export async function removeCard(personId, id) {
  if (remote) {
    await ok(await fetch(`${SB_URL}/rest/v1/cards?person_id=eq.${personId}&id=eq.${id}`, {
      method: 'DELETE',
      headers: sbHeaders,
    }))
  } else {
    await fetch('/__cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: personId, delete: id }),
    }).catch(() => {})
  }
}

// Mobile networks drop uploads constantly; the field build made the user tap
// retry until one got through. Every upload now walks this ladder first and
// only rejects (→ tap-to-retry) once it is exhausted.
// ponytail: fixed delays, no jitter or queue — add both if uploads ever batch.
const RETRY_MS = [1000, 4000, 10000]
async function withRetry(attempt) {
  for (let i = 0; ; i++) {
    try { return await attempt() } catch (e) {
      if (i >= RETRY_MS.length) throw e
      await new Promise(r => setTimeout(r, RETRY_MS[i]))
    }
  }
}

// → the src to store in memory.photos: a public URL (remote) or a
// bundle-relative path (dev).
export const uploadPhoto = blob => withRetry(() => putPhoto(blob))
async function putPhoto(blob) {
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

// → the durable src to store for a voice note, following the photo pattern:
// Storage public URL (remote) or a bundle-relative path (dev middleware).
// Extension follows the recorded type (iOS records audio/mp4 → .m4a, the
// WebAudio fallback in voice.js produces audio/wav → .wav).
export const uploadAudio = blob => withRetry(() => putAudio(blob))
async function putAudio(blob) {
  const type = blob.type || ''
  const ext = type.includes('mp4') ? 'm4a' : type.includes('wav') ? 'wav' : 'webm'
  if (remote) {
    const name = `voice_${Date.now()}.${ext}`
    await ok(await fetch(`${SB_URL}/storage/v1/object/photos/${name}`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Content-Type': blob.type || 'audio/webm' },
      body: blob,
    }))
    return `${SB_URL}/storage/v1/object/public/photos/${name}`
  }
  const r = await ok(await fetch('/__upload-audio', { method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob }))
  return (await r.json()).path
}

// → assistant message content string. Throws with a readable message on failure.
// ('ai-chat' / '/__ai/chat' are deployed backend route names, kept as-is.)
export async function ask(messages) {
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

// Apple catalog lookup via our backend (edge function / dev middleware) —
// server-side so browser content blockers and CORS can't break it.
// → { trackName, artistName, previewUrl, artworkUrl100, trackViewUrl } | null
export async function findTrack(music) {
  if (!music) return null
  const country = (((navigator.language || '').split('-')[1]) || 'US').toUpperCase()
  const url = remote ? `${SB_URL}/functions/v1/music-search` : '/__music'
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...(remote ? sbHeaders : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist: music.artist, name: music.name, country }),
    })
    return (await r.json()).result || null
  } catch { return null }
}

// Fallback when the catalog finds nothing: hand the search to Apple Music.
export const appleMusicSearchUrl = music =>
  `https://music.apple.com/search?term=${encodeURIComponent(`${music.artist || ''} ${music.name || ''}`.trim())}`
