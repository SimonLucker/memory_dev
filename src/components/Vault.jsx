import { useMemo, useRef, useState } from 'react'
import { whenToTs, monthKey, monthLabel, metaLine } from '../lib/thread.js'
import { EMPTY_VAULT, SEARCH_PLACEHOLDER, SEARCH_NO_RESULT, DELETE_CONFIRM } from '../lib/copy.js'
import { Search, Heart, HeartFilled, Plus, Share, Trash } from './Icons.jsx'
import '../styles/vault.css'

const thumbSrc = m => m.photos?.[0] || m.videos?.[0]?.poster || null

// View glyphs local to the toggle (Icons.jsx has no list/constellation icons).
const svgProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }
const ListGlyph = () => (
  <svg {...svgProps}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="14" y2="18" />
  </svg>
)
const CortexGlyph = () => (
  <svg {...svgProps}>
    <line x1="7.5" y1="15.5" x2="11" y2="7.5" />
    <line x1="13.5" y1="7.5" x2="16.5" y2="13.5" />
    <line x1="9" y1="17" x2="15.5" y2="15.5" />
    <circle cx="6.5" cy="17.5" r="2" />
    <circle cx="12" cy="5.5" r="2" />
    <circle cx="17.5" cy="15.5" r="2" />
  </svg>
)

const matches = (m, q) =>
  [m.what, m.where, ...(m.who || []).map(p => p.name), ...(m.voice || []).map(v => v.transcript)]
    .some(s => s && s.toLowerCase().includes(q))

