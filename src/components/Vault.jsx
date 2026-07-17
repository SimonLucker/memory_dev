import { useEffect, useMemo, useRef, useState } from 'react'
import { CLASS_COLORS } from '../lib/palette.js'

// DD-MM-YYYY HH:mm → sortable string (no date library, per memory-schema skill).
const sortKey = w => w.slice(6, 10) + w.slice(3, 5) + w.slice(0, 2) + w.slice(11)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const prettyWhen = w => `${MONTHS[Number(w.slice(3, 5)) - 1]} ${Number(w.slice(0, 2))}, ${w.slice(6, 10)}`

// The Memory Vault: every memory as a calm, scannable list. Click a card to
// open that memory in the Cortex.
export default function Vault({ memories, newId, onOpen }) {
  const [q, setQ] = useState('')
  const newRef = useRef(null)

  const shown = useMemo(() => {
    const sorted = [...memories].sort((a, b) => sortKey(b.when).localeCompare(sortKey(a.when)))
    if (!q.trim()) return sorted
    const needle = q.toLowerCase()
    return sorted.filter(m =>
      [m.what, m.where, m.why, m.summary, m.class, ...m.feeling, ...m.who.map(p => p.name),
        m.music?.name, m.music?.artist].filter(Boolean).join(' ').toLowerCase().includes(needle))
  }, [memories, q])

  useEffect(() => {
    if (newId && newRef.current) newRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [newId])

  return (
    <div className="vault">
      <header className="vault-head">
        <div className="eyebrow">Memory vault</div>
        <h1>{memories.length} memories kept</h1>
        <input
          className="vault-search"
          placeholder="Find a memory — a person, a place, a feeling…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </header>
      <div className="vault-list">
        {shown.map(m => {
          const accent = CLASS_COLORS[m.class] || '#9DB4DE'
          return (
            <article
              key={m.id}
              ref={m.id === newId ? newRef : null}
              className={'vault-card' + (m.id === newId ? ' fresh' : '')}
              onClick={() => onOpen(m.id)}
            >
              {m.photos?.length
                ? <img className="vault-photo" src={m.photos[0]} alt="" loading="lazy" />
                : <div className="vault-photo placeholder" style={{ background: `linear-gradient(145deg, ${accent}55, ${accent}22)` }} />}
              <div className="vault-body">
                <div className="vault-title">
                  <span className="dot" style={{ background: accent }} />
                  <strong>{m.what}</strong>
                  <span className="vault-when">{prettyWhen(m.when)}</span>
                </div>
                <div className="vault-meta">{m.where}{m.feeling.length ? ` · ${m.feeling.join(', ')}` : ''}</div>
                <p className="vault-summary">{m.summary}</p>
                <div className="vault-chips">
                  {m.who.map(p => <span key={p.id} className="chip">{p.name}</span>)}
                  {m.music && <span className="chip music">♪ {m.music.name}</span>}
                </div>
              </div>
              <div className="vault-imp" title={`importance ${m.importance}/5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <i key={i} style={{ opacity: i < m.importance ? 0.9 : 0.18, background: accent }} />
                ))}
              </div>
            </article>
          )
        })}
        {!shown.length && <div className="vault-empty">Nothing matches — try another word.</div>}
      </div>
    </div>
  )
}
