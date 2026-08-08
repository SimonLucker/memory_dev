// Photo path resolution — the ONE place that turns a stored photo value into
// something an <img> can load. Stored values come in three shapes: a bundled
// demo path ("photos/m001.jpg"), a dev-upload path from the vite middleware
// (same shape), or a Supabase Storage public URL (absolute, remote mode).
// A bare filename (no "photos/" prefix) is also tolerated, so anything that
// slips through un-prefixed still resolves instead of 404ing.
// Every component that renders a memory/card photo must go through this —
// never render memory.photos[i] / card.cover raw.
export function photoSrc(path) {
  if (!path) return null
  if (/^(https?:|data:|blob:)/.test(path)) return path
  return '/photos/' + path.replace(/^\/?(photos\/)?/, '')
}

// A failed photo load (missing file, stale/rotated Storage object, offline)
// must never show the browser's broken-image glyph. Swap the element's src
// to a transparent pixel and flag it with a class so CSS paints a neutral
// cream block instead (see .photo-broken in cards.css / memory.css).
const BLANK_PHOTO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
export function onPhotoError(e) {
  const img = e.currentTarget
  img.onerror = null
  img.src = BLANK_PHOTO
  img.classList.add('photo-broken')
}

// Shared photo intake: phone camera shots arrive as 4000px HEIC/JPEG monsters.
// Re-encode through a canvas — bounded JPEG (browser applies EXIF rotation while
// drawing), small enough to travel as a data URL and upload quickly.
// → Promise<dataUrl> (raw file as fallback when the browser can't decode it).
export function encodePhoto(file, maxDim = 1600, quality = 0.85) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * scale)
      c.height = Math.round(img.naturalHeight * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(file)
    }
    img.src = url
  })
}
