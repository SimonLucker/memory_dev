import { useMemo } from 'react';

// Left vertical year rail: month-ridge density line + year labels. Skill: timeline.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOf = (m) => Number(m.when.slice(3, 5));
const yearOf = (m) => m.when.slice(6, 10);

// Catmull-Rom -> cubic bezier, passing exactly THROUGH every point (unlike the
// old quadratic-through-midpoints join, which cuts corners and skips the peak).
function smoothPath(pts) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function Timeline({ years, memories, selectedYear, onSelectYear, selectedMonth, onSelectMonth }) {
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
  const dots = points.filter((p) => p.count > 0);
  const isActive = (p) => selectedMonth && selectedMonth.year === p.year && selectedMonth.month === p.month;

  function handleWheel(e) {
    const idx = selectedYear ? years.indexOf(selectedYear) : -1;
    const delta = e.deltaY > 0 ? 1 : -1;
    const next = Math.min(years.length - 1, Math.max(0, idx === -1 ? 0 : idx + delta));
    onSelectYear(years[next]);
  }

  function handleDotClick(p) {
    onSelectMonth?.(isActive(p) ? null : { year: p.year, month: p.month });
  }

  // The rail's svg uses preserveAspectRatio="none" so the ridge line can fill
  // the full rail height from a fixed 0-100 viewBox (x stays 1:1 with px,
  // y stretches non-uniformly). A plain <circle r> in that space renders as
  // an ellipse. Dots are drawn instead as zero-length <line> points with a
  // round linecap and vector-effect="non-scaling-stroke" — that vector
  // effect renders the stroke (including the round cap) in screen space,
  // immune to the surrounding non-uniform scale, so the cap stays a true
  // circle. Same x/y as the path data, so they land exactly on the curve —
  // no separate HTML overlay, no ResizeObserver needed.
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
        {dots.map((p) => {
          const r = Math.min(6, 2 + p.count);
          const diameter = r * 2;
          const active = isActive(p);
          const label = `${MONTHS[p.month - 1]} ${p.year} · ${p.count} memor${p.count === 1 ? 'y' : 'ies'}`;
          return (
            <g key={`${p.year}-${p.month}`}>
              {active && (
                <line
                  x1={p.x} y1={p.y} x2={p.x} y2={p.y}
                  className="ridge-dot-halo"
                  strokeWidth={diameter + 6}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <line
                x1={p.x} y1={p.y} x2={p.x} y2={p.y}
                className="ridge-dot"
                strokeWidth={diameter}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={p.x} y1={p.y} x2={p.x} y2={p.y}
                className="ridge-dot-hit"
                strokeWidth={16}
                vectorEffect="non-scaling-stroke"
                onClick={() => handleDotClick(p)}
              >
                <title>{label}</title>
              </line>
            </g>
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
