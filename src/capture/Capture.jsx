import { useEffect, useMemo, useRef, useState } from 'react'
import './capture.css'
import { Camera, Mic, Send, Play, Pause, Moment as MomentIcon } from '../core/Icons.jsx'
import {
  appendMessage, updateMessage, loadThread, syncThread, deriveOpenWindow, isCapture,
  monthKey, whenToTs, monthLabel, metaLine, fmtDur, WAVE,
} from '../lib/thread.js'
import { evaluate, markShown, dismiss as dismissPrompt } from '../lib/keeper.js'
import { startRecording, transcribe, vlog, voiceLog, REASON } from '../lib/voice.js'
import {
  synthesizeMemory, extractAnswer, fallbackDraft, nameFromTime, saysSolo,
} from '../lib/synthesize.js'
import { buildVocab } from '../lib/edges.js'
import { parseQuery, filterMemories } from '../lib/search.js'
import { uploadPhoto, uploadAudio } from '../data/api.js'
import {
  FIRST_LAUNCH, INPUT_PLACEHOLDER, FORMING_BAR, FORMING_BAR_ACTION,
  MOMENT_END_ACTION, MOMENT_AUTO_SUGGEST, ON_THIS_DAY_LABEL, SEARCH_NO_RESULT,
  QUICK_REPLY_KEEP, QUICK_REPLY_LATER, FAILED_SEND, OFFLINE,
  ASK_WHO, ASK_WHERE, VOICE_MIC_OFF, VOICE_EMPTY, VOICE_UPLOAD_FAILED,
  BIG_BUTTON_TALK, BIG_BUTTON_CAMERA, SAVED, SAVED_ONE_MEMORY,
} from '../core/copy.js'

const two = n => String(n).padStart(2, '0')
const whenOf = ts => {
  const d = new Date(ts)
  return `${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`
}
const isQuestion = t => /\?\s*$/.test(t) || /^(when|where|what|who|show)\b/i.test(t.trim())

// How long a save waits for transcriptions still in flight before synthesising.
// Long enough for a short note to land, short enough that nothing feels stuck.
const TRANSCRIPT_GRACE = 4000
// A hold shorter than this is a tap on a hold control, not a lost recording.
const MIN_HOLD_MS = 350
// How long a keeper question stays answerable. After this the next text is a
// new capture, never an answer.
const ANSWER_WINDOW = 5 * 60 * 1000

// The failed-voice label names the reason (5.1: errors are calm and specific).
const voiceReason = m => {
  if (m.upload === 'failed') return VOICE_UPLOAD_FAILED
  if (m.state !== 'failed') return null
  return m.reason === REASON.PERMISSION ? VOICE_MIC_OFF : VOICE_EMPTY
}

function VoiceMsg({ msg, onRetry }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [frac, setFrac] = useState(0)
  const [dead, setDead] = useState(false) // blob URL died on reload: quiet row
  const failed = msg.state === 'failed' || msg.upload === 'failed'
  const toggle = () => {
    if (failed) { onRetry?.(); return }
    const a = audioRef.current
    if (!a || dead) return
    if (a.paused) {
      a.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setDead(true) })
    } else { a.pause(); setPlaying(false) }
  }
  return (
    <div className={`msg-voice${failed ? ' failed' : ''}${dead ? ' unavailable' : ''}`}>
      {msg.src && (
        <audio ref={audioRef} src={msg.src} preload="none"
          onTimeUpdate={e => setFrac(e.target.currentTime / (msg.duration || 1))}
          onError={() => { setPlaying(false); setDead(true) }}
          onEnded={() => { setPlaying(false); setFrac(0) }} />
      )}
      <button className="voice-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <span className="wave">
        {WAVE.map((h, i) => (
          <i key={i} className={i / WAVE.length <= frac && frac > 0 ? 'played' : ''}
            style={{ height: `${h}%` }} />
        ))}
      </span>
      <span className="t-label dur">{fmtDur(msg.duration || 0)}</span>
    </div>
  )
}

function VideoMsg({ msg }) {
  const ref = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [dur, setDur] = useState(msg.duration || 0)
  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) { v.play().catch(() => {}); setPlaying(true) } else { v.pause(); setPlaying(false) }
  }
  return (
    <div className="msg-photo" onClick={toggle}>
      <video ref={ref} src={msg.src} playsInline onEnded={() => setPlaying(false)}
        onLoadedMetadata={e => !msg.duration && isFinite(e.target.duration) && setDur(Math.round(e.target.duration))} />
      {!playing && (
        <div className="video-scrim">
          <span className="video-glyph"><Play size={22} /></span>
          <span className="t-label video-dur">{fmtDur(dur)}</span>
        </div>
      )}
    </div>
  )
}

