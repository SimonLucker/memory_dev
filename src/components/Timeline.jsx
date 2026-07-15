import { useMemo } from 'react';

// Left vertical year rail: month-ridge density line + year labels. Skill: timeline.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOf = (m) => Number(m.when.slice(3, 5));
const yearOf = (m) => m.when.slice(6, 10);

// Smooth a point list with quadratic joins through segment midpoints.
function smoothPath(pts) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cur = pts[i];
    const next = pts[i + 1];
    d += ` Q ${cur.x},${cur.y} ${(cur.x + next.x) / 2},${(cur.y + next.y) / 2}`;
  }
  const end = pts[pts.length - 1];
  d += ` L ${end.x},${end.y}`;
  return d;
}

export default function Timeline({ years, memories, selectedYear, onSelectYear }) {
  const points = useMemo(() => {
    if (!years || years.length === 0) return [];
    const counts = {};
    for (const m of memories || []) {
      counts[`${yearOf(m)}-${monthOf(m)}`] = (counts[`${yearOf(m)}-${monthOf(m)}`] || 0) + 1;
    }
    const raw = [];
    for (const y of years) {
      for (let mo = 1; mo <= 12; mo++) {
        raw.push({ year: y, month: mo, count: counts[`${y}-${mo}`] || 0 });
      }
    }
    const denom = Math.max(raw.length - 1, 1);
    return raw.map((p, i) => ({ ...p, x: 6 + p.count * 9, y: (i / denom) * 100 }));
  }, [years, memories]);

  if (!years || years.length === 0) return null;

  const pathD = smoothPath(points);

  function handleWheel(e) {
    const idx = selectedYear ? years.indexOf(selectedYear) : -1;
    const delta = e.deltaY > 0 ? 1 : -1;
    const next = Math.min(years.length - 1, Math.max(0, idx === -1 ? 0 : idx + delta));
    onSelectYear(years[next]);
  }

  return (
    <div className="timeline-rail" onWheel={handleWheel}>
      <svg className="timeline-ridge" viewBox="0 0 96 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="timeline-ridge-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8D4EC" />
            <stop offset="56%" stopColor="#F5D6BC" />
            <stop offset="100%" stopColor="#E0C5DC" />
          </linearGradient>
        </defs>
        <path className="ridge-line" d={pathD} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="ridge-dots">
        {points.filter((p) => p.count > 0).map((p) => {
          const size = Math.min(6, 2 + p.count) * 2;
          return (
            <span
              key={`${p.year}-${p.month}`}
              className="ridge-dot"
              style={{ left: p.x, top: `${p.y}%`, width: size, height: size }}
              title={`${MONTHS[p.month - 1]} ${p.year} · ${p.count} memor${p.count === 1 ? 'y' : 'ies'}`}
            />
          );
        })}
      </div>
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
