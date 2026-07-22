// Top-right person switcher pill. Skill: memory-schema (Multi-person).
export default function PersonSwitch({ persons, activeId, onSwitch }) {
  return (
    <div className="person-switch panel">
      {persons.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`person-chip${p.id === activeId ? ' is-active' : ''}`}
          onClick={() => onSwitch(p.id)}
        >
          {p.short || p.name}
          <span className="person-count">{p.memories.length}</span>
          {p.pendingCount > 0 && <span className="pending-dot">{p.pendingCount}</span>}
        </button>
      ))}
    </div>
  )
}
