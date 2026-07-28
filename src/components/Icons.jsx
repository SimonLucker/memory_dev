// Shared line icons — design-foundation.md 2.7: 1.5px stroke, rounded caps and
// joins, 24px grid, currentColor. The only icon source in the app.
const Icon = ({ size = 24, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
)

export const Camera = p => (
  <Icon {...p}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h6l2 3h3a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
)

export const Mic = p => (
  <Icon {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <path d="M12 18v3" />
  </Icon>
)

export const Send = p => (
  <Icon {...p}>
    <path d="M12 19V5" />
    <path d="M5 12l7-7 7 7" />
  </Icon>
)

export const Play = p => (
  <Icon {...p}>
    <path d="M7 4.5v15l12-7.5z" />
  </Icon>
)

export const Pause = p => (
  <Icon {...p}>
    <path d="M9 5v14" />
    <path d="M15 5v14" />
  </Icon>
)

const heartPath = 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z'
export const Heart = p => (
  <Icon {...p}>
    <path d={heartPath} />
  </Icon>
)
export const HeartFilled = p => (
  <Icon {...p}>
    <path d={heartPath} fill="currentColor" />
  </Icon>
)

export const Share = p => (
  <Icon {...p}>
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <path d="M8 6l4-4 4 4" />
    <path d="M12 2v13" />
  </Icon>
)

export const Plus = p => (
  <Icon {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icon>
)

export const Close = p => (
  <Icon {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Icon>
)

export const ChevronLeft = p => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)

export const ChevronRight = p => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
)

export const ChevronDown = p => (
  <Icon {...p}>
    <path d="M5 9l7 7 7-7" />
  </Icon>
)

export const Search = p => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.5-4.5" />
  </Icon>
)

export const Trash = p => (
  <Icon {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </Icon>
)

export const Transcript = p => (
  <Icon {...p}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h10" />
  </Icon>
)

export const Moment = p => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.5" />
  </Icon>
)

export const Pin = p => (
  <Icon {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </Icon>
)

export const Person = p => (
  <Icon {...p}>
    <circle cx="12" cy="7.5" r="3.5" />
    <path d="M5 21v-1.5a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5V21" />
  </Icon>
)

export const Spotify = p => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M7 9.6c3.4-1 7.2-.6 10 1.2" />
    <path d="M7.6 12.7c2.8-.8 5.7-.4 8.1 1" />
    <path d="M8.2 15.6c2.2-.6 4.4-.3 6.3.8" />
  </Icon>
)

export const AppleMusic = p => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M10 15.5V8.2l6-1.3v7.1" />
    <circle cx="8.5" cy="15.5" r="1.5" />
    <circle cx="14.5" cy="14" r="1.5" />
  </Icon>
)

export const Sparkle = p => (
  <Icon {...p}>
    <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
    <path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
  </Icon>
)
