// window.__ready = true once fonts are in, the first space load has settled
// (resolved or rejected) and two frames have painted. tools/shot.mjs waits on it.
let settle
const firstLoad = new Promise(r => { settle = r })
export const markLoaded = () => settle()

const frame = () => new Promise(r => requestAnimationFrame(r))

export async function markReady() {
  await document.fonts?.ready
  await firstLoad
  await frame(); await frame()
  window.__ready = true
}
