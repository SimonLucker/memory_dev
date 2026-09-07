// One shared <audio> for every music preview in the app.
//
// iOS Safari and Chrome only let play() run inside a user gesture, and the
// permission is granted per element, not per page. primeAudio() spends the
// first tap on a silent file so every later play() on the same element counts
// as user-initiated, however long after the tap it happens.
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

let el = null
let primed = false
let token = 0 // only the newest preview's handle may stop the shared element

const audio = () => (el ||= new Audio())

// Call inside a real pointer/click handler. Safe to call more than once.
export function primeAudio() {
  if (primed) return
  primed = true
  const a = audio()
  a.src = SILENT
  a.play().then(() => a.pause()).catch(() => { primed = false })
}

// Loops `url` until stopPreview(). Returns a handle so a caller can stop just
// its own preview without knowing about the shared element.
export function playPreview(url, { volume = 0.6 } = {}) {
  const a = audio()
  const mine = ++token
  a.src = url
  a.loop = true
  a.volume = volume
  a.play().catch(() => {})
  return { stop: () => { if (token === mine) stopPreview() } }
}

export function stopPreview() {
  if (!el) return
  el.pause()
  el.currentTime = 0
}
