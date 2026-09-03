// The five personas. Legacy surfaces read {id, name, short, photo, memories,
// layout}; the v3 shell reads `space` (a loadSpace-shaped object) through
// bundledSpace(). p1 and p2 keep their v2 JSON and are converted at load;
// p5 Isabel is the bundled demo world; p3 and p4 start empty.
import { fromV2 } from './bridge.js'
import { emptyDb, putRows } from './store.js'
import isabel from './demo/isabel.json'
import p1 from './memories.json'
import p2 from './memories-p2.json'
import p3 from './memories-p3.json'
import p4 from './memories-p4.json'
import l1 from './layout-p1.json'
import l2 from './layout-p2.json'
import l3 from './layout-p3.json'

const EMPTY = { people: [], memories: [], moments: [], links: [], questions: [], recaps: [] }

// v2 memory list -> space (arrays). One people row per user persona too, so
// sharedOf can name the owner.
export function v2Space(pid, list, now = new Date().toISOString()) {
  const space = { ...EMPTY, people: [], memories: [], moments: [], links: [] }
  for (const m of list) {
    if (m._pending) continue
    const r = fromV2(m, pid, now)
    space.memories.push(r.memory); space.moments.push(...r.moments)
    space.links.push(...r.links); space.people.push(...r.people)
  }
  return space
}

export const PERSONS = [
  { id: 'p1', name: 'Glenn', short: 'Glenn', photo: '/photos/portrait-p1.jpg', memories: p1, layout: l1, space: v2Space('p1', p1) },
  { id: 'p2', name: 'Maya', short: 'Maya', photo: '/photos/portrait-p2.jpg', memories: p2, layout: l2, space: v2Space('p2', p2) },
  // Fresh start, real memories, made in the app.
  { id: 'p3', name: 'Simon Akkerman', short: 'Simon A', photo: '/photos/portrait-p3.jpg', memories: p3, layout: l3, space: EMPTY },
  { id: 'p4', name: 'Simon Gullstrøm', short: 'Simon G', photo: '/photos/portrait-p4.jpg', memories: p4, layout: {}, space: EMPTY },
  // The demo world from the roadmap. No portrait: the avatar renders the initial.
  { id: 'p5', name: 'Isabel', short: 'Isabel', photo: null, memories: [], layout: {}, space: isabel },
]

// The user rows every space carries (people.is_user), so a contributor from
// another persona resolves to a name.
export const USER_ROWS = PERSONS.map(p => ({
  id: p.id, name: p.name, first_name: p.name.split(' ')[0], avatar_url: p.photo, is_user: true, space_id: p.id, created_at: null,
}))

// -> db for one persona from bundled data only (no network), memoized.
const bundled = {}
export const bundledSpace = pid => (bundled[pid] ||= putRows(
  putRows(emptyDb(), { people: USER_ROWS }), PERSONS.find(p => p.id === pid)?.space || EMPTY))
