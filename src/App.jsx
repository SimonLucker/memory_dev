import { useMemo, useState } from 'react'
import GraphView from './components/GraphView.jsx'
import Timeline from './components/Timeline.jsx'
import Legend from './components/Legend.jsx'
import QueryBar from './components/QueryBar.jsx'
import PersonSwitch from './components/PersonSwitch.jsx'
import { PERSONS } from './data/persons.js'
import { deriveEdges, buildVocab, yearsOf } from './lib/edges.js'
import { parseQuery, filterMemories, memoryMatches } from './lib/search.js'
import { CLASS_COLORS } from './lib/palette.js'

const CLASSES = Object.keys(CLASS_COLORS)
const yearOf = m => m.when.slice(6, 10)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthOf = m => Number(m.when.slice(3, 5))

export default function App() {
  const [personId, setPersonId] = useState(PERSONS[0].id)
  const person = PERSONS.find(p => p.id === personId)
  const memories = person.memories
  const edges = useMemo(() => deriveEdges(memories), [memories])
  const vocab = useMemo(() => buildVocab(memories), [memories])
  const years = useMemo(() => yearsOf(memories).map(String), [memories])

  const [hiddenClasses, setHiddenClasses] = useState(new Set())
  const [activeFilters, setActiveFilters] = useState([])
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null) // { year, month } | null — mutually exclusive with year
  const [queryResult, setQueryResult] = useState(null) // { ids: Set|null, count: number }
  const [selectedId, setSelectedId] = useState(null)

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

  return (
    <div className="scene">
      <div className="graph-layer">
        <GraphView
          key={personId}
          memories={memories}
          layout={person.layout}
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
        onSelectYear={(y) => { setSelectedYear(y); setSelectedMonth(null) }}
        selectedMonth={selectedMonth}
        onSelectMonth={(m) => { setSelectedMonth(m); setSelectedYear(null) }}
      />
      <Legend
        classCounts={classCounts}
        hiddenClasses={hiddenClasses}
        onToggleClass={toggleClass}
        vocab={vocab}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
      />
      <PersonSwitch persons={PERSONS} activeId={personId} onSwitch={switchPerson} />
      <QueryBar
        stats={stats}
        matchCount={queryResult ? queryResult.count : null}
        filters={filterChips}
        onSubmit={submitQuery}
        onClear={() => setQueryResult(null)}
      />
    </div>
  )
}
