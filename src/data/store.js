// The normalized db App holds for the active persona: rows keyed by id
// (links stay an array, its key is memory_id + person_id). Every change
// returns a new object so selectors memoized by identity see it.

export const TABLE_OF = { people: 'people', memories: 'memories', moments: 'moments', memory_people: 'links', questions: 'questions', recaps: 'recaps' }
export const linkKey = l => `${l.memory_id}|${l.person_id}`

export const emptyDb = () => ({ people: {}, memories: {}, moments: {}, links: [], questions: {}, recaps: {} })

const byId = rows => Object.fromEntries((rows || []).map(r => [r.id, r]))

// space (arrays, as loadSpace / the seed return them) -> db
export const toDb = space => ({
  people: byId(space.people), memories: byId(space.memories), moments: byId(space.moments),
  links: [...(space.links || [])], questions: byId(space.questions), recaps: byId(space.recaps),
})

// Merge rows into db: a loadSpace() result (arrays per table) or a fromV2()
// result ({memory, moments, links, people}). Rows in `rows` win on the same key.
export function putRows(db, rows) {
  let out = db
  if (rows.memory) out = withRows(out, 'memories', [rows.memory])
  for (const [table, key] of Object.entries(TABLE_OF)) if (rows[key]?.length) out = withRows(out, table, rows[key])
  return out
}
export const dropMoments = (db, ids) => ids.reduce((d, id) => withoutRow(d, 'moments', id), db)

// -> new db with rows upserted into `table` (a table name as in the adapter).
export function withRows(db, table, rows) {
  const key = TABLE_OF[table]
  if (!key) throw new Error(`unknown table ${table}`)
  if (key === 'links') {
    const seen = new Set(rows.map(linkKey))
    return { ...db, links: [...db.links.filter(l => !seen.has(linkKey(l))), ...rows] }
  }
  return { ...db, [key]: { ...db[key], ...byId(rows) } }
}

// -> new db without one row. id is a string, or {memory_id, person_id} for links.
// Removing a memory also drops what hangs off it, like the cascade in SQL.
export function withoutRow(db, table, id) {
  const key = TABLE_OF[table]
  if (!key) throw new Error(`unknown table ${table}`)
  if (key === 'links') return { ...db, links: db.links.filter(l => linkKey(l) !== linkKey(id)) }
  const { [id]: _, ...rest } = db[key]
  const out = { ...db, [key]: rest }
  if (key !== 'memories') return out
  const drop = o => Object.fromEntries(Object.entries(o).filter(([, r]) => r.memory_id !== id))
  return { ...out, moments: drop(out.moments), questions: drop(out.questions), recaps: drop(out.recaps),
    links: out.links.filter(l => l.memory_id !== id) }
}
