// Memory synthesis — the LLM pass that turns a captured bundle into a memory.
//
// Why this exists: saving used to concatenate the raw texts into `about` and
// title the memory from the clock ("Wednesday morning"), so an evening gym
// bundle landed as somebody else's day with the user's own texts pasted back
// at them. The old memorialize skill produced a real draft (title, place,
// people, feelings, a written story); this module restores that bar without
// the chat, running once at save time and once per interview reply.
//
// Two exports, both defensive: they NEVER throw and NEVER block the save.
//   synthesizeMemory(bundle, opts) → memory fields (or the deterministic
//                                    fallback, flagged _unsynthesized)
//   extractAnswer(question, reply) → { who, where, aboutAppend }
//
// The feelings vocabulary is CLOSED (spec 3). "Alone" is not a feeling: the
// field-evidence bug tagged a memory with it because the model was free to
// invent chips. Anything outside the list is dropped, never mapped.

import { ask } from './api.js'

export const FEELINGS = [
  'Calm', 'Grateful', 'Happy', 'Excited', 'Proud', 'Cozy', 'Nostalgic', 'Sad',
]
export const CLASSES = ['Friends', 'Family', 'Travel', 'Work', 'Milestones']

// Words that say the user was on their own. Used both to skip the "who" question
// and to keep the interview from ever turning "alone" into a person or a feeling.
const SOLO_RE = /\b(alone|by myself|on my own|solo|nobody else|no one else|just me|myself)\b/i
export const saysSolo = (text) => SOLO_RE.test(String(text || ''))

// ---- Defensive parsing ------------------------------------------------------

// Models wrap JSON in ``` fences, prose, or both. Take the first balanced
// object and parse it; null on anything unusable (never throws).
export function parseJson(raw) {
  const text = String(raw || '').replace(/```json/gi, '```').replace(/```/g, '')
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (esc) { esc = false; continue }
    if (c === '\\') { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)) } catch { return null }
    }
  }
  return null
}

const str = (v, max = 200) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'unknown' ? s.slice(0, max) : ''
}
// Names only: no sentences, no "alone", no duplicates, no empty strings.
const names = (v) => {
  const out = []
  for (const n of Array.isArray(v) ? v : []) {
    const s = str(n, 60).replace(/[.,;]+$/, '').trim()
    if (!s || s.split(/\s+/).length > 4 || saysSolo(s)) continue
    if (/^(i|me|myself|we|us|they|them|someone|friends?|family)$/i.test(s)) continue
    if (!out.some(x => x.toLowerCase() === s.toLowerCase())) out.push(s)
  }
  return out
}
const feelings = (v) => {
  const out = []
  for (const f of Array.isArray(v) ? v : []) {
    const hit = FEELINGS.find(x => x.toLowerCase() === str(f, 30).toLowerCase())
    if (hit && !out.includes(hit)) out.push(hit)
  }
  return out.slice(0, 3)
}
const music = (v) => {
  if (!v || typeof v !== 'object') return null
  const name = str(v.name, 120), artist = str(v.artist, 120)
  return name ? { name, artist } : null
}

// ---- The deterministic fallback (what save produces instantly) --------------

// "Wednesday morning" — the shape of every clock-derived name. A Moment is
// auto-named with one of these, and the field bug was that name being handed to
// the model as "they named this moment X" and then winning over the synthesised
// title, so a memory about last Saturday stayed titled by the save clock.
// Used in three places: the auto-name never leaks into the prompt, never beats
// a real title, and a model that returns this shape is not believed.
export const CLOCK_TITLE_RE = /^(mon|tues|wednes|thurs|fri|satur|sun)day (morning|afternoon|evening|night)$/i
// A moment name the user actually chose, or '' for the clock default.
export const chosenName = (n) => {
  const s = String(n || '').trim()
  return s && !CLOCK_TITLE_RE.test(s) ? s : ''
}

const two = (n) => String(n).padStart(2, '0')
// "Friday night" — the clock title. Only ever a fallback, never a synthesis result.
export const nameFromTime = (ts = Date.now()) => {
  const d = new Date(ts)
  const h = d.getHours()
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night'
  return `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${part}`
}
export const titleFromTexts = (texts, ts) => {
  const t = (texts.find(x => String(x || '').trim()) || '').replace(/[.?!]+$/, '').trim()
  if (!t) return nameFromTime(ts)
  const words = t.split(/\s+/)
  return words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : '')
}

