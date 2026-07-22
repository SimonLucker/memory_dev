// Registered people = profile owners with stable IDs. This is the modular
// identity seam: later this array becomes a server table with real user IDs
// and push tokens; resolve() keeps the same contract.
export const REGISTRY = [
  { id: 'p1', name: 'Glenn' },
  { id: 'p2', name: 'Maya' },
  { id: 'p3', name: 'Simon Akkerman', aliases: ['simon a', 'simon akkerman'] },
  { id: 'p4', name: 'Simon Gullstrøm', aliases: ['simon g', 'simon gullstrom', 'simon gullstrøm'] },
]

export const firstName = name => name.split(' ')[0]

// → { match } on an exact full-name/alias hit, { ambiguous: [...] } when the
// name is only the first name of 2+ registered people, null otherwise.
export function resolvePerson(name) {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return null
  const match = REGISTRY.find(p => p.name.toLowerCase() === n || (p.aliases || []).includes(n))
  if (match) return { match }
  const firsts = REGISTRY.filter(p => firstName(p.name).toLowerCase() === n)
  if (firsts.length >= 2) return { ambiguous: firsts }
  return null
}
