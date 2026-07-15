import { useMemo, useState } from 'react'
import GraphView from './components/GraphView.jsx'
import Timeline from './components/Timeline.jsx'
import Legend from './components/Legend.jsx'
import QueryBar from './components/QueryBar.jsx'
import memories from './data/memories.json'
import { deriveEdges, buildVocab, yearsOf } from './lib/edges.js'
import { parseQuery, filterMemories, memoryMatches } from './lib/search.js'
import { CLASS_COLORS } from './lib/palette.js'

const CLASSES = Object.keys(CLASS_COLORS)
const yearOf = m => m.when.slice(6, 10)

export default function App() {
  const edges = useMemo(() => deriveEdges(memories), [])
  const vocab = useMemo(() => buildVocab(memories), [])
  const years = useMemo(() => yearsOf(memories).map(String), [])

  const [hiddenClasses, setHiddenClasses] = useState(new Set())
  const [activeFilters, setActiveFilters] = useState([])
  const [selectedYear, setSelectedYear] = useState(null)
  const [queryResult, setQueryResult] = useState(null) // { ids: Set|null, count: number }
  const [selectedId, setSelectedId] = useState(null)

  const visibleMemories = useMemo(() =>
    memories.filter(m =>
      !hiddenClasses.has(m.class) &&
      (!selectedYear || yearOf(m) === selectedYear) &&
      activeFilters.every(f => memoryMatches(m, f))
    ), [hiddenClasses, selectedYear, activeFilters])

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

  const submitQuery = text => {
    const { filters } = parseQuery(text, vocab)
    const matched = filters.length ? filterMemories(memories, filters) : []
    // Zero matches: report 0 but leave the graph untouched (ids: null)
    setQueryResult(matched.length
      ? { ids: new Set(matched.map(m => m.id)), count: matched.length }
      : { ids: null, count: 0 })
  }

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

  const classCounts = useMemo(() =>
    CLASSES.map(name => ({ name, count: memories.filter(m => m.class === name).length })), [])

  return (
    <div className="scene">
      <div className="graph-layer">
        <GraphView
          memories={memories}
          edges={edges}
          visibleIds={visibleIds}
          highlightIds={queryResult ? queryResult.ids : null}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <Timeline
        years={years}
        memories={memories}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
      />
      <Legend
        classCounts={classCounts}
        hiddenClasses={hiddenClasses}
        onToggleClass={toggleClass}
        vocab={vocab}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
      />
      <QueryBar
        stats={stats}
        matchCount={queryResult ? queryResult.count : null}
        onSubmit={submitQuery}
        onClear={() => setQueryResult(null)}
      />
    </div>
  )
}