// The draft the card shows the instant the user hits Save now: title from the
// first text (clock title only when there are no words at all), story = the
// texts as sent. Flagged so the caller knows synthesis has not landed yet.
export function fallbackDraft(bundle = {}, momentName) {
  const texts = bundle.texts || []
  const ts = bundle.timestamps?.[0] || Date.now()
  return {
    // The auto clock name is not a title: the first words beat it.
    what: chosenName(momentName) || titleFromTexts(texts, ts),
    where: '',
    who: [],
    feeling: [],
    music: null,
    about: [...texts, ...(bundle.voiceTranscripts || [])].filter(Boolean).join(' '),
    _unsynthesized: true,
  }
}

// ---- Synthesis --------------------------------------------------------------

const SYSTEM = `You turn one person's captured moment into a memory record.
They sent these fragments to their own memory keeper, in order. Write the memory
FOR them, the way their own diary would read: past tense, their vantage point.
Never call them "they", "he", "she" or "the user".

Reply with ONE JSON object and nothing else. Shape:
{"what": string, "where": string|null, "who": string[], "feeling": string[],
 "class": string, "about": string, "music": {"name": string, "artist": string}|null}

Rules:
- "what": a short human title, at most 6 words, describing WHAT HAPPENED, in
  words taken from the fragments themselves ("Morning gym session", "Pizza at
  Luca's", "Rollercoasters with Amber"). A weekday plus a time of day
  ("Wednesday morning", "Friday night") is NEVER a valid title: it says nothing
  about the moment and will be rejected. Never title by the clock or the date.
- "where": the place if they named one, otherwise null. Never invent a place.
- "who": first names of people who were there, other than the user. Empty array
  if they were alone or nobody is named. Never guess.
- "feeling": 0 to 3 values, ONLY from this list: ${FEELINGS.join(', ')}.
  Use nothing else. Being alone is not a feeling. Leave empty when unsure.
- "class": one of ${CLASSES.join(', ')}. Use Friends or Family only when other
  people were actually there. A moment on their own belongs to Milestones.
- "about": 2 to 5 sentences telling the story of the moment as one piece of
  writing ("Walked over to the gym before dinner. The squats felt strong.").
  Synthesise, never concatenate or quote the fragments back. Keep the concrete
  details: what was said, what was eaten, what was done, why it mattered.
  When the fragments put the events on another day ("last Saturday",
  "yesterday"), tell it on that day, counting back from the capture date given
  below. No em dashes, no exclamation marks, no emoji.
- "music": only when a song is explicitly mentioned, otherwise null.`

// Relative-time words the fragments may use. Surfaced to the model with the
// capture date so "last saturday" lands in the story as Saturday.
const RELATIVE_RE = /\b(?:(?:last|this|next)\s+(?:night|week|weekend|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening)|yesterday|today|tonight|earlier today|the other day|a few days ago|\d+\s+(?:days?|weeks?|months?)\s+ago)\b/gi

