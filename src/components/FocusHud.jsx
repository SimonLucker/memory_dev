import { CLASS_COLORS, CLASS_FILLS, CLASS_BORDERS, DAWN, PAPER, PEACH } from '../lib/palette.js';

// polar helper: angle in degrees, 0 = top, clockwise
function pol(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arcPath(cx, cy, r, startDeg, endDeg) {
  const [sx, sy] = pol(cx, cy, r, startDeg);
  const [ex, ey] = pol(cx, cy, r, endDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}

const START = -130;
const SPAN = 260;

function Gauge({ cx, cy, r, frac, ticks, gradId }) {
  const marks = [];
  for (let i = 0; i <= ticks; i++) {
    const [x1, y1] = pol(cx, cy, r - 3, START + (SPAN * i) / ticks);
    const [x2, y2] = pol(cx, cy, r + 3, START + (SPAN * i) / ticks);
    marks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={PAPER} strokeOpacity="0.35" strokeWidth="1" />);
  }
  return (
    <g fill="none">
      <path d={arcPath(cx, cy, r, START, START + SPAN)} stroke={PAPER} strokeOpacity="0.14" strokeWidth="2" strokeLinecap="round" />
      <path d={arcPath(cx, cy, r, START, START + SPAN * Math.max(0.001, frac))} stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" />
      {marks}
    </g>
  );
}

function bracket(cx, cy, half, len) {
  const c = [
    [cx - half, cy - half, len, len], // TL
    [cx + half, cy - half, -len, len], // TR
    [cx - half, cy + half, len, -len], // BL
    [cx + half, cy + half, -len, -len], // BR
  ];
  return c.map(([x, y, dx, dy], i) => (
    <path
      key={i}
      d={`M ${x + dx} ${y} L ${x} ${y} L ${x} ${y + dy}`}
      fill="none"
      stroke={PAPER}
      strokeOpacity="0.5"
      strokeWidth="1.2"
      strokeDasharray="1 3"
      strokeLinecap="round"
    />
  ));
}

const panel = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 16,
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
};

function SectionLabel({ dot, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '14px 0 8px' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: dot, display: 'inline-block' }} />
      <span style={{ fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(242,240,236,0.55)' }}>
        {children}
      </span>
    </div>
  );
}

function Chip({ label, accent, fill, border }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: fill,
        border: `1px solid ${border}`,
        fontSize: 12,
        color: PAPER,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 4, background: accent, display: 'inline-block' }} />
      {label}
    </span>
  );
}

export default function FocusHud({ memory, connections, maxConnections, cx, cy, nodeScreenR, onClose }) {
  const accent = CLASS_COLORS[memory.class] || DAWN[0];
  const fill = CLASS_FILLS[memory.class] || 'rgba(255,255,255,0.06)';
  const border = CLASS_BORDERS[memory.class] || 'rgba(255,255,255,0.14)';
  const year = memory.when.slice(6, 10);
  const feelings = memory.feeling || [];
  const who = memory.who || [];
  const half = nodeScreenR + 34;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* gauges + brackets around the (centered) node — full-screen overlay, must stay
          click-through so it never swallows the ✕ / card clicks (graph gestures pass too) */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="hud-dawn" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={DAWN[0]} />
            <stop offset="56%" stopColor={DAWN[1]} />
            <stop offset="100%" stopColor={DAWN[2]} />
          </linearGradient>
        </defs>
        <Gauge cx={cx} cy={cy} r={nodeScreenR + 12} frac={(memory.importance || 0) / 5} ticks={5} gradId="hud-dawn" />
        <Gauge cx={cx} cy={cy} r={nodeScreenR + 24} frac={connections / maxConnections} ticks={Math.min(maxConnections, 10)} gradId="hud-dawn" />
        {bracket(cx, cy, half, 12)}
        <text x={cx} y={cy + half + 22} textAnchor="middle" fill={PAPER} fillOpacity="0.7" fontSize="10" letterSpacing="1.5">
          {`IMPORTANCE ${memory.importance || 0}/5   ·   ${connections}/${maxConnections} LINKS`}
        </text>
      </svg>

      {/* detail card */}
      <div
        style={{
          ...panel,
          pointerEvents: 'auto',
          position: 'absolute',
          top: 24,
          right: 24,
          width: 320,
          // capped so a long summary scrolls INSIDE the card and never reaches the
          // bottom-right query bar (~300px reserved for it)
          maxHeight: 'calc(100vh - 300px)',
          overflowY: 'auto',
          scrollbarWidth: 'thin', // Firefox + Chrome 121+: thin subtle rail
          scrollbarColor: 'rgba(242,240,236,0.25) transparent',
          padding: 20,
          color: PAPER,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          boxShadow: 'rgba(17,24,39,0.35) 0 12px 40px',
        }}
      >
        <button
          onClick={onClose}
          style={{
            pointerEvents: 'auto', // ensure the ✕ stays clickable under the none-wrapper
            position: 'absolute',
            zIndex: 1, // the rotated photo creates a stacking context that otherwise paints over the ✕
            top: 12,
            right: 12,
            width: 26,
            height: 26,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.06)',
            color: PAPER,
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: 1,
          }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* photo placeholder — slight polaroid tilt */}
        <div
          style={{
            height: 150,
            borderRadius: 14,
            transform: 'rotate(-3deg)',
            background: `linear-gradient(165deg, ${DAWN[0]}, ${PEACH} 56%, ${DAWN[2]})`,
            opacity: 0.5,
            border: '1px solid rgba(255,255,255,0.18)',
            marginBottom: 18,
          }}
        />

        <div style={{ fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', color: accent }}>
          {memory.class} · {year}
        </div>
        <div style={{ fontSize: 19, fontWeight: 600, margin: '4px 0 2px', lineHeight: 1.2 }}>{memory.what}</div>
        <div style={{ fontSize: 12.5, color: 'rgba(242,240,236,0.55)' }}>{memory.where}</div>

        {who.length > 0 && (
          <>
            <SectionLabel dot={accent}>Who was there</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {who.map((p) => (
                <Chip key={p.id} label={p.name} accent={accent} fill={fill} border={border} />
              ))}
            </div>
          </>
        )}

        {feelings.length > 0 && (
          <>
            <SectionLabel dot={DAWN[1]}>Feeling</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {feelings.map((f) => (
                <Chip key={f} label={f} accent={DAWN[1]} fill="rgba(236,176,132,0.16)" border="rgba(240,190,155,0.34)" />
              ))}
            </div>
          </>
        )}

        {memory.music && (
          <>
            <SectionLabel dot={DAWN[2]}>Music</SectionLabel>
            <div style={{ fontSize: 13 }}>
              ♪ {memory.music.name}
              {memory.music.artist ? <span style={{ color: 'rgba(242,240,236,0.55)' }}> — {memory.music.artist}</span> : null}
            </div>
          </>
        )}

        <SectionLabel dot={accent}>Why</SectionLabel>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(242,240,236,0.85)' }}>
          {memory.summary || memory.why}
        </div>
      </div>
    </div>
  );
}
