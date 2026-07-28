import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/capture.css'
import { Camera, Mic, Send, Play, Pause, Moment as MomentIcon } from './Icons.jsx'
import {
  loadThread, appendMessage, updateMessage, seedThreadFromMemories, monthKey, whenToTs,
} from '../lib/thread.js'
import { evaluate, markShown, dismiss as dismissPrompt } from '../lib/keeper.js'
import { startRecording, transcribe } from '../lib/voice.js'
import { parseQuery, filterMemories } from '../lib/search.js'
import { uploadPhoto } from '../lib/api.js'
import {
  GREETING, EMPTY_CAPTURE, INPUT_PLACEHOLDER, FORMING_BAR, FORMING_BAR_ACTION,
  MOMENT_END_ACTION, MOMENT_AUTO_SUGGEST, ON_THIS_DAY_LABEL, SEARCH_NO_RESULT,
  QUICK_REPLY_KEEP, QUICK_REPLY_LATER, QUICK_REPLY_ANSWER, FAILED_SEND, OFFLINE,
} from '../lib/copy.js'

const two = n => String(n).padStart(2, '0')
const whenOf = ts => {
  const d = new Date(ts)
  return `${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const monthLabel = key => {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}
const cardMeta = m => {
  const d = new Date(whenToTs(m.when))
  const date = `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`
  return m.where ? `${date} · ${m.where}` : date
}
// Moment name / fallback title from time: "Friday night".
const nameFromTime = (ts = Date.now()) => {
  const d = new Date(ts)
  const h = d.getHours()
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night'
  return `${DAYS[d.getDay()]} ${part}`
}
const titleFrom = (texts, ts) => {
  const t = (texts[0] || '').replace(/[.?]+$/, '').trim()
  if (!t) return nameFromTime(ts)
  const words = t.split(/\s+/)
  return words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : '')
}
const isQuestion = t => /\?\s*$/.test(t) || /^(when|where|what|who|show)\b/i.test(t.trim())
const CAPTURE_KINDS = new Set(['user-text', 'user-photo', 'user-video', 'user-voice'])
const fmtDur = s => `${Math.floor(s / 60)}:${two(s % 60)}`
// Static waveform bar heights (mockup values, cycled).
const WAVE = [30, 70, 45, 90, 55, 75, 35, 60, 50, 80, 40, 65]

function VoiceMsg({ msg }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [frac, setFrac] = useState(0)
  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) { a.play().catch(() => {}); setPlaying(true) } else { a.pause(); setPlaying(false) }
  }
  return (
    <div className="msg-voice">
      <audio ref={audioRef} src={msg.src} preload="none"
        onTimeUpdate={e => setFrac(e.target.currentTime / (msg.duration || 1))}
        onEnded={() => { setPlaying(false); setFrac(0) }} />
      <button className="voice-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <span className="wave">
        {WAVE.map((h, i) => (
          <i key={i} className={i / WAVE.length <= frac && frac > 0 ? 'played' : ''}
            style={{ height: `${h}%` }} />
        ))}
      </span>
      <span className="type-label dur">{fmtDur(msg.duration || 0)}</span>
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
          <span className="type-label video-dur">{fmtDur(dur)}</span>
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

export default function Capture({ person, memories, addMemory, openMemory, updateMemory }) {
  const [thread, setThread] = useState([])
  const [text, setText] = useState('')
  const [open, setOpen] = useState(null)       // forming: { ids: [], last: ts }
  const [moment, setMoment] = useState(null)   // { name, since, last, editing }
  const [prompt, setPrompt] = useState(null)   // keeper prompt or local suggest
  const [rec, setRec] = useState(null)         // { t0, elapsed, cancel }
  const [online, setOnline] = useState(navigator.onLine)

  const threadRef = useRef(thread); threadRef.current = thread
  const memoriesRef = useRef(memories); memoriesRef.current = memories
  const openRef = useRef(open); openRef.current = open
  const momentRef = useRef(moment); momentRef.current = moment
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const photoInRef = useRef(null)
  const videoInRef = useRef(null)
  const camTimer = useRef(null)
  const sendTimer = useRef(null)
  const recHandle = useRef(null)
  const recX = useRef(0)
  const blobs = useRef({}) // msgId -> blob, for failed-upload retry
  const mountTs = useRef(Date.now())

  const push = msg => {
    const full = appendMessage(person.id, msg)
    setThread(t => [...t, full])
    return full
  }
  const patch = (id, p) => {
    const m = updateMessage(person.id, id, p)
    if (m) setThread(t => t.map(x => (x.id === id ? m : x)))
  }

  // Load (seed) the thread per person + daily greeting.
  useEffect(() => {
    let msgs = seedThreadFromMemories(person.id, memoriesRef.current)
    const key = `memmory.greet.${person.id}`
    const today = new Date().toDateString()
    if (msgs.length && localStorage.getItem(key) !== today) {
      localStorage.setItem(key, today)
      msgs = [...msgs, appendMessage(person.id, {
        kind: 'keeper', text: GREETING.replace('Simon', person.name.split(' ')[0]),
      })]
    }
    setThread(msgs)
    setOpen(null); setMoment(null); setPrompt(null)
  }, [person.id])

  // Keep the thread pinned to the bottom.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.length, prompt, open?.last, moment?.since])

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // ---- Memory forming (5.4) and Moment (5.5) ------------------------------

  const saveMemoryFrom = (msgs, name) => {
    if (!msgs.length) return
    const texts = msgs.filter(m => m.kind === 'user-text').map(m => m.text)
    const memory = addMemory({
      what: name || titleFrom(texts, msgs[0].ts),
      when: whenOf(Date.now()),
      where: '',
      who: [],
      feeling: [],
      photos: msgs.filter(m => m.kind === 'user-photo').map(m => m.src),
      videos: msgs.filter(m => m.kind === 'user-video').map(m => ({ src: m.src, duration: m.duration || 0 })),
      voice: msgs.filter(m => m.kind === 'user-voice')
        .map(m => ({ src: m.src, duration: m.duration || 0, ...(m.transcript ? { transcript: m.transcript } : {}) })),
      about: texts.join(' '),
    })
    push({ kind: 'memory-card', memoryId: memory.id })
  }

  const closeForming = () => {
    const o = openRef.current
    setOpen(null)
    if (!o) return
    saveMemoryFrom(threadRef.current.filter(m => o.ids.includes(m.id)))
  }
  useEffect(() => {
    if (!open || moment) return
    const t = setTimeout(closeForming, 30000)
    return () => clearTimeout(t)
  }, [open?.last, !!moment])

  const startMoment = (since = Date.now()) => {
    const o = openRef.current
    if (o?.ids.length) {
      const first = threadRef.current.find(m => o.ids.includes(m.id))
      if (first) since = Math.min(since, first.ts)
    }
    setOpen(null)
    setMoment({ name: nameFromTime(), since, last: Date.now() })
  }
  const endMoment = () => {
    const mo = momentRef.current
    setMoment(null)
    if (!mo) return
    saveMemoryFrom(
      threadRef.current.filter(m => CAPTURE_KINDS.has(m.kind) && m.ts >= mo.since), mo.name)
  }
  useEffect(() => {
    if (!moment) return
    const t = setTimeout(endMoment, 2 * 3600 * 1000) // silent auto-close after 2 quiet hours
    return () => clearTimeout(t)
  }, [moment?.last])
  const momentCount = moment
    ? thread.filter(m => CAPTURE_KINDS.has(m.kind) && m.ts >= moment.since).length
    : 0

  // Every capture message joins the forming window (or the active Moment).
  const captured = full => {
    if (momentRef.current) setMoment(mo => ({ ...mo, last: Date.now() }))
    else setOpen(o => ({ ids: [...(o?.ids || []), full.id], last: Date.now() }))
  }

  // Moment auto-suggest: 5+ photos in 10 minutes, no Moment, once per day.
  const maybeSuggest = () => {
    if (momentRef.current || promptRef.current) return
    const key = `memmory.suggest.${person.id}`
    const today = new Date().toDateString()
    if (localStorage.getItem(key) === today) return
    const cut = Date.now() - 10 * 60 * 1000
    const recent = threadRef.current.filter(m => m.kind === 'user-photo' && m.ts >= cut)
    if (recent.length >= 5) {
      localStorage.setItem(key, today)
      setPrompt({
        id: `suggest:${today}`, kind: 'suggest', text: MOMENT_AUTO_SUGGEST,
        quickReplies: [QUICK_REPLY_KEEP, QUICK_REPLY_LATER], since: recent[0].ts,
      })
    }
  }

  // ---- Sending ------------------------------------------------------------

  const vocab = useMemo(() => ({
    people: [...new Set(memories.flatMap(m => (m.who || []).map(p => p.name.toLowerCase())))],
    classes: [...new Set(memories.map(m => (m.class || '').toLowerCase()).filter(Boolean))],
    places: [...new Set(memories.map(m => (m.where || '').toLowerCase()).filter(Boolean))],
    feelings: [...new Set(memories.flatMap(m => (m.feeling || []).map(f => f.toLowerCase())))],
    artists: [...new Set(memories.map(m => (m.music?.artist || '').toLowerCase()).filter(Boolean))],
  }), [memories])

  const answer = q => {
    const { filters } = parseQuery(q, vocab)
    const hits = filters.length
      ? filterMemories(memories, filters).sort((a, b) => whenToTs(b.when) - whenToTs(a.when))
      : []
    if (!hits.length) { push({ kind: 'keeper', text: SEARCH_NO_RESULT }); return }
    const top = hits[0]
    const d = new Date(whenToTs(top.when))
    const facts = [top.where, `${MONTHS[d.getMonth()]} ${d.getFullYear()}`].filter(Boolean).join(', ')
    push({ kind: 'keeper', text: `${top.what}. ${facts}.` })
    hits.slice(0, 2).forEach(m => push({ kind: 'memory-card', memoryId: m.id }))
  }

  const sendText = () => {
    const t = text.trim()
    if (!t) return
    setText('')
    const full = push({ kind: 'user-text', text: t })
    if (isQuestion(t)) answer(t)
    else captured(full)
  }

  const addFiles = (files, kind) => {
    for (const file of files) {
      const full = push({ kind, src: URL.createObjectURL(file), ...(kind === 'user-photo' ? { state: 'sending' } : {}) })
      captured(full)
      if (kind === 'user-photo') {
        blobs.current[full.id] = file
        uploadPhoto(file)
          .then(src => { delete blobs.current[full.id]; patch(full.id, { src, state: undefined }) })
          .catch(() => patch(full.id, { state: 'failed' }))
      }
      // ponytail: videos stay as blob URLs (uploadPhoto is photo-only); real video upload later
    }
    if (kind === 'user-photo') maybeSuggest()
  }
  const retryPhoto = msg => {
    const blob = blobs.current[msg.id]
    if (!blob) return
    patch(msg.id, { state: 'sending' })
    uploadPhoto(blob)
      .then(src => { delete blobs.current[msg.id]; patch(msg.id, { src, state: undefined }) })
      .catch(() => patch(msg.id, { state: 'failed' }))
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
  const micDown = async e => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    recX.current = e.clientX
    try { recHandle.current = await startRecording() } catch { return }
    setRec({ t0: Date.now(), elapsed: 0, cancel: false })
  }
  const micMove = e => {
    if (recHandle.current) setRec(r => r && { ...r, cancel: e.clientX - recX.current < -60 })
  }
  const micUp = async () => {
    const h = recHandle.current
    recHandle.current = null
    if (!h) return
    const cancelled = !!rec?.cancel
    setRec(null)
    const { blobUrl, duration, blob } = await h.stop()
    if (cancelled || duration < 1) return
    const full = push({ kind: 'user-voice', src: blobUrl, duration })
    captured(full)
    transcribe(blob).then(t => { if (t) patch(full.id, { transcript: t }) })
  }
  useEffect(() => {
    if (!rec) return
    const iv = setInterval(() => setRec(r => r && { ...r, elapsed: Math.floor((Date.now() - r.t0) / 1000) }), 250)
    return () => clearInterval(iv)
  }, [!!rec])

  // ---- The proactive keeper (6.7 + 6.8) -----------------------------------

  const promptRef = useRef(prompt); promptRef.current = prompt
  useEffect(() => {
    const tick = () => {
      if (promptRef.current) return
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
    if (p.kind === 'suggest') startMoment(p.since)
    else inputRef.current?.focus()
  }

  // ---- Render -------------------------------------------------------------

  const groups = []
  for (const m of thread) {
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
            {m.state === 'sending' && <span className="type-label state">Sending</span>}
          </div>
        )
      case 'user-photo':
        return (
          <div className="right">
            <div className={`msg-photo${m.state === 'failed' ? ' failed' : ''}`}
              onClick={m.state === 'failed' ? () => retryPhoto(m) : undefined}>
              <img src={m.src} alt="" />
            </div>
            {m.state === 'sending' && <span className="type-label state">Sending</span>}
            {m.state === 'failed' && <span className="type-label state error">{FAILED_SEND}</span>}
          </div>
        )
      case 'user-video':
        return <div className="right"><VideoMsg msg={m} /></div>
      case 'user-voice':
        return <div className="right"><VoiceMsg msg={m} /></div>
      case 'memory-card': {
        const mem = memories.find(x => x.id === m.memoryId)
        if (!mem) return null
        const thumb = mem.photos?.[0] || mem.videos?.[0]?.poster
        return (
          <button className={`mem-card${recent(m) ? ' settle' : ''}`} onClick={() => openMemory(mem.id)}>
            {thumb && <img src={thumb} alt="" />}
            <span className="mem-card-body">
              <span className="mem-card-title">{mem.what}</span>
              <span className="type-label mem-card-meta">{cardMeta(mem)}</span>
            </span>
          </button>
        )
      }
      default:
        return null
    }
  }

  const otdMemory = prompt?.kind === 'on-this-day' && new Date().getHours() < 12
    ? memories.find(x => x.id === prompt.memoryId)
    : null

  return (
    <div className="capture">
      {moment && (
        <div className="moment-banner">
          <MomentIcon size={18} />
          {moment.editing ? (
            <input className="moment-name" autoFocus value={moment.name}
              onChange={e => setMoment(mo => ({ ...mo, name: e.target.value }))}
              onBlur={() => setMoment(mo => ({ ...mo, editing: false }))}
              onKeyDown={e => e.key === 'Enter' && setMoment(mo => ({ ...mo, editing: false }))} />
          ) : (
            <button className="moment-label type-label"
              onClick={() => setMoment(mo => ({ ...mo, editing: true }))}>
              Moment · {moment.name} · {momentCount} kept
            </button>
          )}
          <button className="moment-end type-label" onClick={endMoment}>{MOMENT_END_ACTION}</button>
        </div>
      )}

      <div className="cap-thread" ref={scrollRef}>
        {otdMemory && (
          <Swipeable className="otd-card rise" onDismiss={clearPrompt}
            onClick={() => { const id = otdMemory.id; clearPrompt(); openMemory(id) }}>
            <span className="type-label otd-label">{ON_THIS_DAY_LABEL}</span>
            <div className="otd-body">
              {otdMemory.photos?.[0] && <img src={otdMemory.photos[0]} alt="" />}
              <span className="mem-card-body">
                <span className="mem-card-title">{otdMemory.what}</span>
                <span className="type-label mem-card-meta">{cardMeta(otdMemory)}</span>
              </span>
            </div>
          </Swipeable>
        )}

        {thread.length === 0 && <div className="msg keeper rise">{EMPTY_CAPTURE}</div>}

        {groups.map(g => (
          <div className="month-group" key={g.key}>
            <div className="month type-label">{monthLabel(g.key)}</div>
            {g.msgs.map(m => <div className="msg-row" key={m.id}>{renderMsg(m)}</div>)}
          </div>
        ))}

        {prompt && prompt.kind !== 'on-this-day' && (
          <Swipeable className="prompt-card rise" onDismiss={clearPrompt}>
            <p>{prompt.text}</p>
            <div className="quick-replies">
              {(prompt.quickReplies?.length ? prompt.quickReplies : [QUICK_REPLY_KEEP, QUICK_REPLY_LATER])
                .map(r => (
                  <button key={r} className="quick-reply type-label" onClick={() => quickReply(r)}>{r}</button>
                ))}
            </div>
          </Swipeable>
        )}

        {open && !moment && (
          <div className="forming-bar">
            <span className="type-label forming-text">{FORMING_BAR}</span>
            <span className="forming-line"><i key={open.last} /></span>
            <button className="pill-btn type-label" onClick={closeForming}>{FORMING_BAR_ACTION}</button>
            <button className="pill-btn quiet type-label" onClick={() => startMoment()}>Moment</button>
          </div>
        )}
      </div>

      <div className="cap-dock">
        {!online && <div className="type-label offline-line">{OFFLINE}</div>}
        <div className={`cap-bar${rec ? ' recording' : ''}`}>
          {rec ? (
            <>
              <span className={`rec-dot${rec.cancel ? ' cancel' : ''}`} />
              <span className="type-label rec-time">{fmtDur(rec.elapsed)}</span>
              <span className="wave live">
                {WAVE.slice(0, Math.max(1, Math.min(WAVE.length, rec.elapsed + 3))).map((h, i) => (
                  <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
                ))}
              </span>
            </>
          ) : (
            <>
              <button className="bar-icon" aria-label="Camera"
                onPointerDown={camDown} onPointerUp={camUp} onPointerLeave={camLeave}>
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
              onPointerDown={sendDown} onPointerUp={sendUp}>
              <Send size={22} />
            </button>
          ) : (
            <button className="bar-icon swap-in" aria-label="Record a voice note"
              onPointerDown={micDown} onPointerMove={micMove}
              onPointerUp={micUp} onPointerCancel={micUp}>
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
