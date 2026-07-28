import { useMemo, useRef, useState } from 'react'
import { whenToTs, monthKey } from '../lib/thread.js'
import { EMPTY_VAULT, SEARCH_PLACEHOLDER, SEARCH_NO_RESULT, DELETE_CONFIRM } from '../lib/copy.js'
import { Search, Heart, HeartFilled, Plus, Share, Trash } from './Icons.jsx'
import '../styles/vault.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']

// "Dec 27 · Luang Prabang" — the one metadata line a row gets.
const metaLine = m => {
  const d = new Date(whenToTs(m.when))
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return m.where ? `${date} · ${m.where}` : date
}

const thumbSrc = m => m.photos?.[0] || m.videos?.[0]?.poster || null

const matches = (m, q) =>
  [m.what, m.where, ...(m.who || []).map(p => p.name), ...(m.voice || []).map(v => v.transcript)]
    .some(s => s && s.toLowerCase().includes(q))

export default function Vault({ memories, pending, mode, setMode, openMemory, toggleFavorite,
  deleteMemory, acceptShare, declineShare, cortexSlot }) {
  const [query, setQuery] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  const [newestFirst, setNewestFirst] = useState(true)
  const [menu, setMenu] = useState(null) // { memory, confirm: bool }
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

  const monthLabel = key => {
    const [y, mo] = key.split('-')
    return `${MONTHS_FULL[Number(mo) - 1]} ${y}`
  }

  return (
    <div className="vault">
      <div className="vault-top">
        <div className="vault-seg">
          {['list', 'cortex'].map(m => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {m === 'list' ? 'List' : 'Cortex'}
            </button>
          ))}
        </div>
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
