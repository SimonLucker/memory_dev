// Profile picture store. The pointer lives in the profiles backend (Supabase
// table / dev middleware) so it follows the person across devices and deploys;
// localStorage is only the synchronous cache in front of it. Changes broadcast
// as a window CustomEvent 'memmory:avatar' { personId, url }.
import { uploadPhoto, loadProfile, upsertProfile } from './api.js'

const key = pid => 'memmory.avatar.' + pid

export const getAvatar = pid => localStorage.getItem(key(pid)) || null

export function setAvatar(pid, url) {
  localStorage.setItem(key(pid), url)
  window.dispatchEvent(new CustomEvent('memmory:avatar', { detail: { personId: pid, url } }))
  // data: URLs are the offline fallback and too big for a jsonb row; they stay local.
  if (!url.startsWith('data:')) upsertProfile(pid, { avatar: url }).catch(() => {})
}

// Pull the durable pointers into the local cache (App calls this once on
// mount). Anything the backend knows wins over a stale or missing cache.
export async function syncAvatars(personIds) {
  for (const pid of personIds) {
    const p = await loadProfile(pid)
    if (p?.avatar && p.avatar !== localStorage.getItem(key(pid))) {
      localStorage.setItem(key(pid), p.avatar)
      window.dispatchEvent(new CustomEvent('memmory:avatar', { detail: { personId: pid, url: p.avatar } }))
    }
  }
}

// Picked image file → centered-square 256px jpeg blob (cheap to store and load).
async function squareBlob(file, size = 256) {
  const img = await createImageBitmap(file)
  const s = Math.min(img.width, img.height)
  const c = document.createElement('canvas')
  c.width = c.height = size
  c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
}

// → durable URL via the shared photo pipeline; offline fallback is a data: URL
// so the avatar still works (localStorage holds it either way).
export async function uploadAvatar(file) {
  const blob = await squareBlob(file)
  try {
    return await uploadPhoto(blob)
  } catch {
    return new Promise(r => {
      const fr = new FileReader()
      fr.onload = () => r(fr.result)
      fr.readAsDataURL(blob)
    })
  }
}
