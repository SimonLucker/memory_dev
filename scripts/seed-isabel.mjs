// Builds Isabel's demo space (ARCHITECTURE.md 4.6) from the roadmap page:
// writes src/data/demo/isabel.json and copies the roadmap photos into
// public/photos/isabel/. Reproducible: run it again after editing this file.
//   node scripts/seed-isabel.mjs
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const P = 'p5'
const photo = f => `photos/isabel/${f}`
const person = (id, name, avatar, extra = {}) => ({
  id, name, first_name: name.split(' ')[0], avatar_url: avatar ? photo(avatar) : null,
  is_user: false, space_id: P, created_at: '2025-09-01T09:00:00Z', ...extra,
})

const people = [
  person(P, 'Isabel', null, { is_user: true }),
  person('p5_elena', 'Elena', 'mem-13.jpg'),
  person('p5_leo', 'Leo', 'tag-leo.jpg'),
  person('p5_jonas', 'Jonas', 'mem-08.jpg'),
  person('p5_sam', 'Sam', 'mem-11.jpg'),
  person('p5_mara', 'Mara', null),
  person('p5_theo', 'Theo', null),
  person('p5_marco', 'Marco', null),
  person('p5_sofia', 'Sofia', null),
  person('p5_grandma', 'Grandma', null),
]

const memories = [], moments = [], links = [], questions = [], recaps = []

// One memory with its moments in capture order (position = index).
// A moment's created_at defaults to its captured_at.
function memory(id, row, ms, who = {}) {
  const starts = row.starts_at
  memories.push({
    id, owner_id: P, title: row.title, place: row.place || '', starts_at: starts, ends_at: row.ends_at || null,
    about: row.about || '', class: row.class || 'Friends', feeling: row.feeling || [], music: row.music || null,
    importance: row.importance || 2, cover_moment_id: row.cover || null, favorite: false,
    demo: Boolean(row.demo), legacy: null, created_at: starts, updated_at: row.updated_at || starts,
  })
  ms.forEach((m, i) => moments.push({
    id: `${id}_m${i}`, memory_id: id, kind: m.kind, src: m.src || null, poster: m.poster || null,
    duration: m.duration || null, transcript: m.transcript || null, text: m.text || null,
    generated_by: m.by || P, question_id: m.question_id || null, captured_at: m.at, position: i,
    demo: Boolean(m.demo), created_at: m.created || m.at,
  }))
  for (const [role, ids] of Object.entries(who)) for (const pid of ids) links.push({ memory_id: id, person_id: pid, role })
}
const ph = (src, at, by, extra) => ({ kind: 'photo', src: photo(src), at, by, ...extra })
const voice = (at, by, duration, transcript) => ({ kind: 'voice', at, by, duration, transcript, src: null, demo: true })
const text = (at, by, t, extra) => ({ kind: 'text', at, by, text: t, ...extra })

memory('isa_greece', {
  title: 'The house in Greece', place: 'Paros, Greece',
  starts_at: '2026-07-12T10:00:00Z', ends_at: '2026-07-19T16:00:00Z', updated_at: '2026-09-01T18:20:00Z',
  about: 'A week in a house above the harbour with six friends. Long lunches, one terrace, no phones.',
  feeling: ['Happy', 'Grateful'], importance: 3,
  music: { name: 'Ta Paidia tou Peiraia', artist: 'Melina Mercouri', added_by: 'p5_leo' },
}, [
  ph('tag-cover.jpg', '2026-07-12T18:10:00Z', P),
  ph('mem-13.jpg', '2026-07-13T12:30:00Z', 'p5_elena'),
  ph('mem-09.jpg', '2026-07-13T12:34:00Z', 'p5_elena'),
  voice('2026-07-14T21:05:00Z', 'p5_jonas', 32, 'We have been on this terrace for three hours and nobody has looked at a phone once.'),
  ph('mem-04.jpg', '2026-07-15T11:20:00Z', 'p5_leo'),
  ph('mem-06.jpg', '2026-07-16T17:45:00Z', 'p5_jonas'),
  text('2026-07-17T09:15:00Z', 'p5_sam', 'The water was so clear you could count the stones.'),
  // Elena's late additions: within 7 days of 2026-09-04, so Home shows the contributed card.
  ph('tag-leo.jpg', '2026-07-18T19:00:00Z', 'p5_elena', { created: '2026-09-01T18:20:00Z' }),
  text('2026-07-18T19:02:00Z', 'p5_elena', 'Found these on my camera roll.', { created: '2026-09-01T18:21:00Z' }),
], { contributor: ['p5_elena', 'p5_leo', 'p5_jonas', 'p5_sam'], tagged: ['p5_mara', 'p5_theo'] })

const beat = (src, by, duration = 5, extra = {}) => ({ kind: 'photo', src: photo(src), poster: null, duration, by, voice: null, quote: null, ...extra })
recaps.push({
  id: 'isa_greece_recap', memory_id: 'isa_greece', created_at: '2026-07-20T09:00:00Z',
  song: { name: 'Ta Paidia tou Peiraia', artist: 'Melina Mercouri' },
  beats: [
    beat('tag-cover.jpg', P),
    beat('mem-13.jpg', 'p5_elena'),
    beat('mem-09.jpg', 'p5_elena', 32, { voice: { src: null, demo: true, duration: 32, by: 'p5_jonas',
      transcript: 'We have been on this terrace for three hours and nobody has looked at a phone once.' } }),
    beat('mem-04.jpg', 'p5_leo'),
    beat('mem-06.jpg', 'p5_jonas', 6, { quote: { text: 'The water was so clear you could count the stones.', by: 'p5_sam' } }),
    beat('tag-leo.jpg', 'p5_elena'),
    beat('mem-09.jpg', 'p5_elena', 4),
    beat('mem-13.jpg', 'p5_elena'),
  ],
})

