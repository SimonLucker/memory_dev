// Apple Music preview lookup via the public iTunes Search API — no account,
// no key. JSONP because the endpoint's CORS support is unreliable in browsers.
// → { previewUrl, artworkUrl100, trackViewUrl, trackName, artistName } | null
export function findTrack(music) {
  return new Promise(resolve => {
    const cb = '__itunes_cb_' + Math.random().toString(36).slice(2)
    const script = document.createElement('script')
    const done = result => {
      delete window[cb]
      script.remove()
      resolve(result)
    }
    window[cb] = data => done(data?.results?.[0] || null)
    script.onerror = () => done(null)
    const term = encodeURIComponent(`${music.artist || ''} ${music.name || ''}`.trim())
    script.src = `https://itunes.apple.com/search?term=${term}&media=music&limit=1&callback=${cb}`
    document.head.appendChild(script)
    setTimeout(() => window[cb] && done(null), 8000) // network dead: give up quietly
  })
}

// Fallback when the catalog lookup finds nothing: hand the search to Apple Music.
export const appleMusicSearchUrl = music =>
  `https://music.apple.com/search?term=${encodeURIComponent(`${music.artist || ''} ${music.name || ''}`.trim())}`
