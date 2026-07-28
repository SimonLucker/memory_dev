import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '../styles/cards.css'
import { Close, Trash } from './Icons.jsx'
import { whenToTs } from '../lib/thread.js'
import { CARDS_EMPTY, CARD_GENERATING, GIFTS_PLACEHOLDER } from '../lib/copy.js'
import { loadCards, upsertCard, removeCard } from '../lib/api.js'
import { weaveCard, candidatesFor, coverOf } from '../lib/cards.js'

const monthYear = ts => new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

// Overlays portal into .phone: position fixed misplaces them here, because the
// pane pager's translateX makes it the containing block for fixed descendants
// (Cards is the pane at -200%, so a fixed veil would land two panes to the left).
const overlay = node => createPortal(node, document.querySelector('.phone') || document.body)

const Gifts = () => (
  <div className="cd-gifts">
    <p className="type-label cd-quiet">Gifts</p>
    <div className="cd-glass type-label">{GIFTS_PLACEHOLDER}</div>
  </div>
)

// The weave config sheet (spec 6.5): theme free text, people chips from the
// vault's who lists, place free text, optional date range. Dusk styling.
function ConfigSheet({ init, peopleNames, onCancel, onWeave }) {
  const [theme, setTheme] = useState(init.theme || '')
  const [people, setPeople] = useState(init.people || [])
  const [place, setPlace] = useState(init.place || '')
  const [from, setFrom] = useState(init.from || '')
  const [to, setTo] = useState(init.to || '')
  const toggle = n => setPeople(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n])
  return (
    <div className="cd-veil" onClick={onCancel}>
      <div className="cd-sheet" onClick={e => e.stopPropagation()}>
        <p className="type-headline">Weave a card</p>
        <label className="type-label cd-fldlabel">Theme
          <input className="cd-fld type-body" value={theme} placeholder="Summers by the water"
            onChange={e => setTheme(e.target.value)} />
        </label>
        {peopleNames.length > 0 && (
          <>
            <p className="type-label cd-fldlabel">People</p>
            <div className="cd-chips">
              {peopleNames.map(n => (
                <button key={n} className={people.includes(n) ? 'cd-chip type-label on' : 'cd-chip type-label'}
                  onClick={() => toggle(n)}>{n}</button>
              ))}
            </div>
          </>
        )}
        <label className="type-label cd-fldlabel">Place
          <input className="cd-fld type-body" value={place} placeholder="Anywhere"
            onChange={e => setPlace(e.target.value)} />
        </label>
        <div className="cd-dates">
          <label className="type-label cd-fldlabel">From
            <input className="cd-fld type-body" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="type-label cd-fldlabel">To
            <input className="cd-fld type-body" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
        </div>
        <div className="cd-sheet-actions">
          <button className="cd-sheet-cancel type-label" onClick={onCancel}>Cancel</button>
          <button className="cd-weave type-label"
            onClick={() => onWeave({ theme: theme.trim(), people, place: place.trim(), from, to })}>
            Weave
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Cards({ memories, person, openMemory }) {
  const [cards, setCards] = useState([])
  const [openId, setOpenId] = useState(null)
  const [sheet, setSheet] = useState(null)     // { init: config, reweaveId? }
  const [weaving, setWeaving] = useState(null) // { cover } while the weave runs
  const [menu, setMenu] = useState(null)       // { card, confirm }

  // Load persisted cards on mount and person switch (remote or dev files).
  const pidRef = useRef(person.id)
  useEffect(() => {
    pidRef.current = person.id
    setCards([]); setOpenId(null); setSheet(null); setWeaving(null); setMenu(null)
    loadCards(person.id).then(list => {
      if (pidRef.current === person.id) setCards(list || [])
    })
  }, [person.id])

  // Profile reads the count without owning the state: localStorage mirror plus
  // a window event, so no prop drilling through App.
  useEffect(() => {
    localStorage.setItem('memmory.cardCount.' + person.id, String(cards.length))
    window.dispatchEvent(new CustomEvent('memmory:cards', { detail: { personId: person.id, count: cards.length } }))
  }, [cards, person.id])

  const peopleNames = useMemo(() => {
    const counts = {}
    for (const m of memories) for (const w of m.who || []) counts[w.name] = (counts[w.name] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 12)
  }, [memories])

  const sorted = useMemo(() =>
    [...cards].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
  [cards])

  const startWeave = async config => {
    const pid = person.id
    const reweaveId = sheet?.reweaveId || null
    setSheet(null)
    setOpenId(null)
    const candidates = candidatesFor(memories, config)
    setWeaving({ cover: coverOf(candidates.length ? candidates : memories) })
    // The skeleton breath is part of the design: never a flash, never a bar.
    const [card] = await Promise.all([
      weaveCard({ memories, config, existingCards: cards, id: reweaveId }),
      new Promise(r => setTimeout(r, 1600)),
    ])
    if (pidRef.current !== pid) return // switched person mid-weave
    setCards(cs => [card, ...cs.filter(c => c.id !== card.id)])
    setWeaving(null)
    setOpenId(card.id)
    upsertCard(pid, card).catch(() => {})
  }

  const doDelete = id => {
    setCards(cs => cs.filter(c => c.id !== id))
    if (openId === id) setOpenId(null)
    removeCard(person.id, id).catch(() => {})
  }

  // Long press (500ms) or right-click opens the card menu; the click that
  // follows a long press must not open the card. Same pattern as Vault rows.
  const pressRef = useRef({ timer: null, fired: false })
  const startPress = c => e => {
    if (e.button === 2) return
    pressRef.current.fired = false
    pressRef.current.timer = setTimeout(() => {
      pressRef.current.fired = true
      setMenu({ card: c, confirm: false })
    }, 500)
  }
  const cancelPress = () => clearTimeout(pressRef.current.timer)
  const onTileClick = c => () => {
    if (pressRef.current.fired) { pressRef.current.fired = false; return }
    setOpenId(c.id)
  }

  if (weaving) {
    return (
      <div className="cd">
        <div className="cd-cover">
          {weaving.cover ? <img src={weaving.cover} alt="" /> : <div className="cd-blank" />}
        </div>
        <div className="cd-skel" />
        <div className="cd-skel cd-skel-short" />
        <p className="type-label cd-weavelabel">{CARD_GENERATING}</p>
      </div>
    )
  }

  const open = openId && cards.find(c => c.id === openId)
  if (open) {
    const byId = new Map(memories.map(m => [m.id, m]))
    const members = (open.memoryIds || []).map(id => byId.get(id)).filter(Boolean)
    const photos = members.flatMap(m => m.photos || []).filter(p => p !== open.cover).slice(0, 10)
    return (
      <div className="cd">
        <button className="cd-close" onClick={() => setOpenId(null)} aria-label="Close">
          <Close size={20} />
        </button>
        <div className="cd-cover">
          {open.cover ? <img src={open.cover} alt="" /> : <div className="cd-blank" />}
          <div className="cd-scrim">
            <h3 className="type-headline">{open.title}</h3>
            <span className="type-label">{open.span}</span>
          </div>
        </div>
        <p className="type-body cd-summary">{open.summary}</p>
        {(open.insights || []).length > 0 && (
          <>
            <p className="type-label cd-quiet">Insights</p>
            {open.insights.map(s => <div key={s} className="cd-glass cd-insight type-label">{s}</div>)}
          </>
        )}
        {photos.length > 0 && (
          <div className="cd-masonry">
            {photos.map(p => <img key={p} src={p} alt="" />)}
          </div>
        )}
        <p className="type-label cd-quiet">Memories</p>
        {members.map(m => (
          <button key={m.id} className="cd-glass cd-mrow" onClick={() => openMemory(m.id)}>
            <span className="type-body cd-mtitle">{m.what}</span>
            <span className="type-label cd-mdate">{monthYear(whenToTs(m.when))}</span>
          </button>
        ))}
        <Gifts />
      </div>
    )
  }

  return (
    <div className="cd">
      {sorted.length === 0 ? (
        <div className="cd-empty">
          <p className="type-body">{CARDS_EMPTY}</p>
          {memories.length >= 3 && (
            <button className="cd-weave type-label" onClick={() => setSheet({ init: {} })}>
              Weave a card
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="cd-grid">
            {sorted.map(c => (
              <div key={c.id} className="cd-tile" role="button" tabIndex={0}
                onClick={onTileClick(c)}
                onPointerDown={startPress(c)} onPointerUp={cancelPress}
                onPointerLeave={cancelPress} onPointerCancel={cancelPress}
                onContextMenu={e => { e.preventDefault(); setMenu({ card: c, confirm: false }) }}>
                {c.cover ? <img src={c.cover} alt="" /> : <div className="cd-blank" />}
                <div className="cd-scrim">
                  <h3 className="type-headline">{c.title}</h3>
                  <span className="type-label">{c.span}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="cd-weave cd-weave-more type-label" onClick={() => setSheet({ init: {} })}>
            Weave a card
          </button>
        </>
      )}
      <Gifts />

      {sheet && overlay(
        <ConfigSheet init={sheet.init} peopleNames={peopleNames}
          onCancel={() => setSheet(null)} onWeave={startWeave} />
      )}

      {menu && overlay(
        <div className="cd-veil cd-veil-center" onClick={() => setMenu(null)}>
          <div className="cd-menu" onClick={e => e.stopPropagation()}>
            {menu.confirm ? (
              <>
                <p className="type-body cd-menu-text">This card will be gone. Its memories stay in the vault.</p>
                <div className="cd-menu-actions">
                  <button className="cd-menu-item" onClick={() => setMenu(null)}>Cancel</button>
                  <button className="cd-menu-item danger"
                    onClick={() => { doDelete(menu.card.id); setMenu(null) }}>
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <button className="cd-menu-item"
                  onClick={() => { setSheet({ init: menu.card.config || {}, reweaveId: menu.card.id }); setMenu(null) }}>
                  Re-weave
                </button>
                <button className="cd-menu-item danger" onClick={() => setMenu({ ...menu, confirm: true })}>
                  <Trash size={18} />Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
