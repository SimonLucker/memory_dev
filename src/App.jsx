import { useEffect, useMemo, useRef, useState } from 'react'
import Capture from './components/Capture.jsx'
import Vault from './components/Vault.jsx'
import Cortex from './components/Cortex.jsx'
import Cards from './components/Cards.jsx'
import MemoryDetail from './components/MemoryDetail.jsx'
import Slideshow from './components/Slideshow.jsx'
import Profile from './components/Profile.jsx'
import { PERSONS } from './data/persons.js'
import { resolvePerson } from './lib/people.js'
import { deriveEdges } from './lib/edges.js'
import * as api from './lib/api.js'

// Resolve plain names to {id,name}: reuse the id of any existing person with the
// same name (case-insensitive); mint sequential ids for genuinely new people.
const resolveWho = (names, memories) => {
  const dir = new Map()
  let maxId = 0
  for (const m of memories) for (const p of m.who) {
    dir.set(p.name.toLowerCase(), p)
    const n = Number(String(p.id).replace(/\D/g, '')) || 0
    if (n > maxId) maxId = n
  }
  const seen = new Set()
  return names.map(name => {
    // Registered people first: registry id = profile id (the ID-to-ID link).
    const r = resolvePerson(name)
    if (r?.match) return { id: r.match.id, name: r.match.name }
    return dir.get(name.toLowerCase()) || { id: 'p' + String(++maxId).padStart(2, '0'), name }
  }).filter(p => !seen.has(p.id) && seen.add(p.id))
}

// Mint the next memory id in a person's space (m### for p1, p{n}m### otherwise).
const mintId = (pid, list) => {
  const prefix = pid === 'p1' ? 'm' : pid + 'm'
  const maxN = list.reduce((a, m) => Math.max(a, Number(m.id.replace(/\D/g, '')) || 0), 0)
  return prefix + String(maxN + 1).padStart(3, '0')
}

// Seed a graph position near the strongest connected neighbours so the Cortex
// doesn't need a full re-layout.
const seedPos = (memory, memories, layout) => {
  const near = deriveEdges([...memories, memory])
    .filter(e => e.source === memory.id || e.target === memory.id)
    .sort((a, b) => b.weight - a.weight)
    .map(e => layout[e.source === memory.id ? e.target : e.source])
    .filter(Boolean)
    .slice(0, 3)
  const pool = near.length ? near : Object.values(layout)
  const cx = pool.reduce((a, p) => a + p[0], 0) / (pool.length || 1)
  const cy = pool.reduce((a, p) => a + p[1], 0) / (pool.length || 1)
  return [Math.round(cx + (Math.random() - 0.5) * 60), Math.round(cy + (Math.random() - 0.5) * 60)]
}