// bundle: { texts[], voiceTranscripts[], photoCount, videoCount, timestamps[],
//           momentName?, priorAnswers? } in capture order.
// opts:   { momentName?, signal? } — momentName wins over a synthesised title.
// → memory fields. On any failure: fallbackDraft(bundle) with _unsynthesized.
export async function synthesizeMemory(bundle = {}, opts = {}) {
  const b = {
    texts: [], voiceTranscripts: [], photoCount: 0, videoCount: 0,
    timestamps: [], ...bundle,
  }
  // Only a name the user typed. The auto clock name must never reach the model
  // (it parroted it straight back) nor outrank a synthesised title.
  const momentName = chosenName(opts.momentName || b.momentName)
  const fallback = fallbackDraft(b, momentName)
  const hasWords = b.texts.some(Boolean) || b.voiceTranscripts.some(Boolean)
  // Nothing but media: there is no story to write, the fallback is honest.
  if (!hasWords) return fallback

  const when = b.timestamps?.[0] ? new Date(b.timestamps[0]) : new Date()
  const said = [...b.texts, ...b.voiceTranscripts].filter(Boolean).join(' ')
  const relative = [...new Set((said.match(RELATIVE_RE) || []).map(s => s.toLowerCase()))]
  const lines = [
    `Captured on ${when.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`,
    // The events are not always the capture: "last saturday" means the story
    // happened days earlier, even though `when` stays the capture time.
    relative.length
      ? `They referred to the time as: ${relative.join(', ')}. Work out the real day from the capture date and tell the story on that day.`
      : '',
    momentName ? `They named this moment "${momentName}".` : '',
    b.texts.length ? `Typed, in order:\n${b.texts.map(t => `- ${t}`).join('\n')}` : '',
    b.voiceTranscripts.filter(Boolean).length
      ? `Said out loud, in order:\n${b.voiceTranscripts.filter(Boolean).map(t => `- ${t}`).join('\n')}` : '',
    b.photoCount ? `They also sent ${b.photoCount} photo${b.photoCount > 1 ? 's' : ''}.` : '',
    b.videoCount ? `They also sent ${b.videoCount} video${b.videoCount > 1 ? 's' : ''}.` : '',
    b.priorAnswers ? `Already known: ${b.priorAnswers}` : '',
  ].filter(Boolean)

  let raw
  try {
    raw = await ask([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: lines.join('\n') },
    ])
  } catch { return fallback }

  const j = parseJson(raw)
  if (!j) return fallback

  const what = str(j.what, 80).replace(/^["'“]|["'”]$/g, '')
  const about = str(j.about, 1200)
  // A synthesis that produced neither a title nor a story is not a synthesis.
  if (!what && !about) return fallback
  // A clock title is what the model returns when it ignored the content. It is
  // indistinguishable from the fallback, so treat it as no synthesis at all.
  if (CLOCK_TITLE_RE.test(what)) return fallback

  const cls = CLASSES.find(c => c.toLowerCase() === str(j.class, 20).toLowerCase())
  return {
    what: momentName || what || fallback.what,
    where: str(j.where, 80),
    who: names(j.who),
    feeling: feelings(j.feeling),
    ...(cls ? { class: cls } : {}),
    about: about || fallback.about,
    music: music(j.music),
    _unsynthesized: false,
  }
}

// ---- Interview replies ------------------------------------------------------

const ANSWER_SYSTEM = `The user is answering one question from their memory keeper.
Reply with ONE JSON object and nothing else:
{"who": string[], "where": string|null, "aboutAppend": string}

- "who": first names of people they say were with them. Empty array if they say
  they were alone, or if they name nobody. "Alone" is never a name.
- "where": the place, only if their answer names one. Otherwise null.
- "aboutAppend": one short factual sentence in past tense recording the answer,
  written about the user ("Went with Mark and Ida.", "Went alone."). Empty
  string if the answer says nothing. No em dashes, no exclamation marks.`

// extractAnswer(question, replyText) → { who: string[], where: string|null,
// aboutAppend: string }. NEVER returns a feeling: an answer like "I was alone"
// is a fact about company, not a mood, and the old build turned it into a chip.
export async function extractAnswer(question, replyText) {
  const reply = String(replyText || '').trim()
  const empty = { who: [], where: null, aboutAppend: '' }
  if (!reply) return empty

  // Solo answers are decided here, not by the model: this is the exact case
  // that produced the "alone" feeling chip in the field.
  if (saysSolo(reply) && !/\b(with|and)\b\s+[A-Z]/.test(reply)) {
    return { who: [], where: null, aboutAppend: 'Went alone.' }
  }

  let j = null
  try {
    j = parseJson(await ask([
      { role: 'system', content: ANSWER_SYSTEM },
      { role: 'user', content: `Question: ${question || 'Tell me more.'}\nAnswer: ${reply}` },
    ]))
  } catch { j = null }

  if (!j) {
    // Deterministic last resort: keep the user's words in the story, invent nothing.
    return { who: [], where: null, aboutAppend: reply.slice(0, 200) }
  }
  const who = names(j.who)
  const append = str(j.aboutAppend, 200)
  return {
    who,
    where: str(j.where, 80) || null,
    aboutAppend: append || (who.length ? '' : reply.slice(0, 200)),
  }
}
