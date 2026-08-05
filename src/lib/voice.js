// Voice note recording — MediaRecorder wrapper (spec 5.3: hold to record,
// max 60s, the audio IS the message; transcription is background metadata).
//
// Hardened for real iOS Safari after four field recordings died at 0:00:
//   - getUserMedia runs inside the gesture (the caller holds the mic button);
//     a denial is reported with a reason, never as silence.
//   - MediaRecorder starts WITHOUT a timeslice. iOS cannot cut audio/mp4 into
//     streamable chunks, so start(1000) yields empty ondataavailable events and
//     the final blob comes out zero-byte. One chunk at stop is the only shape
//     that works on both engines.
//   - stop() calls requestData() and then resolves on onstop OR a 1600ms
//     timeout, whichever lands first, with whatever chunks exist. iOS drops
//     onstop often enough that waiting for it loses real audio.
//   - duration is measured wall time. Recorded-blob metadata reports 0 on iOS
//     (that is literally what the 0:00 rows were), so it is never consulted.
//   - tracks are always released, on every path.
//
// Every stage lands in voiceLog (also on window.__memmory.voiceLog) so a remote
// tester can read the exact failure stage out of the console. No UI exposure.

import { transcribe as apiTranscribe } from './api.js'

// ---- Diagnostics ring buffer ------------------------------------------------

const LOG_MAX = 60
export const voiceLog = []
export function vlog(stage) {
  const line = `${new Date().toISOString().slice(11, 23)} ${stage}`
  voiceLog.push(line)
  if (voiceLog.length > LOG_MAX) voiceLog.splice(0, voiceLog.length - LOG_MAX)
  // keeper.js assigns window.__memmory at import time, so re-attach on every
  // write instead of once at module load; either import order works.
  if (typeof window !== 'undefined') {
    window.__memmory = window.__memmory || {}
    window.__memmory.voiceLog = voiceLog
  }
  return line
}
if (typeof window !== 'undefined') vlog('voice-log ready')

// Failure reasons carried on the thrown error / returned result, so the thread
// row can name what went wrong instead of showing a bare failed state.
export const REASON = { PERMISSION: 'permission', RECORDER: 'recorder', EMPTY: 'empty' }

// iOS Safari records audio/mp4 and rejects webm; Chromium the reverse. Pick a
// supported type and never pass an unsupported one (that throws on iOS).
const MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
const pickMime = () => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return MIME_CANDIDATES.find(t => { try { return MediaRecorder.isTypeSupported(t) } catch { return false } })
}

const fail = (reason, detail) => {
  const e = new Error(detail || reason)
  e.reason = reason
  return e
}

// startRecording() → { stop() → Promise<{blobUrl, duration, blob, ms}> }.
// Throws with .reason on permission denial or a recorder that will not start.
// duration is whole seconds of wall time, at least 1 when any bytes exist.
// Callers must treat a zero-size blob as a failed recording (reason EMPTY).
export async function startRecording() {
  vlog('gesture-start')
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (e) {
    vlog(`permission-denied ${e?.name || e}`)
    throw fail(REASON.PERMISSION, e?.name)
  }
  vlog('permission-ok')

  const release = () => { try { stream.getTracks().forEach(t => t.stop()) } catch {} }

  const mimeType = pickMime()
  let rec
  try {
    rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  } catch (e) {
    release()
    vlog(`rec-construct-failed ${e?.name || e}`)
    throw fail(REASON.RECORDER, e?.name)
  }

  const chunks = []
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) { chunks.push(e.data); vlog(`chunk ${e.data.size}B`) }
    else vlog('chunk 0B')
  }

  const t0 = Date.now()
  let settle
  const done = new Promise((resolve) => {
    let settled = false
    settle = (via) => {
      if (settled) return
      settled = true
      try {
        const ms = Date.now() - t0
        const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/mp4' })
        // Wall time, never blob/metadata duration: iOS reports 0 for both.
        const duration = blob.size ? Math.max(1, Math.round(ms / 1000)) : 0
        vlog(`stop-resolved ${(ms / 1000).toFixed(1)}s via=${via} bytes=${blob.size}`)
        resolve({ blob, blobUrl: blob.size ? URL.createObjectURL(blob) : '', duration, ms })
      } finally {
        release() // always, on every path
      }
    }
    rec.onstop = () => settle('onstop')
    rec.onerror = (e) => { vlog(`rec-error ${e?.error?.name || ''}`); settle('error') }
  })

  const stop = () => {
    clearTimeout(hardStop)
    // requestData first: without a timeslice this is what flushes the buffer on
    // engines that would otherwise only emit after a delayed onstop.
    try { if (rec.state !== 'inactive') rec.requestData() } catch (e) { vlog(`requestData-threw ${e?.name || e}`) }
    try { if (rec.state !== 'inactive') rec.stop() } catch (e) { vlog(`stop-threw ${e?.name || e}`); settle('stop-threw') }
    setTimeout(() => settle('timeout'), 1600) // iOS Safari sometimes never fires onstop
    return done
  }
  const hardStop = setTimeout(stop, 60_000)

  try {
    rec.start() // NO timeslice: iOS emits empty chunks when audio/mp4 is sliced
  } catch (e) {
    release()
    vlog(`rec-start-failed ${e?.name || e}`)
    throw fail(REASON.RECORDER, e?.name)
  }
  vlog(`rec-start mime=${rec.mimeType || mimeType || 'default'}`)

  return { stop }
}

// transcribe(blob) → transcript text, or null on any failure. Transcription is
// background metadata and must never block or replace the audio.
export async function transcribe(blob) {
  try {
    const { transcript } = await apiTranscribe(blob)
    vlog(transcript ? `transcript ${transcript.length}c` : 'transcript empty')
    return transcript || null
  } catch (e) {
    vlog(`transcript-failed ${e?.message || e}`)
    return null
  }
}
