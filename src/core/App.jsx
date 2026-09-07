// The v3 shell: nav state (nav.js), the persona's db, now, settings, and the
// two write actions every module gets (ARCHITECTURE.md sections 3, 4.5, 5).
import { useEffect, useMemo, useRef, useState } from 'react'
import './app.css'
import { useNav } from './nav.js'
import { primeAudio, stopPreview } from './audio.js'
import { readShowcase } from './showcase.js'
import { markLoaded, markReady } from './ready.js'
import TabBar from './TabBar.jsx'
import * as api from '../data/api.js'
import { PERSONS, bundledSpace } from '../data/personas.js'
import { putRows, dropMoments } from '../data/store.js'
import { fromV2, toV2 } from '../data/bridge.js'
import { memoriesOf } from '../data/select.js'
import { getSettings, setSetting as writeSetting } from '../lib/settings.js'
import { resolvePerson } from '../lib/people.js'
import { syncAvatars } from '../lib/avatar.js'
import Home from '../home/index.jsx'
import Memories from '../memories/index.jsx'
import Story, { Viewer } from '../story/index.jsx'
import Recap from '../recap/index.jsx'
import CaptureSheet from '../capture/index.jsx'
import Profile from '../profile/index.jsx'

const SHOWCASE = readShowcase()
const QUERY = new URLSearchParams(location.search)
const FIXED_NOW = SHOWCASE?.now || (QUERY.get('now') && new Date(QUERY.get('now')))
// ?persona=p3 picks the persona outside showcase mode (smoke tests, deep links).
const LAUNCH = SHOWCASE?.state || { personId: QUERY.get('persona') || 'p5', tab: 'home', stack: [], sheet: null }
const PUSH_MS = 600

// Ticks every minute unless frozen by ?now= or a showcase.
function useNow() {
  const [now, setNow] = useState(() => FIXED_NOW || new Date())
  useEffect(() => {
    if (FIXED_NOW) return
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])
  return now
}

// True for `ms` after `on` turns false, so a closing layer can animate out.
function useLinger(on, ms) {
  const [linger, setLinger] = useState(false)
  useEffect(() => {
    if (on) { setLinger(true); return }
    const t = setTimeout(() => setLinger(false), ms)
    return () => clearTimeout(t)
  }, [on, ms])
  return on || linger
}

