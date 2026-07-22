import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { CLASS_COLORS } from '../lib/palette.js'

// DD-MM-YYYY HH:mm → sortable string (no date library, per memory-schema skill).
const sortKey = w => w.slice(6, 10) + w.slice(3, 5) + w.slice(0, 2) + w.slice(11)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const prettyWhen = w => `${MONTHS[Number(w.slice(3, 5)) - 1]} ${Number(w.slice(0, 2))}, ${w.slice(6, 10)}`

const ORDERS = [
  ['new', 'Newest first'],
  ['old', 'Oldest first'],
  ['class', 'Category'],
  ['people', 'People'],
  ['feeling', 'Feelings'],
  ['music', 'Music'],
  ['place', 'Places'],
]

// Which group(s) a memory belongs to per order. Multi-value orders (people,
// feelings) list the memory under EVERY value it carries.
const GROUP_KEYS = {
  class: m => [m.class || 'No category'],
  people: m => (m.who.length ? m.who.map(p => p.name) : ['No one tagged']),
  feeling: m => (m.feeling.length ? m.feeling : ['No feeling']),
  music: m => [m.music?.artist || m.music?.name || 'No music'],
  place: m => [m.where || 'No place'],
}

// The Memory Vault: every memory as a calm, scannable list. Click a card to
// open that memory in the Cortex; heart to favorite, trash to delete (two-tap).
export default function Vault({ memories, pending = [], newId, onOpen, onFav, onDelete, onPhoto, onPlay, onAccept, onDecline }) {
  const [q, setQ] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  const [order, setOrder] = useState('new')
  const [confirmId, setConfirmId] = useState(null) // trash tapped once on this card
  const newRef = useRef(null)

  // search + favorites filter, newest-first as the base ordering
  const found = useMemo(() => {
    const sorted = [...memories].sort((a, b) => sortKey(b.when).localeCompare(sortKey(a.when)))
    const pool = favOnly ? sorted.filter(m => m.favorite) : sorted
    if (!q.trim()) return pool
    const needle = q.toLowerCase()
    return pool.filter(m =>
      [m.what, m.where, m.why, m.summary, m.class, ...m.feeling, ...m.who.map(p => p.name),
        m.music?.name, m.music?.artist].filter(Boolean).join(' ').toLowerCase().includes(needle))
  }, [memories, q, favOnly])

  // → [[groupLabel|null, memories[]], ...]; time orders are one unlabelled group,
  // attribute orders become alphabetical sections ("No …" fallbacks sink last).
  const groups = useMemo(() => {
    if (order === 'new') return [[null, found]]
    if (order === 'old') return [[null, [...found].reverse()]]
    const keyOf = GROUP_KEYS[order]
    const map = new Map()
    for (const m of found) for (const k of keyOf(m)) {
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(m)
    }
    return [...map.entries()].sort((a, b) => {
      const an = a[0].startsWith('No '), bn = b[0].startsWith('No ')
      return an !== bn ? an - bn : a[0].localeCompare(b[0])
    })
  }, [found, order])

  useEffect(() => {
    if (newId && newRef.current) newRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [newId])

  // "Delete?" reverts on its own — mouseleave is unreliable on touch screens.
  useEffect(() => {
    if (!confirmId) return
    const t = setTimeout(() => setConfirmId(null), 3000)
    return () => clearTimeout(t)
  }, [confirmId])

  const favCount = memories.filter(m => m.favorite).length

  // A memory someone shared: same card, no favorite/delete/open — just accept or decline.
  const pendingCard = m => {
    const accent = CLASS_COLORS[m.class] || '#9DB4DE'
    return (
      <article key={m.id} className="vault-card pending">
        {m.photos?.length
          ? <img className="vault-photo" src={m.photos[0]} alt="" loading="lazy"
              onClick={() => onPhoto(m.photos, 0)} />
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
            {m.music && (
              <button className="chip music" title="Play preview" onClick={() => onPlay(m.music)}>
                ▶ {m.music.name}
              </button>
            )}
          </div>
          <div className="pending-from">from {m._pending.from}</div>
          <div className="pending-actions">
            <button className="save-btn" onClick={() => onAccept(m.id)}>Accept</button>
            <button className="ghost-btn" onClick={() => onDecline(m.id)}>Decline</button>
          </div>
        </div>
      </article>
    )
  }

  const card = m => {
    const accent = CLASS_COLORS[m.class] || '#9DB4DE'
    return (
      <article
        ref={m.id === newId ? newRef : null}
        className={'vault-card' + (m.id === newId ? ' fresh' : '')}
        onClick={() => onOpen(m.id)}
      >
        {m.photos?.length
          ? <img className="vault-photo" src={m.photos[0]} alt="" loading="lazy"
              onClick={e => { e.stopPropagation(); onPhoto(m.photos, 0) }} />
          : <div className="vault-photo placeholder" style={{ background: `linear-gradient(145deg, ${accent}55, ${accent}22)` }} />}
        <div className="vault-body">
          <div className="vault-title">
            <span className="dot" style={{ background: accent }} />
            <strong>{m.what}</strong>
            <span className="vault-when">{prettyWhen(m.when)}</span>
          </div>
          <div className="vault-meta">{m.where}{m.feeling.length ? ` · ${m.feeling.join(', ')}` : ''}{m._from ? ` · shared by ${m._from}` : ''}</div>
          <p className="vault-summary">{m.summary}</p>
          <div className="vault-chips">
            {m.who.map(p => <span key={p.id} className="chip">{p.name}</span>)}
            {m.music && (
              <button className="chip music" title="Play preview"
                onClick={e => { e.stopPropagation(); onPlay(m.music) }}>
                ▶ {m.music.name}
              </button>
            )}
          </div>
        </div>
        <div className="vault-side">
          <button
            className={'fav-btn' + (m.favorite ? ' on' : '')}
            title={m.favorite ? 'Unfavorite' : 'Favorite'}
            onClick={e => { e.stopPropagation(); onFav(m.id) }}
          >♥</button>
          <div className="vault-imp" title={`importance ${m.importance}/5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} style={{ opacity: i < m.importance ? 0.9 : 0.18, background: accent }} />
            ))}
          </div>
          {confirmId === m.id ? (
            <button className="del-btn confirm"
              onClick={e => { e.stopPropagation(); setConfirmId(null); onDelete(m.id) }}
            >Delete?</button>
          ) : (
            <button className="del-btn" title="Delete memory"
              onClick={e => { e.stopPropagation(); setConfirmId(m.id) }}
            >🗑</button>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="vault">
      <header className="vault-head">
        <div className="eyebrow">Memory vault</div>
        <h1>{memories.length} memories kept</h1>
        <div className="vault-tools">
          <input
            className="vault-search"
            placeholder="Find a memory — a person, a place, a feeling…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <select
            className="order-select"
            value={order}
            onChange={e => setOrder(e.target.value)}
            title="Order by"
          >
            {ORDERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <button
            className={'fav-filter' + (favOnly ? ' on' : '')}
            title="Show favorites"
            onClick={() => setFavOnly(o => !o)}
          >
            ♥{favCount ? ` ${favCount}` : ''}
          </button>
        </div>
      </header>
      <div className="vault-list">
        {pending.length > 0 && !q.trim() && !favOnly && (
          <>
            <div className="vault-group">
              <span className="eyebrow">Shared with you</span>
              <span className="vault-group-count">{pending.length}</span>
            </div>
            {pending.map(pendingCard)}
          </>
        )}
        {groups.map(([label, mems]) => (
          <Fragment key={label ?? 'time'}>
            {label && (
              <div className="vault-group">
                <span className="eyebrow">{label}</span>
                <span className="vault-group-count">{mems.length}</span>
              </div>
            )}
            {mems.map(m => <Fragment key={`${label ?? ''}|${m.id}`}>{card(m)}</Fragment>)}
          </Fragment>
        ))}
        {!found.length && <div className="vault-empty">{favOnly ? 'No favorites yet — tap ♥ on a memory.' : 'Nothing matches — try another word.'}</div>}
      </div>
    </div>
  )
}
