// Memory story (design-foundation-v3.md 5.3 + 5.4): one scrolling page of
// blocks in capture order, plus the people row, badges and recap pill when
// the memory is shared. Grows from its tile in 900ms when `origin` is given.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './story.css'
import Avatar from '../core/Avatar.jsx'
import { ChevronLeft, ChevronRight, Play, Pause, Mic, Spotify } from '../core/Icons.jsx'
import {
  TRANSCRIPT_LABEL, VOICE_OTHER, SONG_LABEL, SONG_ADDED_BY, RELATED_LABEL, QUESTION_LABEL,
  ANSWER_PLACEHOLDER, ANSWER_ACTION, ANSWERED, RECAP_BUTTON, EVERYONE, FILTERED_HEADING,
  FILTERED_HEADING_YOU, DELETED_MEMORY,
} from '../core/copy.js'
import { storyOf, momentsOf } from '../data/select.js'
import { findTrack, appleMusicSearchUrl, uploadAudio } from '../data/api.js'
import { photoSrc, onPhotoError } from '../lib/photos.js'
import { WAVE, fmtDur } from '../lib/thread.js'
import { startRecording, transcribe } from '../lib/voice.js'
import { getSettings } from '../lib/settings.js'
import { dateLine, composeFiltered, relatedLine } from './compose.js'

export { default as Viewer } from './Viewer.jsx'

const first = name => String(name || '').split(' ')[0]
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const asPerson = p => ({ id: p.id, name: p.name || p.id, photo: photoSrc(p.avatar_url) })

// "You" for the viewer, the first name for everyone else.
const labelOf = (p, personId) => (p?.id === personId ? 'You' : first(p?.name))

const Badge = ({ person, personId }) => person ? (
  <span className="st-badge"><Avatar person={asPerson(person)} size={16} />{labelOf(person, personId)}</span>
) : null

// A photo (or video poster) tile: tap opens the viewer at that photo's index.
function Photo({ m, cls, shared, personId, people, photos, nav, id, eager }) {
  const i = photos.indexOf(m)
  return (
    <button className={`st-photo ${cls}`} onClick={() => i >= 0 && nav.openViewer(id, i)}>
      <img src={photoSrc(m.src)} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onError={onPhotoError} />
      {shared && <Badge person={people[m.generated_by]} personId={personId} />}
    </button>
  )
}

function Video({ m, shared, personId, people }) {
  return (
    <div className="st-photo st-video">
      {m.src
        ? <video src={m.src} poster={photoSrc(m.poster)} controls playsInline preload="none" />
        : <img src={photoSrc(m.poster)} alt="" loading="lazy" onError={onPhotoError} />}
      {!m.src && <span className="st-video-play"><Play size={16} fill="#000" stroke="none" /></span>}
      {m.duration > 0 && <span className="st-video-dur">{fmtDur(m.duration)}</span>}
      {shared && <Badge person={people[m.generated_by]} personId={personId} />}
    </div>
  )
}

