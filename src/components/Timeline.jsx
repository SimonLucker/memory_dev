import { useEffect, useMemo, useRef, useState } from 'react';

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

// The svg is measured (ResizeObserver) and everything is drawn in PIXEL space
// with a matching viewBox — real circles, uniform strokes. The previous approach
// (fixed 0-100 viewBox + preserveAspectRatio="none" + zero-length lines with
// vector-effect="non-scaling-stroke") rendered smeared ellipses on Safari, which
// scales non-scaling strokes anyway under a non-uniform viewBox transform.
//
// horizontal: the phone variant — time runs left→right along a top strip
// (density becomes ridge height), same dot/halo/hit mechanics.
export default function Timeline({ years, memories, selectedYear, onSelectYear, selectedMonth, onSelectMonth, horizontal }) {
  const svgRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => {
    if (!years || years.length === 0 || !box.w || !box.h) return [];
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
    return raw.map((p, i) => horizontal
      ? { ...p, x: (i / denom) * box.w, y: Math.max(4, box.h - 6 - p.count * 4) }
      : { ...p, x: 6 + p.count * 9, y: (i / denom) * box.h });
  }, [years, memories, horizontal, box]);

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

  return (
    <div className={horizontal ? 'timeline-rail horizontal' : 'timeline-rail'} onWheel={handleWheel}>
      <div className="timeline-inner">
      <svg ref={svgRef} className="timeline-ridge" viewBox={`0 0 ${Math.max(box.w, 1)} ${Math.max(box.h, 1)}`}>
        <defs>
          <linearGradient id="timeline-ridge-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8D4EC" />
            <stop offset="56%" stopColor="#F5D6BC" />
            <stop offset="100%" stopColor="#E0C5DC" />
          </linearGradient>
        </defs>
        <path className="ridge-line" d={pathD} />
        {dots.map((p) => {
          const r = Math.min(6, 2 + p.count);
          const active = isActive(p);
          const label = `${MONTHS[p.month - 1]} ${p.year} · ${p.count} memor${p.count === 1 ? 'y' : 'ies'}`;
          return (
            <g key={`${p.year}-${p.month}`}>
              {active && <circle cx={p.x} cy={p.y} r={r + 3} className="ridge-dot-halo" />}
              <circle cx={p.x} cy={p.y} r={r} className="ridge-dot" />
              <circle cx={p.x} cy={p.y} r={9} className="ridge-dot-hit" onClick={() => handleDotClick(p)}>
                <title>{label}</title>
              </circle>
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
    </div>
  );
}
