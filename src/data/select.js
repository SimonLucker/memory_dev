// Pure selectors over the normalized db (store.js). Memoized by db identity
// plus the other arguments, so a screen re-rendering with the same db gets
// the same arrays back.

const memo = fn => {
  const cache = new WeakMap()
  return (db, ...args) => {
    let m = cache.get(db)
    if (!m) cache.set(db, m = new Map())
    const k = JSON.stringify(args)
    if (!m.has(k)) m.set(k, fn(db, ...args))
    return m.get(k)
  }
}

const ts = x => (x ? new Date(x).getTime() : 0)
const DAY = 86400e3
const BEAT_S = 5
const first = name => String(name || '').split(' ')[0]

const linksOf = (db, id) => db.links.filter(l => l.memory_id === id)
const recapRow = (db, id) => Object.values(db.recaps).find(r => r.memory_id === id) || null
const isShared = (db, id) => linksOf(db, id).some(l => l.role === 'contributor')

// Story order: position, then captured_at. The composer never reorders.
export const momentsOf = memo((db, id) => Object.values(db.moments)
  .filter(m => m.memory_id === id)
  .sort((a, b) => (a.position - b.position) || (ts(a.captured_at) - ts(b.captured_at))))

// -> Memory[] the persona owns or contributes to, newest first, demo last.
export const memoriesOf = memo((db, pid) => {
  const mine = new Set(db.links.filter(l => l.person_id === pid && l.role === 'contributor').map(l => l.memory_id))
  return Object.values(db.memories)
    .filter(m => m.owner_id === pid || mine.has(m.id))
    .sort((a, b) => (a.demo - b.demo) || (ts(b.starts_at) - ts(a.starts_at)))
})

export const countOf = (db, pid) => memoriesOf(db, pid).length

// -> people row: owner first as You, then the others in first-moment order.
export const sharedOf = memo((db, id) => {
  const m = db.memories[id]
  if (!m) return []
  const firstAt = {}
  momentsOf(db, id).forEach((x, i) => { if (x.generated_by && !(x.generated_by in firstAt)) firstAt[x.generated_by] = i })
  const others = linksOf(db, id).map(l => l.person_id).filter(p => p !== m.owner_id && db.people[p])
    .sort((a, b) => (firstAt[a] ?? Infinity) - (firstAt[b] ?? Infinity))
  const owner = db.people[m.owner_id] || { id: m.owner_id, name: m.owner_id }
  return [{ ...owner, label: 'You' }, ...others.map(p => ({ ...db.people[p], label: first(db.people[p].name) }))]
})

// -> earlier memories sharing a person or a place, strongest first.
export const relatedOf = memo((db, id, n = 3) => {
  const m = db.memories[id]
  if (!m) return []
  const people = new Set(linksOf(db, id).map(l => l.person_id))
  const place = (m.place || '').trim().toLowerCase()
  return Object.values(db.memories)
    .filter(o => o.id !== id && o.owner_id === m.owner_id && ts(o.starts_at) < ts(m.starts_at))
    .map(o => {
      const shared = linksOf(db, o.id).filter(l => people.has(l.person_id)).length
      const samePlace = place && (o.place || '').trim().toLowerCase() === place ? 1 : 0
      return { o, shared, samePlace }
    })
    .filter(r => r.shared || r.samePlace)
    .sort((a, b) => (b.shared - a.shared) || (b.samePlace - a.samePlace) || (ts(b.o.starts_at) - ts(a.o.starts_at)))
    .slice(0, n).map(r => r.o)
})

// Oldest unanswered question on a memory (or null).
const openQuestion = (db, id) => Object.values(db.questions)
  .filter(q => q.memory_id === id && !q.answered_at)
  .sort((a, b) => ts(a.asked_at) - ts(b.asked_at))[0] || null

