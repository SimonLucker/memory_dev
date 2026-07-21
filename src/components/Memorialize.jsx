import { useEffect, useRef, useState } from 'react'
import { CLASS_COLORS } from '../lib/palette.js'
import * as api from '../lib/api.js'
import { encodePhoto } from '../lib/photos.js'

const today = () => {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const systemPrompt = personName => `You are the Memorialization guide of Memmory, a calm, warm companion that helps ${personName} preserve a memory. The user shares a photo, a voice note (already transcribed to text), or written words.

Your job: gently gather what is needed, ONE short question at a time (never a list of questions), at most 3-4 questions total. Prioritise what is missing: when it happened, where, who was there, what happened, how it felt, and optionally a song that brings it back and why the moment mattered. If a photo is shared, look at it and let it guide your questions. Keep every reply to 1-3 warm, plain sentences. Never use bullet points. Never repeat a sentence you have already written.

When you have enough (do not drag it out), produce the memory IMMEDIATELY — in that same reply: one short closing sentence, then the memory as a fenced json block, then one short question asking whether anything should be added or changed. NEVER say the memory is ready, or that you have enough, without including the json block in that very reply. If the user then asks for a change or addition, reply with the complete updated json block in the same format. The json block must be exactly this shape:

\`\`\`json
{
  "class": "Friends|Family|Travel|Work|Milestones",
  "what": "short title, a few words",
  "when": "DD-MM-YYYY HH:mm (right now is ${today()}; if the user gives no date or time, assume it just happened and use right now — do NOT ask when unless their words suggest it was not today)",
  "where": "place",
  "why": "why this moment happened / mattered",
  "who": [{"name": "Sarah"}],
  "feeling": ["Happy"],
  "music": {"name": "Song", "artist": "Artist"} or null,
  "summary": "one warm sentence capturing the memory",
  "importance": 1-5
}
\`\`\`

Feelings vocabulary (pick 1-2 closest): Happy, Nostalgic, Proud, Excited, Calm, Grateful, Sad, Bittersweet, Free.`

const extractDraft = text => {
  const m = text.match(/```json\s*([\s\S]*?)```/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

// The model sometimes emits the same sentence twice in a row — collapse
// consecutive duplicate lines so the bubble reads once.
const dedupeLines = text => text
  .split('\n')
  .filter((l, i, a) => !l.trim() || l.trim() !== a[i - 1]?.trim())
  .join('\n')

// The Memorialization chat: photo / voice / text in → clarifying dialogue →
// a memory JSON out, saved into the vault via onSave (App.addMemory).
export default function Memorialize({ personName, onSave, onPlay }) {
  const [messages, setMessages] = useState([]) // {role, text, image?} — UI shape
  const [input, setInput] = useState('')
  const [photos, setPhotos] = useState([]) // pending attachments, data URLs
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [draft, setDraft] = useState(null) // parsed memory JSON awaiting save
  const [songCheck, setSongCheck] = useState(null) // { status: 'loading'|'found'|'missing', info? }
  const [notice, setNotice] = useState(null)
  const recRef = useRef(null)
  const fileRef = useRef(null)
  const endRef = useRef(null)
  const taRef = useRef(null)

  // Composer grows with the text (capped) and shrinks back once it empties —
  // sending clears the input, so the reset is automatic.
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy, draft])

  // Double-check the draft's song against Apple's catalog the moment it appears,
  // so a wrong guess is caught (and playable) before the memory is saved.
  useEffect(() => {
    if (!draft?.music) { setSongCheck(null); return }
    let live = true
    setSongCheck({ status: 'loading' })
    api.findTrack(draft.music).then(info => {
      if (live) setSongCheck(info?.previewUrl ? { status: 'found', info } : { status: 'missing' })
    })
    return () => { live = false }
  }, [draft?.music?.name, draft?.music?.artist])

  // UI messages → OpenAI chat format (images as data-URL parts).
  const toApi = msgs => [
    { role: 'system', content: systemPrompt(personName) },
    ...msgs.map(m => m.images?.length
      ? {
          role: m.role,
          content: [
            { type: 'text', text: m.text || 'Here are some photos.' },
            ...m.images.map(url => ({ type: 'image_url', image_url: { url } })),
          ],
        }
      : { role: m.role, content: m.text }),
  ]

  const send = async () => {
    if (busy || (!input.trim() && !photos.length)) return
    const mine = { role: 'user', text: input.trim(), images: photos }
    const next = [...messages, mine]
    setMessages(next)
    setInput('')
    setPhotos([])
    setBusy(true)
    setNotice(null)
    try {
      const content = await api.chat(toApi(next))
      const d = extractDraft(content)
      const spoken = dedupeLines(content.replace(/```json[\s\S]*?```/, '').trim())
      setMessages(prev => [...prev, { role: 'assistant', text: spoken }])
      if (d) setDraft(d)
    } catch (e) {
      setNotice(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  // iPhone camera shots arrive as 4000px HEIC/JPEG monsters. Re-encode through a
  // canvas at pick time: bounded JPEG (browser applies EXIF rotation while drawing),
  // small enough to travel as a data URL through the AI chat and the upload endpoint.
  const pickPhoto = e => {
    for (const f of Array.from(e.target.files || [])) {
      encodePhoto(f).then(dataUrl => setPhotos(prev => [...prev, dataUrl]))
    }
    e.target.value = ''
  }

  const toggleRecord = async () => {
    if (recording) { recRef.current?.stop(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks = []
      rec.ondataavailable = e => chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        setBusy(true)
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
          const data = await api.transcribe(blob)
          if (data.error) setNotice(data.error)
          if (data.transcript) setInput(prev => (prev ? prev + ' ' : '') + data.transcript)
        } catch (e) { setNotice('Transcription failed: ' + e.message) } finally { setBusy(false) }
      }
      rec.start()
      recRef.current = rec
      setRecording(true)
    } catch { setNotice('Microphone unavailable — you can also upload a recording as text or type instead.') }
  }

  const saveDraft = async () => {
    setBusy(true)
    try {
      // Every photo shared in this conversation belongs to the memory.
      const uploaded = []
      for (const m of messages) {
        for (const image of m.images || []) {
          const blob = await (await fetch(image)).blob()
          uploaded.push(await api.uploadPhoto(blob))
        }
      }
      onSave({ ...draft, photos: uploaded }) // App appends, persists, and jumps to the Vault
    } catch (e) {
      setNotice('Could not save: ' + e.message)
      setBusy(false)
    }
  }

  const accent = draft ? (CLASS_COLORS[draft.class] || '#9DB4DE') : null

  return (
    <div className="memorialize">
      <header className="vault-head">
        <div className="eyebrow">Memorialization</div>
        <h1>Keep a moment, {personName}</h1>
      </header>

      <div className="chat">
        {!messages.length && (
          <div className="chat-msg assistant">
            Share a photo, record your voice, or simply start writing — I’ll ask a few
            small questions and keep this moment safe in your vault.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {(m.images || []).map((img, j) => <img key={j} className="chat-photo" src={img} alt="" />)}
            {m.text}
          </div>
        ))}
        {busy && <div className="chat-msg assistant thinking">…</div>}

        {draft && (
          <div className="draft-card" style={{ borderColor: `${accent}66` }}>
            <div className="vault-title">
              <span className="dot" style={{ background: accent }} />
              <strong>{draft.what}</strong>
              <span className="vault-when">{draft.when}</span>
            </div>
            <div className="vault-meta">{draft.where} · {(draft.feeling || []).join(', ')}</div>
            <p className="vault-summary">{draft.summary}</p>
            <div className="vault-chips">
              {(draft.who || []).map((p, i) => <span key={i} className="chip">{p.name || p}</span>)}
              {draft.music && (
                <button className="chip music" title="Play preview"
                  onClick={() => onPlay?.(draft.music)}>
                  ▶ {draft.music.name}
                </button>
              )}
            </div>
            {songCheck && (
              <div className={'song-check' + (songCheck.status === 'missing' ? ' warn' : '')}>
                {songCheck.status === 'loading' && 'Checking the song in Apple Music…'}
                {songCheck.status === 'found' && `✓ Found: ${songCheck.info.trackName} — ${songCheck.info.artistName}`}
                {songCheck.status === 'missing' && '⚠ Song not found in Apple Music — tell me a correction, or save as is.'}
              </div>
            )}
            <button className="save-btn" onClick={saveDraft} disabled={busy}>Save to vault</button>
          </div>
        )}

        {notice && <div className="chat-notice">{notice}</div>}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {photos.length > 0 && (
          <div className="composer-photos">
            {photos.map((p, i) => (
              <div key={i} className="composer-photo">
                <img src={p} alt="" />
                <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="composer-row">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickPhoto} />
          <button className="icon-btn" title="Add a photo" onClick={() => fileRef.current.click()}>📷</button>
          <button className={'icon-btn' + (recording ? ' rec' : '')} title="Record your voice" onClick={toggleRecord}>
            {recording ? '■' : '🎙'}
          </button>
          <textarea
            ref={taRef}
            rows={1}
            placeholder={recording ? 'Listening…' : 'Tell me about a moment…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button className="send-btn" onClick={send} disabled={busy || (!input.trim() && !photos.length)}>↑</button>
        </div>
      </div>
    </div>
  )
}
