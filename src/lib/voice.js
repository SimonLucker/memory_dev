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
//   - DUAL CAPTURE: a real iPhone still handed back a zero-byte blob with no
//     error at all, so a WebAudio ScriptProcessor tap on the same stream runs
//     alongside and is encoded to 16-bit mono WAV at stop. The recorder blob
//     wins when it has bytes, the WAV otherwise. Which one won is remembered in
//     localStorage memmory.voiceStrategy (diagnostic only, nothing reads it).
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

// ---- Raw PCM fallback -------------------------------------------------------
// Field evidence: an iPhone that grants the mic, runs the recorder and reports
// no error still hands back a ZERO-byte blob. A WebAudio tap on the same stream
// cannot lose that audio — it reads the samples directly. So both run together
// and the recorder blob only wins when it actually has bytes.

// Float32 chunks → 16-bit mono WAV. null when every sample is digital silence
// (a truly dead mic must still be reportable as EMPTY, not as a silent file).
export function wavFromPcm(chunks, sampleRate) {
  const n = chunks.reduce((a, c) => a + c.length, 0)
  if (!n) return null
  const dv = new DataView(new ArrayBuffer(44 + n * 2))
  const tag = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  tag(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); tag(8, 'WAVEfmt ')
  dv.setUint32(16, 16, true)          // PCM header size
  dv.setUint16(20, 1, true)           // format: PCM
  dv.setUint16(22, 1, true)           // channels: mono
  dv.setUint32(24, sampleRate, true)
  dv.setUint32(28, sampleRate * 2, true) // byte rate
  dv.setUint16(32, 2, true)           // block align
  dv.setUint16(34, 16, true)          // bits per sample
  tag(36, 'data'); dv.setUint32(40, n * 2, true)
  let o = 44, silent = true
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++, o += 2) {
      const s = c[i] > 1 ? 1 : c[i] < -1 ? -1 : c[i]
      if (s) silent = false
      dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
  }
  return silent ? null : new Blob([dv.buffer], { type: 'audio/wav' })
}

// Tap the live stream into Float32 chunks. → { stop() → wavBlob|null } or null
// when WebAudio is unavailable. ScriptProcessor is deprecated but is the only
// node that works on every engine we ship to without a worklet module file.
function pcmTap(stream) {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!AC) return null
  try {
    const ctx = new AC()
    ctx.resume?.().catch(() => {})
    const src = ctx.createMediaStreamSource(stream)
    const node = ctx.createScriptProcessor(4096, 1, 1)
    const mute = ctx.createGain()
    mute.gain.value = 0 // Safari only runs the processor when it reaches the
    node.connect(mute)  // destination; a zero gain keeps it off the speaker.
    mute.connect(ctx.destination)
    const chunks = []
    node.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    src.connect(node)
    return {
      stop() {
        const rate = ctx.sampleRate
        try { src.disconnect(); node.disconnect(); mute.disconnect(); ctx.close() } catch {}
        node.onaudioprocess = null
        return wavFromPcm(chunks, rate)
      },
    }
  } catch (e) { vlog(`pcm-tap-failed ${e?.name || e}`); return null }
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

  // Second, independent capture of the SAME stream. Cheap, always on.
  const tap = pcmTap(stream)
  vlog(tap ? 'pcm-tap on' : 'pcm-tap unavailable')

  const t0 = Date.now()
  let settle
  const done = new Promise((resolve) => {
    let settled = false
    settle = (via) => {
      if (settled) return
      settled = true
      try {
        const ms = Date.now() - t0
        // Always stop the tap (it owns an AudioContext), even when unused.
        const wav = tap ? tap.stop() : null
        let blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/mp4' })
        let strategy = 'mediarecorder'
        if (!blob.size && wav) {
          blob = wav
          strategy = 'wav'
          vlog(`wav-fallback ${wav.size}B`)
        }
        // Diagnostic only: which capture path this device actually needs.
        if (blob.size) { try { localStorage.setItem('memmory.voiceStrategy', strategy) } catch {} }
        // Wall time, never blob/metadata duration: iOS reports 0 for both.
        const duration = blob.size ? Math.max(1, Math.round(ms / 1000)) : 0
        vlog(`stop-resolved ${(ms / 1000).toFixed(1)}s via=${via} bytes=${blob.size} src=${strategy}`)
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
    tap?.stop()
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