// Swipe-to-dismiss wrapper for prompt and On this day cards.
function Swipeable({ onDismiss, className, children, ...rest }) {
  const x0 = useRef(null)
  return (
    <div className={className} {...rest}
      onTouchStart={e => { x0.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (x0.current != null && Math.abs(e.changedTouches[0].clientX - x0.current) > 60) onDismiss()
        x0.current = null
      }}>
      {children}
    </div>
  )
}

// scene: showcase-only state (src/capture/showcase.js). A showcase is READ
// ONLY: the thread is built in memory from the memories, rows and saved
// memories stay in component state, nothing reaches lib/thread or the store.
// now: the app's clock when frozen (?now= or a showcase), else null.
export default function Capture({ person, memories, addMemory, openMemory, updateMemory, bigButtons = true, scene = null, now = null }) {
  const nowMs = () => (now ? now.getTime() : Date.now())
  const [thread, setThread] = useState([])
  const [local, setLocal] = useState([]) // showcase: memories saved here, never written
  if (scene) {
    memories = local.length ? [...local, ...memories] : memories
    addMemory = draft => { const v2 = { id: `sc_${nowMs().toString(36)}`, photos: [], music: null, who: [], ...draft }; setLocal(l => [v2, ...l]); return v2 }
    updateMemory = v2 => setLocal(l => l.map(m => (m.id === v2.id ? v2 : m)))
  }
  const [text, setText] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [prompt, setPrompt] = useState(null)   // keeper prompt or local suggest
  const [recState, setRec] = useState(null)    // { t0, elapsed, cancel }
  const rec = recState || (scene?.rec ? { t0: 0, elapsed: 3, cancel: false } : null)
  const [armed, setArmed] = useState(false)    // retry hint on the mic button
  const [online, setOnline] = useState(navigator.onLine)

  const threadRef = useRef(thread); threadRef.current = thread
  const memoriesRef = useRef(memories); memoriesRef.current = memories
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const photoInRef = useRef(null)
  const videoInRef = useRef(null)
  const camTimer = useRef(null)
  const sendTimer = useRef(null)
  const recHandle = useRef(null)
  const micToken = useRef(null) // pending mic hold; cleared on release
  const recX = useRef(0)
  const blobs = useRef({}) // msgId -> blob, for failed-upload retry
  const txPending = useRef({}) // msgId -> in-flight transcription promise
  const upPending = useRef({}) // msgId -> in-flight upload promise
  const mountTs = useRef(nowMs())
  const recRef = useRef(rec); recRef.current = rec

  // The voice diagnostics ring buffer, readable from the console on a real
  // phone: window.__memmory.voiceLog. Attached here too because keeper.js
  // claims window.__memmory at import time.
  useEffect(() => {
    window.__memmory = window.__memmory || {}
    window.__memmory.voiceLog = voiceLog
  }, [])

  const push = msg => {
    const full = scene
      ? { id: `sc_${nowMs().toString(36)}${Math.random().toString(36).slice(2, 7)}`, ts: nowMs(), ...msg }
      : appendMessage(person.id, msg)
    setThread(t => [...t, full])
    return full
  }
  const patch = (id, p) => {
    let m
    if (scene) { m = threadRef.current.find(x => x.id === id); m = m && { ...m, ...p } }
    else m = updateMessage(person.id, id, p)
    if (m) setThread(t => t.map(x => (x.id === id ? m : x)))
    return m
  }

  // The open capture window is DERIVED from the persisted thread (5.4-5.6):
  // iOS reloads the tab whenever it likes, so forming/Moment must survive
  // as thread markers, never as ephemeral state.
  const { bundle, momentMsg } = useMemo(() => deriveOpenWindow(thread), [thread])
  const lastCap = bundle[bundle.length - 1] || null

  // The keeper's one unanswered follow-up question (enrichment target), still
  // pending only while nothing new has been captured since it was asked, and
  // only for a few minutes: a question left hanging must never swallow what the
  // user types an hour later (the thread survives reloads, the question does not).
  const pendingEnrich = useMemo(() => {
    for (let i = thread.length - 1; i >= 0; i--) {
      const m = thread[i]
      if (m.kind === 'keeper' && m.enrich) {
        return m.done || Date.now() - m.ts > ANSWER_WINDOW ? null : m
      }
      if (isCapture(m)) return null // something real was captured since
    }
    return null
  }, [thread])
  const pendingEnrichRef = useRef(pendingEnrich); pendingEnrichRef.current = pendingEnrich

  // Per person: render the local cache instantly, then reconcile with the
  // backend in the background (seeding when both stores are empty). The merged
  // thread only ever appends/patches rows the cache already keyed, so the list
  // never clears while the user watches; deriveOpenWindow recomputes from it.
  useEffect(() => {
    let live = true
    setPrompt(null)
    if (scene) {
      // One memory card per memory at its own date, then the scene's rows.
      const seeds = memoriesRef.current.map(m => ({ id: `seed_${m.id}`, ts: whenToTs(m.when), kind: 'memory-card', memoryId: m.id }))
        .sort((a, b) => a.ts - b.ts)
      setThread([...seeds, ...(scene.thread || []).map((m, i) => ({ ts: nowMs() + 1000 * (i + 1), ...m }))])
      return
    }
    setThread(loadThread(person.id))
    syncThread(person.id, memoriesRef.current).then((msgs) => { if (live) setThread(msgs) })
    return () => { live = false }
  }, [person.id])

  // Keep the thread pinned to the bottom.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.length, prompt, lastCap?.id, !!momentMsg])

  // Coming back online re-kicks everything that gave up while the network was
  // gone, so the user never has to hunt for failed rows and tap them.
  useEffect(() => {
    const on = () => {
      setOnline(true)
      for (const m of threadRef.current) {
        if (m.kind === 'user-photo' && m.state === 'failed') retryPhoto(m)
        else if (m.kind === 'user-voice' && m.upload === 'failed') retryVoice(m)
      }
    }
    const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // ---- Memory forming (5.4) and Moment (5.5) ------------------------------

  // Media as it stands right now, read fresh from the thread: an upload that
  // landed after the save still reaches the memory this way.
  const mediaOf = ids => {
    const msgs = threadRef.current.filter(m => ids.includes(m.id))
    return {
      photos: msgs.filter(m => m.kind === 'user-photo' && !m.state).map(m => m.src),
      videos: msgs.filter(m => m.kind === 'user-video').map(m => ({ src: m.src, duration: m.duration || 0 })),
      voice: msgs.filter(m => m.kind === 'user-voice' && m.src && m.upload !== 'failed')
        .map(m => ({ src: m.src, duration: m.duration || 0, ...(m.transcript ? { transcript: m.transcript } : {}) })),
    }
  }

  // An upload that only lands after the memory was saved (retries can run for
  // ~15s, the save waits 4) still has to reach it: every captured row carries
  // its memId, so the durable srcs are simply re-read into the memory.
  const refreshMedia = memId => {
    const mem = memoriesRef.current.find(m => m.id === memId)
    if (!mem) return
    updateMemory({ ...mem, ...mediaOf(threadRef.current.filter(m => m.memId === memId).map(m => m.id)) })
  }

  const bundleOf = (msgs, name) => ({
    texts: msgs.filter(m => m.kind === 'user-text').map(m => m.text),
    voiceTranscripts: msgs.filter(m => m.kind === 'user-voice').map(m => m.transcript).filter(Boolean),
    photoCount: msgs.filter(m => m.kind === 'user-photo').length,
    videoCount: msgs.filter(m => m.kind === 'user-video').length,
    timestamps: msgs.map(m => m.ts),
    momentName: name || '',
  })

  // Saving is INSTANT and silent: the card lands with the deterministic draft,
  // then synthesis rewrites it in place. No spinner, no "thinking" bubble.
  const saveMemoryFrom = (msgs, name) => {
    if (!msgs.length) return
    const ids = msgs.map(m => m.id)
    const memory = addMemory({
      ...fallbackDraft(bundleOf(msgs, name), name),
      when: whenOf(nowMs()),
      ...mediaOf(ids),
    })
    // The memory-card message is the window boundary: it MUST land in the
    // thread on every save, or the bundle would re-bundle after a reload.
    push({ kind: 'memory-card', memoryId: memory.id })
    // The one-word confirmation (v3 copy bank): plain, never a status line.
    push({ kind: 'keeper', text: msgs.length > 1 ? SAVED_ONE_MEMORY : SAVED })
    // Every captured row remembers where it landed: a transcript arriving after
    // synthesis knows which memory to enrich, and so does a late upload.
    msgs.forEach(m => patch(m.id, { memId: memory.id }))
    synthesizeInto(memory.id, msgs, name)
  }

  // Wait briefly for transcriptions in flight, synthesise once, patch the saved
  // memory. Failure leaves the fallback draft standing (flagged _unsynthesized).
  const synthesizeInto = async (memId, msgs, name) => {
    const ids = msgs.map(m => m.id)
    // Transcriptions enrich the story, uploads turn blob URLs into durable
    // srcs. Both are worth a few seconds; neither may hold the save hostage.
    const waits = ids.flatMap(id => [txPending.current[id], upPending.current[id]]).filter(Boolean)
    if (waits.length) {
      await Promise.race([
        Promise.all(waits.map(p => p.catch(() => null))),
        new Promise(r => setTimeout(r, TRANSCRIPT_GRACE)),
      ])
    }
    // Re-read the thread: transcripts and uploads may have landed since.
    const fresh = threadRef.current.filter(m => ids.includes(m.id))
    // From here a late transcript appends to `about` instead of waiting.
    fresh.filter(m => m.kind === 'user-voice').forEach(m => patch(m.id, { synthesized: true }))

    const bundle = bundleOf(fresh, name)
    const fields = await synthesizeMemory(bundle, { momentName: name })
    const mem = memoriesRef.current.find(m => m.id === memId)
    if (!mem) return
    // Media is re-read either way: an upload that landed after the instant save
    // must reach the memory even when synthesis could not run.
    const upd = { ...mem, ...mediaOf(ids) }
    if (!fields._unsynthesized) {
      upd.what = fields.what || mem.what
      upd.about = fields.about || mem.about
      if (fields.where) upd.where = fields.where
      if (fields.feeling.length) upd.feeling = fields.feeling
      if (fields.class) upd.class = fields.class
      if (fields.music) upd.music = fields.music
      if (fields.who.length) upd.__whoNames = fields.who
      delete upd._unsynthesized
    }
    updateMemory(upd)
    interview(memId, fields, bundle)
  }

  // ---- The keeper interview: at most TWO questions, one at a time ----------

  const askQuestion = (memId, field, next) => {
    push({
      kind: 'keeper', enrich: memId, field, next,
      text: field === 'who' ? ASK_WHO : ASK_WHERE,
    })
  }

  // Who first, then where. Nothing is asked when the content already answers
  // it (named people, or the user saying they were on their own).
  const interview = (memId, fields, bundle) => {
    const solo = saysSolo([...bundle.texts, ...bundle.voiceTranscripts].join(' '))
    const needWho = !(fields.who || []).length && !solo
    const needWhere = !fields.where
    if (needWho) askQuestion(memId, 'who', needWhere ? 'where' : null)
    else if (needWhere) askQuestion(memId, 'where', null)
  }

  // Close the open window (forming timeout, Save now, or Moment End): the
  // moment-end marker and the memory card both persist as boundaries.
  const closeWindow = () => {
    const { bundle, momentMsg } = deriveOpenWindow(threadRef.current)
    setEditingName(false)
    if (momentMsg) push({ kind: 'moment-end', name: momentMsg.name })
    if (bundle.length) saveMemoryFrom(bundle, momentMsg?.name)
  }

  // Forming: 30s idle since the last captured message. On reload mid-forming
  // the effect re-arms from now for the derived bundle.
  useEffect(() => {
    if (!lastCap || momentMsg) return
    const t = setTimeout(closeWindow, 30000)
    return () => clearTimeout(t)
  }, [lastCap?.id, !!momentMsg])

  // A Moment is a persisted moment-start marker; the window derivation absorbs
  // everything captured since the last boundary, so photos sent just before
  // (an auto-suggest) join it too.
  const startMoment = () => {
    if (deriveOpenWindow(threadRef.current).momentMsg) return
    push({ kind: 'moment-start', name: nameFromTime() })
  }
  // Silent auto-close 2 quiet hours after the last message, reload-safe.
  useEffect(() => {
    if (!momentMsg) return
    const lastTs = Math.max(momentMsg.ts, lastCap?.ts || 0)
    const t = setTimeout(closeWindow, Math.max(1000, lastTs + 2 * 3600 * 1000 - Date.now()))
    return () => clearTimeout(t)
  }, [momentMsg?.id, lastCap?.id])

  // Moment auto-suggest: 5+ photos in 10 minutes, no Moment, once per day.
  const maybeSuggest = () => {
    if (deriveOpenWindow(threadRef.current).momentMsg || promptRef.current) return
    const key = `memmory.suggest.${person.id}`
    const today = new Date().toDateString()
    if (localStorage.getItem(key) === today) return
    const cut = Date.now() - 10 * 60 * 1000
    const recent = threadRef.current.filter(m => m.kind === 'user-photo' && m.ts >= cut)
    if (recent.length >= 5) {
      localStorage.setItem(key, today)
      setPrompt({
        id: `suggest:${today}`, kind: 'suggest', text: MOMENT_AUTO_SUGGEST,
        quickReplies: [QUICK_REPLY_KEEP, QUICK_REPLY_LATER],
      })
    }
  }

  // The next text reply answers the question. Extraction never adds a feeling:
  // "I was alone" is a fact about company, and the field build turned it into
  // an "alone" chip. The second question only ever follows the first answer.
  const enrich = (keeperMsg, reply) => {
    patch(keeperMsg.id, { done: true })
    const memId = keeperMsg.enrich
    extractAnswer(keeperMsg.text, reply).then(a => {
      const mem = memoriesRef.current.find(m => m.id === memId)
      if (!mem) return
      const upd = { ...mem }
      let changed = false
      if (a.who.length) {
        upd.__whoNames = [...(mem.who || []).map(p => p.name), ...a.who]
        changed = true
      }
      if (a.where && !mem.where) { upd.where = a.where; changed = true }
      if (a.aboutAppend) {
        upd.about = [mem.about, a.aboutAppend].filter(Boolean).join(' ')
        changed = true
      }
      if (changed) updateMemory(upd)
      // Question two of two, and only when it is still unanswered.
      if (keeperMsg.next === 'where' && !(a.where || mem.where)) askQuestion(memId, 'where', null)
    }).catch(() => {})
  }

  // ---- Sending ------------------------------------------------------------

  const vocab = useMemo(() => buildVocab(memories), [memories])

  const answer = q => {
    const { filters } = parseQuery(q, vocab)
    const hits = filters.length
      ? filterMemories(memories, filters).sort((a, b) => whenToTs(b.when) - whenToTs(a.when))
      : []
    if (!hits.length) { push({ kind: 'keeper', text: SEARCH_NO_RESULT }); return }
    const top = hits[0]
    const d = new Date(whenToTs(top.when))
    const facts = [top.where,
      d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })].filter(Boolean).join(', ')
    push({ kind: 'keeper', text: `${top.what}. ${facts}.` })
    hits.slice(0, 2).forEach(m => push({ kind: 'memory-card', memoryId: m.id }))
  }

  const sendText = () => {
    const t = text.trim()
    if (!t) return
    setText('')
    if (isQuestion(t)) { push({ kind: 'user-text', text: t, meta: true }); answer(t); return }
    const pe = pendingEnrichRef.current
    if (pe && !momentMsg) { push({ kind: 'user-text', text: t, meta: true }); enrich(pe, t); return }
    push({ kind: 'user-text', text: t }) // joins the derived window
  }

  const addFiles = (files, kind) => {
    for (const file of files) {
      const full = push({ kind, src: URL.createObjectURL(file), ...(kind === 'user-photo' ? { state: 'sending' } : {}) })
      if (kind === 'user-photo') {
        blobs.current[full.id] = file
        upPending.current[full.id] = sendPhoto(full.id, file)
      }
      // ponytail: videos stay as blob URLs (uploadPhoto is photo-only); real video upload later
    }
    if (kind === 'user-photo') maybeSuggest()
  }
  // uploadPhoto already retries with backoff; the row stays 'sending' (5.1: the
  // quiet label) for the whole ladder and only fails once it is exhausted.
  const sendPhoto = (msgId, blob) => {
    upPending.current[msgId] = uploadPhoto(blob)
      .then(src => {
        delete blobs.current[msgId]
        const m = patch(msgId, { src, state: undefined })
        if (m?.memId) refreshMedia(m.memId)
      })
      .catch(() => patch(msgId, { state: 'failed' }))
      .finally(() => { delete upPending.current[msgId] })
    return upPending.current[msgId]
  }
  const retryPhoto = msg => {
    const blob = blobs.current[msg.id]
    if (!blob) return
    patch(msg.id, { state: 'sending' })
    sendPhoto(msg.id, blob)
  }

  // Camera: tap opens the photo picker, hold (400ms) the video picker.
  const camDown = () => { camTimer.current = setTimeout(() => { camTimer.current = null; videoInRef.current?.click() }, 400) }
  const camUp = () => {
    if (!camTimer.current) return
    clearTimeout(camTimer.current); camTimer.current = null
    photoInRef.current?.click()
  }
  const camLeave = () => { clearTimeout(camTimer.current); camTimer.current = null }

  // Send: tap sends, hold (400ms) starts a Moment.
  const sendDown = () => { sendTimer.current = setTimeout(() => { sendTimer.current = null; startMoment() }, 400) }
  const sendUp = () => {
    if (!sendTimer.current) return
    clearTimeout(sendTimer.current); sendTimer.current = null
    sendText()
  }

  // Mic: hold records, slide left cancels, release sends a voice note.
  // Every failure surfaces a row that NAMES its reason (5.1), never silence.
  // A failed row is meta and has no src, so it can never join a bundle.
  const failedVoice = reason => {
    vlog(`row-failed ${reason}`)
    return push({ kind: 'user-voice', duration: 0, state: 'failed', reason, meta: true })
  }

  const micDown = async e => {
    // Own the gesture completely: preventDefault kills the iOS long-press
    // callout, stopPropagation keeps the pane pager from stealing the pointer
    // capture mid-hold (that steal is what ends a hold as a pointercancel).
    e.preventDefault()
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch {}
    setArmed(false)
    recX.current = e.clientX
    const token = {}
    micToken.current = token
    let h
    try {
      h = await startRecording()
    } catch (err) {
      if (micToken.current === token) failedVoice(err?.reason || REASON.RECORDER)
      micToken.current = null
      return
    }
    // Released while the permission prompt was up: stop, keep nothing, say so
    // only if the hold was long enough to have meant a recording.
    if (micToken.current !== token) { h.stop(); vlog('released-before-start'); return }
    recHandle.current = h
    setRec({ t0: Date.now(), elapsed: 0, cancel: false })
  }
  const micMove = e => {
    e.stopPropagation()
    if (recHandle.current) setRec(r => r && { ...r, cancel: e.clientX - recX.current < -60 })
  }
  // pointercancel is a release, not a discard: iOS fires it for gestures the
  // system claims, and the audio recorded up to that point is real.
  const micUp = async e => {
    micToken.current = null
    const h = recHandle.current
    recHandle.current = null
    if (!h) return
    const cancelled = !!recRef.current?.cancel && e?.type !== 'pointercancel'
    setRec(null)
    vlog(e?.type === 'pointercancel' ? 'gesture-cancel keep-audio' : 'gesture-end')
    const { blobUrl, duration, blob, ms } = await h.stop()
    if (cancelled) { vlog('slide-cancel discard'); return }
    if (!blob || !blob.size) {
      if (ms >= MIN_HOLD_MS) failedVoice(REASON.EMPTY)
      else vlog('tap-not-hold discard')
      return
    }
    // Optimistic: the voice message lands NOW with its blob URL; the durable
    // src swaps in when the upload lands. A failed upload keeps the blob for
    // this session; after a reload the row degrades to the quiet state.
    const full = push({ kind: 'user-voice', src: blobUrl, duration })
    blobs.current[full.id] = blob
    sendAudio(full.id, blob)
    txPending.current[full.id] = transcribe(blob)
      .then(t => { if (t) applyTranscript(full.id, t); return t })
      .finally(() => { delete txPending.current[full.id] })
  }

  const sendAudio = (msgId, blob) => {
    upPending.current[msgId] = uploadAudio(blob)
      .then(src => {
        delete blobs.current[msgId]
        vlog('upload-ok')
        const m = patch(msgId, { src, upload: undefined })
        if (m?.memId) refreshMedia(m.memId)
      })
      .catch(e => { vlog(`upload-failed ${e?.message || e}`); patch(msgId, { upload: 'failed' }) })
      .finally(() => { delete upPending.current[msgId] })
    return upPending.current[msgId]
  }

  // A transcript that lands after the memory was synthesised enriches it with
  // ONE guarded update. Never a re-synthesis, never a loop.
  const applyTranscript = (msgId, text) => {
    const m = patch(msgId, { transcript: text })
    if (!m?.memId || !m.synthesized || m.txMerged) return
    patch(msgId, { txMerged: true })
    const mem = memoriesRef.current.find(x => x.id === m.memId)
    if (!mem) return
    updateMemory({
      ...mem,
      about: [mem.about, text].filter(Boolean).join(' '),
      voice: (mem.voice || []).map(v => (v.src === m.src ? { ...v, transcript: text } : v)),
    })
  }

  // Retry: a failed UPLOAD re-sends the blob we kept; a failed RECORDING has
  // nothing to send, so the tap arms the mic and the label says to hold it.
  const retryVoice = msg => {
    const blob = blobs.current[msg.id]
    if (msg.upload === 'failed' && blob) {
      vlog('retry-upload')
      patch(msg.id, { upload: undefined })
      sendAudio(msg.id, blob)
      return
    }
    vlog('retry-arm')
    setArmed(true)
    setTimeout(() => setArmed(false), 4000)
  }
  useEffect(() => {
    if (!rec) return
    const iv = setInterval(() => setRec(r => r && { ...r, elapsed: Math.floor((Date.now() - r.t0) / 1000) }), 250)
    return () => clearInterval(iv)
  }, [!!rec])

  // One gesture, two controls: the bar mic and the big mic share these, and so
  // do the two cameras (tap = photo, hold 400ms = video).
  const micProps = {
    onPointerDown: micDown, onPointerMove: micMove, onPointerUp: micUp, onPointerCancel: micUp,
    onContextMenu: e => e.preventDefault(),
  }
  const camProps = { onPointerDown: camDown, onPointerUp: camUp, onPointerLeave: camLeave }

  // ---- The proactive keeper (6.7 + 6.8) -----------------------------------

  const promptRef = useRef(prompt); promptRef.current = prompt
  useEffect(() => {
    if (scene) return // a showcase is a known state: no nudges, no localStorage
    const tick = () => {
      // an On this day card evaluated in the morning expires at noon; without
      // this it would invisibly block every later prompt (render gates hide it)
      if (promptRef.current?.kind === 'on-this-day' && new Date().getHours() >= 12) {
        promptRef.current = null
        setPrompt(null)
      }
      if (promptRef.current) return
      // The keeper never stacks two asks: a pending interview question holds
      // the proactive nudge back (it is re-evaluated on the next tick).
      if (pendingEnrichRef.current) return
      const p = evaluate({ personId: person.id, memories: memoriesRef.current })
      if (p) { markShown(person.id, p); setPrompt(p) }
    }
    tick()
    const iv = setInterval(tick, 60000)
    return () => clearInterval(iv)
  }, [person.id])

  const clearPrompt = () => {
    if (prompt) dismissPrompt(person.id, prompt)
    setPrompt(null)
  }
  const quickReply = reply => {
    const p = prompt
    clearPrompt()
    if (reply === QUICK_REPLY_LATER) return
    if (p.kind === 'suggest') startMoment()
    else inputRef.current?.focus()
  }

  // ---- Render -------------------------------------------------------------

  const groups = []
  for (const m of thread) {
    if (m.kind === 'moment-start' || m.kind === 'moment-end') continue // markers, never rendered
    const k = monthKey(m.ts)
    if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, msgs: [] })
    groups[groups.length - 1].msgs.push(m)
  }
  const recent = m => m.ts > mountTs.current

  const renderMsg = m => {
    switch (m.kind) {
      case 'keeper':
        return <div className={`msg keeper${recent(m) ? ' rise' : ''}`}>{m.text}</div>
      case 'user-text':
        return (
          <div className="right">
            <div className="msg user">{m.text}</div>
            {m.state === 'sending' && <span className="t-label state">Sending</span>}
          </div>
        )
      case 'user-photo':
        return (
          <div className="right">
            <div className={`msg-photo${m.state === 'failed' ? ' failed' : ''}`}
              onClick={m.state === 'failed' ? () => retryPhoto(m) : undefined}>
              <img src={m.src} alt="" />
            </div>
            {m.state === 'sending' && <span className="t-label state">Sending</span>}
            {m.state === 'failed' && <span className="t-label state error">{FAILED_SEND}</span>}
          </div>
        )
      case 'user-video':
        return <div className="right"><VideoMsg msg={m} /></div>
      case 'user-voice': {
        const why = voiceReason(m)
        return (
          <div className="right">
            <VoiceMsg msg={m} onRetry={() => retryVoice(m)} />
            {why && <span className="t-label state error">{why}</span>}
          </div>
        )
      }
      case 'memory-card': {
        const mem = memories.find(x => x.id === m.memoryId)
        if (!mem) return null
        const thumb = mem.photos?.[0] || mem.videos?.[0]?.poster
        return (
          <button className={`mem-card${recent(m) ? ' settle' : ''}`} onClick={() => openMemory(mem.id)}>
            {thumb && <img src={thumb} alt="" loading="lazy" decoding="async" />}
            <span className="mem-card-body">
              <span className="mem-card-title">{mem.what}</span>
              <span className="t-label mem-card-meta">{metaLine(mem)}</span>
            </span>
          </button>
        )
      }
      default:
        return null
    }
  }

  const otdMemory = prompt?.kind === 'on-this-day'
    ? memories.find(x => x.id === prompt.memoryId)
    : null

  return (
    <div className="capture">
      {momentMsg && (
        <div className="moment-banner">
          <MomentIcon size={18} />
          {editingName ? (
            <input className="moment-name" autoFocus value={momentMsg.name}
              onChange={e => patch(momentMsg.id, { name: e.target.value })}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingName(false)} />
          ) : (
            <button className="moment-label t-label" onClick={() => setEditingName(true)}>
              Moment · {momentMsg.name} · {bundle.length} kept
            </button>
          )}
          <button className="moment-end t-label" onClick={closeWindow}>{MOMENT_END_ACTION}</button>
        </div>
      )}

      <div className="cap-thread" ref={scrollRef}>
        {otdMemory && (
          <Swipeable className="otd-card rise" onDismiss={clearPrompt}
            onClick={() => { const id = otdMemory.id; clearPrompt(); openMemory(id) }}>
            <span className="t-label otd-label">{ON_THIS_DAY_LABEL}</span>
            <div className="otd-body">
              {otdMemory.photos?.[0] && <img src={otdMemory.photos[0]} alt="" loading="lazy" decoding="async" />}
              <span className="mem-card-body">
                <span className="mem-card-title">{otdMemory.what}</span>
                <span className="t-label mem-card-meta">{metaLine(otdMemory)}</span>
              </span>
            </div>
          </Swipeable>
        )}

        {thread.length === 0 && <div className="msg keeper rise">{FIRST_LAUNCH}</div>}

        {groups.map(g => (
          <div className="month-group" key={g.key}>
            <div className="month t-label">{monthLabel(g.key)}</div>
            {g.msgs.map(m => <div className="msg-row" key={m.id}>{renderMsg(m)}</div>)}
          </div>
        ))}

        {prompt && prompt.kind !== 'on-this-day' && !lastCap && (
          <Swipeable className="prompt-card rise" onDismiss={clearPrompt}>
            <p>{prompt.text}</p>
            <div className="quick-replies">
              {(prompt.quickReplies?.length ? prompt.quickReplies : [QUICK_REPLY_KEEP, QUICK_REPLY_LATER])
                .map(r => (
                  <button key={r} className="quick-reply t-label" onClick={() => quickReply(r)}>{r}</button>
                ))}
            </div>
          </Swipeable>
        )}

        {lastCap && !momentMsg && (
          <div className="forming-bar">
            <span className="t-label forming-text">{FORMING_BAR(bundle.length)}</span>
            <span className="forming-line"><i key={lastCap.id} /></span>
            <button className="pill-btn t-label" onClick={closeWindow}>{FORMING_BAR_ACTION}</button>
          </div>
        )}
      </div>

      <div className="cap-dock">
        {!online && <div className="t-label offline-line">{OFFLINE}</div>}
        {bigButtons && (
          <div className="cap-big">
            <span className="cap-big-act">
              <button className={`cap-big-btn${armed ? ' armed' : ''}${rec ? ' recording' : ''}`} aria-label="Record a voice note" {...micProps}>
                <Mic size={26} />
              </button>
              <span className="cap-big-label">{BIG_BUTTON_TALK}</span>
            </span>
            <span className="cap-big-act">
              <button className="cap-big-btn" aria-label="Camera" {...camProps}>
                <Camera size={26} />
              </button>
              <span className="cap-big-label">{BIG_BUTTON_CAMERA}</span>
            </span>
          </div>
        )}
        <div className={`cap-bar${rec ? ' recording' : ''}`}>
          {rec ? (
            <>
              <span className={`rec-dot${rec.cancel ? ' cancel' : ''}`} />
              <span className="t-label rec-time">{fmtDur(rec.elapsed)}</span>
              <span className="wave live">
                {WAVE.slice(0, Math.max(1, Math.min(WAVE.length, rec.elapsed + 3))).map((h, i) => (
                  <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
                ))}
              </span>
            </>
          ) : (
            <>
              <button className="bar-icon" aria-label="Camera" {...camProps}>
                <Camera size={22} />
              </button>
              <input ref={inputRef} className="cap-field" value={text}
                placeholder={INPUT_PLACEHOLDER}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendText()} />
            </>
          )}
          {text.trim() && !rec ? (
            <button className="bar-icon swap-in" aria-label="Send"
              onPointerDown={sendDown} onPointerUp={sendUp}
              onPointerLeave={() => { clearTimeout(sendTimer.current); sendTimer.current = null }}>
              <Send size={22} />
            </button>
          ) : (
            <button className={`bar-icon swap-in${armed ? ' armed' : ''}`}
              aria-label="Record a voice note" {...micProps}>
              <Mic size={22} />
            </button>
          )}
        </div>
        <input ref={photoInRef} type="file" accept="image/*" multiple hidden
          onChange={e => { addFiles([...e.target.files], 'user-photo'); e.target.value = '' }} />
        <input ref={videoInRef} type="file" accept="video/*" hidden
          onChange={e => { addFiles([...e.target.files], 'user-video'); e.target.value = '' }} />
      </div>
    </div>
  )
}
