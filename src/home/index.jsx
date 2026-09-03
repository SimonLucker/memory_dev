// Home, design-foundation-v3.md 5.1: top row, greeting, hero card, activity
// rows, Latest. The top card is always something that came back.
import { useEffect, useState } from 'react'
import './home.css'
import Avatar from '../core/Avatar.jsx'
import { Play } from '../core/Icons.jsx'
import { GREETING_MORNING, GREETING_AFTERNOON, GREETING_EVENING, YEAR_AGO_LABEL, QUESTION_LABEL, CONTRIBUTED, LATEST_LABEL } from '../core/copy.js'
// ponytail: the only import outside the module contract; goes when homeOf
// returns the demo Latest for an empty persona (core request).
import { bundledSpace } from '../data/personas.js'
import { homeOf, memoriesOf, sharedOf, momentsOf } from '../data/select.js'
import { photoSrc, onPhotoError } from '../lib/photos.js'

export const greetingFor = now => {
  const h = now.getHours()
  return h < 12 ? GREETING_MORNING : h < 18 ? GREETING_AFTERNOON : GREETING_EVENING
}

const isPicture = m => m.kind === 'photo' || m.kind === 'video'
const srcOf = m => photoSrc(m?.kind === 'video' ? m.poster : m?.src)
// The cover photo: cover_moment_id, else the first photo or video poster.
const coverOf = (db, memory) => srcOf(db.moments[memory.cover_moment_id] || momentsOf(db, memory.id).find(isPicture))

const MONTH = { month: 'long', timeZone: 'UTC' }
const DAY = { day: 'numeric', timeZone: 'UTC' }
const fmt = (d, o) => new Date(d).toLocaleDateString('en-US', o)
// "July 12–19" for a range in one month, "July 28 – August 2" otherwise, "June 14" for one day.
export const dateRange = (a, b) => {
  const from = `${fmt(a, MONTH)} ${fmt(a, DAY)}`
  if (!b || fmt(a, DAY) === fmt(b, DAY) && fmt(a, MONTH) === fmt(b, MONTH)) return from
  return fmt(a, MONTH) === fmt(b, MONTH) ? `${from}–${fmt(b, DAY)}` : `${from} – ${fmt(b, MONTH)} ${fmt(b, DAY)}`
}

const asPerson = p => ({ id: p.id, name: p.name, photo: photoSrc(p.avatar_url) })
const openStory = (nav, id) => e => nav.openStory(id, e.currentTarget.getBoundingClientRect())

function Hero({ db, memory, nav }) {
  const people = sharedOf(db, memory.id)
  const shared = people.length > 1
  const when = dateRange(memory.starts_at, memory.ends_at)
  const meta = shared ? `${people.length} people · ${when}` : memory.place ? `${when} · ${memory.place}` : when
  return (
    <div className="hm-hero">
      <button className="hm-hero-card" onClick={openStory(nav, memory.id)}>
        <img src={coverOf(db, memory)} alt="" onError={onPhotoError} />
        <span className="hm-hero-scrim" />
        <span className="hm-stack">
          {people.slice(1, 5).map(p => <Avatar key={p.id} person={asPerson(p)} size={22} />)}
        </span>
        <span className="hm-hero-text">
          <span className="hm-hero-title">{memory.title}</span>
          <span className="hm-hero-meta">{meta}</span>
        </span>
      </button>
      <button className="hm-play" aria-label="Recap" onClick={() => nav.openRecap(memory.id)}>
        <Play size={16} fill="currentColor" />
      </button>
    </div>
  )
}

const rowCopy = card => {
  if (card.kind === 'year-ago') return [YEAR_AGO_LABEL, card.memory.title]
  if (card.kind === 'question') return [QUESTION_LABEL, card.question.text]
  const place = (card.memory.place || card.memory.title).split(',').pop().trim()
  return CONTRIBUTED(card.by?.first_name || card.by?.name || '', place).split(' · ')
}

// The thumb: what the contributor added (their latest picture), else the cover.
const thumbOf = (db, card) => {
  const added = card.kind === 'contributed' && momentsOf(db, card.memory.id).filter(m => isPicture(m) && m.generated_by === card.by?.id).pop()
  return added ? srcOf(added) : coverOf(db, card.memory)
}

function Row({ db, card, nav }) {
  const [label, line] = rowCopy(card)
  return (
    <button className="hm-row" onClick={openStory(nav, card.memory.id)}>
      <img src={thumbOf(db, card)} alt="" loading="lazy" onError={onPhotoError} />
      <span>
        <span className="hm-row-label">{label}</span>
        <span className="hm-row-line">{line}</span>
      </span>
    </button>
  )
}

const Tile = ({ db, memory, onClick }) => {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag className="hm-tile" onClick={onClick}>
      <img src={coverOf(db, memory)} alt="" loading="lazy" onError={onPhotoError} />
    </Tag>
  )
}

export default function Home({ db, personId, now, nav }) {
  const person = db.people[personId] || { id: personId, name: personId }
  const { hero, cards } = homeOf(db, personId, now.toISOString())
  // Latest never repeats a memory already on the screen (hero, rows).
  const shown = new Set([hero?.id, ...cards.map(c => c.memory.id)])
  const latest = memoriesOf(db, personId).filter(m => !shown.has(m.id)).slice(0, 3)
  // Content enters once, on first mount (600ms). Tab switches must not replay it.
  const [entering, setEntering] = useState(true)
  useEffect(() => { const t = setTimeout(() => setEntering(false), 600); return () => clearTimeout(t) }, [])
  // Zero memories: the Latest row shows Isabel's demo world, nothing asks for input.
  const demo = hero ? null : bundledSpace('p5')
  const demoLatest = demo ? homeOf(demo, 'p5', now.toISOString()).latest : []

  return (
    <div className={`hm${entering ? ' hm-enter' : ''}`}>
      <div className="hm-top">
        <span className="hm-wordmark">Memmory</span>
        <Avatar person={asPerson(person)} size={30} onClick={nav.openProfile} />
      </div>
      <h1 className="t-display hm-greeting">{greetingFor(now)}</h1>
      {hero && <Hero db={db} memory={hero} nav={nav} />}
      {cards.length > 0 && (
        <div className="hm-rows">
          {cards.map(c => <Row key={c.kind + c.memory.id} db={db} card={c} nav={nav} />)}
        </div>
      )}
      <p className="t-label hm-latest-label">{LATEST_LABEL}</p>
      <div className="hm-latest">
        {latest.map(m => <Tile key={m.id} db={db} memory={m} onClick={openStory(nav, m.id)} />)}
        {demoLatest.map(m => <Tile key={m.id} db={demo} memory={m} />)}
      </div>
    </div>
  )
}
