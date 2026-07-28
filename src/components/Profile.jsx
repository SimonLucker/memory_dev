import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/profile.css'
import { Close, ChevronLeft, ChevronRight, Sparkle } from './Icons.jsx'
import { personColor, HEAT } from '../lib/palette.js'
import { getAvatar, setAvatar, uploadAvatar } from '../lib/avatar.js'
import { whenToTs } from '../lib/thread.js'
import { PRESENCE_LINE, PRIVACY_ROW } from '../lib/copy.js'

// Demo bio facts per profile (test phase; real profiles carry their own).
const BIO = {
  p1: { born: 'April 1988', city: 'San Francisco' },
  p2: { born: 'March 1994', city: 'Utrecht' },
  p3: { born: 'July 1992', city: 'Amsterdam' },
  p4: { born: 'May 1991', city: 'Copenhagen' },
}

// Three optional questions that sharpen the keeper (spec 6.6.5).
const QUESTIONS = [
  'Who matters most to you?',
  'Which places mean the most?',
  'What do you want to remember more of?',
]

const qKey = pid => 'memmory.profile.questions.' + pid
const loadQs = pid => {
  try { return JSON.parse(localStorage.getItem(qKey(pid))) || {} } catch { return {} }
}

// Semicircular activity gauge: heat gradient arc, ink needle floating free of
// the arc (clear gap, pivot dot). Value from the last-7-day capture count.
function Gauge({ memories }) {
  const count = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400e3
    return memories.filter(m => whenToTs(m.when) >= cutoff).length
  }, [memories])
  const frac = Math.min(count, 7) / 7
  const th = Math.PI * (1 - frac)
  const tip = { x: 70 + 34 * Math.cos(th), y: 70 - 34 * Math.sin(th) }
  return (
    <div className="pf-card pf-gauge">
      <svg viewBox="0 0 140 78" aria-hidden="true">
        <defs>
          <linearGradient id="pf-heat" x1="0" y1="0" x2="1" y2="0">
            {HEAT.map((c, i) => <stop key={c} offset={i / (HEAT.length - 1)} stopColor={c} />)}
          </linearGradient>
        </defs>
        <path d="M14 70 A56 56 0 0 1 126 70" fill="none" stroke="url(#pf-heat)"
          strokeWidth="10" strokeLinecap="round" />
        <path d={`M70 70 L${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`} stroke="var(--text-primary)"
          strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="70" cy="70" r="4" fill="var(--text-primary)" />
      </svg>
      <p className="type-body pf-gval">{count >= 3 ? 'Warm week' : 'Quiet week'}</p>
      <p className="type-label pf-quiet">{PRESENCE_LINE}</p>
    </div>
  )
}

const PersonRow = ({ p }) => (
  <div className="pf-row">
    <span className="pf-dot" style={{ background: personColor(p.id) }} />
    <span className="type-body pf-grow">{p.name}</span>
    <span className="type-label pf-count">{p.count}</span>
  </div>
)

