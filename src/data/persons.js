import p1 from './memories.json'
import p2 from './memories-p2.json'
import p3 from './memories-p3.json'
import l1 from './layout-p1.json'
import l2 from './layout-p2.json'
import l3 from './layout-p3.json'

export const PERSONS = [
  { id: 'p1', name: 'Glenn', memories: p1, layout: l1 },
  { id: 'p2', name: 'Maya', memories: p2, layout: l2 },
  // Fresh start — real memories, made in Memorialize.
  { id: 'p3', name: 'Simon', memories: p3, layout: l3 },
]
