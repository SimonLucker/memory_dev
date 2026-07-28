// Per-person Capture thread store. Prototype-only persistence: localStorage
// under memmory.thread.<personId>. See src/lib/SCHEMA.md for the message model.

const KEY = (personId) => `memmory.thread.${personId}`

// Sticky month-group key for a timestamp: "2026-07".
export const monthKey = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// 'DD-MM-YYYY HH:MM' (the memory `when` format) → epoch ms.
export const whenToTs = (when) => {
  const [date, time = '12:00'] = String(when).split(' ')
  const [dd, mm, yyyy] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(yyyy, mm - 1, dd, h, min).getTime()
}

// --- Small display helpers shared by Capture, Vault, Cards, MemoryDetail. ---

// '2026-07' (monthKey) → 'July 2026'
export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// The one metadata line a memory row/card gets: 'Dec 27 · Luang Prabang'.
export const metaLine = (m) => {
  const d = new Date(whenToTs(m.when))
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return m.where ? `${date} · ${m.where}` : date
}

// Seconds → 'm:ss'
export const fmtDur = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round(s || 0) % 60).padStart(2, '0')}`

// Static waveform bar heights (mockup values, cycled).
export const WAVE = [30, 70, 45, 90, 55, 75, 35, 60, 50, 80, 40, 65]

export function loadThread(personId) {
  try {
    return JSON.parse(localStorage.getItem(KEY(personId))) || []
  } catch {
    return []
  }
}

function save(personId, msgs) {
  // ponytail: localStorage only, swap for the api.js backend when threads go real
  try { localStorage.setItem(KEY(personId), JSON.stringify(msgs)) } catch {}
}

// Append one message; id and ts are minted when missing. Returns the stored message.
export function appendMessage(personId, msg) {
  const msgs = loadThread(personId)
  const full = {
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    ...msg,
  }
  msgs.push(full)
  save(personId, msgs)
  return full
}

// Patch a message by id (e.g. sending → sent, add transcript). Returns it, or null.
export function updateMessage(personId, id, patch) {
  const msgs = loadThread(personId)
  const i = msgs.findIndex((m) => m.id === id)
  if (i < 0) return null
  msgs[i] = { ...msgs[i], ...patch }
  save(personId, msgs)
  return msgs[i]
}

// Build a plausible historical thread from existing memories: one memory-card
// message at each memory's own date, so the thread scrolls through months of
// history with sticky month groups. No-op when a thread already exists.
export function seedThreadFromMemories(personId, memories) {
  const existing = loadThread(personId)
  if (existing.length) return existing
  const msgs = (memories || [])
    .map((m) => ({ id: `seed_${m.id}`, ts: whenToTs(m.when), kind: 'memory-card', memoryId: m.id }))
    .sort((a, b) => a.ts - b.ts)
  save(personId, msgs)
  return msgs
}
