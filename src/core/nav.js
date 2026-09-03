// Navigation model, ARCHITECTURE.md section 3. One state object, a small nav
// API handed to every module as props, and a hash mirror of the top entry.
import { useEffect, useMemo, useState } from 'react'

export const LAUNCH = { personId: 'p1', tab: 'home', stack: [], sheet: null }

// '#/memory/:id' | '#/recap/:id' | '#/memories' | '#/capture' | '#/profile' -> partial state
export function fromHash(hash) {
  const m = hash.replace(/^#\/?/, '').split('/')
  switch (m[0]) {
    case 'memory': return { stack: [{ kind: 'story', id: m[1] }] }
    case 'recap': return { stack: [{ kind: 'recap', id: m[1] }] }
    case 'memories': return { tab: 'memories' }
    case 'capture': return { sheet: 'capture' }
    case 'profile': return { sheet: 'profile' }
    default: return {}
  }
}

export function toHash({ tab, stack, sheet }) {
  if (sheet) return '#/' + sheet
  const top = stack[stack.length - 1]
  if (top) return top.kind === 'recap' ? `#/recap/${top.id}` : `#/memory/${top.id}`
  return tab === 'memories' ? '#/memories' : ''
}

// useNav(initial, mirrorHash): the hash is applied once on load and written on
// every change unless mirrorHash is false (showcase mode).
export function useNav(initial = LAUNCH, mirrorHash = true) {
  const [state, set] = useState(() => (mirrorHash ? { ...initial, ...fromHash(location.hash) } : initial))

  useEffect(() => {
    window.__state = state
    if (!mirrorHash) return
    const h = toHash(state)
    if (h !== location.hash && (h || location.hash)) history.replaceState(null, '', location.pathname + location.search + h)
  }, [state, mirrorHash])

  const nav = useMemo(() => {
    const push = entry => set(s => ({ ...s, stack: [...s.stack, entry] }))
    return {
      openStory: (id, origin) => push({ kind: 'story', id, filter: null, origin: origin || undefined }),
      openViewer: (id, index) => push({ kind: 'viewer', id, index }),
      openRecap: id => push({ kind: 'recap', id }),
      back: () => set(s => ({ ...s, stack: s.stack.slice(0, -1) })),
      openCapture: () => set(s => ({ ...s, sheet: 'capture' })),
      openProfile: () => set(s => ({ ...s, sheet: 'profile' })),
      closeSheet: () => set(s => ({ ...s, sheet: null })),
      setTab: tab => set(s => ({ ...s, tab })),
      // Persona switch (Profile): clears the stack, the sheet closes itself.
      setPerson: personId => set(s => ({ ...s, personId, stack: [], sheet: null })),
    }
  }, [])

  return { state, nav }
}
