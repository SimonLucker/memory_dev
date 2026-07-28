// Memory Card weaving — schema helpers + the weave flow (spec 6.5).
// A card is an AI-curated collection spanning multiple memories:
// { id, title, span, config, summary, insights[], memoryIds[], cover, createdAt }
// (see SCHEMA.md). Everything derivable stays out and is recomputed from the
// member memories at render time.
import { ask } from './api.js'
import { whenToTs } from './thread.js'

const monthYear = ts => new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const shortMY = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
export const yearOf = m => new Date(whenToTs(m.when)).getFullYear()

export const mintCardId = cards => {
  const n = Math.max(0, ...cards.map(c => parseInt(String(c.id).replace(/\D/g, ''), 10) || 0))
  return 'c' + String(n + 1).padStart(3, '0')
}

// "June 2026" for one month, "Oct 2024 – Mar 2025" across months (SCHEMA.md).
export const spanOf = members => {
  if (!members.length) return ''
  const ts = members.map(m => whenToTs(m.when))
  const a = Math.min(...ts), b = Math.max(...ts)
  return monthYear(a) === monthYear(b) ? monthYear(a) : shortMY(a) + ' – ' + shortMY(b)
}

// Cover = first photo of the first selected memory; when that memory has no
// photos, the first member that has one.
export const coverOf = members => members.find(m => m.photos?.length)?.photos[0] || null

// Hard filters live client-side; only the theme goes to the LLM.
// from/to are 'YYYY-MM-DD' strings (or '') from the config sheet's date inputs.
export const matchesConfig = (m, config = {}) => {
  const { people = [], place = '', from, to } = config
  if (people.length && !people.some(p => (m.who || []).some(w => w.name === p))) return false
  if (place && !(m.where || '').toLowerCase().includes(place.toLowerCase())) return false
  const ts = whenToTs(m.when)
  if (from && ts < new Date(from + 'T00:00').getTime()) return false
  if (to && ts > new Date(to + 'T23:59').getTime()) return false
  return true
}

export const candidatesFor = (memories, config) =>
  memories.filter(m => matchesConfig(m, config))
    .sort((a, b) => whenToTs(b.when) - whenToTs(a.when))

const countBy = (list, key) => {
  const counts = {}
  for (const item of list) for (const k of key(item)) counts[k] = (counts[k] || 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

// 2-4 short factual lines, computed, no AI needed.
const buildInsights = members => {
  const out = []
  const years = members.map(yearOf)
  const a = Math.min(...years), b = Math.max(...years)
  out.push(`${members.length} memories ${a === b ? 'in ' + a : 'between ' + a + ' and ' + b}`)
  const [person] = countBy(members, m => (m.who || []).map(w => w.name))
  if (person && person[1] >= 2) out.push(`${person[0]} is in ${person[1]} of them`)
  const [place] = countBy(members, m => m.where ? [m.where] : [])
  if (place && place[1] >= 2) out.push(`Most often at ${place[0]}`)
  const [feeling] = countBy(members, m => m.feeling || [])
  if (feeling && feeling[1] >= 2) out.push(`The feeling that returns is ${feeling[0].toLowerCase()}`)
  return out.slice(0, 4)
}

const aboutOf = m => m.about || m.summary || m.why || m.what || ''

// Deterministic weave for the no-key mock and any AI failure.
const fallbackWeave = (candidates, config) => {
  const chosen = candidates.slice(0, 8)
  const title = (config.theme || '').trim()
    || (config.place ? 'Days in ' + config.place
      : config.people?.length ? 'With ' + config.people.join(' and ')
        : 'Kept together')
  return {
    title,
    summary: chosen.map(aboutOf).filter(Boolean).slice(0, 4).join(' '),
    insights: buildInsights(chosen),
    memoryIds: chosen.map(m => m.id),
  }
}

// Defensive parse: first {...} block, valid JSON, memoryIds a non-empty subset.
const parseWoven = (text, candidates) => {
  try {
    const raw = JSON.parse(text.match(/\{[\s\S]*\}/)[0])
    const ids = new Set(candidates.map(m => m.id))
    const memoryIds = (raw.memoryIds || []).filter(id => ids.has(id))
    if (!memoryIds.length || typeof raw.title !== 'string' || typeof raw.summary !== 'string') return null
    return {
      title: raw.title.slice(0, 60),
      summary: raw.summary,
      insights: (Array.isArray(raw.insights) ? raw.insights : []).filter(s => typeof s === 'string').slice(0, 4),
      memoryIds,
    }
  } catch { return null }
}

const SYSTEM = `You curate Memory Cards for a personal memory keeper.
From the candidate memories, pick the 3 to 10 that best belong to the theme and weave them into one card.
Reply with STRICT JSON only, no prose, no code fences:
{"title": "short evocative title, max 6 words", "summary": "the woven story in 2 to 4 warm factual sentences", "insights": ["2 to 4 short factual observations across the picked memories"], "memoryIds": ["ids of the picked memories"]}
No emoji, no em dashes, no exclamation marks anywhere.`

// → a complete card object, persisted by the caller. Never throws: any AI
// failure lands on the deterministic fallback. Pass `id` to re-weave an
// existing card in place (same id, fresh content).
export async function weaveCard({ memories, config, existingCards = [], id = null }) {
  let candidates = candidatesFor(memories, config)
  // Filters that match nothing still weave a card: newest memories overall.
  if (!candidates.length) candidates = candidatesFor(memories, {})
  const compact = candidates.slice(0, 40).map(m => ({
    id: m.id, what: m.what, where: m.where, when: m.when,
    who: (m.who || []).map(w => w.name), feeling: m.feeling || [],
    about: aboutOf(m).slice(0, 200),
  }))
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: JSON.stringify({ theme: (config.theme || '').trim(), memories: compact }) },
  ]
  let woven = null
  try {
    const first = await ask(messages)
    woven = parseWoven(first, candidates)
    if (!woven) {
      woven = parseWoven(await ask([...messages,
        { role: 'assistant', content: first },
        { role: 'user', content: 'JSON only.' }]), candidates)
    }
  } catch { /* mock or misconfigured backend: fallback below */ }
  const result = woven || fallbackWeave(candidates, config)
  const byId = new Map(memories.map(m => [m.id, m]))
  const members = result.memoryIds.map(id => byId.get(id)).filter(Boolean)
  return {
    id: id || mintCardId(existingCards),
    title: result.title,
    span: spanOf(members),
    config,
    summary: result.summary,
    insights: result.insights,
    memoryIds: members.map(m => m.id),
    cover: coverOf(members),
    createdAt: new Date().toISOString(),
  }
}
