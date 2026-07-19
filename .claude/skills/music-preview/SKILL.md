---
name: music-preview
description: Spec for the music feature end to end — Apple-catalog lookup (api.findTrack), the inline SongRow in FocusHud, the floating mini player in App, and the Apple Music fallback. Read before touching SongRow, the App mini player, or anything calling findTrack.
---

# Music preview

A memory's `music: {name, artist}` is looked up in Apple's catalog and its 30-second preview plays inline. Three surfaces, all fed by one lookup. The lookup itself (retry ladder, why it's server-side) is documented in **backend-api** — this skill covers the playback UX.

## Lookup contract — `api.findTrack(music)`

`music` `{name, artist}` (or `null` → `null`). Returns `{ trackName, artistName, previewUrl, artworkUrl100, trackViewUrl } | null`. Best-effort: any failure resolves `null`, never throws — music must never break a save, a focus, or a vault render. A result with a `previewUrl` is "playable"; a result without one (or `null`) is "missing". Used by: FocusHud `SongRow`, App `playMusic`, and Memorialize `songCheck`.

## Inline SongRow (FocusHud.jsx)

A small player docked between the photos and the text of the focus card, scrolling with the card:
- On mount: `findTrack(music)` → `{info}` (playable) or `{missing:true}`. `live` flag guards the async set against unmount.
- **Autoplay on open**: the `<audio autoPlay>` starts the preview the moment the card opens. It's an ELEMENT, so it **stops on unmount** automatically — closing the memory (FocusHud unmounts) kills the sound, no manual teardown. `key={memory.id}` on `SongRow` forces a fresh element (and fresh autoplay) per memory.
- **iOS autoplay caveat**: mobile Safari may refuse programmatic autoplay, leaving the element paused. So the play/pause button state is DERIVED FROM THE ELEMENT, not assumed: `playing` is set by the audio's own `onPlay`/`onPause`/`onEnded` events, and `toggle()` reads `a.paused` off the live element. The button therefore shows the true state whether or not autoplay was allowed. Never track play-state independently of the element.
- Layout: artwork (`artworkUrl100`, or a ♪ dawn-gradient placeholder), track/artist text (falls back to the raw `music.name`/`music.artist` while loading or when missing — "Finding song…" / "No preview found"), the ▶/❚❚ toggle (only when playable), and an ↗ link to Apple Music.

## Floating mini player (App.jsx)

Triggered by the ▶ music chip in the **Vault** and the draft card in **Memorialize** (both call `onPlay = playMusic`). Distinct from SongRow — it's a persistent bottom-center pill (`.music-player`) that survives view changes:
- `playMusic(music)`: `setTrack({status:'loading', music})`, then `findTrack` → `{status:'ready', info}` / `{status:'missing'}`. `playing` starts `true`.
- Renders artwork + title/artist + ▶/❚❚ (`togglePlay` reads `audioRef.current.paused`) + ↗ Apple Music link + ✕ (clears `track`). `<audio autoPlay>` again = auto-teardown when `track` clears or the player unmounts.
- Only one mini player at a time; opening a new song replaces `track`.

## Apple Music fallback — `appleMusicSearchUrl(music)`

When no preview is found (or as the ↗ target when there's no `trackViewUrl`), hand off to Apple's web search: `https://music.apple.com/search?term={artist name}`. Both SongRow and the mini player use it so a missing preview still gets the user to the full song in one tap. The ↗ is always present even when playback isn't.

## MusicKit upgrade path (deliberately NOT taken)

Full in-page playback of the WHOLE song (not just the 30s preview) would need Apple MusicKit JS + an Apple Developer Program membership (paid) and a signed developer token. That was consciously skipped for the POC: the free iTunes Search API gives artwork + a 30s preview + a deep link with zero credentials and no membership. If someone asks for full-track playback, that's the jump to make — don't reach for it otherwise.
