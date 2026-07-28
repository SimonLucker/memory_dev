// The copy bank — design-foundation.md v2.4, section 7. Strings are VERBATIM.
// ALL UI copy anywhere in the app must come from this module. No em dashes,
// no exclamation marks, no emoji, ever.

// Daily greeting (keeper message, first open of the day)
export const GREETING = 'Keep a moment, Simon.'

// Proactive keeper (6.8)
export const NUDGE_KNOWN_PLACE = 'You were here last week. What brings you back today?'
export const NUDGE_LONG_DWELL = "Don't forget to keep this."
export const NUDGE_CHECK_IN = 'How do you feel today?'
export const CHECK_IN_VARIANTS = [
  'What are you doing right now?',
  'What did you do today?',
  'Want to take a picture?',
  'Want to remember this moment forever?',
  'What is something you have been thinking about lately?',
]
// After training or sport (motion/health signal, if permitted), section 6.8 bank
export const NUDGE_WORKOUT = 'How was the workout?'

// Proactive quick replies
export const QUICK_REPLY_KEEP = 'Keep this'
export const QUICK_REPLY_LATER = 'Later'
export const QUICK_REPLY_ANSWER = 'Answer'

// Memory detail
export const LOCATION_LINK = 'Maps'
export const MUSIC_LINK = 'Open'
export const VIEW_TRANSCRIPT = 'View transcript'
// Spec conflict: section 7 says 'Play as slideshow', binding 6.4 (newer) names
// the pill 'Slideshow'. 6.4 wins; flagged to Simon G for the next spec bump.
export const SLIDESHOW_ACTION = 'Slideshow'

// Capture
export const INPUT_PLACEHOLDER = 'What do you want to keep?'
export const FORMING_BAR = 'Keeping this together'
export const FORMING_BAR_ACTION = 'Save now'
export const MOMENT_END_ACTION = 'End'
export const MOMENT_AUTO_SUGGEST = 'Looks like a moment. Keep it together as one?'
export const EMPTY_CAPTURE = 'Send something you want to remember.' // empty thread, first open

// Cards
export const CARD_GENERATING = 'Weaving this together.'
export const CARDS_EMPTY = 'Your first card will be woven here.'
export const GIFTS_PLACEHOLDER = 'Photo books and prints, later.'

// Vault + search
export const EMPTY_VAULT = 'Your memories will live here.'
export const SEARCH_PLACEHOLDER = 'Find a memory'
export const SEARCH_NO_RESULT = 'Nothing kept about that yet.'
// Cortex search field, section 6.3 (binding view spec, not in the 7 table)
export const CORTEX_SEARCH_PLACEHOLDER = 'Search your memories'

// Retention
export const ON_THIS_DAY_LABEL = 'A year ago today'
export const COACHING_PROMPT = 'Want to say what this was?' // max 1/day
export const PRESENCE_LINE = 'You kept something 5 days in a row.'

// Profile
export const PRIVACY_ROW = 'Private by default. Your memories are never posted anywhere.'

// States
export const FAILED_SEND = 'Not saved. Tap to retry.'
export const OFFLINE = 'Offline. Everything you send is kept and syncs later.'
export const DELETE_CONFIRM = 'This memory will be gone. That is the one thing Memmory cannot undo.'
