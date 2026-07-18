import { useEffect, useRef, useState } from 'react';
import { CLASS_COLORS, CLASS_FILLS, CLASS_BORDERS, DAWN, PAPER, PEACH } from '../lib/palette.js';
import { findTrack, appleMusicSearchUrl } from '../lib/api.js';

// Inline preview player: sits between the photos and the text, scrolls with the
// card, autoplays on open and stops when the card unmounts (memory closed).
function SongRow({ music }) {
  const [song, setSong] = useState(null); // { info } | { missing: true }
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    let live = true;
    findTrack(music).then((info) => {
      if (live) setSong(info?.previewUrl ? { info } : { missing: true });
    });
    return () => { live = false };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    a.paused ? a.play() : a.pause();
  };

  const btn = {
    border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    fontSize: 11, color: PAPER, background: 'rgba(255,255,255,0.12)', textDecoration: 'none',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
      padding: '8px 10px', borderRadius: 12,
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    }}>
      {song?.info?.artworkUrl100
        ? <img src={song.info.artworkUrl100} alt="" style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }} />
        : <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: `linear-gradient(145deg, ${DAWN[0]}55, ${DAWN[2]}55)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>♪</div>}
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ fontSize: 12, color: PAPER, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {song?.info?.trackName || music.name}
        </div>
        <div style={{ fontSize: 10.5, color: 'rgba(242,240,236,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {song?.missing ? 'No preview found' : song?.info ? song.info.artistName : music.artist || 'Finding song…'}
        </div>
      </div>
      {song?.info && (
        <>
          <audio
            ref={audioRef}
            src={song.info.previewUrl}
            autoPlay
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          <button onClick={toggle} style={btn}>{playing ? '❚❚' : '▶'}</button>
        </>
      )}
      <a
        href={song?.info?.trackViewUrl || appleMusicSearchUrl(music)}
        target="_blank" rel="noreferrer" title="Open in Apple Music"
        style={{ ...btn, background: `linear-gradient(165deg, ${DAWN[0]}, ${PEACH} 56%, ${DAWN[2]})`, color: '#1F2937', fontWeight: 700 }}
      >↗</a>
    </div>
  );
}

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

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8,
  color: PAPER,
  font: '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  padding: '6px 8px',
  marginBottom: 6,
};

// Editable chip list: ✕ removes, typing + Enter (or comma) adds. Values are plain strings.
function TagEditor({ values, onChange, accent, fill, border, placeholder }) {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setText('');
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {values.map((v) => (
        <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: PAPER, background: fill, border: `1px solid ${border}`, borderRadius: 999, padding: '3px 8px' }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: accent }} />
          {v}
          <span onClick={() => onChange(values.filter((x) => x !== v))} style={{ cursor: 'pointer', opacity: 0.6, fontSize: 9, marginLeft: 2 }}>✕</span>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, color: PAPER, font: '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '3px 10px', width: 90 }}
      />
    </div>
  );
}

export default function FocusHud({ memory, onEdit, onClose, onPhotoTap }) {
  const accent = CLASS_COLORS[memory.class] || DAWN[0];
  const fill = CLASS_FILLS[memory.class] || 'rgba(255,255,255,0.06)';
  const border = CLASS_BORDERS[memory.class] || 'rgba(255,255,255,0.14)';
  const year = memory.when.slice(6, 10);
  const feelings = memory.feeling || [];
  const who = memory.who || [];
  const photos = memory.photos || [];
  const [hero, setHero] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const startEdit = () => {
    setDraft({
      what: memory.what, where: memory.where, why: memory.why, summary: memory.summary,
      importance: memory.importance || 3,
      who: (memory.who || []).map((p) => p.name),
      feeling: [...(memory.feeling || [])],
    });
    setEditing(true);
  };
  const saveEdit = () => {
    const { who, ...rest } = draft;
    onEdit?.({ ...memory, ...rest, importance: Number(draft.importance), feeling: draft.feeling, __whoNames: who });
    setEditing(false);
  };
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value })); // index of the photo shown large (reset per memory via key= in GraphView)
  const heroSrc = photos[hero];

  return (
    // full-screen wrapper stays click-through so graph gestures pass; the card re-enables events
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        className="focus-card"
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
        {onEdit && !editing && (
          <button
            onClick={startEdit}
            aria-label="Edit"
            style={{
              pointerEvents: 'auto',
              position: 'absolute',
              zIndex: 1,
              top: 12,
              right: 44,
              width: 26,
              height: 26,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              color: PAPER,
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ✎
          </button>
        )}
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
              onClick={() => onPhotoTap?.(photos, hero)}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
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

        {memory.music && <SongRow key={memory.id} music={memory.music} />}

        <div style={{ fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', color: accent }}>
          {memory.class} · {year}
        </div>
        {editing ? (
          <div style={{ marginTop: 8 }}>
            <input style={{ ...inputStyle, fontSize: 15, fontWeight: 600 }} value={draft.what} onChange={set('what')} placeholder="What" />
            <input style={inputStyle} value={draft.where} onChange={set('where')} placeholder="Where" />
            <input style={inputStyle} value={draft.why} onChange={set('why')} placeholder="Why" />
            <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} value={draft.summary} onChange={set('summary')} placeholder="Summary" />
            <label style={{ fontSize: 11, color: 'rgba(242,240,236,0.55)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              Importance
              <select style={{ ...inputStyle, width: 'auto', marginBottom: 0 }} value={draft.importance} onChange={set('importance')}>
                {[1, 2, 3, 4, 5].map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </label>
            <SectionLabel dot={accent}>Who was there</SectionLabel>
            <TagEditor values={draft.who} onChange={(v) => setDraft((d) => ({ ...d, who: v }))} accent={accent} fill={fill} border={border} placeholder="add person…" />
            <SectionLabel dot={DAWN[1]}>Feelings</SectionLabel>
            <TagEditor values={draft.feeling} onChange={(v) => setDraft((d) => ({ ...d, feeling: v }))} accent={DAWN[1]} fill="rgba(236,176,132,0.16)" border="rgba(240,190,155,0.34)" placeholder="add feeling…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={saveEdit} style={{ flex: 1, padding: '7px 0', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, color: '#1F2937', background: `linear-gradient(165deg, ${DAWN[0]}, ${PEACH} 56%, ${DAWN[2]})` }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '7px 0', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer', color: PAPER, background: 'transparent' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 19, fontWeight: 600, margin: '4px 0 2px', lineHeight: 1.2 }}>{memory.what}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(242,240,236,0.55)' }}>{memory.where}</div>
          </>
        )}

        {!editing && who.length > 0 && (
          <>
            <SectionLabel dot={accent}>Who was there</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {who.map((p) => (
                <Chip key={p.id} label={p.name} accent={accent} fill={fill} border={border} />
              ))}
            </div>
          </>
        )}

        {!editing && feelings.length > 0 && (
          <>
            <SectionLabel dot={DAWN[1]}>Feeling</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {feelings.map((f) => (
                <Chip key={f} label={f} accent={DAWN[1]} fill="rgba(236,176,132,0.16)" border="rgba(240,190,155,0.34)" />
              ))}
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
