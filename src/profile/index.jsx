// Profile sheet, design-foundation-v3.md 5.6: cream, white rows, slate text.
// Portrait, name, fact line, counts, top people, gauge, three questions,
// switches, privacy, sign out, viewing-as. Props are the whole contract.
import { useEffect, useMemo, useRef, useState } from 'react'
import './profile.css'
import { AppleMusic, ChevronDown, ChevronLeft, ChevronRight, Spotify } from '../core/Icons.jsx'
import Avatar, { useAvatarSrc } from '../core/Avatar.jsx'
import { setAvatar, uploadAvatar } from '../lib/avatar.js'
import { photoSrc } from '../lib/photos.js'
import { countOf, memoriesOf } from '../data/select.js'
import { ANSWER_ACTION, ANSWER_PLACEHOLDER, MEMORIES_COUNT, PRESENCE_LINE, PRIVACY_ROW } from '../core/copy.js'

// Profile strings not yet in core/copy.js (integrator request pending: move
// this block there as flat exports, then import). Same rules: no em dashes,
// no exclamation marks, no emoji.
const C = {
  title: 'Profile', people: 'People', topPeople: 'Top people', viewAll: 'View all people',
  memories: 'memories', peopleCount: 'people', questions: 'Questions',
  quiet: 'Quiet week', warm: 'Warm week',
  bigButtons: 'Big capture buttons', musicIn: 'Music opens in', faceId: 'Face ID', signOut: 'Sign out',
  viewingAs: 'Viewing as', cancel: 'Cancel', skip: 'Skip', saving: 'Saving',
}

// Demo bio facts per persona (test phase; real profiles carry their own).
const BIO = {
  p1: { born: 'April 1988', city: 'San Francisco' },
  p2: { born: 'March 1994', city: 'Utrecht' },
  p3: { born: 'July 1992', city: 'Amsterdam' },
  p4: { born: 'May 1991', city: 'Copenhagen' },
  p5: { born: 'July 1992', city: 'Amsterdam' },
}

// Three optional questions that sharpen the keeper.
const QUESTIONS = [
  'Who matters most to you?',
  'Which places mean the most?',
  'What do you want to remember more of?',
]

const DAY = 86400e3
const dayKey = t => Math.floor(new Date(t).getTime() / DAY)

// Semicircular activity gauge (v2 mock .gauge): pale track for the full arc,
// the heat gradient painted only up to the value, slate needle floating free.
// #EFE9E0 (track) and #C8D4EC > #F5D6BC > #DC8C5E (heat) are the v2 data
// colors, allowed for data only; nothing else in the profile uses them.
// Value = memories in the last 7 days; the streak line only when it is true.
function Gauge({ memories, now }) {
  const { count, streak } = useMemo(() => {
    const today = dayKey(now)
    const days = new Set(memories.map(m => dayKey(m.starts_at)))
    let streak = 0
    while (days.has(today - streak)) streak++
    return { count: memories.filter(m => dayKey(m.starts_at) > today - 7).length, streak }
  }, [memories, now])
  const v = Math.min(count, 7) / 7
  const th = Math.PI * (1 - v)
  const at = r => `${(70 + r * Math.cos(th)).toFixed(1)} ${(70 - r * Math.sin(th)).toFixed(1)}`
  return (
    <div className="pf-card pf-gauge">
      <svg viewBox="0 0 140 78" aria-hidden="true">
        <defs>
          <linearGradient id="pf-heat" gradientUnits="userSpaceOnUse" x1="14" y1="0" x2="126" y2="0">
            <stop offset="0" stopColor="#C8D4EC" /><stop offset="0.55" stopColor="#F5D6BC" /><stop offset="1" stopColor="#DC8C5E" />
          </linearGradient>
        </defs>
        <path d="M14 70 A56 56 0 0 1 126 70" fill="none" stroke="#EFE9E0" strokeWidth="10" strokeLinecap="round" />
        {v > 0 && <path d={`M14 70 A56 56 0 0 1 ${at(56)}`} fill="none" stroke="url(#pf-heat)" strokeWidth="10" strokeLinecap="round" />}
        <path d={`M70 70 L${at(34)}`} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="70" cy="70" r="4" fill="currentColor" />
      </svg>
      <p className="t-body pf-gval">{count >= 3 ? C.warm : C.quiet}</p>
      {streak >= 5 && <p className="t-label">{PRESENCE_LINE}</p>}
    </div>
  )
}

