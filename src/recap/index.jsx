// Recap player, spec 5.5: a full screen film of one memory. Beats from
// recapOf (stored or composed), the song's Apple preview underneath, one
// setTimeout per beat, CSS for the zoom, the crossfade and the progress fill.
import { useEffect, useRef, useState } from 'react'
import './recap.css'
import { recapOf, songOf } from '../data/select.js'
import { findTrack } from '../data/api.js'
import { photoSrc, onPhotoError } from '../lib/photos.js'
import Avatar from '../core/Avatar.jsx'
import { Close, Spotify } from '../core/Icons.jsx'
import { scenes } from './showcase.js'

// Showcase: no network (the credit still shows), and ?beat=<index> or the scene's `beat` freezes the player on that beat.
const Q = new URLSearchParams(location.search)
const SHOWCASE = Q.has('showcase')
const FROZEN = Q.get('beat') ?? (Q.get('showcase') === 'recap' ? scenes[Q.get('scene') || 'default']?.beat : null) ?? null

// App mounts a fresh Recap for the 600ms slide-out after close. Remember where the live one was,
// so that copy shows the same beat, frozen and silent, instead of beat 0 with a new song lookup.
// ponytail: module-level marker; drop it when App keeps the leaving element instance.
let closing = null
const SILENT_VOICE_S = 8 // a demo voice with no audio has nothing to hear, so its beat does not need the full length

const personOf = (db, by) => (typeof by === 'string' ? db.people[by] : by) || null
const firstName = p => p?.first_name || String(p?.name || '').split(' ')[0]
const beatMs = b => (b.voice && !b.voice.src ? Math.min(b.duration || 5, SILENT_VOICE_S) : b.duration || 5) * 1000
// Written text is the quote; a demo voice with no audio shows its transcript instead of dead air.
const quoteOf = b => b.quote?.text || (b.voice && !b.voice.src && b.voice.transcript) || ''

function Layer({ beat, under, frozen }) {
  const ms = beatMs(beat)
  const src = photoSrc(beat.src)
  const quote = quoteOf(beat)
  // Frozen shots sit 40% into the beat so the zoom and the quote are visible.
  const style = { '--ms': `${ms}ms`, ...(frozen ? { animationDelay: `${-ms * 0.4}ms`, animationPlayState: 'paused' } : {}) }
  return (
    <div className={`rc-layer${under ? ' rc-under' : ' rc-in'}${quote ? ' rc-q' : ''}`}>
      {beat.kind === 'video'
        ? <video className="rc-img" src={src} poster={photoSrc(beat.poster)} autoPlay muted playsInline />
        : <img className="rc-img" src={src} alt="" style={style} onError={onPhotoError} />}
      <div className="rc-scrim" />
      {quote && <p className="rc-quote t-headline" style={frozen ? { animation: 'none' } : undefined}>{quote}</p>}
    </div>
  )
}

export default function Recap({ db, id, onClose }) {
  const beats = recapOf(db, id)
  const song = songOf(db, id)
  const leaving = closing?.id === id && Date.now() - closing.at < 1000
  const frozen = FROZEN !== null || leaving
  const [cur, setCur] = useState({ i: Math.min(leaving ? closing.i : Number(FROZEN) || 0, Math.max(beats.length - 1, 0)), from: null })
  const { i } = cur
  const beat = beats[i]
  const go = n => setCur(c => ({ i: n, from: c.i }))
  const close = () => { closing = { id, i, at: Date.now() }; onClose() }
  const ms = beat ? beatMs(beat) : 0

  // One timer per beat; after the last one the story just ends.
  useEffect(() => {
    if (!beat || frozen) return
    const t = setTimeout(() => (i < beats.length - 1 ? go(i + 1) : close()), ms)
    return () => clearTimeout(t)
  }, [i, frozen])

  // Warm the next photo so the crossfade never fades into a blank.
  useEffect(() => { const n = beats[i + 1]; if (n?.src) new Image().src = photoSrc(n.src) }, [i])

  // Song: the Apple preview looped low, ducked while a voice note plays. Silent when the lookup fails.
  const songRef = useRef(null)
  useEffect(() => {
    if (!song || SHOWCASE || frozen) return
    let live = true
    findTrack(song).then(t => {
      if (!live || !t?.previewUrl) return
      const a = new Audio(t.previewUrl)
      a.loop = true; a.volume = 0.5
      a.play().catch(() => {})
      songRef.current = a
    })
    return () => { live = false; songRef.current?.pause(); songRef.current = null }
  }, [])

  // Voice notes with a file play over the picture (demo voices have none).
  useEffect(() => {
    const v = beat?.voice
    if (!v?.src || frozen) return
    const a = new Audio(photoSrc(v.src))
    a.play().catch(() => {})
    if (songRef.current) songRef.current.volume = 0.25
    return () => { a.pause(); if (songRef.current) songRef.current.volume = 0.5 }
  }, [i])

  const tap = e => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    if (x > 0.6) return i < beats.length - 1 ? go(i + 1) : close()
    if (x < 0.4 && i > 0) go(i - 1)
  }

  const by = personOf(db, beat?.by)
  return (
    <div className="rc" onClick={tap}>
      {cur.from !== null && beats[cur.from] && <Layer key={`u${cur.from}`} beat={beats[cur.from]} under />}
      {beat && <Layer key={i} beat={beat} frozen={frozen} />}

      <div className="rc-progress">
        {beats.map((b, j) => (
          <i key={j} className={j < i ? 'rc-on' : ''}>
            {j === i && <b key={i} style={{ '--ms': `${ms}ms`, ...(frozen ? { animationDelay: `${-ms * 0.4}ms`, animationPlayState: 'paused' } : {}) }} />}
          </i>
        ))}
      </div>
      <button className="rc-close" onClick={e => { e.stopPropagation(); close() }} aria-label="Close"><Close size={18} /></button>

      {by && (
        <div className="rc-caption" key={`c${i}`} style={frozen ? { animation: 'none' } : undefined}>
          <Avatar person={{ id: by.id, name: by.name || firstName(by) || '?', photo: photoSrc(by.avatar_url) }} size={24} />
          <span>{firstName(by)}</span>
        </div>
      )}
      {song && (
        <div className="rc-song">
          <span className="rc-spot"><Spotify size={22} /></span>
          <span>{song.name} · {song.artist}</span>
        </div>
      )}
    </div>
  )
}
