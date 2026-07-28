// The proactive keeper engine — design-foundation.md 6.7 + 6.8. Pure decision
// logic plus localStorage state (memmory.keeper.<personId>); rendering is the
// Capture pane's job. All strings come from copy.js.
//
// Contract: evaluate(context) returns AT MOST ONE prompt (or null). The caller
// renders it as a prompt card, then calls markShown(personId, prompt) when it
// actually appears (that is what counts against the caps) and
// dismiss(personId, prompt) on swipe/Later (dismissed prompts never return).

import {
  NUDGE_CHECK_IN, CHECK_IN_VARIANTS, NUDGE_WORKOUT,
  NUDGE_KNOWN_PLACE, NUDGE_LONG_DWELL, COACHING_PROMPT, ON_THIS_DAY_LABEL,
  QUICK_REPLY_KEEP, QUICK_REPLY_LATER, QUICK_REPLY_ANSWER,
} from './copy.js'
import { whenToTs } from './thread.js'

// Rotation bank for check-ins: never repeat a question within a week.
const QUESTION_BANK = [NUDGE_CHECK_IN, ...CHECK_IN_VARIANTS, NUDGE_WORKOUT]

const WEEK = 7 * 24 * 3600 * 1000
const KEY = (personId) => `memmory.keeper.${personId}`

function load(personId) {
  let s = {}
  try { s = JSON.parse(localStorage.getItem(KEY(personId))) || {} } catch {}
  s.shown ||= []      // [{id, kind, ts, place?, question?, memoryId?}]
  s.dismissed ||= []  // [prompt ids]
  s.queued ||= []     // demo prompts from window.__memmory.fireNudge
  return s
}
const save = (personId, s) => {
  try { localStorage.setItem(KEY(personId), JSON.stringify(s)) } catch {}
}

const dayKey = (ts) => new Date(ts).toDateString()
const ANSWERABLE = [QUICK_REPLY_ANSWER, QUICK_REPLY_LATER]
const KEEPABLE = [QUICK_REPLY_KEEP, QUICK_REPLY_LATER]

// The hard caps (6.8), applied to a candidate against recorded state.
// On this day (6.7) has its own cap (one/day, morning only) and does not count
// against the 2/day proactive budget: it is a retention card, not a nudge.
function blocked(s, p, now) {
  if (s.dismissed.includes(p.id)) return 'dismissed'
  const today = s.shown.filter((x) => dayKey(x.ts) === dayKey(now))
  if (p.kind === 'on-this-day') {
    return today.some((x) => x.kind === 'on-this-day') ? 'max one On this day card per day' : null
  }
  if (today.filter((x) => x.kind !== 'on-this-day').length >= 2) return 'max 2 proactive per day'
  if (p.kind === 'coach' && today.some((x) => x.kind === 'coach')) return 'coaching max once per day'
  if (p.kind === 'coach' && s.shown.some((x) => x.kind === 'coach' && x.memoryId === p.memoryId)) {
    return 'never twice on the same memory'
  }
  if ((p.kind === 'place' || p.kind === 'dwell') && s.shown.some((x) =>
    x.kind === p.kind && x.place === p.place && now - x.ts < WEEK)) {
    return 'same trigger and place within a week'
  }
  if (p.kind === 'checkin') {
    if (s.shown.filter((x) => x.kind === 'checkin' && now - x.ts < WEEK).length >= 2) {
      return 'check-in max twice a week'
    }
  }
  return null
}

// First bank question not asked within the past week.
function nextQuestion(s, now) {
  const recent = new Set(
    s.shown.filter((x) => x.question && now - x.ts < WEEK).map((x) => x.question),
  )
  return QUESTION_BANK.find((q) => !recent.has(q)) || null
}

const latestMemory = (memories) =>
  (memories || []).reduce((a, m) => (!a || whenToTs(m.when) > whenToTs(a.when) ? m : a), null)

