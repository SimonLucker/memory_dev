import { useMemo, useState } from 'react'
import GraphView from './components/GraphView.jsx'
import Timeline from './components/Timeline.jsx'
import Legend from './components/Legend.jsx'
import QueryBar from './components/QueryBar.jsx'
import PersonSwitch from './components/PersonSwitch.jsx'
import Vault from './components/Vault.jsx'
import Memorialize from './components/Memorialize.jsx'
import { PERSONS } from './data/persons.js'
import { deriveEdges, buildVocab, yearsOf } from './lib/edges.js'
import { parseQuery, filterMemories, memoryMatches } from './lib/search.js'
import { CLASS_COLORS } from './lib/palette.js'

const CLASSES = Object.keys(CLASS_COLORS)
const yearOf = m => m.when.slice(6, 10)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthOf = m => Number(m.when.slice(3, 5))

// The POC pipeline: Memorialize (create) → Vault (browse) → Cortex (explore).
const VIEWS = [
  { id: 'memorialize', label: 'Memorialize' },
  { id: 'vault', label: 'Vault' },
  { id: 'cortex', label: 'Cortex' },
]

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
  return names.map(name =>
    dir.get(name.toLowerCase()) || { id: 'p' + String(++maxId).padStart(2, '0'), name })
}

export default function App() {
  const [view, setView] = useState('cortex')
  const [personId, setPersonId] = useState(PERSONS[0].id)
  const person = PERSONS.find(p => p.id === personId)
  // Memories are editable state (seeded from the JSON); edits persist via the dev-server
  // /__save-memories endpoint (vite.config.js) straight back into the data files.
  const [memMap, setMemMap] = useState(() => Object.fromEntries(PERSONS.map(p => [p.id, p.memories])))
  // Layout grows at runtime: new memories get a client-seeded position (near their
  // strongest neighbours) merged over the precomputed layout file.
  const [layoutMap, setLayoutMap] = useState(() => Object.fromEntries(PERSONS.map(p => [p.id, p.layout])))
  const [newId, setNewId] = useState(null) // last memory born in Memorialize, highlighted in Vault
  const memories = memMap[personId]

  const persist = (pid, next, layoutEntry) =>
    fetch('/__save-memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: pid, memories: next, ...(layoutEntry ? { layout: layoutEntry } : {}) }),
    }).catch(() => console.warn('save endpoint unavailable — edit kept in memory only'))

  const saveMemory = updated => {
    if (updated.__whoNames) {
      updated = { ...updated, who: resolveWho(updated.__whoNames, memories) }
      delete updated.__whoNames
    }
    const next = memories.map(m => (m.id === updated.id ? updated : m))
    setMemMap(prev => ({ ...prev, [personId]: next }))
    persist(personId, next)
  }

  const toggleFavorite = id => {
    const next = memories.map(m => (m.id === id ? { ...m, favorite: !m.favorite } : m))
    setMemMap(prev => ({ ...prev, [personId]: next }))
    persist(personId, next)
  }

  const deleteMemory = id => {
    const next = memories.filter(m => m.id !== id)
    setMemMap(prev => ({ ...prev, [personId]: next }))
    persist(personId, next)
    if (selectedId === id) setSelectedId(null)
    if (newId === id) setNewId(null)
  }

  // Memorialization → Vault → Cortex pipeline entry point.
  const addMemory = draft => {
    const prefix = personId === 'p2' ? 'p2m' : 'm'
    const maxN = memories.reduce((a, m) => Math.max(a, Number(m.id.replace(/\D/g, '')) || 0), 0)
    const memory = {
      id: prefix + String(maxN + 1).padStart(3, '0'),
      photos: [],
      music: null,
      ...draft,
      who: resolveWho((draft.who || []).map(p => p.name || p), memories),
    }
    const next = [...memories, memory]
    // Seed a graph position near the strongest connected neighbours so the Cortex
    // doesn't need a full re-layout (GraphView only seeds from the layout map).
    const layout = layoutMap[personId]
    const near = deriveEdges(next)
      .filter(e => e.source === memory.id || e.target === memory.id)
      .sort((a, b) => b.weight - a.weight)
      .map(e => layout[e.source === memory.id ? e.target : e.source])
      .filter(Boolean)
      .slice(0, 3)
    const pool = near.length ? near : Object.values(layout)
    const cx = pool.reduce((a, p) => a + p[0], 0) / (pool.length || 1)
    const cy = pool.reduce((a, p) => a + p[1], 0) / (pool.length || 1)
    const pos = [Math.round(cx + (Math.random() - 0.5) * 60), Math.round(cy + (Math.random() - 0.5) * 60)]
    setLayoutMap(prev => ({ ...prev, [personId]: { ...prev[personId], [memory.id]: pos } }))
    setMemMap(prev => ({ ...prev, [personId]: next }))
    persist(personId, next, { [memory.id]: pos })
    setNewId(memory.id)
    setView('vault')
    return memory.id
  }

  const edges = useMemo(() => deriveEdges(memories), [memories])
  const vocab = useMemo(() => buildVocab(memories), [memories])
  const years = useMemo(() => yearsOf(memories).map(String), [memories])

  const [hiddenClasses, setHiddenClasses] = useState(new Set())
  const [activeFilters, setActiveFilters] = useState([])
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null) // { year, month } | null — mutually exclusive with year
  const [queryResult, setQueryResult] = useState(null) // { ids: Set|null, count: number }
  const [selectedId, setSelectedId] = useState(null)
  const [legendOpen, setLegendOpen] = useState(false) // phones: filters sheet, opened from the query sheet
  const [mobileMenu, setMobileMenu] = useState(null) // 'person' | 'views' | null — corner fold-outs
  const [sheetOpen, setSheetOpen] = useState(false) // phones: query bar bottom sheet
  const [lightbox, setLightbox] = useState(null) // photo url shown full-screen, tap to close

  const visibleMemories = useMemo(() =>
    memories.filter(m =>
      !hiddenClasses.has(m.class) &&
      (!selectedYear || yearOf(m) === selectedYear) &&
      (!selectedMonth || (yearOf(m) === selectedMonth.year && monthOf(m) === selectedMonth.month)) &&
      activeFilters.every(f => memoryMatches(m, f))
    ), [memories, hiddenClasses, selectedYear, selectedMonth, activeFilters])

  const visibleIds = useMemo(() => new Set(visibleMemories.map(m => m.id)), [visibleMemories])

  const toggleClass = name => setHiddenClasses(prev => {
    const s = new Set(prev)
    s.has(name) ? s.delete(name) : s.add(name)
    return s
  })

  const toggleFilter = f => setActiveFilters(prev =>
    prev.some(x => x.type === f.type && x.value === f.value)
      ? prev.filter(x => !(x.type === f.type && x.value === f.value))
      : [...prev, f]
  )

  const switchPerson = id => {
    setPersonId(id)
    setSelectedId(null)
    setSelectedYear(null)
    setSelectedMonth(null)
    setHiddenClasses(new Set())
    setActiveFilters([])
    setQueryResult(null)
    setNewId(null)
  }

  const runQueryFilters = filters => {
    if (!filters.length) { setQueryResult(null); return }
    const matched = filterMemories(memories, filters)
    // Zero matches: report 0 but leave the graph untouched (ids: null)
    setQueryResult(matched.length
      ? { ids: new Set(matched.map(m => m.id)), count: matched.length, filters }
      : { ids: null, count: 0, filters })
  }

  const submitQuery = text => runQueryFilters(parseQuery(text, vocab).filters)

  const stats = useMemo(() => {
    const people = new Set()
    const feelings = {}
    let imp = 0
    for (const m of visibleMemories) {
      m.who.forEach(p => people.add(p.name))
      m.feeling.forEach(f => { feelings[f] = (feelings[f] || 0) + 1 })
      imp += m.importance
    }
    const top = Object.entries(feelings).sort((a, b) => b[1] - a[1])[0]
    return {
      memories: visibleMemories.length,
      people: people.size,
      topFeeling: top ? top[0] : '—',
      avgImportance: visibleMemories.length
        ? Math.round((imp / visibleMemories.length) * 20) + '%'
        : '—',
    }
  }, [visibleMemories])

  // Active-filter chips shown under the question bar (query-search/SKILL.md). Click removes.
  const filterChips = [
    ...(selectedYear ? [{ key: 'year', label: selectedYear, onRemove: () => setSelectedYear(null) }] : []),
    ...(selectedMonth ? [{ key: 'month', label: `${MONTHS[selectedMonth.month - 1]} ${selectedMonth.year}`, onRemove: () => setSelectedMonth(null) }] : []),
    ...activeFilters.map(f => ({ key: `f-${f.type}-${f.value}`, label: f.value, onRemove: () => toggleFilter(f) })),
    ...(queryResult?.filters || []).map(f => ({
      key: `q-${f.type}-${f.value}`,
      label: f.value,
      onRemove: () => runQueryFilters(queryResult.filters.filter(x => !(x.type === f.type && x.value === f.value))),
    })),
    ...[...hiddenClasses].map(c => ({ key: `h-${c}`, label: `no ${c}`, onRemove: () => toggleClass(c) })),
  ]

  const classCounts = useMemo(() =>
    CLASSES.map(name => ({ name, count: memories.filter(m => m.class === name).length })), [memories])

  const openInCortex = id => { setSelectedId(id); setView('cortex') }

  return (
    <div className="scene">
      <nav className="view-pills">
        {VIEWS.map(v => (
          <button key={v.id} className={view === v.id ? 'active' : ''} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </nav>
      <PersonSwitch persons={PERSONS} activeId={personId} onSwitch={switchPerson} />

      {/* Phone chrome (hidden ≥701px): person fold-out top-left, views fold-out top-right. */}
      {(mobileMenu || legendOpen) && (
        <div className="m-scrim" onClick={() => { setMobileMenu(null); setLegendOpen(false) }} />
      )}
      <button className="m-corner left" onClick={() => setMobileMenu(m => (m === 'person' ? null : 'person'))}>
        {person.name[0]}
      </button>
      <button className="m-corner right" onClick={() => setMobileMenu(m => (m === 'views' ? null : 'views'))}>
        {VIEWS.find(v => v.id === view).label} ▾
      </button>
      {mobileMenu === 'person' && (
        <div className="m-menu left">
          {PERSONS.map(p => (
            <button key={p.id} className={p.id === personId ? 'active' : ''}
              onClick={() => { switchPerson(p.id); setMobileMenu(null) }}>
              {p.name} <span className="person-count">{memMap[p.id].length}</span>
            </button>
          ))}
        </div>
      )}
      {mobileMenu === 'views' && (
        <div className="m-menu right">
          {VIEWS.map(v => (
            <button key={v.id} className={view === v.id ? 'active' : ''}
              onClick={() => { setView(v.id); setMobileMenu(null) }}>
              {v.label}
            </button>
          ))}
        </div>
      )}

      {view === 'cortex' && (
        <>
          <div className="graph-layer">
            <GraphView
              key={personId}
              memories={memories}
              layout={layoutMap[personId]}
              edges={edges}
              visibleIds={visibleIds}
              highlightIds={queryResult ? queryResult.ids : null}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onEdit={saveMemory}
              onPhotoTap={setLightbox}
              gatherActive={Boolean(queryResult?.ids) || activeFilters.length > 0 || !!selectedYear || !!selectedMonth}
            />
          </div>
          <Timeline
            years={years}
            memories={memories}
            selectedYear={selectedYear}
            onSelectYear={(y) => { setSelectedYear(y); setSelectedMonth(null) }}
            selectedMonth={selectedMonth}
            onSelectMonth={(m) => { setSelectedMonth(m); setSelectedYear(null) }}
          />
          {/* Phone: same timeline, horizontal top strip (the vertical rail hides ≤700px). */}
          <Timeline
            horizontal
            years={years}
            memories={memories}
            selectedYear={selectedYear}
            onSelectYear={(y) => { setSelectedYear(y); setSelectedMonth(null) }}
            selectedMonth={selectedMonth}
            onSelectMonth={(m) => { setSelectedMonth(m); setSelectedYear(null) }}
          />
          <div className={legendOpen ? 'legend-wrap open' : 'legend-wrap'}>
            <Legend
              classCounts={classCounts}
              hiddenClasses={hiddenClasses}
              onToggleClass={toggleClass}
              vocab={vocab}
              activeFilters={activeFilters}
              onToggleFilter={toggleFilter}
            />
          </div>
          {/* Phone: query bar lives in a tap-up bottom sheet; filters open from inside it.
              Desktop: the wrapper is display:contents and the extras are hidden. */}
          <div className={sheetOpen ? 'query-sheet open' : 'query-sheet'}>
            <div className="sheet-actions">
              <button onClick={() => setLegendOpen(o => !o)}>✦ Filters</button>
              <button onClick={() => { setSheetOpen(false); setLegendOpen(false) }}>▾</button>
            </div>
            <QueryBar
              stats={stats}
              matchCount={queryResult ? queryResult.count : null}
              filters={filterChips}
              onSubmit={submitQuery}
              onClear={() => setQueryResult(null)}
            />
          </div>
          {!sheetOpen && (
            <button className="query-collapsed" onClick={() => setSheetOpen(true)}>
              Ask your memories…{filterChips.length ? ` · ${filterChips.length} active` : ''}
            </button>
          )}
        </>
      )}

      {view === 'vault' && (
        <Vault memories={memories} newId={newId} onOpen={openInCortex}
          onFav={toggleFavorite} onDelete={deleteMemory} onPhoto={setLightbox} />
      )}

      {view === 'memorialize' && (
        <Memorialize personName={person.name} onSave={addMemory} />
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  )
}
