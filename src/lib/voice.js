// Voice note recording — MediaRecorder wrapper (spec 5.3: hold to record,
// max 60s, the audio IS the message; transcription is background metadata).

import { transcribe as apiTranscribe } from './api.js'

// iOS Safari records audio/mp4 and rejects webm; Chromium the reverse. Pick a
// supported type and never pass an unsupported one (that throws on iOS).
const MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
const pickMime = () => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return MIME_CANDIDATES.find(t => { try { return MediaRecorder.isTypeSupported(t) } catch { return false } })
}

// startRecording() → { stop() → Promise<{blobUrl, duration, blob}> }.
// duration is in whole seconds. A 60s hard stop fires automatically; the
// stop() promise resolves either way, even when iOS drops the onstop event
// (1s timeslice keeps chunks flowing, a settle timeout closes the promise).
// Callers must treat a zero-size blob as a failed recording.
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = pickMime()
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
  const t0 = Date.now()
  let settle
  const done = new Promise((resolve) => {
    let settled = false
    settle = () => {
      if (settled) return
      settled = true
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/mp4' })
      resolve({ blob, blobUrl: URL.createObjectURL(blob), duration: Math.round((Date.now() - t0) / 1000) })
    }
    rec.onstop = settle
    rec.onerror = settle
  })
  const stop = () => {
    clearTimeout(hardStop)
    try { if (rec.state !== 'inactive') rec.requestData() } catch {}
    try { if (rec.state !== 'inactive') rec.stop() } catch { settle() }
    setTimeout(settle, 1200) // iOS Safari sometimes never fires onstop
    return done
  }
  const hardStop = setTimeout(stop, 60_000)
  rec.start(1000) // timeslice so a lost onstop still has the recorded chunks
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