// Voice card: real audio when there is a file, a demo note plays nothing and never errors.
function Voice({ m, person, personId }) {
  const [playing, setPlaying] = useState(false)
  const audio = useRef(null)
  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }
  const mine = !person || person.id === personId
  return (
    <div className="st-card st-voice">
      <div className="st-voice-row">
        <button className="st-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={14} stroke="#000" /> : <Play size={14} fill="#000" stroke="none" />}
        </button>
        <span className="st-wave" aria-hidden="true">{WAVE.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</span>
        <span className="st-dur">{fmtDur(m.duration)}</span>
      </div>
      <p className="st-lbl">{mine ? TRANSCRIPT_LABEL : VOICE_OTHER(first(person.name))}</p>
      {m.transcript && <p className="st-txt">{m.transcript}</p>}
      {m.src && <audio ref={audio} src={m.src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
    </div>
  )
}

// Text card: an answer is labelled with its question, own words "What you said", others "Sam said".
function Text({ m, person, personId, question }) {
  const label = question ? question.text : !person || person.id === personId ? TRANSCRIPT_LABEL : VOICE_OTHER(first(person.name))
  return (
    <div className="st-card">
      <p className="st-lbl">{label}</p>
      <p className="st-txt">{m.text || m.transcript}</p>
    </div>
  )
}

// Song row: Spotify look, the Apple 30s preview plays inline on tap, the chevron opens the track.
function Song({ music, people, personId }) {
  const [info, setInfo] = useState(null)
  const [playing, setPlaying] = useState(false)
  const audio = useRef(null)
  useEffect(() => { if (info?.previewUrl) audio.current?.play().catch(() => {}) }, [info])
  const toggle = () => {
    const a = audio.current
    if (a) return a.paused ? a.play().catch(() => {}) : a.pause()
    if (!info) findTrack(music).then(t => setInfo(t?.previewUrl ? t : { missing: true }))
  }
  const spotify = getSettings(personId).musicService !== 'apple'
  const url = spotify
    ? 'https://open.spotify.com/search/' + encodeURIComponent(`${music.name} ${music.artist || ''}`.trim())
    : info?.trackViewUrl || appleMusicSearchUrl(music)
  const adder = music.added_by && music.added_by !== personId ? people[music.added_by] : null
  return (
    <div className="st-row">
      <button className="st-row-main" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        <span className={`st-spotify${playing ? ' on' : ''}`}>{playing ? <Pause size={14} stroke="#000" /> : <Spotify size={26} fill="var(--spotify)" stroke="#000" />}</span>
        <span>
          <span className="st-lbl">{adder ? SONG_ADDED_BY(first(adder.name)) : SONG_LABEL}</span>
          <span className="st-line">{music.name}{music.artist ? ` · ${music.artist}` : ''}</span>
        </span>
      </button>
      <a className="st-open" href={url} target="_blank" rel="noreferrer" aria-label="Open"><ChevronRight size={18} /></a>
      {info?.previewUrl && <audio ref={audio} src={info.previewUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setPlaying(false)} />}
    </div>
  )
}

function Related({ db, memory, memories, nav }) {
  const thumb = m => {
    const x = momentsOf(db, m.id).find(x => x.kind === 'photo' || x.kind === 'video')
    return x ? photoSrc(x.kind === 'video' ? x.poster : x.src) : null
  }
  return (
    <button className="st-row" onClick={() => nav.openStory(memories[0].id)}>
      <span className="st-thumbs">
        {memories.map(m => <img key={m.id} src={thumb(m)} alt="" loading="lazy" onError={onPhotoError} />)}
      </span>
      <span>
        <span className="st-lbl">{RELATED_LABEL}</span>
        <span className="st-line">{relatedLine(db, memory, memories)}</span>
      </span>
    </button>
  )
}

// Question card: type or hold the mic. The card keeps its box: on save the
// content swaps to "Saved." (height animates 600ms), two seconds later it
// becomes the answer card, then the real text block takes its place.
function Question({ question, answer, onSave, onDone }) {
  const [text, setText] = useState('')
  const [rec, setRec] = useState(false)
  const [phase, setPhase] = useState('ask') // ask -> saved -> done
  const handle = useRef(null)
  const card = useRef(null)
  const height = useRef(null)
  useLayoutEffect(() => {
    const el = card.current, h = el.offsetHeight, was = height.current
    height.current = h
    if (was == null || was === h || reducedMotion()) return
    el.animate([{ height: `${was}px` }, { height: `${h}px` }], { duration: 600, easing: EASE })
  }, [phase])
  useEffect(() => {
    if (phase === 'ask') return
    const t = setTimeout(phase === 'saved' ? () => setPhase('done') : onDone, phase === 'saved' ? 2000 : 600)
    return () => clearTimeout(t)
  }, [phase])
  const commit = (t, voice) => {
    answer(question.id, voice ? { text: t, voice } : { text: t })
    setText(t)
    setPhase('saved')
    onSave()
  }
  const save = () => { const t = text.trim(); if (t) commit(t) }
  const micDown = async e => {
    e.preventDefault()
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch {}
    try { handle.current = await startRecording(); setRec(true) } catch { handle.current = null }
  }
  const micUp = async () => {
    const h = handle.current
    handle.current = null
    setRec(false)
    if (!h) return
    const { blob, duration } = await h.stop()
    if (!blob?.size) return
    const [src, transcript] = await Promise.all([uploadAudio(blob).catch(() => null), transcribe(blob)])
    commit(transcript, { src, duration, transcript })
  }
  return (
    <div ref={card} className={`st-card${phase === 'ask' ? ' st-question' : phase === 'saved' ? ' st-saved' : ''}`}>
      {phase === 'ask' && (
        <>
          <div className="st-qhead"><span className="st-qmic"><Mic size={13} /></span><span className="st-lbl">{QUESTION_LABEL}</span></div>
          <p className="st-q">{question.text}</p>
          <div className="st-input">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder={ANSWER_PLACEHOLDER} />
            <button className={`st-mic${rec ? ' rec' : ''}`} aria-label="Hold to talk"
              onPointerDown={micDown} onPointerUp={micUp} onPointerCancel={micUp}><Mic size={16} /></button>
            <button className="st-save" onClick={save}>{ANSWER_ACTION}</button>
          </div>
        </>
      )}
      {phase === 'saved' && <p className="st-q">{ANSWERED}</p>}
      {phase === 'done' && <><p className="st-lbl">{question.text}</p><p className="st-txt">{text}</p></>}
    </div>
  )
}

function Back({ nav }) {
  return <button className="st-back" onClick={nav.back} aria-label="Back"><ChevronLeft size={18} /></button>
}

export default function Story({ db, personId, id, filter: initial, origin, nav, answer }) {
  const story = storyOf(db, id)
  const [filter, setFilter] = useState(initial || null)
  const [pending, setPending] = useState(null) // the question being answered while its card morphs
  const root = useRef(null)

  // Signature animation: the hero photo flies from the tile's rect into place in
  // 900ms while the ground darkens and the rest of the page settles in.
  useLayoutEffect(() => {
    const el = root.current
    if (!origin || !el) return
    el.classList.add('st-grow')
    const img = el.querySelector('.st-hero img')
    if (img && !reducedMotion()) {
      const to = img.getBoundingClientRect()
      img.animate([
        { transform: `translate(${origin.left - to.left}px, ${origin.top - to.top}px)`, width: `${origin.width}px`, height: `${origin.height}px`, borderRadius: '18px' },
        { transform: 'none', width: `${to.width}px`, height: `${to.height}px`, borderRadius: '20px' },
      ], { duration: 900, easing: EASE, fill: 'backwards' })
    }
    const t = setTimeout(() => el.classList.remove('st-grow'), 900)
    return () => clearTimeout(t)
  }, [origin])

  if (!story) {
    return (
      <div className="st" ref={root} data-scroll>
        <div className="st-head"><Back nav={nav} /><p className="st-txt">{DELETED_MEMORY}</p></div>
      </div>
    )
  }
  const { memory, shared, people: row } = story
  const people = db.people
  const photos = momentsOf(db, id).filter(m => m.kind === 'photo')
  // Chips only for people who generated a moment; tagged people without moments have nothing to filter to.
  const chips = shared ? row.filter(p => momentsOf(db, id).some(m => m.generated_by === p.id)) : []
  const isAnswer = b => b.kind === 'text' && b.moments[0].kind === 'answer'
  // Answers close the story: they sit after the song and related rows. ponytail: move this into storyOf.
  const blocks = (filter ? composeFiltered(momentsOf(db, id).filter(m => m.generated_by === filter), people) : story.blocks)
    .filter(b => b.kind !== 'question' && !(pending && isAnswer(b) && b.moments[0].question_id === pending.id))
    .sort((a, b) => isAnswer(a) - isAnswer(b))
  const question = filter ? null : pending || story.question
  const filteredBy = filter ? people[filter] : null
  const meta = filteredBy
    ? (filter === personId ? FILTERED_HEADING_YOU : FILTERED_HEADING(first(filteredBy.name)))
    : [dateLine(memory), memory.place].filter(Boolean).join(' · ')

  const render = (b, i) => {
    const m = b.moments[0]
    const ph = { shared, personId, people, photos, nav, id, eager: i < 2 }
    switch (b.kind) {
      case 'hero': return <Photo key={m.id} m={m} cls="st-hero" {...ph} />
      case 'pair': return <div key={m.id} className="st-pair">{b.moments.map(x => <Photo key={x.id} m={x} cls="st-sq" {...ph} />)}</div>
      case 'photo': return <Photo key={m.id} m={m} cls="st-lone" {...ph} />
      case 'video': return <Video key={m.id} m={m} shared={shared} personId={personId} people={people} />
      case 'voice': return <Voice key={m.id} m={m} person={people[m.generated_by]} personId={personId} />
      case 'text': return <Text key={m.id} m={m} person={people[m.generated_by]} personId={personId} question={m.question_id ? db.questions[m.question_id] : null} />
      case 'song': return <Song key="song" music={b.music} people={people} personId={personId} />
      case 'related': return <Related key="related" db={db} memory={memory} memories={b.memories} nav={nav} />
      default: return null
    }
  }

  return (
    <div className="st" ref={root} data-scroll>
      <div className="st-head">
        <Back nav={nav} />
        <div className="st-headtext">
          <h1 className="st-title">{memory.title}</h1>
          <p className="st-meta">{meta}</p>
        </div>
      </div>
      {shared && (
        <>
          <div className="st-people">
            <button className={`st-chip st-chip-text${filter ? '' : ' on'}`} onClick={() => setFilter(null)}>{EVERYONE}</button>
            {chips.map(p => (
              <button key={p.id} className={`st-chip${filter === p.id ? ' on' : ''}`} onClick={() => setFilter(p.id)}>
                <Avatar person={asPerson(p)} size={22} />{labelOf(p, personId)}
              </button>
            ))}
          </div>
          <button className="st-recap" onClick={() => nav.openRecap(id)}>
            <span className="st-play st-play-30"><Play size={12} fill="#000" stroke="none" /></span>{RECAP_BUTTON}
          </button>
        </>
      )}
      {blocks.map(render)}
      {question && <Question key={question.id} question={question} answer={answer} onSave={() => setPending(question)} onDone={() => setPending(null)} />}
    </div>
  )
}
