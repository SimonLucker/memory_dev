// v2 memory object <-> v3 rows. The capture engine and the legacy surfaces
// still speak v2 (src/lib/SCHEMA.md); the store speaks rows (SCHEMA-v3.md).
// fromV2 is deterministic (ids derive from the memory id) so converting the
// same memory twice yields the same rows and a diff can find what changed.

import { REGISTRY } from '../lib/people.js'

// Registered personas are users; every other who[] id is a contact.
export const isUser = id => REGISTRY.some(p => p.id === id)

// Contact ids collide across spaces (p04 is Mom for Glenn, Diego for Maya),
// so a contact row is keyed by its space: p1_p04. Users keep their own id.
export const personRowId = (ownerId, whoId) => isUser(whoId) ? whoId : `${ownerId}_${whoId}`
const slug = name => String(name || '').trim().toLowerCase().replace(/\W+/g, '_') || 'unknown'

// 'DD-MM-YYYY HH:MM' -> ISO (local time, same as lib/thread.js whenToTs).
export const whenToIso = when => {
  const [date, time = '12:00'] = String(when || '').split(' ')
  const [dd, mm, yyyy] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  const d = new Date(yyyy, mm - 1, dd, h, min)
  return isNaN(d) ? null : d.toISOString()
}
const pad = n => String(n).padStart(2, '0')
export const isoToWhen = iso => {
  const d = new Date(iso)
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const V2_KEYS = ['id', 'what', 'where', 'when', 'who', 'feeling', 'music', 'about', 'class',
  'importance', 'photos', 'voice', 'videos', 'favorite']

// -> { memory, moments, links, people } (rows). People are the owner's
// contact rows for non-user who[] entries; users become contributor links.
export function fromV2(v2, ownerId, now = new Date().toISOString()) {
  const legacy = {}
  for (const k of Object.keys(v2)) if (!V2_KEYS.includes(k)) legacy[k] = v2[k]
  const startsAt = whenToIso(v2.when)
  const memory = {
    id: v2.id, owner_id: ownerId, title: v2.what || '', place: v2.where || '',
    starts_at: startsAt, ends_at: null, about: v2.about || '', class: v2.class || null,
    feeling: v2.feeling || [], music: v2.music || null, importance: v2.importance ?? null,
    cover_moment_id: null, favorite: Boolean(v2.favorite), demo: false, legacy,
    created_at: now, updated_at: now,
  }
  const base = { memory_id: v2.id, generated_by: ownerId, captured_at: startsAt, created_at: now }
  const moments = []
  ;(v2.photos || []).forEach((src, i) => moments.push({ ...base, id: `${v2.id}_p${i}`, kind: 'photo', src }))
  ;(v2.voice || []).forEach((v, i) => moments.push({
    ...base, id: `${v2.id}_v${i}`, kind: 'voice', src: v.src, duration: v.duration,
    transcript: v.transcript || '', demo: Boolean(v.demo),
  }))
  ;(v2.videos || []).forEach((v, i) => moments.push({
    ...base, id: `${v2.id}_vid${i}`, kind: 'video', src: v.src, duration: v.duration,
    poster: v.poster || null, demo: Boolean(v.demo),
  }))
  moments.forEach((m, i) => { m.position = i; m.demo = Boolean(m.demo) })
  const people = [], links = []
  for (const w of v2.who || []) {
    const id = personRowId(ownerId, w.id || slug(w.name))
    if (id === ownerId) continue
    if (!isUser(id)) people.push({
      id, name: w.name, first_name: String(w.name || '').split(' ')[0], avatar_url: null,
      is_user: false, space_id: ownerId, created_at: now,
    })
    links.push({ memory_id: v2.id, person_id: id, role: isUser(id) ? 'contributor' : 'tagged' })
  }
  return { memory, moments, links, people }
}

// -> the v2 object the capture engine and legacy surfaces expect.
export function toV2(db, memoryId) {
  const m = db.memories[memoryId]
  if (!m) return null
  const strip = id => id.startsWith(`${m.owner_id}_`) ? id.slice(m.owner_id.length + 1) : id
  const who = db.links.filter(l => l.memory_id === memoryId)
    .map(l => ({ id: strip(l.person_id), name: db.people[l.person_id]?.name || l.person_id }))
  const moments = Object.values(db.moments).filter(x => x.memory_id === memoryId)
    .sort((a, b) => a.position - b.position)
  const photos = moments.filter(x => x.kind === 'photo').map(x => x.src)
  const voice = moments.filter(x => x.kind === 'voice')
    .map(({ src, duration, transcript, demo }) => ({ src, duration, ...(transcript ? { transcript } : {}), ...(demo ? { demo } : {}) }))
  const videos = moments.filter(x => x.kind === 'video')
    .map(({ src, duration, poster, demo }) => ({ src, duration, ...(demo ? { demo } : {}), ...(poster ? { poster } : {}) }))
  // Arrays and music are always present (that is what the engine writes);
  // class, importance and favorite only when set.
  const v2 = {
    ...(m.legacy || {}),
    id: m.id, when: m.starts_at ? isoToWhen(m.starts_at) : '', what: m.title, where: m.place,
    who, feeling: m.feeling || [], about: m.about, music: m.music || null, photos, voice, videos,
  }
  if (m.class) v2.class = m.class
  if (m.importance != null) v2.importance = m.importance
  if (m.favorite) v2.favorite = true
  return v2
}
