// The persona's avatar: saved profile picture (lib/avatar.js) or bundled
// portrait, else the initial on a surface circle. Re-renders on 'memmory:avatar'.
import { useEffect, useState } from 'react'
import { getAvatar } from '../lib/avatar.js'

export function useAvatarSrc(person) {
  const [, bump] = useState(0)
  useEffect(() => {
    const on = () => bump(t => t + 1)
    window.addEventListener('memmory:avatar', on)
    return () => window.removeEventListener('memmory:avatar', on)
  }, [])
  return getAvatar(person.id) || person.photo || null
}

export default function Avatar({ person, size = 30, onClick, className = '' }) {
  const src = useAvatarSrc(person)
  const [broken, setBroken] = useState(null) // src that failed to load, so the initial shows instead
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag className={`app-avatar ${className}`} style={{ width: size, height: size }} onClick={onClick}
      aria-label={onClick ? 'Profile' : undefined}>
      {src && src !== broken ? <img src={src} alt="" onError={() => setBroken(src)} /> : person.name[0]}
    </Tag>
  )
}
