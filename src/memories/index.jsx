// Memories: the photo grid of everything kept (design-foundation-v3.md 5.2).
// Solo memories sit two by two as squares; a shared memory (one with
// contributors) takes the full width and shows its people. Tap = story,
// grown from the tile's rect.
import { useMemo, useRef } from 'react'
import './memories.css'
import Avatar from '../core/Avatar.jsx'
import { MEMORIES_TITLE, MEMORIES_COUNT, MEMORIES_EMPTY } from '../core/copy.js'
import { memoriesOf, momentsOf, sharedOf } from '../data/select.js'
import { photoSrc, onPhotoError } from '../lib/photos.js'

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

export default function Memories({ db, personId, nav }) {
  const memories = memoriesOf(db, personId)
  // Wide = has at least one contributor (a shared memory, section 3); tagged people alone keep the square.
  const shared = useMemo(() => new Set(db.links.filter(l => l.role === 'contributor').map(l => l.memory_id)), [db])
  if (!memories.length) return <div className="mg mg-empty"><p className="t-body">{MEMORIES_EMPTY}</p></div>
  return (
    <div className="mg">
      <h1 className="t-display">{MEMORIES_TITLE}</h1>
      <p className="mg-count">{MEMORIES_COUNT(memories.length)}</p>
      <div className="mg-grid">
        {memories.map((m, i) => <Tile key={m.id} db={db} memory={m} wide={shared.has(m.id)} eager={i < 4} nav={nav} />)}
      </div>
    </div>
  )
}
