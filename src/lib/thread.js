// Per-person Capture thread store. localStorage (memmory.thread.<personId>) is
// the synchronous cache and render source; every durable message is also
// pushed to the api.js thread backend, and syncThread() merges the two on
// load. See src/lib/SCHEMA.md for the message model and the merge rule.

import { loadThreadRemote, upsertThreadMsg, upsertThreadMsgs } from '../data/api.js'

const KEY = (personId) => `memmory.thread.${personId}`

// blob:/data: srcs are meaningless off this device; those rows reach the
// backend only after the upload-swap patches in a durable src.
const durable = (m) => !/^(blob|data):/.test(m.src || '')

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
  if (durable(full)) upsertThreadMsg(personId, full).catch(() => {}) // fire-and-forget
  return full
}

// Patch a message by id (e.g. sending → sent, add transcript). Returns it, or null.
export function updateMessage(personId, id, patch) {
  const msgs = loadThread(personId)
  const i = msgs.findIndex((m) => m.id === id)
  if (i < 0) return null
  msgs[i] = { ...msgs[i], ...patch }
  save(personId, msgs)
  // The upload-swap patch (blob: → durable src) rides this same push.
  if (durable(msgs[i])) upsertThreadMsg(personId, msgs[i]).catch(() => {})
  return msgs[i]
}

// --- The open capture window, derived from the persisted thread (5.4-5.6). ---
// A memory-card or moment-end message is a boundary: everything captured after
// the last one is the still-open bundle, so a reload mid-forming (iOS kills
// tabs freely) loses nothing. Texts flagged `meta` (questions to the keeper,
// enrichment replies) never join a bundle. momentMsg is the open moment-start
// marker (no boundary after it), or null.
const BOUNDARY_KINDS = ['memory-card', 'moment-end']
const CAPTURE_KINDS = ['user-text', 'user-photo', 'user-video', 'user-voice']
const MEDIA_KINDS = ['user-photo', 'user-video', 'user-voice']

// A media row that never produced media (a recording that failed, a photo that
// vanished) is a STATE row, not content: four dead voice rows must never turn
// into a memory made of nothing. Structural, so a forgotten `meta` flag on a
// failure path cannot re-create the field bug.
export const isCapture = (m) =>
  CAPTURE_KINDS.includes(m.kind) && !m.meta && m.state !== 'failed' &&
  !(MEDIA_KINDS.includes(m.kind) && !m.src)

export function deriveOpenWindow(msgs) {
  let start = 0
  let momentMsg = null
  for (let i = 0; i < msgs.length; i++) {
    if (BOUNDARY_KINDS.includes(msgs[i].kind)) { start = i + 1; momentMsg = null }
    else if (msgs[i].kind === 'moment-start') momentMsg = msgs[i]
  }
  return { bundle: msgs.slice(start).filter(isCapture), momentMsg }
}

// Build a plausible historical thread from existing memories: one memory-card
// message at each memory's own date, so the thread scrolls through months of
// history with sticky month groups. Seed ids derive from memory ids, so two
// devices seeding the same memories produce IDENTICAL rows and the sync union
// can never double the history. No-op when a thread already exists.
export function seedThreadFromMemories(personId, memories) {
  const existing = loadThread(personId)
  if (existing.length) return existing
  const msgs = (memories || [])
    .map((m) => ({ id: `seed_${m.id}`, ts: whenToTs(m.when), kind: 'memory-card', memoryId: m.id }))
    .sort((a, b) => a.ts - b.ts)
  save(personId, msgs)
  return msgs
}

// Reconcile the local cache with the backend: union by message id; on a
// conflicting id the local copy wins when its ts is same-or-newer (it carries
// this device's patches). Local-only durable messages are pushed up in ONE
// bulk call. When BOTH stores are empty the thread is seeded from the
// memories and the seeds pushed. Returns the merged, ts-ordered thread —
// always usable, even fully offline (loadThreadRemote resolves [] then).
export async function syncThread(personId, memories) {
  const remoteMsgs = await loadThreadRemote(personId)
  // Read local AFTER the await: anything appended while the fetch was in
  // flight is included, so saving the merge can never drop a fresh message.
  const local = loadThread(personId)
  if (!remoteMsgs.length && !local.length) {
    const seeds = seedThreadFromMemories(personId, memories)
    upsertThreadMsgs(personId, seeds).catch(() => {})
    return seeds
  }
  const byId = new Map(remoteMsgs.map((m) => [m.id, m]))
  const localOnly = []
  for (const m of local) {
    const r = byId.get(m.id)
    if (!r) { byId.set(m.id, m); if (durable(m)) localOnly.push(m) }
    else if (m.ts >= r.ts) byId.set(m.id, m)
  }
  const merged = [...byId.values()].sort((a, b) => a.ts - b.ts) // stable sort
  save(personId, merged)
  upsertThreadMsgs(personId, localOnly).catch(() => {})
  return merged
}
