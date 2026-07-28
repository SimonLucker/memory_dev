// Schema v2 migration (see src/lib/SCHEMA.md): adds `about` to every memory
// (merged from summary + why, originals kept) and seeds demo videos[] / voice[]
// entries in memories.json. Idempotent: run with `node scripts/migrate-v2.mjs`.

import fs from 'node:fs'

const punct = (s) => (/[.?!]$/.test(s.trim()) ? s.trim() : s.trim() + '.')
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function aboutOf(m) {
  const summary = (m.summary || '').trim()
  const why = (m.why || '').trim()
  const parts = summary ? [punct(summary)] : []
  if (why && !summary.toLowerCase().includes(why.toLowerCase())) parts.push(punct(cap(why)))
  return parts.join(' ') || m.what || ''
}

// Demo media: video src paths do not exist (players show the poster frame and
// duration); voice src paths do not exist (players must degrade gracefully).
// poster is filled from the memory's own last photo so it always exists.
const DEMO_VIDEOS = {
  m002: [{ src: 'videos/m002-demo.mp4', duration: 18, demo: true }],
  m005: [{ src: 'videos/m005-demo.mp4', duration: 24, demo: true }],
  m010: [{ src: 'videos/m010-demo.mp4', duration: 15, demo: true }],
  m011: [{ src: 'videos/m011-demo.mp4', duration: 21, demo: true }],
}
const DEMO_VOICE = {
  m001: [{ src: 'voice/m001-demo.webm', duration: 19, demo: true,
    transcript: 'Everyone made it home for Easter this year. Mom did the lamb and Dad kept sneaking Emma dessert early. We sat in the backyard until the sun went down.' }],
  m006: [{ src: 'voice/m006-demo.webm', duration: 14, demo: true,
    transcript: 'Lisa swore she did not want a fuss, and then she was the first one dancing. The kitchen turned into the dance floor around midnight.' }],
  m011: [{ src: 'voice/m011-demo.webm', duration: 16, demo: true,
    transcript: 'Grandpa Joe blew out all eighty candles on the dock. He said the lake looked the same as it did when he was a boy.' }],
}

for (const file of ['src/data/memories.json', 'src/data/memories-p2.json']) {
  const mems = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const m of mems) {
    if (!m.about) m.about = aboutOf(m)
    if (file.endsWith('memories.json')) {
      if (DEMO_VIDEOS[m.id] && !m.videos) {
        m.videos = DEMO_VIDEOS[m.id].map((v) => ({ ...v, poster: m.photos[m.photos.length - 1] }))
      }
      if (DEMO_VOICE[m.id] && !m.voice) m.voice = DEMO_VOICE[m.id]
    }
  }
  fs.writeFileSync(file, JSON.stringify(mems, null, 2) + '\n')
  console.log(`${file}: ${mems.length} memories migrated`)
}