const PersonRow = ({ p, nav }) => {
  const handleClick = () => {
    if (nav) nav.showPerson(p.id)
  }
  return (
    <button className="pf-row pf-person" onClick={handleClick}>
      <Avatar size={26} person={{ id: p.id, name: p.name, photo: photoSrc(p.avatar_url) }} />
      <span className="t-body pf-grow">{p.name}</span>
      <span className="t-label">{p.count}</span>
      <ChevronRight size={20} />
    </button>
  )
}

const Switch = ({ on, label, onChange }) => (
  <button className={on ? 'pf-switch on' : 'pf-switch'} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
)

export default function Profile({ person, persons, db, nav, onClose, switchPerson, settings, setSetting, now = new Date() }) {
  const [view, setView] = useState('main') // 'main' | 'people'
  const [editing, setEditing] = useState(null) // question index being edited
  const [draft, setDraft] = useState('')
  const [faceId, setFaceId] = useState(false) // visual only
  const [pick, setPick] = useState(null) // { file, url } pending save
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const avatarSrc = useAvatarSrc(person)

  useEffect(() => { setEditing(null); setPick(null); setSaving(false); setView('main') }, [person.id])

  const onPickPhoto = e => {
    const file = e.target.files[0]
    if (file) setPick({ file, url: URL.createObjectURL(file) })
    e.target.value = ''
  }
  const savePhoto = async () => {
    setSaving(true)
    try { setAvatar(person.id, await uploadAvatar(pick.file)); setPick(null) } catch { /* quiet; Save stays for a retry */ }
    setSaving(false)
  }

  const memories = memoriesOf(db, person.id)
  const count = countOf(db, person.id)
  // People by number of the persona's memories they are linked to.
  const people = useMemo(() => {
    const mine = new Set(memories.map(m => m.id))
    const counts = {}
    for (const l of db.links) if (mine.has(l.memory_id) && l.person_id !== person.id) counts[l.person_id] = (counts[l.person_id] || 0) + 1
    return Object.entries(counts).filter(([id]) => db.people[id]).map(([id, n]) => ({ ...db.people[id], count: n })).sort((a, b) => b.count - a.count)
  }, [db, memories, person.id])

  const bio = BIO[person.id]
  // Question answers live in the persona's settings bag (the one write path we are given).
  const qs = settings.questions || {}
  const setQ = (i, entry) => { setSetting('questions', { ...qs, [i]: entry }); setEditing(null) }
  const openQuestions = QUESTIONS.map((q, i) => ({ q, i })).filter(({ i }) => !qs[i]?.skipped)
  const musicService = settings.musicService || 'spotify'

  if (view === 'people') {
    return (
      <div className="pf" data-scroll>
        <header className="pf-head">
          <button className="pf-close" onClick={() => setView('main')} aria-label="Back"><ChevronLeft size={22} /></button>
          <span className="pf-title">{C.people}</span>
          <span className="pf-close pf-ghost" />
        </header>
        {people.map(p => <PersonRow key={p.id} p={p} nav={nav} />)}
      </div>
    )
  }

  return (
    <div className="pf" data-scroll>
      <header className="pf-head">
        <button className="pf-close" onClick={onClose} aria-label="Close"><ChevronDown size={22} /></button>
        <span className="pf-title">{C.title}</span>
        <span className="pf-close pf-ghost" />
      </header>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
      <button className="pf-portrait" onClick={() => fileRef.current.click()} aria-label="Change profile photo">
        {avatarSrc ? <img src={avatarSrc} alt="" /> : <span className="t-headline">{person.name[0]}</span>}
        {pick && <img className="pf-portrait-new" src={pick.url} alt="" />}
      </button>
      {pick && (
        <div className="pf-avatar-actions">
          {saving
            ? <span className="t-label">{C.saving}</span>
            : <>
                <button className="pf-pill t-label" onClick={savePhoto}>{ANSWER_ACTION}</button>
                <button className="t-label" onClick={() => setPick(null)}>{C.cancel}</button>
              </>}
        </div>
      )}
      <h2 className="t-headline pf-center">{person.name}</h2>
      <p className="t-label pf-center pf-fact">
        {bio ? `Born ${bio.born} · ${bio.city} · ` : ''}{MEMORIES_COUNT(count)}
      </p>

      <div className="pf-card pf-numbers">
        <div><strong className="t-display">{count}</strong><span className="t-label">{C.memories}</span></div>
        <div><strong className="t-display">{people.length}</strong><span className="t-label">{C.peopleCount}</span></div>
      </div>

      {people.length > 0 && (
        <>
          <p className="t-label pf-label">{C.topPeople}</p>
          {people.slice(0, 3).map(p => <PersonRow key={p.id} p={p} nav={nav} />)}
          {people.length > 3 && (
            <button className="pf-link pf-viewall t-label" onClick={() => setView('people')}>{C.viewAll}</button>
          )}
        </>
      )}

      <Gauge memories={memories} now={now} />

      {openQuestions.length > 0 && (
        <>
          <p className="t-label pf-label">{C.questions}</p>
          {openQuestions.map(({ q, i }) => {
            const answered = qs[i]?.a
            if (editing !== i) {
              return (
                <button key={i} className="pf-row pf-q" onClick={() => { setEditing(i); setDraft(answered || '') }}>
                  {answered
                    ? <><span className="t-label">{q}</span><span className="t-body">{answered}</span></>
                    : <span className="t-body">{q}</span>}
                </button>
              )
            }
            return (
              <div key={i} className="pf-row pf-q">
                <span className="t-label">{q}</span>
                <input className="pf-input t-body" value={draft} autoFocus placeholder={ANSWER_PLACEHOLDER}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) setQ(i, { a: draft.trim() }) }} />
                <div className="pf-qactions">
                  {draft.trim() && <button className="pf-pill t-label" onClick={() => setQ(i, { a: draft.trim() })}>{ANSWER_ACTION}</button>}
                  <button className="t-label" onClick={() => setQ(i, { skipped: true })}>{C.skip}</button>
                </div>
              </div>
            )
          })}
        </>
      )}

      <div className="pf-row">
        <span className="t-body pf-grow">{C.bigButtons}</span>
        <Switch on={settings.bigButtons !== false} label={C.bigButtons} onChange={v => setSetting('bigButtons', v)} />
      </div>
      <div className="pf-row">
        <span className="t-body pf-grow">{C.musicIn}</span>
        <div className="pf-seg">
          <button className={'pf-seg-opt' + (musicService === 'spotify' ? ' sel' : '')} aria-label="Spotify"
            aria-pressed={musicService === 'spotify'} onClick={() => setSetting('musicService', 'spotify')}><Spotify size={18} /></button>
          <button className={'pf-seg-opt' + (musicService === 'apple' ? ' sel' : '')} aria-label="Apple Music"
            aria-pressed={musicService === 'apple'} onClick={() => setSetting('musicService', 'apple')}><AppleMusic size={18} /></button>
        </div>
      </div>
      <div className="pf-row">
        <span className="t-body pf-grow">{C.faceId}</span>
        <Switch on={faceId} label={C.faceId} onChange={setFaceId} />
      </div>
      <div className="pf-row"><span className="t-label">{PRIVACY_ROW}</span></div>
      <button className="pf-row"><span className="t-body">{C.signOut}</span></button>

      {/* Viewing as: test-phase persona switcher, the current one ringed. */}
      <div className="pf-row pf-viewing">
        <span className="t-body pf-grow">{C.viewingAs}</span>
        {persons.map(p => (
          <button key={p.id} className={p.id === person.id ? 'pf-persona sel' : 'pf-persona'} aria-label={p.name}
            aria-pressed={p.id === person.id} onClick={() => switchPerson(p.id)}><Avatar size={30} person={p} /></button>
        ))}
      </div>
    </div>
  )
}
