// Memories: the photo grid of everything kept (design-foundation-v3.md 5.2).
// Solo memories sit two by two as squares; a shared memory (one with
// contributors) takes the full width and shows its people. Tap = story,
// grown from the tile's rect.
import { useMemo, useRef } from 'react'
import './memories.css'
import Avatar from '../core/Avatar.jsx'
import { Search } from '../core/Icons.jsx'
import {
  MEMORIES_TITLE, MEMORIES_COUNT, MEMORIES_EMPTY, MEMORIES_FILTERED_COUNT, MEMORIES_NO_MATCH,
  CLEAR_FILTER, CORTEX_SEARCH_PLACEHOLDER,
} from '../core/copy.js'
import { memoriesOf, momentsOf, sharedOf } from '../data/select.js'
import { photoSrc, onPhotoError } from '../lib/photos.js'

const MAX_CHIPS = 12
const first = name => String(name || '').split(' ')[0]

// Frequency-ranked filter chips from the persona's own memories: people
// (excluding the persona), then feelings, then places, most common first.
function buildChips(db, memories) {
  const ids = new Set(memories.map(m => m.id))
  const people = new Map(), feelings = new Map(), places = new Map()
  const bump = (map, key) => key && map.set(key, (map.get(key) || 0) + 1)
  db.links.forEach(l => {
    if (ids.has(l.memory_id) && db.people[l.person_id] && l.person_id !== db.memories[l.memory_id]?.owner_id) bump(people, l.person_id)
  })
  memories.forEach(m => { (m.feeling || []).forEach(f => bump(feelings, f)); bump(places, m.place) })
  const rank = map => [...map.entries()].sort((a, b) => b[1] - a[1])
  return [
    ...rank(people).map(([id]) => ({ type: 'people', value: id, label: first(db.people[id].name) })),
    ...rank(feelings).map(([v]) => ({ type: 'feelings', value: v, label: v })),
    ...rank(places).map(([v]) => ({ type: 'places', value: v, label: v })),
  ].slice(0, MAX_CHIPS)
}

const hasActiveFilter = f => !!(f.q && f.q.trim()) || f.people?.length > 0 || f.feelings?.length > 0 || f.places?.length > 0

// A memory passes when every q word is found in its title/place/about/people
// names/voice transcripts, AND it has every selected person, AND any
// selected feeling, AND matches any selected place.
function memoryMatches(db, memory, filter) {
  const q = (filter.q || '').trim().toLowerCase()
  if (q) {
    const links = db.links.filter(l => l.memory_id === memory.id)
    const names = [db.people[memory.owner_id]?.name, ...links.map(l => db.people[l.person_id]?.name)]
    const transcripts = momentsOf(db, memory.id).filter(m => m.kind === 'voice').map(m => m.transcript)
    const hay = [memory.title, memory.place, memory.about, ...names, ...transcripts].filter(Boolean).join(' ').toLowerCase()
    if (!q.split(/\s+/).every(w => hay.includes(w))) return false
  }
  if (filter.people?.length) {
    const linked = new Set(db.links.filter(l => l.memory_id === memory.id).map(l => l.person_id))
    if (!filter.people.every(p => linked.has(p))) return false
  }
  if (filter.feelings?.length && !filter.feelings.some(f => (memory.feeling || []).includes(f))) return false
  if (filter.places?.length && !filter.places.includes(memory.place)) return false
  return true
}

const toggleChip = (setFilter, chip) => setFilter(f => {
  const cur = f[chip.type] || []
  return { ...f, [chip.type]: cur.includes(chip.value) ? cur.filter(v => v !== chip.value) : [...cur, chip.value] }
})

const day = (d, year) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(year && { year: 'numeric' }) })

// "June 14", "June 14, 2017", "July 12–19", "July 30 – August 2".
export function dateLine(memory, now = new Date()) {
  const a = new Date(memory.starts_at)
  if (isNaN(a)) return ''
  const year = a.getFullYear() !== now.getFullYear()
  const b = memory.ends_at ? new Date(memory.ends_at) : a
  if (isNaN(b) || b.toDateString() === a.toDateString()) return day(a, year)
  if (b.getMonth() === a.getMonth() && b.getFullYear() === a.getFullYear()) return `${day(a, false)}–${b.getDate()}${year ? `, ${a.getFullYear()}` : ''}`
  return `${day(a, false)} – ${day(b, year)}`
}

