// Runnable check for the selectors and the bridge:  node src/data/select.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emptyDb, putRows, toDb } from './store.js'
import { memoriesOf, storyOf, homeOf, sharedOf, recapOf, relatedOf, countOf, songOf } from './select.js'
import { fromV2, toV2 } from './bridge.js'

const here = dirname(fileURLToPath(import.meta.url))
const load = f => JSON.parse(readFileSync(join(here, f), 'utf8'))
const db = toDb(load('demo/isabel.json'))
const NOW = '2026-09-04T09:00'

// memoriesOf: 12, real before demo, newest first within each
const mems = memoriesOf(db, 'p5')
assert.equal(mems.length, 12)
assert.equal(countOf(db, 'p5'), 12)
const firstDemo = mems.findIndex(m => m.demo)
assert.ok(firstDemo > 0 && mems.slice(firstDemo).every(m => m.demo), 'real before demo')
assert.equal(mems[0].id, 'isa_greece')
assert.ok(memoriesOf(db, 'p5') === mems, 'memoized by db identity')

// storyOf(marco): hero, voice, song, related (3), question last
const marco = storyOf(db, 'isa_marco')
const kinds = marco.blocks.map(b => b.kind)
assert.deepEqual(kinds, ['hero', 'voice', 'song', 'related', 'question'])
assert.equal(marco.related.length, 3)
assert.deepEqual(marco.related.map(m => m.id), ['isa_marco2', 'isa_marco3', 'isa_marco1'], 'two shared people beat one')
assert.equal(marco.question.text, 'What did you and Marco talk about after Sofia left?')
assert.equal(marco.shared, false)

// storyOf(greece): hero, pairs, voice, text, lone photo, song after the last media block
const greece = storyOf(db, 'isa_greece')
assert.deepEqual(greece.blocks.map(b => b.kind), ['hero', 'pair', 'voice', 'pair', 'text', 'photo', 'song', 'text', 'related'])
assert.equal(greece.shared, true)
assert.equal(greece.blocks[2].by.name, 'Jonas')
assert.equal(greece.blocks[1].moments.length, 2)

// homeOf at Sept 4 2026, 09:00
const home = homeOf(db, 'p5', NOW)
assert.equal(home.hero.id, 'isa_greece')
assert.deepEqual(home.cards.map(c => c.kind), ['year-ago', 'question', 'contributed'])
assert.equal(home.cards[0].memory.id, 'isa_valldemossa')
assert.equal(home.cards[1].question.id, 'isa_marco_q1')
assert.equal(home.cards[2].by.name, 'Elena')
assert.equal(home.cards[2].count, 2)
assert.equal(home.latest.length, 3)
assert.equal(home.latest[0].id, 'isa_greece')

// sharedOf(greece): 7 people, Isabel first as You, then first-moment order
const row = sharedOf(db, 'isa_greece')
assert.equal(row.length, 7)
assert.equal(row[0].label, 'You'); assert.equal(row[0].name, 'Isabel')
assert.deepEqual(row.slice(1).map(p => p.label), ['Elena', 'Jonas', 'Leo', 'Sam', 'Mara', 'Theo'])

// recapOf: stored beats for Greece, composed for Marco (voice stretches its beat)
assert.equal(recapOf(db, 'isa_greece').length, 8)
assert.equal(songOf(db, 'isa_greece').artist, 'Melina Mercouri')
const mb = recapOf(db, 'isa_marco')
assert.equal(mb.length, 1)
assert.equal(mb[0].duration, 19)
assert.equal(mb[0].voice.transcript, 'Best pasta of my life. Marco finally met Sofia.')
assert.equal(songOf(db, 'isa_marco').name, 'Caruso')
assert.equal(relatedOf(db, 'isa_valldemossa').length, 0, 'nothing earlier than the oldest memory')

// bridge round-trip on Glenn's v2 memories (with voice, with videos, with _pos).
// Equal up to the engine's own looseness: [] and a missing array are the same.
const norm = m => Object.fromEntries(Object.entries(m).filter(([k, v]) => !(Array.isArray(v) && !v.length && k !== 'who' && k !== 'feeling') && !(k === 'music' && v == null)))
const v2 = load('memories.json')
for (const m of [v2.find(x => x.id === 'm001'), v2.find(x => x.videos), v2.find(x => x._pos)]) {
  const r = fromV2(m, 'p1', '2026-09-04T09:00:00Z')
  const d = putRows(emptyDb(), r)
  assert.deepEqual(norm(toV2(d, m.id)), norm(m), `round-trip ${m.id}`)
  assert.ok(r.people.every(p => p.id.startsWith('p1_') && p.space_id === 'p1'))
  assert.ok(r.links.every(l => l.role === 'tagged'))
}
// A registered persona in who[] becomes a contributor link, not a contact row.
const shared = fromV2({ id: 'x1', what: 'x', when: '01-02-2026 10:00', who: [{ id: 'p2', name: 'Maya' }, { id: 'p07', name: 'Tom' }] }, 'p1')
assert.deepEqual(shared.links.map(l => l.role), ['contributor', 'tagged'])
assert.deepEqual(shared.people.map(p => p.id), ['p1_p07'])

console.log('select.test: ok')
