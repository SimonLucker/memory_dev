import { useEffect, useState } from 'react'
import './memory.css'
import { findTrack } from '../data/api.js'

// Full-screen slideshow (design-foundation.md 6.4): dusk, slow Ken Burns,
// 900ms crossfades, voice notes in capture order (else the music preview),
// ends on the About text. Tap exits. Styles in memory.css.
export default function Slideshow({ memory, onClose }) {
  const photos = memory.photos || []
  const about = memory.about || [memory.summary, memory.why].filter(Boolean).join(' ')
  const last = photos.length // the final About screen
  const [i, setI] = useState(0)

  useEffect(() => {
    if (i >= last) return
    const t = setTimeout(() => setI(i + 1), 6000)
    return () => clearTimeout(t)
  }, [i, last])

  // Sound: voice notes play in capture order underneath; without voice the
  // music row's Apple preview carries the scenes. Missing media is skipped.
  useEffect(() => {
    const voices = (memory.voice || []).filter(v => v.src)
    const a = new Audio()
    let alive = true
    let vi = 0
    const playVoice = () => {
      if (!alive || vi >= voices.length) return
      a.src = voices[vi].src
      a.play().catch(() => {})
    }
    if (voices.length) {
      a.onended = a.onerror = () => { vi++; playVoice() }
      playVoice()
    } else if (memory.music) {
      findTrack(memory.music).then(info => {
        if (!alive || !info?.previewUrl) return
        a.loop = true
        a.src = info.previewUrl
        a.play().catch(() => {})
      })
    }
    return () => {
      alive = false
      a.onended = a.onerror = null
      a.pause()
      a.removeAttribute('src')
    }
  }, [])

  return (
    <div className="overlay slideshow" onClick={onClose}>
      {photos.map((src, idx) => (
        <div key={idx} className={'ss-slide' + (idx === i ? ' on' : '') + (idx % 2 ? ' alt' : '')}>
          {/* landscape photos letterbox on the dusk ground instead of cropping hard */}
          <img src={src} alt="" onLoad={e => {
            const im = e.target
            if (im.naturalWidth > im.naturalHeight * 1.1) im.classList.add('contain')
          }} />
        </div>
      ))}
      <div className={'ss-slide ss-about' + (i === last ? ' on' : '')}>
        <p className="type-label">{memory.what}</p>
        {about && <p className="type-body ss-text">{about}</p>}
      </div>
    </div>
  )
}
