import { useLayoutEffect, useRef, useState } from 'react'
import '../styles/memory.css'
import { Camera, Close, Mic, Pause, Person, Pin, Play, Plus, Spotify, Transcript } from './Icons.jsx'
import { findTrack, uploadPhoto } from '../lib/api.js'
import { encodePhoto } from '../lib/photos.js'
import { startRecording, transcribe } from '../lib/voice.js'
import { REGISTRY } from '../lib/people.js'
import { whenToTs } from '../lib/thread.js'
import { LOCATION_LINK, MUSIC_LINK, VIEW_TRANSCRIPT } from '../lib/copy.js'

const fmtDur = s => `${Math.floor((s || 0) / 60)}:${String(Math.round(s || 0) % 60).padStart(2, '0')}`
const WAVE = [40, 80, 55, 95, 60, 30, 70, 45, 85, 50, 65, 90, 35, 75]

// Voice note row: play, static waveform, duration, quiet transcript reveal (6.4.4).
function VoiceRow({ note, rise }) {
  const [playing, setPlaying] = useState(false)
  const [showT, setShowT] = useState(false)
  const audioRef = useRef(null)
  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) { a.play().catch(() => {}); setPlaying(true) }
    else { a.pause(); setPlaying(false) }
  }
  return (
    <div className={rise ? 'rise' : undefined}>
      <div className="md-row">
        <audio ref={audioRef} src={note.src} onEnded={() => setPlaying(false)} onError={() => setPlaying(false)} />
        <button className="md-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="md-wave">{WAVE.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
        <span className="type-label">{fmtDur(note.duration)}</span>
      </div>
      {note.transcript && (
        <button className="md-quiet type-label" onClick={() => setShowT(s => !s)}>{VIEW_TRANSCRIPT}</button>
      )}
      {showT && <p className="type-body md-transcript">{note.transcript}</p>}
    </div>
  )
}

// Music row: play + song and artist + Spotify logo + open link (6.4.5).
// Inline play uses the Apple catalog preview via findTrack.
function MusicRow({ music }) {
  const [preview, setPreview] = useState(null) // null | 'loading' | 'missing' | url
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const toggle = async () => {
    const a = audioRef.current
    if (a && typeof preview === 'string' && preview !== 'loading' && preview !== 'missing') {
      if (a.paused) { a.play().catch(() => {}); setPlaying(true) } else { a.pause(); setPlaying(false) }
      return
    }
    if (preview === 'loading') return
    setPreview('loading')
    const info = await findTrack(music)
    if (info?.previewUrl) { setPreview(info.previewUrl); setPlaying(true) }
    else setPreview('missing')
  }
  const url = 'https://open.spotify.com/search/' + encodeURIComponent(`${music.name} ${music.artist || ''}`.trim())
  const hasUrl = typeof preview === 'string' && preview !== 'loading' && preview !== 'missing'
  return (
    <div className="md-row">
      <button className="md-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <span className="type-label md-grow">{music.name}{music.artist ? ` · ${music.artist}` : ''}</span>
      <Spotify size={18} />
      <a className="type-label md-lnk" href={url} target="_blank" rel="noreferrer">{MUSIC_LINK}</a>
      {hasUrl && <audio ref={audioRef} src={preview} autoPlay onEnded={() => setPlaying(false)} />}
    </div>
  )
}

