// The copy bank. v3 strings (design-foundation-v3.md section 7) are at the top;
// the v2.4 strings the capture engine still reads follow. Strings are VERBATIM.
// ALL UI copy anywhere in the app must come from this module. No em dashes,
// no exclamation marks, no emoji, ever.

// ---- v3 (section 7 of design-foundation-v3.md) ----
export const GREETING_MORNING = 'Good morning.'
export const GREETING_AFTERNOON = 'Good afternoon.'
export const GREETING_EVENING = 'Good evening.'
export const YEAR_AGO_LABEL = 'A year ago today'
export const QUESTION_LABEL = 'A question for you'
export const CONTRIBUTED = (name, place) => `${name} added to your memory · A few more moments from ${place}.`
export const LATEST_LABEL = 'Latest'
export const SEE_ALL = 'See all'
export const MEMORIES_TITLE = 'Memories'
export const MEMORIES_COUNT = n => `${n} ${n === 1 ? 'memory' : 'memories'}`
export const MEMORIES_EMPTY = 'Nothing here yet. Start capturing a memory.'
export const MEMORIES_FILTERED_COUNT = (n, total) => `${n} of ${total} memories`
export const MEMORIES_NO_MATCH = 'No memories match that.'
export const CLEAR_FILTER = 'Clear'
export const TRANSCRIPT_LABEL = 'What you said'
export const TRANSCRIBING = 'Listening…'
export const VOICE_OTHER = name => `${name} said`
export const SONG_LABEL = 'Playing then'
export const SONG_ADDED_BY = name => `${name} added the song`
export const RELATED_LABEL = 'Related memories'
export const ANSWER_PLACEHOLDER = 'What do you remember?'
export const ANSWER_ACTION = 'Save'
export const ANSWERED = 'Saved.'
export const RECAP_BUTTON = 'Watch the story'
export const EVERYONE = 'Everyone'
export const FILTERED_HEADING = name => `${name}'s memories`
export const FILTERED_HEADING_YOU = 'Your memories'
export const DELETED_MEMORY = 'This memory is gone.'
export const CAPTURE_TITLE = 'Capture'
export const BIG_BUTTON_TALK = 'Hold to talk'
export const BIG_BUTTON_CAMERA = 'Camera'
export const SAVED = 'Saved'
export const SAVED_ONE_MEMORY = 'Saved as one memory'
export const FIRST_LAUNCH = 'What do you want to remember? Send a photo, voice note or thought.'
export const ASK_FOUND = 'I found one.'
export const ASK_NOTHING = "I couldn't find anything about that yet."
export const SAVE_AS_MEMORY = 'Save as a memory'

// ---- v2.4 strings the capture engine and legacy surfaces still read ----

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
export const FORMING_BAR = n => `${n} ${n === 1 ? 'moment' : 'moments'} · one memory`
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

// Keeper interview after a memory saves (max two questions, one at a time)
export const ASK_WHO = 'Who was with you?'
export const ASK_WHERE = 'Where was this?'

// States
export const FAILED_SEND = 'Not saved. Tap to retry.'
// Voice failures name their reason on the label line (5.1 failed state).
export const VOICE_MIC_OFF = 'Microphone is off. Hold to try again.'
export const VOICE_EMPTY = 'Nothing was recorded. Hold to try again.'
export const VOICE_UPLOAD_FAILED = 'Not saved. Tap to retry.'
export const OFFLINE = 'Offline. Everything you send is kept and syncs later.'
export const DELETE_CONFIRM = 'This memory will be gone. That is the one thing Memmory cannot undo.'