// context: { personId, memories, now? } — now defaults to Date.now().
// Returns one prompt {id, kind, text, quickReplies, memoryId?, place?, question?} or null.
export function evaluate(context) {
  const { personId, memories = [], now = Date.now() } = context
  lastPersonId = personId
  const s = load(personId)
  const hour = new Date(now).getHours()

  // Demo prompts queued via window.__memmory.fireNudge skip only the
  // time-of-day gates; every cap still applies and blocks are logged.
  while (s.queued.length) {
    const p = s.queued.shift()
    save(personId, s)
    const why = blocked(s, p, now)
    if (why) { console.info(`[keeper] demo ${p.kind} blocked: ${why}`); continue }
    return p
  }

  // Quiet hours 22:00-08:00: nothing fires.
  if (hour >= 22 || hour < 8) return null

  const candidates = []

  // On this day: morning only, gone by noon, a memory from ~a year ago.
  if (hour < 12) {
    const target = now - 365 * 24 * 3600 * 1000
    const m = (memories || []).find((x) => Math.abs(whenToTs(x.when) - target) < 3 * 24 * 3600 * 1000)
    if (m) {
      candidates.push({
        id: `otd:${dayKey(now)}`, kind: 'on-this-day', text: ON_THIS_DAY_LABEL,
        memoryId: m.id, quickReplies: [],
      })
    }
  }

  // Golden-moment coaching: photos without voice in the latest memory.
  const last = latestMemory(memories)
  if (last && (last.photos || []).length && !(last.voice || []).length) {
    candidates.push({
      id: `coach:${last.id}`, kind: 'coach', text: COACHING_PROMPT,
      memoryId: last.id, quickReplies: ANSWERABLE,
    })
  }

  // Quiet check-in: evening, no capture today.
  const capturedToday = last && dayKey(whenToTs(last.when)) === dayKey(now)
  if (hour >= 18 && !capturedToday) {
    const question = nextQuestion(s, now)
    if (question) {
      candidates.push({
        id: `checkin:${dayKey(now)}`, kind: 'checkin', text: question,
        question, quickReplies: ANSWERABLE,
      })
    }
  }

  return candidates.find((p) => !blocked(s, p, now)) || null
}

// Record that a prompt actually rendered. This is what the caps count.
export function markShown(personId, prompt, now = Date.now()) {
  const s = load(personId)
  s.shown.push({ id: prompt.id, kind: prompt.kind, ts: now,
    place: prompt.place, question: prompt.question, memoryId: prompt.memoryId })
  save(personId, s)
}

// Swiped away or "Later": this prompt id never returns.
export function dismiss(personId, prompt) {
  const s = load(personId)
  if (!s.dismissed.includes(prompt.id)) s.dismissed.push(prompt.id)
  save(personId, s)
}

// ---- Demo triggers (prototype only, documented in SCHEMA.md). Location and
// dwell signals do not exist in the prototype, so place/dwell fire only here.
let lastPersonId = null
const DEMO = {
  place: { kind: 'place', text: NUDGE_KNOWN_PLACE, place: 'demo', quickReplies: KEEPABLE },
  dwell: { kind: 'dwell', text: NUDGE_LONG_DWELL, place: 'demo', quickReplies: KEEPABLE },
  checkin: { kind: 'checkin', text: NUDGE_CHECK_IN, question: NUDGE_CHECK_IN, quickReplies: ANSWERABLE },
  coach: { kind: 'coach', text: COACHING_PROMPT, quickReplies: ANSWERABLE },
}
if (typeof window !== 'undefined') {
  window.__memmory = {
    fireNudge(kind, personId = lastPersonId || 'p1') {
      const base = DEMO[kind]
      if (!base) return console.info('[keeper] unknown nudge kind:', kind)
      const s = load(personId)
      s.queued.push({ ...base, id: `demo:${kind}:${Date.now()}` })
      save(personId, s)
      console.info(`[keeper] queued demo ${kind} for ${personId}; next evaluate() returns it`)
    },
  }
}