// -> { memory, blocks, people, shared, question, related }. Blocks in capture
// order: first photo = hero, consecutive photos pair up, a lone trailing
// photo is full width, voice and text stay where captured, the song after
// the last media block, related and question always last.
export const storyOf = memo((db, id) => {
  const memory = db.memories[id]
  if (!memory) return null
  const by = m => db.people[m.generated_by] || db.people[memory.owner_id] || null
  const blocks = []
  let run = []
  let hero = false
  const flush = () => {
    if (!hero && run.length) { blocks.push({ kind: 'hero', moments: [run[0]], by: by(run[0]) }); hero = true; run = run.slice(1) }
    for (; run.length >= 2; run = run.slice(2)) blocks.push({ kind: 'pair', moments: run.slice(0, 2), by: by(run[0]) })
    if (run.length) blocks.push({ kind: 'photo', moments: run, by: by(run[0]) })
    run = []
  }
  for (const m of momentsOf(db, id)) {
    if (m.kind === 'photo') { run.push(m); continue }
    flush()
    blocks.push({ kind: m.kind === 'answer' ? 'text' : m.kind, moments: [m], by: by(m) })
  }
  flush()
  if (memory.music) {
    let i = blocks.length
    while (i > 0 && blocks[i - 1].kind === 'text') i--
    blocks.splice(i, 0, { kind: 'song', moments: [], by: db.people[memory.owner_id] || null, music: memory.music })
  }
  const related = relatedOf(db, id)
  if (related.length) blocks.push({ kind: 'related', moments: [], by: null, memories: related })
  const question = openQuestion(db, id)
  if (question) blocks.push({ kind: 'question', moments: [], by: null, question })
  return { memory, blocks, people: sharedOf(db, id), shared: isShared(db, id), question, related }
})

// -> { hero, cards, latest } for the Home screen at `now`.
export const homeOf = memo((db, pid, now) => {
  const t = ts(now) || Date.now()
  const mems = memoriesOf(db, pid)
  const hero = mems.find(m => recapRow(db, m.id) || isShared(db, m.id)) || mems[0] || null
  const yearAgo = new Date(t); yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const cards = []
  for (const m of mems) if (Math.abs(ts(m.starts_at) - yearAgo.getTime()) <= 3 * DAY) cards.push({ kind: 'year-ago', memory: m })
  const ids = new Set(mems.map(m => m.id))
  const q = Object.values(db.questions)
    .filter(x => ids.has(x.memory_id) && !x.answered_at && (!x.person_id || x.person_id === pid))
    .sort((a, b) => ts(a.asked_at) - ts(b.asked_at))[0]
  if (q) cards.push({ kind: 'question', memory: db.memories[q.memory_id], question: q })
  const seen = new Set()
  for (const x of Object.values(db.moments).sort((a, b) => ts(b.created_at) - ts(a.created_at))) {
    if (!ids.has(x.memory_id) || !x.generated_by || x.generated_by === pid || seen.has(x.memory_id)) continue
    if (t - ts(x.created_at) > 7 * DAY || ts(x.created_at) > t) continue
    seen.add(x.memory_id)
    const count = Object.values(db.moments).filter(y => y.memory_id === x.memory_id && y.generated_by === x.generated_by && t - ts(y.created_at) <= 7 * DAY).length
    cards.push({ kind: 'contributed', memory: db.memories[x.memory_id], by: db.people[x.generated_by] || null, count })
  }
  return { hero, cards: cards.slice(0, 3), latest: mems.slice(0, 3) }
})

// -> Beat[]: the stored recap when there is one, else composed from the story.
// Beat = { kind: 'photo'|'video', src, poster, duration, by, voice, quote }
export const recapOf = memo((db, id) => {
  const stored = recapRow(db, id)
  if (stored?.beats?.length) return stored.beats
  const beats = []
  let voice = null, quote = null
  const attach = b => {
    if (voice) { b.voice = voice; b.duration = Math.max(b.duration, voice.duration || 0); voice = null }
    if (quote) { b.quote = quote; quote = null }
  }
  for (const m of momentsOf(db, id)) {
    if (m.kind === 'photo' || m.kind === 'video') {
      const b = { kind: m.kind, src: m.src, poster: m.poster || null, duration: BEAT_S, by: m.generated_by, voice: null, quote: null }
      attach(b)
      beats.push(b)
    } else if (m.kind === 'voice') {
      voice = { src: m.src, transcript: m.transcript || '', duration: m.duration || 0, demo: Boolean(m.demo), by: m.generated_by }
    } else if (m.text) {
      quote = { text: m.text, by: m.generated_by }
    }
  }
  // Trailing voice or text with nothing after it lands on the last beat.
  if (beats.length && (voice || quote)) attach(beats[beats.length - 1])
  return beats
})

// The song under a recap: the stored one, else the memory's music.
export const songOf = (db, id) => {
  return recapRow(db, id)?.song || db.memories[id]?.music || null
}