memory('isa_marco', {
  title: "Dinner at Marco's", place: 'Amsterdam', starts_at: '2026-06-14T19:30:00Z',
  about: 'Marco cooked. Sofia came for the first time.', feeling: ['Happy'], importance: 3,
  music: { name: 'Caruso', artist: 'Lucio Dalla' },
}, [
  ph('mem-12.jpg', '2026-06-14T20:40:00Z', P),
  voice('2026-06-14T23:10:00Z', P, 19, 'Best pasta of my life. Marco finally met Sofia.'),
], { tagged: ['p5_marco', 'p5_sofia'] })
questions.push({
  id: 'isa_marco_q1', memory_id: 'isa_marco', person_id: P,
  text: 'What did you and Marco talk about after Sofia left?', asked_at: '2026-06-15T09:00:00Z', answered_at: null,
})

// Three earlier nights with Marco (the related row on his dinner).
memory('isa_marco3', { title: "Pasta night at Marco's", place: 'Amsterdam', starts_at: '2026-03-21T19:00:00Z', demo: true },
  [ph('rest-3.jpg', '2026-03-21T20:15:00Z', P)], { tagged: ['p5_marco'] })
memory('isa_marco2', { title: "Marco's birthday dinner", place: 'Amsterdam', starts_at: '2025-11-08T19:00:00Z', demo: true },
  [ph('rest-2.jpg', '2025-11-08T21:00:00Z', P)], { tagged: ['p5_marco', 'p5_sofia'] })
memory('isa_marco1', { title: "First dinner at Marco's", place: 'Amsterdam', starts_at: '2025-10-03T19:00:00Z', demo: true },
  [ph('rest-1.jpg', '2025-10-03T20:30:00Z', P)], { tagged: ['p5_marco'] })

memory('isa_valldemossa', {
  title: 'That evening in Valldemossa', place: 'Valldemossa, Mallorca', starts_at: '2025-09-04T19:30:00Z',
  about: 'The last warm evening of the summer, up in the hills with Elena.', class: 'Travel', feeling: ['Calm'], importance: 3,
}, [
  ph('mem-03.jpg', '2025-09-04T19:50:00Z', P),
  text('2025-09-04T22:00:00Z', P, 'The whole village smelled of orange trees.'),
], { tagged: ['p5_elena'] })

memory('isa_grandma', {
  title: "Grandma's laughter", place: 'Stockholm', starts_at: '2026-05-03T14:00:00Z', class: 'Family',
  about: 'On the boat to the islands. She laughed so hard the captain turned around.', feeling: ['Happy'], importance: 3,
  cover: 'isa_grandma_m0',
}, [
  { kind: 'video', src: 'videos/isa-grandma-demo.mp4', poster: photo('vf-grandma-boat-poster.jpg'), duration: 14, demo: true, at: '2026-05-03T14:20:00Z' },
], { tagged: ['p5_grandma'] })

memory('isa_siv', { title: 'Siv after the groomer', starts_at: '2026-05-18T16:00:00Z', class: 'Family', feeling: ['Happy'] }, [
  ph('siv-1.jpg', '2026-05-18T16:05:00Z', P),
  text('2026-05-18T16:06:00Z', P, 'She hates it. She looks great.'),
])

memory('isa_swim', { title: 'Morning swim', starts_at: '2026-05-24T07:30:00Z', class: 'Milestones', feeling: ['Calm'] }, [
  ph('mem-01.jpg', '2026-05-24T07:45:00Z', P),
  voice('2026-05-24T08:00:00Z', P, 11, 'Cold enough to wake up properly. Nobody else on the pier.'),
])

memory('isa_terrace', { title: 'Sunset on the terrace', place: 'Positano', starts_at: '2026-04-19T19:40:00Z', class: 'Travel', demo: true },
  [ph('mem-05.jpg', '2026-04-19T19:55:00Z', P)], { tagged: ['p5_sam'] })
memory('isa_park', { title: 'Siv in the park', place: 'Amsterdam', starts_at: '2026-04-26T17:00:00Z', class: 'Family', demo: true },
  [ph('mem-08.jpg', '2026-04-26T17:20:00Z', P)], { tagged: ['p5_jonas'] })
memory('isa_ridge', { title: 'Beers on the ridge', place: 'Cape Town', starts_at: '2026-03-28T18:30:00Z', class: 'Travel', demo: true },
  [ph('mem-11.jpg', '2026-03-28T18:50:00Z', P)], { tagged: ['p5_jonas', 'p5_sam'] })

// Photos: copy every file the space references.
const srcDir = join(root, 'docs/reference/images'), outDir = join(root, 'public/photos/isabel')
mkdirSync(outDir, { recursive: true })
const files = new Set()
const collect = s => { const m = /^photos\/isabel\/(.+)$/.exec(s || ''); if (m) files.add(m[1]) }
for (const m of moments) { collect(m.src); collect(m.poster) }
for (const p of people) collect(p.avatar_url)
for (const r of recaps) for (const b of r.beats) collect(b.src)
for (const f of files) copyFileSync(join(srcDir, f), join(outDir, f))

const space = { people, memories, moments, links, questions, recaps }
mkdirSync(join(root, 'src/data/demo'), { recursive: true })
writeFileSync(join(root, 'src/data/demo/isabel.json'), JSON.stringify(space, null, 2) + '\n')
console.log(`isabel.json: ${memories.length} memories, ${moments.length} moments, ${people.length} people, ${links.length} links, ${questions.length} questions, ${recaps.length} recaps, ${files.size} photos copied`)
