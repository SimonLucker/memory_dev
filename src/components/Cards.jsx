import { useEffect, useMemo, useState } from 'react'
import '../styles/cards.css'
import { Close } from './Icons.jsx'
import { whenToTs } from '../lib/thread.js'
import { CARDS_EMPTY, CARD_GENERATING, GIFTS_PLACEHOLDER } from '../lib/copy.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const monthYear = ts => {
  const d = new Date(ts)
  return MONTHS[d.getMonth()] + ' ' + d.getFullYear()
}

const CLASS_TITLES = {
  Travel: 'Days away',
  Family: 'Family days',
  Friends: 'With friends',
  Work: 'Days at work',
  Milestones: 'Milestones kept',
}

const top = counts => Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || []

const Gifts = () => (
  <div className="cd-gifts">
    <p className="type-label cd-quiet">Gifts</p>
    <div className="cd-glass type-label">{GIFTS_PLACEHOLDER}</div>
  </div>
)

export default function Cards({ memories, person, openMemory }) {
  // The one generatable demo card: woven from the 3-5 most recent memories
  // with photos. idle -> weaving -> grid (cover) <-> open (full card).
  const [stage, setStage] = useState('idle')
  useEffect(() => setStage('idle'), [person.id])
  useEffect(() => {
    if (stage !== 'weaving') return
    const t = setTimeout(() => setStage('open'), 2600)
    return () => clearTimeout(t)
  }, [stage])

  const chosen = useMemo(() =>
    memories.filter(m => m.photos?.length)
      .sort((a, b) => whenToTs(b.when) - whenToTs(a.when))
      .slice(0, 5),
  [memories])

  const cover = chosen[0]?.photos[0]

  const span = useMemo(() => {
    if (!chosen.length) return ''
    const ts = chosen.map(m => whenToTs(m.when))
    const a = monthYear(Math.min(...ts))
    const b = monthYear(Math.max(...ts))
    return a === b ? a : a + ' to ' + b
  }, [chosen])

  const title = useMemo(() => {
    const wheres = {}
    for (const m of chosen) wheres[m.where] = (wheres[m.where] || 0) + 1
    const [where, n] = top(wheres)
    if (n >= 2) return 'Days in ' + where
    const classes = {}
    for (const m of chosen) classes[m.class] = (classes[m.class] || 0) + 1
    return CLASS_TITLES[top(classes)[0]] || 'Kept together'
  }, [chosen])

  const summary = useMemo(() => {
    const titles = chosen.map(m => m.what)
    if (titles.length < 2) return titles[0] || ''
    return titles.slice(0, -1).join(', ') + ' and ' + titles.at(-1) + ', woven into one card.'
  }, [chosen])

  const photos = useMemo(() => chosen.flatMap(m => m.photos).slice(0, 10), [chosen])

  const coverCard = tap => (
    <div className={'cd-cover' + (tap ? ' cd-tap' : '')}
      onClick={tap ? () => setStage('open') : undefined}
      role={tap ? 'button' : undefined}>
      <img src={cover} alt="" />
      {stage !== 'weaving' && (
        <div className="cd-scrim">
          <h3 className="type-headline">{title}</h3>
          <span className="type-label">{span}</span>
        </div>
      )}
    </div>
  )

  if (stage === 'weaving') {
    return (
      <div className="cd">
        {coverCard(false)}
        <div className="cd-skel" />
        <div className="cd-skel cd-skel-short" />
        <p className="type-label cd-weavelabel">{CARD_GENERATING}</p>
      </div>
    )
  }

  if (stage === 'open') {
    return (
      <div className="cd">
        <button className="cd-close" onClick={() => setStage('grid')} aria-label="Close">
          <Close size={20} />
        </button>
        {coverCard(false)}
        <p className="type-body cd-summary">{summary}</p>
        <div className="cd-masonry">
          {photos.map(p => <img key={p} src={p} alt="" />)}
        </div>
        <p className="type-label cd-quiet">Memories</p>
        {chosen.map(m => (
          <button key={m.id} className="cd-glass cd-mrow" onClick={() => openMemory(m.id)}>
            <span className="type-body cd-mtitle">{m.what}</span>
            <span className="type-label cd-mdate">{monthYear(whenToTs(m.when))}</span>
          </button>
        ))}
        <Gifts />
      </div>
    )
  }

  if (stage === 'grid') {
    return (
      <div className="cd">
        {coverCard(true)}
        <Gifts />
      </div>
    )
  }

  return (
    <div className="cd">
      <div className="cd-empty">
        <p className="type-body">{CARDS_EMPTY}</p>
        {chosen.length >= 3 && (
          <button className="cd-weave type-label" onClick={() => setStage('weaving')}>
            Weave a card
          </button>
        )}
      </div>
      <Gifts />
    </div>
  )
}