const mint = pid => `${pid}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export default function App() {
  const { state, nav: navBase } = useNav(LAUNCH, !SHOWCASE)
  const { personId, tab, stack, sheet } = state
  const person = PERSONS.find(p => p.id === personId) || PERSONS[0]
  const now = useNow()

  // Memories filter lives here so any screen can point the grid at one person.
  const [memFilter, setMemFilter] = useState(SHOWCASE?.filter || {})
  const nav = useMemo(() => ({
    ...navBase,
    showPerson: id => { setMemFilter({ people: [id] }); navBase.showMemories() },
  }), [navBase])

  // The bundled space paints first; loadSpace replaces what it knows about.
  const [db, setDb] = useState(() => bundledSpace(personId))
  useEffect(() => {
    setDb(bundledSpace(personId))
    stopPreview()
    if (SHOWCASE) return markLoaded()
    let live = true
    api.loadSpace(personId)
      .then(space => { if (live) setDb(putRows(bundledSpace(personId), space)) })
      .catch(e => console.warn('loadSpace failed, showing bundled data', e))
      .finally(markLoaded)
    return () => { live = false }
  }, [personId])
  useEffect(() => { markReady(); syncAvatars(PERSONS.map(p => p.id)) }, [])

  const [settings, setSettings] = useState(() => getSettings(personId))
  useEffect(() => {
    setSettings(getSettings(personId))
    const on = e => { if (e.detail.personId === personId) setSettings(e.detail.settings) }
    window.addEventListener('memmory:settings', on)
    return () => window.removeEventListener('memmory:settings', on)
  }, [personId])
  const setSetting = (name, value) => writeSetting(personId, name, value)

  // The capture engine reads and writes v2 objects (4.5).
  const memoriesV2 = useMemo(() => memoriesOf(db, personId).map(m => toV2(db, m.id)), [db, personId])

  // Plain names -> {id, name}: registered users keep their persona id, known
  // contacts their row, new people get an id in this persona's space.
  const resolveWho = names => names.map(n => {
    const name = n.name || n
    const r = resolvePerson(name)?.match
    if (r) return { id: r.id, name: r.name }
    const known = Object.values(db.people).find(p => p.name.toLowerCase() === name.toLowerCase())
    return known ? { id: known.id, name: known.name } : { id: `${personId}_${slug(name)}`, name }
  })

  const saveRows = ({ memory, moments, links, people }) => {
    setDb(d => putRows(d, { memory, moments, links, people }))
    const fresh = people.filter(p => !db.people[p.id])
    api.upsert('people', fresh); api.upsert('memories', memory ? [memory] : []); api.upsert('moments', moments); api.upsert('memory_people', links)
  }

  const addMemory = draft => {
    const v2 = { id: mint(personId), photos: [], music: null, ...draft, who: resolveWho(draft.who || []) }
    saveRows(fromV2(v2, personId, now.toISOString()))
    return v2
  }

  const updateMemory = v2 => {
    if (v2.__whoNames) { v2 = { ...v2, who: resolveWho(v2.__whoNames) }; delete v2.__whoNames }
    const owner = db.memories[v2.id]?.owner_id || personId
    const rows = fromV2(v2, owner, now.toISOString())
    const keep = new Set(rows.moments.map(m => m.id))
    // Only the owner's photo/video/voice moments come from v2; answers and other people's moments stay.
    const gone = Object.values(db.moments).filter(m => m.memory_id === v2.id && m.generated_by === owner && !m.question_id
      && ['photo', 'video', 'voice'].includes(m.kind) && !keep.has(m.id)).map(m => m.id)
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    rows.moments = rows.moments.filter(m => !same(db.moments[m.id], m))
    if (same(db.memories[v2.id], rows.memory)) rows.memory = null
    if (gone.length) setDb(d => dropMoments(d, gone))
    gone.forEach(id => api.remove('moments', id))
    saveRows(rows)
  }

  const nextPosition = memoryId => Object.values(db.moments).filter(m => m.memory_id === memoryId).length

  const addMoment = (memoryId, moment) => {
    const row = { id: mint(personId), memory_id: memoryId, generated_by: personId, captured_at: now.toISOString(), position: nextPosition(memoryId), demo: false, ...moment }
    setDb(d => putRows(d, { moments: [row] }))
    api.upsert('moments', [row])
    return row
  }

  const answer = (questionId, { text, voice }) => {
    const q = db.questions[questionId]
    if (!q) return
    const moment = addMoment(q.memory_id, { kind: 'answer', question_id: questionId, text: text || null, src: voice?.src || null, duration: voice?.duration || null, transcript: voice?.transcript || null })
    const question = { ...q, answered_at: now.toISOString() }
    setDb(d => putRows(d, { questions: [question] }))
    api.upsert('questions', [question])
    return moment
  }

  // Pushed layers: a popped entry lingers PUSH_MS so it can slide out. A push
  // that lands inside that window used to cancel the timeout and strand the
  // leaving layer over the app for good, so every run clears it, pop or not.
  const [leaving, setLeaving] = useState(null)
  const prevStack = useRef(stack)
  useEffect(() => {
    const prev = prevStack.current
    prevStack.current = stack
    const popped = prev.length > stack.length
    if (popped) stopPreview()
    setLeaving(popped ? prev[prev.length - 1] : null)
    // The iOS keyboard leaves the window scrolled under the fixed shell, which
    // moves every hit target off its pixels until the page is put back.
    if (window.scrollY) window.scrollTo(0, 0)
    const t = setTimeout(() => setLeaving(null), PUSH_MS)
    return () => clearTimeout(t)
  }, [stack])

  // Same restore after the Capture sheet: its text field raises the iOS
  // keyboard, and Safari scrolls the window to reveal it.
  useEffect(() => { if (!sheet && window.scrollY) window.scrollTo(0, 0) }, [sheet])

  const layer = e => {
    if (e.kind === 'story') return <Story db={db} personId={personId} id={e.id} filter={e.filter || null} origin={e.origin} nav={nav} answer={answer} addMoment={addMoment} />
    if (e.kind === 'viewer') return <Viewer db={db} id={e.id} index={e.index} nav={nav} />
    if (e.kind === 'recap') return <Recap db={db} id={e.id} nav={nav} onClose={nav.back} />
    return null
  }

  const profileMounted = useLinger(sheet === 'profile', PUSH_MS)
  const chromeHidden = stack.length > 0 || !!sheet

  return (
    <div className="app">
      {/* The first tap buys the audio element its autoplay permission
          (audio.js). primeAudio is idempotent, so no state and no re-render
          during a pointerdown, which is what swallows the tap that caused it. */}
      <div className="phone" onPointerDownCapture={primeAudio}>
        <section className="app-screen" hidden={tab !== 'home'}>
          <Home db={db} personId={personId} now={now} nav={nav} />
        </section>
        <section className="app-screen" hidden={tab !== 'memories'}>
          <Memories db={db} personId={personId} nav={nav} filter={memFilter} setFilter={setMemFilter} />
        </section>

        {stack.map((e, i) => (
          <div className={`app-push${e.origin ? ' from-origin' : ''}`} key={`${e.kind}-${e.id}-${i}`}>{layer(e)}</div>
        ))}
        {leaving && <div className="app-push leaving" key="leaving">{layer(leaving)}</div>}

        <TabBar tab={tab} setTab={nav.setTab} openCapture={nav.openCapture} hidden={chromeHidden} />

        <div className={`sheet sheet-capture${sheet === 'capture' ? ' open' : ''}`} inert={sheet === 'capture' ? undefined : ''}>
          <CaptureSheet open={sheet === 'capture'} person={person} memories={memoriesV2}
            addMemory={addMemory} updateMemory={updateMemory} nav={nav} settings={settings} />
        </div>

        {profileMounted && (
          <div className={`sheet sheet-profile${sheet === 'profile' ? ' open' : ''}`}>
            <Profile person={person} persons={PERSONS} db={db} memories={memoriesV2} nav={nav} onClose={nav.closeSheet}
              switchPerson={nav.setPerson} settings={settings} setSetting={setSetting} />
          </div>
        )}
      </div>
    </div>
  )
}
