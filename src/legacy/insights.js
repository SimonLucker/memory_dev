// AI Insights — computed locally, always available; an optional LLM narrative
// on top via the ai-chat adapter. Factual sentences only, spec tone.

import { ask } from '../data/api.js'
import { whenToTs } from '../lib/thread.js'

const SEASON = m => (m < 2 || m === 11 ? 'Winter' : m < 5 ? 'Spring' : m < 8 ? 'Summer' : 'Autumn')

const monthYear = ts => new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

// Count occurrences, return [name, count] sorted desc.
const tally = values => {
  const map = new Map()
  for (const v of values) if (v) map.set(v, (map.get(v) || 0) + 1)
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

// → [{ label, lines: [sentence] }] sections, [] when the vault is empty.
export function computeInsights(person, memories) {
  if (!memories.length) return []
  const sections = []

  const people = tally(memories.flatMap(m => (m.who || []).filter(p => p.id !== person.id).map(p => p.name)))
  if (people.length) {
    const lines = [`Most memories are with ${people[0][0]}. ${people[0][1]} together.`]
    for (const [name, n] of people.slice(1, 3)) lines.push(`${name} appears in ${n} ${n === 1 ? 'memory' : 'memories'}.`)
    sections.push({ label: 'People', lines })
  }

  const places = tally(memories.map(m => m.where))
  if (places.length) {
    const lines = [`${places[0][0]} holds the most memories. ${places[0][1]} kept there.`]
    for (const [name, n] of places.slice(1, 3)) lines.push(`${name} follows with ${n}.`)
    sections.push({ label: 'Places', lines })
  }

  const feelings = tally(memories.flatMap(m => m.feeling || []))
  if (feelings.length) {
    const lines = [`${feelings[0][0]} is the most kept feeling. ${feelings[0][1]} memories carry it.`]
    if (feelings[1]) lines.push(`Then ${feelings[1][0]} with ${feelings[1][1]}.`)
    sections.push({ label: 'Feelings', lines })
  }

  const stamps = memories.map(m => whenToTs(m.when)).sort((a, b) => a - b)
  const years = tally(stamps.map(ts => new Date(ts).getFullYear()))
  const seasons = tally(stamps.map(ts => SEASON(new Date(ts).getMonth())))
  sections.push({
    label: 'Time',
    lines: [
      `${years[0][0]} is the fullest year. ${years[0][1]} memories kept.`,
      `${seasons[0][0]} is the fullest season. ${seasons[0][1]} memories.`,
    ],
  })

  // Longest run of consecutive capture days.
  const days = [...new Set(stamps.map(ts => Math.floor(ts / 86400e3)))].sort((a, b) => a - b)
  let streak = 1, best = 1
  for (let i = 1; i < days.length; i++) best = Math.max(best, (streak = days[i] - days[i - 1] === 1 ? streak + 1 : 1))
  sections.push({
    label: 'Streak',
    lines: [best > 1 ? `Longest capture streak: ${best} days in a row.` : 'Captures come one day at a time so far.'],
  })

  const spanYears = Math.round((stamps[stamps.length - 1] - stamps[0]) / (365.25 * 86400e3))
  sections.push({
    label: 'Span',
    lines: [
      `The oldest memory is from ${monthYear(stamps[0])}. The newest is from ${monthYear(stamps[stamps.length - 1])}.`
      + (spanYears >= 1 ? ` ${spanYears} ${spanYears === 1 ? 'year' : 'years'} between them.` : ''),
    ],
  })

  return sections
}

// Compact digest for the LLM: counts and top entities, never memory texts.
const digest = (person, memories) => ({
  total: memories.length,
  perYear: Object.fromEntries(tally(memories.map(m => new Date(whenToTs(m.when)).getFullYear()))),
  topPeople: tally(memories.flatMap(m => (m.who || []).filter(p => p.id !== person.id).map(p => p.name))).slice(0, 5),
  topPlaces: tally(memories.map(m => m.where)).slice(0, 5),
  topFeelings: tally(memories.flatMap(m => m.feeling || [])).slice(0, 5),
})

// → 3-5 observation strings. Throws on any malformed reply; callers fall back
// to the computed sections alone.
export async function fetchNarrative(person, memories) {
  const content = await ask([
    {
      role: 'system',
      content: 'You study a person\'s memory-keeping statistics. Reply with ONLY a JSON array of 3 to 5 short factual pattern observations as plain strings. No markdown, no keys, no other text. No exclamation marks.',
    },
    { role: 'user', content: JSON.stringify(digest(person, memories)) },
  ])
  const raw = content.match(/\[[\s\S]*\]/)?.[0] || content
  const arr = JSON.parse(raw)
  if (!Array.isArray(arr)) throw new Error('not an array')
  const lines = arr.filter(s => typeof s === 'string' && s.trim()).slice(0, 5)
  if (!lines.length) throw new Error('empty')
  return lines
}

// Narrative cache, per person.
const cacheKey = pid => 'memmory.insights.' + pid
export function loadNarrative(pid) {
  try {
    const arr = JSON.parse(localStorage.getItem(cacheKey(pid)))
    return Array.isArray(arr) && arr.length ? arr : null
  } catch { return null }
}
export const saveNarrative = (pid, lines) => localStorage.setItem(cacheKey(pid), JSON.stringify(lines))
