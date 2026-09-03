// Showcase mode, ARCHITECTURE.md section 6: /?showcase=<module>&scene=<name>&now=<ISO>&persona=p5
// The real App starts in a known state from the bundled persona space, with a
// frozen clock and no hash routing. Scenes come from src/<module>/showcase.js.
import { LAUNCH } from './nav.js'

const modules = import.meta.glob('../*/showcase.js', { eager: true })

export function readShowcase(search = location.search) {
  const q = new URLSearchParams(search)
  const module = q.get('showcase')
  if (!module) return null
  const scenes = modules[`../${module}/showcase.js`]?.scenes || {}
  const scene = q.get('scene') || 'default'
  const s = scenes[scene] || scenes.default || {}
  const persona = q.get('persona') || s.persona || 'p5'
  const now = new Date(q.get('now') || s.now || '2026-09-04T09:00')
  if (!scenes[scene]) console.warn(`showcase: no scene "${scene}" in ${module}/showcase.js`)
  return { module, scene, now, persona, state: { ...LAUNCH, tab: s.tab || 'home', stack: s.stack || [], sheet: s.sheet || null, personId: persona } }
}
