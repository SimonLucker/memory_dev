// Bottom-left legend: class visibility toggles + attribute filter chips.
// Skill: legend-filters.

const FILTER_SECTIONS = [
  { key: 'people', type: 'who', label: 'People' },
  { key: 'places', type: 'where', label: 'Places' },
  { key: 'feelings', type: 'feeling', label: 'Feelings' },
  { key: 'artists', type: 'artist', label: 'Music' },
];

export default function Legend({ classCounts, hiddenClasses, onToggleClass, vocab, activeFilters, onToggleFilter }) {
  function isActive(type, value) {
    return activeFilters.some((f) => f.type === type && f.value === value);
  }

  function activeCount(type) {
    return activeFilters.filter((f) => f.type === type).length;
  }

  return (
    <div className="panel legend">
      <div className="eyebrow legend-header">Legend</div>

      {classCounts.map(({ name, count }) => {
        const hidden = hiddenClasses.has(name);
        return (
          <button
            key={name}
            type="button"
            className={`legend-row${hidden ? ' is-hidden' : ''}`}
            onClick={() => onToggleClass(name)}
          >
            <span className="legend-dot" data-class={name} />
            <span className="legend-name">{name}</span>
            <span className="legend-count">{count}</span>
          </button>
        );
      })}

      {FILTER_SECTIONS.map(({ key, type, label }) => {
        const entries = (vocab && vocab[key]) || [];
        if (entries.length === 0) return null;
        const count = activeCount(type);
        return (
          <details key={key} className="legend-section">
            <summary>
              <span className="eyebrow">{label}</span>
              {count > 0 && <span className="legend-badge">{count}</span>}
            </summary>
            <div className="chip-list">
              {entries.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`chip${isActive(type, value) ? ' is-active' : ''}`}
                  onClick={() => onToggleFilter({ type, value })}
                >
                  <span className="chip-dot" />
                  {value}
                </button>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