// The tile photo: the cover moment, else the first photo or video poster.
const coverOf = (db, memory) => {
  const ms = momentsOf(db, memory.id)
  const m = db.moments[memory.cover_moment_id] || ms.find(x => x.kind === 'photo') || ms.find(x => x.kind === 'video')
  return m ? (m.kind === 'video' ? m.poster : m.src) : null
}

function Tile({ db, memory, wide, eager, nav }) {
  const img = useRef(null)
  const people = wide ? sharedOf(db, memory.id) : null
  // "June 14 · Amsterdam" for a solo memory, "7 people · July 12–19" for a shared one (copy bank).
  const meta = (people ? [`${people.length} people`, dateLine(memory)] : [dateLine(memory), memory.place]).filter(Boolean).join(' · ')
  const src = photoSrc(coverOf(db, memory))
  return (
    <button className={`mg-tile${wide ? ' mg-wide' : ''}`} onClick={() => nav.openStory(memory.id, img.current?.getBoundingClientRect())}>
      <span className="mg-photo" ref={img}>
        {/* loading before src: React sets props in order and a src set first fetches at once */}
        {src && <img loading={eager ? 'eager' : 'lazy'} decoding="async" src={src} alt="" onError={onPhotoError} />}
      </span>
      <span className="mg-title">{memory.title}</span>
      <span className="mg-meta">
        {people && (
          <span className="mg-stack" aria-hidden="true">
            {/* Faces lead the stack; a person without a photo (the initial) fills in last. */}
            {[...people].sort((a, b) => !!b.avatar_url - !!a.avatar_url).slice(0, 3)
              .map(p => <Avatar key={p.id} size={22} person={{ id: p.id, name: p.name, photo: photoSrc(p.avatar_url) }} />)}
          </span>
        )}
        <span className="mg-meta-text">{meta}</span>
      </span>
    </button>
  )
}

export default function Memories({ db, personId, nav, filter, setFilter }) {
  const memories = memoriesOf(db, personId)
  // Wide = has at least one contributor (a shared memory, section 3); tagged people alone keep the square.
  const shared = useMemo(() => new Set(db.links.filter(l => l.role === 'contributor').map(l => l.memory_id)), [db])

  const chips = useMemo(() => buildChips(db, memories), [db, memories])
  const filtered = useMemo(() => memories.filter(m => memoryMatches(db, m, filter)), [db, memories, filter])
  const active = hasActiveFilter(filter)

  if (!memories.length) return <div className="mg mg-empty"><p className="t-body">{MEMORIES_EMPTY}</p></div>
  return (
    <div className="mg">
      <h1 className="t-display">{MEMORIES_TITLE}</h1>
      <p className="mg-count">{active ? MEMORIES_FILTERED_COUNT(filtered.length, memories.length) : MEMORIES_COUNT(memories.length)}</p>
      <label className="mg-search">
        <Search size={18} />
        <input type="text" inputMode="search" placeholder={CORTEX_SEARCH_PLACEHOLDER}
          value={filter.q || ''} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} />
      </label>
      {chips.length > 0 && (
        <div className="mg-chips">
          {/* Clear leads the row: at the end it scrolls off and cannot be found. */}
          {active && <button className="mg-chip mg-chip-clear" onClick={() => setFilter({})}>{CLEAR_FILTER}</button>}
          {chips.map(c => (
            <button key={`${c.type}:${c.value}`} className={`mg-chip${(filter[c.type] || []).includes(c.value) ? ' on' : ''}`}
              onClick={() => toggleChip(setFilter, c)}>{c.label}</button>
          ))}
        </div>
      )}
      {active && !filtered.length && <p className="t-body mg-nomatch">{MEMORIES_NO_MATCH}</p>}
      <div className="mg-grid">
        {filtered.map((m, i) => <Tile key={m.id} db={db} memory={m} wide={shared.has(m.id)} eager={i < 4} nav={nav} />)}
      </div>
    </div>
  )
}
