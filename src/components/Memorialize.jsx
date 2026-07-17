import { useEffect, useRef, useState } from 'react'
import { CLASS_COLORS } from '../lib/palette.js'

const today = () => {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const systemPrompt = personName => `You are the Memorialization guide of Memmory, a calm, warm companion that helps ${personName} preserve a memory. The user shares a photo, a voice note (already transcribed to text), or written words.

Your job: gently gather what is needed, ONE short question at a time (never a list of questions), at most 3-4 questions total. Prioritise what is missing: when it happened, where, who was there, what happened, how it felt, and optionally a song that brings it back and why the moment mattered. If a photo is shared, look at it and let it guide your questions. Keep every reply to 1-3 warm, plain sentences. Never use bullet points.

When you have enough (do not drag it out), reply with one short closing sentence followed by the memory as a fenced json block, exactly this shape:

\`\`\`json
{
  "class": "Friends|Family|Travel|Work|Milestones",
  "what": "short title, a few words",
  "when": "DD-MM-YYYY HH:mm (best guess; today is ${today()}; use 12:00 if time unknown)",
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

// The Memorialization chat: photo / voice / text in → clarifying dialogue →
// a memory JSON out, saved into the vault via onSave (App.addMemory).
export default function Memorialize({ personName, onSave }) {
  const [messages, setMessages] = useState([]) // {role, text, image?} — UI shape
  const [input, setInput] = useState('')
  const [photo, setPhoto] = useState(null) // { dataUrl, blob } pending attachment
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [draft, setDraft] = useState(null) // parsed memory JSON awaiting save
  const [notice, setNotice] = useState(null)
  const recRef = useRef(null)
  const fileRef = useRef(null)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy, draft])

  // UI messages → OpenAI chat format (images as data-URL parts).
  const toApi = msgs => [
    { role: 'system', content: systemPrompt(personName) },
    ...msgs.map(m => m.image
      ? { role: m.role, content: [{ type: 'text', text: m.text || 'Here is a photo.' }, { type: 'image_url', image_url: { url: m.image } }] }
      : { role: m.role, content: m.text }),
  ]

  const send = async () => {
    if (busy || (!input.trim() && !photo)) return
    const mine = { role: 'user', text: input.trim(), image: photo?.dataUrl }
    const next = [...messages, mine]
    setMessages(next)
    setInput('')
    setPhoto(null)
    setBusy(true)
    setNotice(null)
    try {
      const r = await fetch('/__ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: toApi(next) }),
      })
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      const d = extractDraft(data.content)
      const spoken = data.content.replace(/```json[\s\S]*?```/, '').trim()
      setMessages(prev => [...prev, { role: 'assistant', text: spoken }])
      if (d) setDraft(d)
    } catch (e) {
      setNotice(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const pickPhoto = e => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setPhoto({ dataUrl: reader.result, blob: f })
    reader.readAsDataURL(f)
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
          const r = await fetch('/__ai/transcribe', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob })
          const data = await r.json()
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
      const photos = []
      for (const m of messages) {
        if (!m.image) continue
        const blob = await (await fetch(m.image)).blob()
        const r = await fetch('/__upload-photo', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob })
        const { path } = await r.json()
        photos.push(path)
      }
      onSave({ ...draft, photos }) // App appends, persists, and jumps to the Vault
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
            {m.image && <img className="chat-photo" src={m.image} alt="" />}
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
              {draft.music && <span className="chip music">♪ {draft.music.name}</span>}
            </div>
            <button className="save-btn" onClick={saveDraft} disabled={busy}>Save to vault</button>
          </div>
        )}

        {notice && <div className="chat-notice">{notice}</div>}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {photo && (
          <div className="composer-photo">
            <img src={photo.dataUrl} alt="" />
            <button onClick={() => setPhoto(null)}>✕</button>
          </div>
        )}
        <div className="composer-row">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          <button className="icon-btn" title="Add a photo" onClick={() => fileRef.current.click()}>📷</button>
          <button className={'icon-btn' + (recording ? ' rec' : '')} title="Record your voice" onClick={toggleRecord}>
            {recording ? '■' : '🎙'}
          </button>
          <textarea
            rows={1}
            placeholder={recording ? 'Listening…' : 'Tell me about a moment…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button className="send-btn" onClick={send} disabled={busy || (!input.trim() && !photo)}>↑</button>
        </div>
      </div>
    </div>
  )
}
