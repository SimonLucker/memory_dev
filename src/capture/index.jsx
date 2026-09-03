// Capture sheet frame (spec 6): Dawn gradient, header with chevron-down close,
// "Capture", avatar; the unchanged engine below. App keeps this mounted for
// the app's lifetime and toggles `open` (the sheet transform lives in app.css),
// so nothing here may reset on open or close.
import Capture from './Capture.jsx'
import Avatar from '../core/Avatar.jsx'
import { ChevronDown } from '../core/Icons.jsx'
import { CAPTURE_TITLE } from '../core/copy.js'
import { readShowcase } from '../core/showcase.js'
import { scenes } from './showcase.js'

// Showcase-only: the scene may seed thread rows, fake the recording bar or
// force the big-button setting (ARCHITECTURE.md section 6). Any showcase
// (not only capture's) makes the engine read only; {} is the plain flag.
const SHOW = readShowcase()
const SCENE = SHOW ? (SHOW.module === 'capture' && scenes[SHOW.scene]) || {} : null
// The app's clock when frozen (a showcase or ?now=), so a save is dated like the greeting.
const Q = new URLSearchParams(location.search)
const NOW = SHOW?.now || (Q.get('now') ? new Date(Q.get('now')) : null)

export default function CaptureSheet({ open, person, memories, addMemory, updateMemory, nav, settings }) {
  const openMemory = id => { nav.closeSheet(); nav.openStory(id) }
  const bigButtons = SCENE?.bigButtons ?? settings?.bigButtons !== false
  return (
    <div className="cs bg-dawn" aria-hidden={!open}>
      <header className="cs-head">
        <button className="cs-close" onClick={nav.closeSheet} aria-label="Close"><ChevronDown size={22} /></button>
        <span className="cs-title">{CAPTURE_TITLE}</span>
        <Avatar person={person} size={30} className="cs-avatar" onClick={() => { nav.closeSheet(); nav.openProfile() }} />
      </header>
      <div className="cs-body">
        <Capture person={person} memories={memories} addMemory={addMemory} updateMemory={updateMemory}
          openMemory={openMemory} bigButtons={bigButtons} scene={SCENE} now={NOW} />
      </div>
    </div>
  )
}
