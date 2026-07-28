// Per-person settings — localStorage under memmory.settings.<personId>.
// Writes announce themselves with a 'memmory:settings' window event.

const key = pid => 'memmory.settings.' + pid

export function getSettings(pid) {
  try { return JSON.parse(localStorage.getItem(key(pid))) || {} } catch { return {} }
}

export function setSetting(pid, name, value) {
  const settings = { ...getSettings(pid), [name]: value }
  localStorage.setItem(key(pid), JSON.stringify(settings))
  window.dispatchEvent(new CustomEvent('memmory:settings', { detail: { personId: pid, settings } }))
}

// Memory ids encode their owner's space (m### is p1, pNm### otherwise) — lets
// overlays that only hold a memory find the right settings bag.
export const personIdFromMemoryId = id => (/^p\d+/.exec(id || '') || ['p1'])[0]
