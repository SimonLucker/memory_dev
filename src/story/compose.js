// Story helpers: the header date line, the person-filtered block list, and
// the related row's line. select.js composes the unfiltered story.

const MONTH = { month: 'long', timeZone: 'UTC' }
const DAY = { day: 'numeric', timeZone: 'UTC' }
const fmt = (d, o) => new Date(d).toLocaleDateString('en-US', o)

// "June 14", "July 12–19", "July 28 – August 2".
export function dateLine(memory) {
  const a = memory.starts_at, b = memory.ends_at
  if (!a || isNaN(new Date(a))) return ''
  const from = `${fmt(a, MONTH)} ${fmt(a, DAY)}`
  if (!b || isNaN(new Date(b)) || (fmt(a, DAY) === fmt(b, DAY) && fmt(a, MONTH) === fmt(b, MONTH))) return from
  return fmt(a, MONTH) === fmt(b, MONTH) ? `${from}–${fmt(b, DAY)}` : `${from} – ${fmt(b, MONTH)} ${fmt(b, DAY)}`
}

// One person's moments, composed like storyOf: first photo = hero, then pairs,
// a lone trailing photo full width, voice and text where they were captured.
export function composeFiltered(moments, people) {
  const by = m => people[m.generated_by] || null
  const blocks = []
  let run = [], hero = false
  const flush = () => {
    if (!hero && run.length) { blocks.push({ kind: 'hero', moments: [run[0]], by: by(run[0]) }); hero = true; run = run.slice(1) }
    for (; run.length >= 2; run = run.slice(2)) blocks.push({ kind: 'pair', moments: run.slice(0, 2), by: by(run[0]) })
    if (run.length) blocks.push({ kind: 'photo', moments: run, by: by(run[0]) })
    run = []
  }
  for (const m of moments) {
    if (m.kind === 'photo') { run.push(m); continue }
    flush()
    blocks.push({ kind: m.kind === 'answer' ? 'text' : m.kind, moments: [m], by: by(m) })
  }
  flush()
  return blocks
}

// "3 earlier nights with Marco": count plus the person the related memories
// share most, else the place. Evening memories are nights.
export function relatedLine(db, memory, related) {
  const n = related.length
  const mine = new Set(db.links.filter(l => l.memory_id === memory.id).map(l => l.person_id))
  const tally = {}
  for (const r of related) for (const l of db.links) if (l.memory_id === r.id && mine.has(l.person_id)) tally[l.person_id] = (tally[l.person_id] || 0) + 1
  const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0]
  const evening = related.every(r => new Date(r.starts_at).getUTCHours() >= 17)
  const what = evening ? (n === 1 ? 'night' : 'nights') : (n === 1 ? 'memory' : 'memories')
  const name = top && db.people[top] ? String(db.people[top].name).split(' ')[0] : null
  return name ? `${n} earlier ${what} with ${name}` : memory.place ? `${n} earlier ${what} in ${memory.place}` : `${n} earlier ${what}`
}