export default function App() {
  // Navigation: three panes (0 Vault, 1 Capture = home, 2 Cards) + Profile sheet.
  const [pane, setPane] = useState(1)
  const [vaultMode, setVaultMode] = useState('list')
  const [profileOpen, setProfileOpen] = useState(false)
  const [openMemoryId, setOpenMemoryId] = useState(null)
  const [slideshowId, setSlideshowId] = useState(null)

  const [personId, setPersonId] = useState('p3')
  const person = PERSONS.find(p => p.id === personId)
  // Memories are editable state, seeded from the bundled JSON. Persistence goes
  // through lib/api.js: Supabase (deployed) or the vite dev endpoints (local).
  const [memMap, setMemMap] = useState(() => Object.fromEntries(PERSONS.map(p => [p.id, p.memories])))
  const all = memMap[personId]
  // Pending shares live in the same space but never leak into the graph/stats.
  const memories = useMemo(() => all.filter(m => !m._pending), [all])
  const pending = useMemo(() => all.filter(m => m._pending), [all])

  // Deployed builds load the source of truth from Supabase (bundled JSON is the
  // instant first paint; the DB replaces it as soon as it answers).
  useEffect(() => {
    if (!api.remote) return
    let live = true
    Promise.all(PERSONS.map(p => api.loadMemories(p.id).then(ms => [p.id, ms])))
      .then(entries => { if (live) setMemMap(Object.fromEntries(entries)) })
      .catch(e => console.warn('remote load failed — showing bundled data', e))
    return () => { live = false }
  }, [])

  // Static precomputed layout + per-memory _pos.
  const layout = useMemo(() => ({
    ...person.layout,
    ...Object.fromEntries(memories.filter(m => m._pos).map(m => [m.id, m._pos])),
  }), [person, memories])

  const edges = useMemo(() => deriveEdges(memories), [memories])

  const applyUpsert = (updated, pid = personId) => {
    setMemMap(prev => ({
      ...prev,
      [pid]: prev[pid].some(m => m.id === updated.id)
        ? prev[pid].map(m => (m.id === updated.id ? updated : m))
        : [...prev[pid], updated],
    }))
    api.upsertMemory(pid, updated).catch(e => console.warn('save failed', e))
  }

  const updateMemory = updated => {
    if (updated.__whoNames) {
      updated = { ...updated, who: resolveWho(updated.__whoNames, memories) }
      delete updated.__whoNames
    }
    applyUpsert(updated)
  }

  const toggleFavorite = id => {
    const m = memories.find(m => m.id === id)
    if (m) applyUpsert({ ...m, favorite: !m.favorite })
  }

  const deleteMemory = id => {
    setMemMap(prev => ({ ...prev, [personId]: prev[personId].filter(m => m.id !== id) }))
    api.removeMemory(personId, id).catch(e => console.warn('delete failed', e))
    if (openMemoryId === id) setOpenMemoryId(null)
    if (slideshowId === id) setSlideshowId(null)
  }

  const addMemory = draft => {
    const memory = {
      id: mintId(personId, all), // mint over ALL memories incl. pending, so ids never collide
      photos: [],
      music: null,
      ...draft,
      who: resolveWho((draft.who || []).map(p => p.name || p), memories),
    }
    memory._pos = seedPos(memory, memories, layout)
    applyUpsert(memory)
    // Share: every registered co-tagged person gets a pending copy in their space.
    // ponytail: counter-minted ids can collide across concurrent sessions; real per-user id service later.
    for (const w of memory.who) {
      if (w.id !== personId && memMap[w.id]) {
        // In the recipient's copy they aren't "who was there" — the sharer is.
        const who = [{ id: personId, name: person.name },
          ...memory.who.filter(p => p.id !== w.id && p.id !== personId)]
        const copy = { ...memory, who, id: mintId(w.id, memMap[w.id]), _pending: { from: person.name } }
        delete copy._pos
        applyUpsert(copy, w.id)
      }
    }
    return memory
  }

  // Accept a shared memory: it becomes a real one, placed near its neighbours.
  const acceptShare = id => {
    const m = all.find(m => m.id === id)
    if (!m?._pending) return
    const { _pending, ...accepted } = m
    accepted._from = _pending.from
    accepted._pos = seedPos(accepted, memories, layout)
    applyUpsert(accepted)
  }
  const declineShare = deleteMemory

  const switchPerson = id => {
    setPersonId(id)
    setOpenMemoryId(null)
    setSlideshowId(null)
  }

  const openMemory = id => setOpenMemoryId(id)
  const closeMemory = () => setOpenMemoryId(null)
  const openSlideshow = id => setSlideshowId(id)
  const openedMemory = openMemoryId ? all.find(m => m.id === openMemoryId) : null
  const slideshowMemory = slideshowId ? all.find(m => m.id === slideshowId) : null

  // Pager: swipe tracks the finger 1:1 and settles in 200ms; dot taps take 600ms.
  const pagerRef = useRef(null)
  const dragRef = useRef(null)
  const [dragX, setDragX] = useState(null) // px while a finger is down, else null
  const [settleMs, setSettleMs] = useState(200)

  const onPointerDown = e => {
    if (profileOpen || openMemoryId || slideshowId) return
    dragRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false, w: pagerRef.current.clientWidth }
  }
  const onPointerMove = e => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        d.active = true
        pagerRef.current.setPointerCapture?.(d.id)
      } else if (Math.abs(dy) > 10) { dragRef.current = null; return } else return
    }
    // Resist past the ends.
    const atEnd = (pane === 0 && dx > 0) || (pane === 2 && dx < 0)
    setDragX(atEnd ? dx / 3 : dx)
  }
  const endDrag = e => {
    const d = dragRef.current
    dragRef.current = null
    if (!d?.active) return
    const dx = e.clientX - d.x
    setSettleMs(200)
    if (Math.abs(dx) > d.w / 4) setPane(p => Math.max(0, Math.min(2, p + (dx < 0 ? 1 : -1))))
    setDragX(null)
  }
  const goPane = i => { setSettleMs(600); setPane(i) }

  const pagerStyle = {
    transform: `translateX(calc(${pane * -100}% + ${dragX || 0}px))`,
    transition: dragX != null ? 'none' : `transform ${settleMs}ms var(--ease)`,
  }

  return (
    <div className="app">
      <div className="phone bg-dawn">
        <div className="chrome">
          <button className="avatar" aria-label="Profile" onClick={() => setProfileOpen(true)}>
            {person.photo ? <img src={person.photo} alt="" /> : person.name[0]}
          </button>
          <nav className="pane-dots" aria-label="Panes">
            {['Vault', 'Capture', 'Cards'].map((name, i) => (
              <button key={name} className={pane === i ? 'active' : ''} aria-label={name}
                onClick={() => goPane(i)} />
            ))}
          </nav>
        </div>

        <div className="pager" ref={pagerRef} style={pagerStyle}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={endDrag} onPointerCancel={endDrag}>
          <section className="pane">
            <Vault memories={memories} pending={pending} mode={vaultMode} setMode={setVaultMode}
              openMemory={openMemory} toggleFavorite={toggleFavorite} deleteMemory={deleteMemory}
              acceptShare={acceptShare} declineShare={declineShare}
              cortexSlot={<Cortex memories={memories} edges={edges} layout={layout} openMemory={openMemory} />} />
          </section>
          <section className="pane">
            <Capture person={person} memories={memories} addMemory={addMemory}
              openMemory={openMemory} updateMemory={updateMemory} />
          </section>
          <section className="pane">
            <Cards memories={memories} person={person} openMemory={openMemory} />
          </section>
        </div>

        <div className={profileOpen ? 'profile-sheet open' : 'profile-sheet'}>
          <Profile person={person} persons={PERSONS} memories={memories}
            onClose={() => setProfileOpen(false)} switchPerson={switchPerson} />
        </div>

        {openedMemory && (
          <MemoryDetail memory={openedMemory} onClose={closeMemory}
            updateMemory={updateMemory} openSlideshow={openSlideshow} />
        )}

        {slideshowMemory && (
          <Slideshow memory={slideshowMemory} onClose={() => setSlideshowId(null)} />
        )}
      </div>
    </div>
  )
}