export default function MemoryDetail({ memory, onClose, updateMemory, openSlideshow }) {
  const memRef = useRef(memory)
  memRef.current = memory
  const patch = p => updateMemory({ ...memRef.current, ...p })

  // ---- Open/close: 900ms expansion, reversed on close (6.4). --------------
  const rootRef = useRef(null)
  const scrollRef = useRef(null)
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [phase, setPhase] = useState('enter')
  const fromRef = useRef(null)
  useLayoutEffect(() => {
    // Openers may pass the tapped thumbnail's rect via this global helper.
    const r = window.__memmoryOpenRect
    window.__memmoryOpenRect = null
    if (r && rootRef.current) {
      const host = rootRef.current.getBoundingClientRect()
      fromRef.current = {
        origin: `${r.left + r.width / 2 - host.left}px ${r.top + r.height / 2 - host.top}px`,
        scale: Math.max(0.08, r.width / host.width),
      }
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')))
    return () => cancelAnimationFrame(id)
  }, [])
  const close = () => {
    setPhase('closing')
    setTimeout(onClose, reduced ? 0 : 900)
  }

  // Swipe down from the top of the scroll closes.
  const [dragY, setDragY] = useState(0)
  const touchY = useRef(null)
  const onTouchStart = e => {
    touchY.current = scrollRef.current?.scrollTop <= 0 ? e.touches[0].clientY : null
  }
  const onTouchMove = e => {
    if (touchY.current == null) return
    const dy = e.touches[0].clientY - touchY.current
    if (dy > 0) setDragY(dy)
  }
  const onTouchEnd = () => {
    touchY.current = null
    if (dragY > 90) close()
    else setDragY(0)
  }

  const hidden = phase !== 'open'
  const from = fromRef.current
  const style = {
    transformOrigin: from ? from.origin : '50% 45%',
    transform: hidden ? `scale(${from ? from.scale : 0.6})` : dragY ? `translateY(${dragY}px)` : 'none',
    opacity: hidden ? 0 : 1,
    transition: dragY && phase === 'open' ? 'none' : undefined,
  }

  // ---- Media: photos + videos in one grid (6.4.1). ------------------------
  const photos = memory.photos || []
  const items = [
    ...photos.map(src => ({ type: 'photo', src })),
    ...(memory.videos || []).map(v => ({ type: 'video', ...v })),
  ]
  const [viewer, setViewer] = useState(null) // index into items
  const vSwipe = useRef({ x: 0, moved: false })

  // Tap opens the viewer; long press a photo opens its menu.
  const [menuIdx, setMenuIdx] = useState(null) // index into photos
  const lp = useRef(null)
  const pressDown = i => () => {
    clearTimeout(lp.current)
    lp.current = items[i].type === 'photo'
      ? setTimeout(() => { lp.current = 'fired'; setMenuIdx(i) }, 500)
      : null
  }
  const pressUp = i => () => {
    if (lp.current === 'fired') { lp.current = null; return }
    clearTimeout(lp.current)
    lp.current = null
    setViewer(i)
  }
  const pressCancel = () => { if (lp.current !== 'fired') clearTimeout(lp.current); lp.current = null }

  // ---- Add to this memory: photo, text line, voice (600ms rise). ----------
  const [add, setAdd] = useState(null) // 'menu' | 'text' | null
  const [addText, setAddText] = useState('')
  const [recording, setRecording] = useState(false)
  const recRef = useRef(null)
  const fileRef = useRef(null)
  const [fresh, setFresh] = useState(null) // src (or 'about') of the newest addition

  const onFiles = async e => {
    const files = [...e.target.files]
    e.target.value = ''
    setAdd(null)
    for (const f of files) {
      const src = await uploadPhoto(f).catch(() => encodePhoto(f))
      setFresh(src)
      patch({ photos: [...(memRef.current.photos || []), src] })
    }
  }
  const about = memory.about || [memory.summary, memory.why].filter(Boolean).join(' ')
  const saveText = () => {
    const t = addText.trim()
    setAdd(null)
    setAddText('')
    setMenuIdx(null)
    if (!t) return
    const cur = memRef.current
    const base = cur.about || [cur.summary, cur.why].filter(Boolean).join(' ')
    patch({ about: [base, t].filter(Boolean).join('\n\n') })
    setFresh('about')
  }
  const startVoice = async () => {
    try { recRef.current = await startRecording() } catch { return }
    setRecording(true)
  }
  const stopVoice = async () => {
    const h = recRef.current
    recRef.current = null
    setRecording(false)
    setAdd(null)
    if (!h) return
    const { blobUrl, duration, blob } = await h.stop()
    if (duration < 1) return
    setFresh(blobUrl)
    patch({ voice: [...(memRef.current.voice || []), { src: blobUrl, duration }] })
    transcribe(blob).then(t => {
      if (!t) return
      patch({ voice: (memRef.current.voice || []).map(v => (v.src === blobUrl ? { ...v, transcript: t } : v)) })
    })
  }

  // ---- Tag people: picker over known registry + tagged names. -------------
  const [tagOpen, setTagOpen] = useState(false)
  const [selNames, setSelNames] = useState([])
  const knownNames = [...new Set([...REGISTRY.map(p => p.name), ...(memory.who || []).map(p => p.name)])]
  const openTag = () => { setSelNames((memory.who || []).map(p => p.name)); setTagOpen(true) }
  const toggleName = n => setSelNames(s => (s.includes(n) ? s.filter(x => x !== n) : [...s, n]))
  const saveTag = () => {
    setTagOpen(false)
    updateMemory({ ...memRef.current, __whoNames: selNames })
  }

  // ---- Long press photo menu actions. -------------------------------------
  const setCover = i => {
    setMenuIdx(null)
    patch({ photos: [photos[i], ...photos.filter((_, j) => j !== i)] })
  }
  const removePhoto = i => {
    setMenuIdx(null)
    patch({ photos: photos.filter((_, j) => j !== i) })
  }

  const monthYear = new Date(whenToTs(memory.when)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const mapsUrl = 'https://maps.apple.com/?q=' + encodeURIComponent(memory.where || '')

  const media = item =>
    item.type === 'photo' ? (
      <img src={item.src} alt="" className={fresh === item.src ? 'rise' : undefined} draggable={false} />
    ) : (
      <>
        {item.poster ? <img src={item.poster} alt="" draggable={false} /> : <span className="md-vfill" />}
        <span className="md-vplay"><Play size={18} /></span>
        <span className="md-vdur type-label">{fmtDur(item.duration)}</span>
      </>
    )

  const closeSheets = () => {
    if (recording) stopVoice()
    setAdd(null)
    setTagOpen(false)
    setMenuIdx(null)
  }

  return (
    <div className="overlay memory-detail" ref={rootRef} style={style}>
      <button className="md-close" onClick={close} aria-label="Close"><Close /></button>

      <div className="md-scroll" ref={scrollRef}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

        {items.length > 0 && (
          <button className="md-hero" onPointerDown={pressDown(0)} onPointerUp={pressUp(0)}
            onPointerLeave={pressCancel} onPointerCancel={pressCancel}>
            {media(items[0])}
          </button>
        )}
        {items.length > 1 && (
          <div className="md-thumbs">
            {items.slice(1).map((item, k) => (
              <button key={k} className="md-thumb" onPointerDown={pressDown(k + 1)} onPointerUp={pressUp(k + 1)}
                onPointerLeave={pressCancel} onPointerCancel={pressCancel}>
                {media(item)}
              </button>
            ))}
          </div>
        )}

        <h1 className="type-display md-title">{memory.what}</h1>

        {memory.where && (
          <a className="md-row" href={mapsUrl} target="_blank" rel="noreferrer">
            <Pin size={18} />
            <span className="type-label md-grow">{memory.where} · {monthYear}</span>
            <span className="type-label md-lnk">{LOCATION_LINK}</span>
          </a>
        )}

        {(memory.voice || []).map((note, i) => (
          <VoiceRow key={note.src || i} note={note} rise={fresh === note.src} />
        ))}

        {memory.music && <MusicRow music={memory.music} />}

        {memory.feeling?.length > 0 && (
          <>
            <h2 className="md-sec">Feelings</h2>
            <div className="md-chips">
              {memory.feeling.map(f => <span key={f} className="md-chip">{f}</span>)}
            </div>
          </>
        )}

        {memory.who?.length > 0 && (
          <>
            <h2 className="md-sec">People</h2>
            <div className="md-chips">
              {memory.who.map(p => <span key={p.id} className="md-chip">{p.name}</span>)}
            </div>
          </>
        )}

        {about && (
          <>
            <h2 className="md-sec">About</h2>
            <p className={'type-body md-about' + (fresh === 'about' ? ' rise' : '')}>{about}</p>
          </>
        )}

        <div className="md-actions">
          <button className="md-pill prim" onClick={() => openSlideshow(memory.id)}>Slideshow</button>
          <button className="md-pill quiet" onClick={() => setAdd('menu')}><Plus size={16} />Add</button>
          <button className="md-pill quiet" onClick={openTag}><Person size={16} />Tag people</button>
        </div>
      </div>

      {viewer != null && (
        <div className="md-viewer"
          onClick={() => { if (!vSwipe.current.moved) setViewer(null) }}
          onTouchStart={e => { vSwipe.current = { x: e.touches[0].clientX, moved: false } }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - vSwipe.current.x
            if (Math.abs(dx) > 40 && items.length > 1) {
              vSwipe.current.moved = true
              setViewer(v => (v + (dx < 0 ? 1 : -1) + items.length) % items.length)
              setTimeout(() => { vSwipe.current.moved = false }, 350)
            }
          }}>
          {items[viewer].type === 'photo'
            ? <img src={items[viewer].src} alt="" />
            : <video src={items[viewer].src} poster={items[viewer].poster} controls autoPlay playsInline
                onClick={e => e.stopPropagation()} />}
        </div>
      )}

      {(add || tagOpen || menuIdx != null) && <div className="md-scrim" onClick={closeSheets} />}

      {menuIdx != null && add == null && !tagOpen && (
        <div className="md-sheet">
          <button className="md-opt" onClick={() => setAdd('text')}><Transcript size={18} />Add context</button>
          <button className="md-opt" onClick={() => setCover(menuIdx)}><Camera size={18} />Set as cover</button>
          <button className="md-opt" onClick={() => setMenuIdx(null)}><Person size={18} />Share</button>
          <button className="md-opt danger" onClick={() => removePhoto(menuIdx)}><Close size={18} />Remove</button>
        </div>
      )}

      {add === 'menu' && (
        <div className="md-sheet">
          <button className="md-opt" onClick={() => fileRef.current?.click()}><Camera size={18} />Photo</button>
          <button className="md-opt" onClick={() => setAdd('text')}><Transcript size={18} />Text</button>
          <button className="md-opt" onClick={recording ? stopVoice : startVoice}>
            <Mic size={18} />{recording ? 'Stop' : 'Voice'}
          </button>
        </div>
      )}

      {add === 'text' && (
        <div className="md-sheet">
          <input className="md-line" autoFocus value={addText} placeholder="Add a line"
            onChange={e => setAddText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveText()} />
          <button className="md-done" onClick={saveText}>Done</button>
        </div>
      )}

      {tagOpen && (
        <div className="md-sheet">
          <div className="md-names">
            {knownNames.map(n => (
              <button key={n} className={'md-name' + (selNames.includes(n) ? ' sel' : '')}
                onClick={() => toggleName(n)}>{n}</button>
            ))}
          </div>
          <button className="md-done" onClick={saveTag}>Done</button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
    </div>
  )
}
