// Left vertical year rail: density ridge + year labels. Skill: timeline.
export default function Timeline({ years, countsByYear, selectedYear, onSelectYear }) {
  if (!years || years.length === 0) return null;

  const max = Math.max(1, ...years.map((y) => countsByYear[y] || 0));
  const last = Math.max(years.length - 1, 1);

  function handleWheel(e) {
    const idx = selectedYear ? years.indexOf(selectedYear) : -1;
    const delta = e.deltaY > 0 ? 1 : -1;
    const next = Math.min(years.length - 1, Math.max(0, idx === -1 ? 0 : idx + delta));
    onSelectYear(years[next]);
  }

  return (
    <div className="timeline-rail" onWheel={handleWheel}>
      <svg className="timeline-ridge" viewBox="0 0 100 100" preserveAspectRatio="none">
        {years.map((y, i) => {
          const count = countsByYear[y] || 0;
          const w = 8 + (count / max) * 26;
          const yPos = years.length > 1 ? (i / last) * 100 : 50;
          return (
            <rect key={y} className="ridge-bar" x="0" y={yPos - 0.8} width={w} height="1.6" rx="0.8" />
          );
        })}
      </svg>
      <ul className="timeline-years">
        {years.map((y) => {
          const selected = selectedYear === y;
          return (
            <li key={y}>
              <button
                type="button"
                className={`timeline-year${selected ? ' is-selected' : ''}`}
                onClick={() => onSelectYear(selected ? null : y)}
              >
                {y}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
