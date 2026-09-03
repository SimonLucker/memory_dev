// Scenes for the verification loop (ARCHITECTURE.md section 6).
// Extra fields are read by src/capture/index.jsx only: `thread` rows follow
// the seeded memory cards, `rec` fakes the recording bar, `bigButtons`
// overrides the profile setting. A showcase never writes: the thread lives in
// component state, and a Save now keeps its memory there too.
const base = { persona: 'p5', tab: 'home', stack: [], sheet: 'capture' }
const photo = (id, src) => ({ id, kind: 'user-photo', src })

export const scenes = {
  default: base,
  open: base,
  forming: { ...base, thread: [photo('sc_photo1', '/photos/isabel/mem-12.jpg'), photo('sc_photo2', '/photos/isabel/rest-1.jpg')] },
  recording: { ...base, rec: true },
  'big-buttons-off': { ...base, bigButtons: false },
}