export default function Profile({ person, persons, memories, onClose, switchPerson }) {
  const [view, setView] = useState('main') // 'main' | 'people' | 'insights'
  const [qs, setQs] = useState(() => loadQs(person.id))
  const [editing, setEditing] = useState(null) // question index being edited
  const [draft, setDraft] = useState('')
  const [faceId, setFaceId] = useState(false) // visual only
  const [picking, setPicking] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(() => getAvatar(person.id))
  const [pick, setPick] = useState(null) // { file, url } pending save
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    setQs(loadQs(person.id))
    setEditing(null)
    setPicking(false)
    setAvatarUrl(getAvatar(person.id))
    setPick(null)
    setSaving(false)
  }, [person.id])

  const onPickPhoto = e => {
    const file = e.target.files[0]
    if (file) setPick({ file, url: URL.createObjectURL(file) })
    e.target.value = ''
  }
  const savePhoto = async () => {
    setSaving(true)
    try {
      const url = await uploadAvatar(pick.file)
      setAvatar(person.id, url)
      setAvatarUrl(url)
      setPick(null)
    } catch { /* quiet; Save stays for a retry */ }
    setSaving(false)
  }

  const people = useMemo(() => {
    const map = new Map()
    for (const m of memories) for (const p of m.who || []) {
      if (p.id === person.id) continue
      const e = map.get(p.id) || { id: p.id, name: p.name, count: 0 }
      e.count++
      map.set(p.id, e)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [memories, person.id])

  const bio = BIO[person.id]
  const cardCount = memories.length ? 1 : 0 // the one woven demo card

  const setQ = (i, entry) => {
    const next = { ...qs, [i]: entry }
    setQs(next)
    localStorage.setItem(qKey(person.id), JSON.stringify(next))
    setEditing(null)
  }
  const openQuestions = QUESTIONS.map((q, i) => ({ q, i })).filter(({ i }) => !qs[i]?.skipped)

  const close = () => { setView('main'); setPicking(false); setEditing(null); onClose() }

  if (view !== 'main') {
    return (
      <div className="pf">
        <button className="pf-icon" onClick={() => setView('main')} aria-label="Back">
          <ChevronLeft />
        </button>
        {view === 'people' ? (
          <>
            <h2 className="type-headline pf-subtitle">People</h2>
            {people.map(p => <PersonRow key={p.id} p={p} />)}
          </>
        ) : (
          <>
            <h2 className="type-headline pf-subtitle">AI Insights</h2>
            <p className="type-body pf-quiet pf-center">
              Patterns from travels, people and thoughts.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="pf">
      <button className="pf-icon" onClick={close} aria-label="Close"><Close /></button>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
      <button className="pf-portrait" onClick={() => fileRef.current.click()}
        aria-label="Change profile photo">
        {(avatarUrl || person.photo)
          ? <img src={avatarUrl || person.photo} alt="" />
          : <span className="type-headline">{person.name[0]}</span>}
        {pick && <img className="pf-portrait-new" src={pick.url} alt="" />}
      </button>
      {pick && (
        <div className="pf-avatar-actions">
          {saving
            ? <span className="type-label pf-quiet">Saving</span>
            : <>
                <button className="pf-pill type-label" onClick={savePhoto}>Save</button>
                <button className="type-label pf-quiet" onClick={() => setPick(null)}>Cancel</button>
              </>}
        </div>
      )}
      <h2 className="type-headline pf-center">{person.name}</h2>
      <p className="type-label pf-quiet pf-center">
        {bio ? `Born ${bio.born} · ${bio.city} · ` : ''}{memories.length} memories
      </p>

      <div className="pf-card pf-numbers">
        <div>
          <strong className="type-display">{memories.length}</strong>
          <span className="type-label pf-quiet">memories</span>
        </div>
        <div>
          <strong className="type-display">{cardCount}</strong>
          <span className="type-label pf-quiet">memory cards</span>
        </div>
      </div>

      {people.length > 0 && (
        <>
          <p className="type-label pf-label">Top people</p>
          {people.slice(0, 3).map(p => <PersonRow key={p.id} p={p} />)}
          <button className="pf-link type-label" onClick={() => setView('people')}>
            View all people
          </button>
        </>
      )}

      <button className="pf-row pf-tap" onClick={() => setView('insights')}>
        <Sparkle size={18} />
        <span className="type-body pf-grow">AI Insights</span>
        <ChevronRight size={18} />
      </button>

      <Gauge memories={memories} />

      {openQuestions.length > 0 && (
        <>
          <p className="type-label pf-label">Questions</p>
          {openQuestions.map(({ q, i }) => {
            const answered = qs[i]?.a
            if (editing !== i && answered) {
              return (
                <button key={i} className="pf-row pf-q pf-tap"
                  onClick={() => { setEditing(i); setDraft(answered) }}>
                  <span className="type-label pf-quiet">{q}</span>
                  <span className="type-body">{answered}</span>
                </button>
              )
            }
            if (editing !== i) {
              return (
                <button key={i} className="pf-row pf-q pf-tap"
                  onClick={() => { setEditing(i); setDraft('') }}>
                  <span className="type-body">{q}</span>
                </button>
              )
            }
            return (
              <div key={i} className="pf-row pf-q">
                <span className="type-label pf-quiet">{q}</span>
                <input className="pf-input" value={draft} autoFocus
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) setQ(i, { a: draft.trim() }) }} />
                <div className="pf-qactions">
                  {draft.trim() && (
                    <button className="type-label" onClick={() => setQ(i, { a: draft.trim() })}>
                      Save
                    </button>
                  )}
                  <button className="type-label pf-quiet" onClick={() => setQ(i, { skipped: true })}>
                    Skip
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}

      <div className="pf-row">
        <span className="type-body pf-grow">Face ID</span>
        <button className={faceId ? 'pf-switch on' : 'pf-switch'} role="switch"
          aria-checked={faceId} aria-label="Face ID" onClick={() => setFaceId(v => !v)} />
      </div>
      <div className="pf-row">
        <span className="type-label pf-quiet">{PRIVACY_ROW}</span>
      </div>
      <button className="pf-row pf-tap">
        <span className="type-body">Sign out</span>
      </button>

      <div className="pf-row pf-viewing">
        <button className="pf-viewrow" onClick={() => setPicking(v => !v)}>
          <span className="type-body pf-grow">Viewing as</span>
          <span className="type-body pf-current">{person.short || person.name}</span>
        </button>
        {picking && persons.filter(p => p.id !== person.id).map(p => (
          <button key={p.id} className="pf-viewrow"
            onClick={() => { setPicking(false); switchPerson(p.id) }}>
            <span className="type-body pf-quiet">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