export default function Vault({ memories, pending, mode, setMode, openMemory, toggleFavorite,
  deleteMemory, acceptShare, declineShare, cortexSlot }) {
  const [query, setQuery] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  const [newestFirst, setNewestFirst] = useState(true)
  const [menu, setMenu] = useState(null) // { memory, confirm: bool }
  const [toggleOpen, setToggleOpen] = useState(false)
  const [monthsShown, setMonthsShown] = useState(3)
  const [loadingMore, setLoadingMore] = useState(false)

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    return memories
      .filter(m => (!favOnly || m.favorite) && (!q || matches(m, q)))
      .sort((a, b) => (whenToTs(b.when) - whenToTs(a.when)) * (newestFirst ? 1 : -1))
  }, [memories, query, favOnly, newestFirst])

  // Month pages: browse view loads history a month at a time (shimmer while
  // "fetching"); an active search or favorites filter shows everything at once.
  const filtering = query.trim() !== '' || favOnly
  const groups = useMemo(() => {
    const out = []
    for (const m of sorted) {
      const key = monthKey(whenToTs(m.when))
      if (out[out.length - 1]?.key !== key) out.push({ key, items: [] })
      out[out.length - 1].items.push(m)
    }
    return out
  }, [sorted])
  const visible = filtering ? groups : groups.slice(0, monthsShown)
  const hasMore = !filtering && groups.length > monthsShown

  const onScroll = e => {
    if (!hasMore || loadingMore) return
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      setLoadingMore(true)
      setTimeout(() => { setMonthsShown(n => n + 1); setLoadingMore(false) }, 400)
    }
  }

  // Long press (500ms) or right-click opens the row menu; the click that
  // follows a long press must not open the memory.
  const pressRef = useRef({ timer: null, fired: false })
  const startPress = m => e => {
    if (e.button === 2) return
    pressRef.current.fired = false
    pressRef.current.timer = setTimeout(() => {
      pressRef.current.fired = true
      setMenu({ memory: m, confirm: false })
    }, 500)
  }
  const cancelPress = () => clearTimeout(pressRef.current.timer)
  const onRowClick = m => () => {
    if (pressRef.current.fired) { pressRef.current.fired = false; return }
    openMemory(m.id)
  }

  const closeMenu = () => setMenu(null)
  const menuAction = fn => () => { fn(); closeMenu() }

  return (
    <div className={mode === 'cortex' ? 'vault cortex' : 'vault'}>
      {toggleOpen && <div className="vault-toggle-veil" onClick={() => setToggleOpen(false)} />}
      <div className={toggleOpen ? 'vault-toggle open' : 'vault-toggle'}>
        <button className="vault-toggle-glyph" aria-label="Switch view"
          tabIndex={toggleOpen ? -1 : 0} onClick={() => setToggleOpen(true)}>
          {mode === 'list' ? <ListGlyph /> : <CortexGlyph />}
        </button>
        <div className="vault-toggle-segs">
          {['list', 'cortex'].map(m => (
            <button key={m} className={mode === m ? 'on' : ''} tabIndex={toggleOpen ? 0 : -1}
              onClick={() => { setMode(m); setToggleOpen(false) }}>
              {m === 'list' ? 'List' : 'Cortex'}
            </button>
          ))}
        </div>
      </div>

      <div className="vault-top">
        <div className={toggleOpen ? 'vault-fold open' : 'vault-fold'} />
        {mode === 'list' && (
          <div className="vault-tools">
            <label className="vault-search">
              <Search size={18} />
              <input value={query} placeholder={SEARCH_PLACEHOLDER}
                onChange={e => setQuery(e.target.value)} />
            </label>
            <button className={favOnly ? 'vault-fav on' : 'vault-fav'} aria-label="Favorites"
              onClick={() => setFavOnly(v => !v)}>
              {favOnly ? <HeartFilled size={18} /> : <Heart size={18} />}
            </button>
            <button className="vault-sort" onClick={() => setNewestFirst(v => !v)}>
              {newestFirst ? 'Newest' : 'Oldest'}
            </button>
          </div>
        )}
      </div>

      {mode === 'cortex' ? (
        <div className="vault-cortex">{cortexSlot}</div>
      ) : (
        <div className="vault-list" onScroll={onScroll}>
          {pending.map(m => (
            <div key={m.id} className="vault-pending">
              <div className="vault-pending-body">
                <span className="type-body vault-title">{m.what}</span>
                <span className="type-label vault-meta">From {m._pending.from}</span>
              </div>
              <button className="vault-pending-btn" onClick={() => acceptShare(m.id)}>Accept</button>
              <button className="vault-pending-btn quiet" onClick={() => declineShare(m.id)}>Decline</button>
            </div>
          ))}

          {memories.length === 0 && pending.length === 0 && (
            <p className="type-body vault-empty">{EMPTY_VAULT}</p>
          )}
          {memories.length > 0 && sorted.length === 0 && (
            <p className="type-body vault-empty">{SEARCH_NO_RESULT}</p>
          )}

          {visible.map(g => (
            <div key={g.key}>
              <div className="type-label vault-month">{monthLabel(g.key)}</div>
              {g.items.map(m => (
                <button key={m.id} className="vault-row" onClick={onRowClick(m)}
                  onPointerDown={startPress(m)} onPointerUp={cancelPress}
                  onPointerLeave={cancelPress} onPointerCancel={cancelPress}
                  onContextMenu={e => { e.preventDefault(); setMenu({ memory: m, confirm: false }) }}>
                  <span className="vault-thumb">
                    {thumbSrc(m) && <img src={thumbSrc(m)} alt="" />}
                  </span>
                  <span className="vault-row-text">
                    <span className="type-body vault-title">{m.what}</span>
                    <span className="type-label vault-meta">{metaLine(m)}</span>
                  </span>
                  {m.favorite && <HeartFilled size={18} className="vault-heart" />}
                </button>
              ))}
            </div>
          ))}

          {loadingMore && [0, 1, 2].map(i => (
            <div key={i} className="vault-skel">
              <span className="vault-thumb" />
              <span className="vault-skel-lines"><span /><span /></span>
            </div>
          ))}
        </div>
      )}

      {menu && (
        <div className="vault-menu-veil" onClick={closeMenu}>
          <div className="vault-menu" onClick={e => e.stopPropagation()}>
            {menu.confirm ? (
              <>
                <p className="type-body vault-confirm-text">{DELETE_CONFIRM}</p>
                <div className="vault-confirm-actions">
                  <button className="vault-menu-item" onClick={closeMenu}>Cancel</button>
                  <button className="vault-menu-item danger"
                    onClick={menuAction(() => deleteMemory(menu.memory.id))}>
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <button className="vault-menu-item"
                  onClick={menuAction(() => toggleFavorite(menu.memory.id))}>
                  {menu.memory.favorite ? <HeartFilled size={18} /> : <Heart size={18} />}
                  {menu.memory.favorite ? 'Unfavorite' : 'Favorite'}
                </button>
                <button className="vault-menu-item" onClick={closeMenu}>
                  <Plus size={18} />Add to a Card
                </button>
                <button className="vault-menu-item" onClick={closeMenu}>
                  <Share size={18} />Share
                </button>
                <button className="vault-menu-item danger"
                  onClick={() => setMenu({ ...menu, confirm: true })}>
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
