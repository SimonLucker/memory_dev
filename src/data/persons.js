import p1 from './memories.json'
import p2 from './memories-p2.json'
import p3 from './memories-p3.json'
import p4 from './memories-p4.json'
import l1 from './layout-p1.json'
import l2 from './layout-p2.json'
import l3 from './layout-p3.json'

export const PERSONS = [
  { id: 'p1', name: 'Glenn', short: 'Glenn', memories: p1, layout: l1 },
  { id: 'p2', name: 'Maya', short: 'Maya', memories: p2, layout: l2 },
  // Fresh start — real memories, made in Memorialize.
  { id: 'p3', name: 'Simon Akkerman', short: 'Simon A', memories: p3, layout: l3 },
  { id: 'p4', name: 'Simon Gullstrøm', short: 'Simon G', memories: p4, layout: {} },
]
