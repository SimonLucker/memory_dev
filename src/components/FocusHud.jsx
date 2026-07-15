import { useState } from 'react';
import { CLASS_COLORS, CLASS_FILLS, CLASS_BORDERS, DAWN, PAPER, PEACH } from '../lib/palette.js';

// The rotating crosshair, gauges, brackets and caption now live in GraphView's canvas paint
// (graph-view/SKILL.md → Selected-node crosshair) so they stay glued to the node through
// pans/zooms. FocusHud keeps ONLY the detail card + ✕.

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

export default function FocusHud({ memory, onClose }) {
  const accent = CLASS_COLORS[memory.class] || DAWN[0];
  const fill = CLASS_FILLS[memory.class] || 'rgba(255,255,255,0.06)';
  const border = CLASS_BORDERS[memory.class] || 'rgba(255,255,255,0.14)';
  const year = memory.when.slice(6, 10);
  const feelings = memory.feeling || [];
  const who = memory.who || [];
  const photos = memory.photos || [];
  const [hero, setHero] = useState(0); // index of the photo shown large (reset per memory via key= in GraphView)
  const heroSrc = photos[hero];

  return (
    // full-screen wrapper stays click-through so graph gestures pass; the card re-enables events
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          ...panel,
          pointerEvents: 'auto',
          position: 'absolute',
          top: 64, /* clears the person-switch pill */
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

        {/* hero photo — photos[0] (or the clicked thumb) as a real image; else the dusk-tinted
            dawn gradient placeholder. onError falls back to the same gradient. key=heroSrc remounts
            the <img> on swap so a prior onError-hide never sticks to the reused DOM node. */}
        <div
          style={{
            height: 150,
            borderRadius: 14,
            overflow: 'hidden',
            transform: 'rotate(-3deg)',
            // dusk tint layered over the dawn gradient keeps the placeholder soft; the <img>
            // sits on top of both, so a loaded photo shows crisp and full-strength.
            background: `linear-gradient(rgba(30,24,44,0.4), rgba(30,24,44,0.4)), linear-gradient(165deg, ${DAWN[0]}, ${PEACH} 56%, ${DAWN[2]})`,
            border: '1px solid rgba(255,255,255,0.18)',
            marginBottom: photos.length > 1 ? 10 : 18,
          }}
        >
          {heroSrc && (
            <img
              key={heroSrc}
              src={heroSrc}
              alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>

        {/* thumbnail strip — only when there is more than one photo; click swaps into the hero */}
        {photos.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {photos.slice(0, 4).map((p, i) => (
              <img
                key={p}
                src={p}
                alt=""
                onClick={() => setHero(i)}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  objectFit: 'cover',
                  cursor: 'pointer',
                  opacity: i === hero ? 1 : 0.6,
                  border: `1px solid ${i === hero ? 'rgba(245,214,188,0.8)' : 'rgba(255,255,255,0.14)'}`,
                }}
              />
            ))}
          </div>
        )}

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
