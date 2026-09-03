// Edge-to-edge photo viewer: swipe between the memory's photos, tap closes.
import { useRef, useState } from 'react'
import { momentsOf } from '../data/select.js'
import { photoSrc, onPhotoError } from '../lib/photos.js'
import { Close } from '../core/Icons.jsx'

export default function Viewer({ db, id, index = 0, nav }) {
  const photos = momentsOf(db, id).filter(m => m.kind === 'photo')
  const [i, setI] = useState(Math.min(Math.max(index, 0), Math.max(photos.length - 1, 0)))
  const touch = useRef({ x: 0, moved: false })
  const onStart = e => { touch.current = { x: e.touches[0].clientX, moved: false } }
  const onEnd = e => {
    const dx = e.changedTouches[0].clientX - touch.current.x
    if (Math.abs(dx) < 40) return
    touch.current.moved = true
    setI(v => Math.min(Math.max(v + (dx < 0 ? 1 : -1), 0), photos.length - 1))
  }
  const onClick = () => { if (!touch.current.moved) nav.back(); touch.current.moved = false }
  return (
    <div className="st-viewer" onClick={onClick} onTouchStart={onStart} onTouchEnd={onEnd}>
      <div className="st-strip" style={{ transform: `translateX(${-i * 100}%)` }}>
        {photos.map(m => <img key={m.id} src={photoSrc(m.src)} alt="" onError={onPhotoError} />)}
      </div>
      {photos.length > 1 && <div className="st-vpos" aria-hidden="true">{photos.map((m, k) => <i key={m.id} className={k === i ? 'on' : ''} />)}</div>}
      <button className="st-back st-vclose" aria-label="Close"><Close size={18} /></button>
    </div>
  )
}
