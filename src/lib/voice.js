// Voice note recording — MediaRecorder wrapper (spec 5.3: hold to record,
// max 60s, the audio IS the message; transcription is background metadata).

import { transcribe as apiTranscribe } from './api.js'

// startRecording() → { stop() → Promise<{blobUrl, duration, blob}> }.
// duration is in whole seconds. A 60s hard stop fires automatically; the
// stop() promise resolves either way.
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const rec = new MediaRecorder(stream)
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  const t0 = Date.now()
  const done = new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
      resolve({ blob, blobUrl: URL.createObjectURL(blob), duration: Math.round((Date.now() - t0) / 1000) })
    }
  })
  const stop = () => {
    clearTimeout(hardStop)
    if (rec.state !== 'inactive') rec.stop()
    return done
  }
  const hardStop = setTimeout(stop, 60_000)
  rec.start()
  return { stop }
}

// transcribe(blob) → transcript text, or null on any failure. Transcription is
// background metadata and must never block or replace the audio.
export async function transcribe(blob) {
  try {
    const { transcript } = await apiTranscribe(blob)
    return transcript || null
  } catch {
    return null
  }
}
