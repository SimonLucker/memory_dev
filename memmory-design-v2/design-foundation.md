# Memmory Design Foundation v2.4

**Status: foundation + locked app structure.** v1 defined the design system. v2, written after reviewing the first working build (July 23, 2026), locks what v1 left open: navigation, view names, and per-view requirements. Sections 4, 6 and 9 are BINDING, not reference. The visual twin of this document is `design-direction-v2.html` (annotated screenshots of the current build plus target mockups). When the design changes, this document changes with it and the version bumps.

**v2.4 additions (July 23, fifth round):** Cortex connection lines have a stated FORMULA: a line exists only when two memories share a person, a place or a theme; weight scales with shared links; max three lines per node; a line always terminates exactly at the node, a floating line end is a rendering bug · Cortex nodes are technical, not playful: dark glass spheres in muted jewel colors with one specular point and a thin ring · Cortex search field moves to the BOTTOM of the view · name spelling corrected everywhere: the person is "Isabel" (the spelling "Isabelle" was wrong and is purged).

**v2.3 additions (July 23, fourth round):** Cortex connection lines are SOLID, not dashed or dotted · memory detail is categorized under small labeled sections: Feelings, People, About (About replaces "the why text" as the section name and carries story plus concrete details: what was said, what you ate, why it mattered) · a memory's media is a GRID that mixes photos and videos (for example one video plus two photos), not a single carousel only · memory actions are three: Slideshow, Add (plus icon + label), Tag people (person icon + label) · document tone rule: factual and declarative, no emotional framing, no anecdotes · the keeper question bank is presented as separate bubbles, not inline text.

**v2.2 additions (July 23, third round):** the center pane is renamed **Capture** (was Chat) · HARD RULE: saved memories never leave the thread; the current build empties the chat after saving, which is wrong, the thread is the full scrollable history with memory cards inline · Cortex nodes go premium (gradient + inner light + 3D depth; at near zoom nodes carry the memory's photo; connection lines only from mid zoom in; search field inside Cortex) · memory detail: the why text and feeling tags are part of the target view, actions are a compact "Play as slideshow" plus a labeled "Add" button with plus icon · Profile: memories + cards counts as their own big row, "View all people" link, "AI Insights" row (opens future insights view: patterns from travels, people, thoughts; printable and copyable for reflection), gauge needle floats free of the arc, profile switching acknowledged as a temporary test feature living as a "Viewing as" row inside Profile (every profile shares this same view; removed in production) · proactive keeper question bank expanded and nudges render as distinct prompt cards with quick replies.

**v2.1 additions (same day, after Simon G review):** proactive keeper specified (section 6.8) · Cortex revised: keep the first build's density, depth and connection web, darker ground, continuous gradient heat pill instead of segments (6.3) · memory detail: tappable location row that opens Maps, music row with Spotify logo and link, plus button for adding (6.4) · Profile respecified: cream, portrait, name and birth date, Top people with person colors, activity gauge (6.6) · mockups use real photos, never empty color blocks.

**How to use this document:** it is machine readable. Paste the relevant section (tokens, a component spec, a view spec, the rules) straight into your AI coding tool together with your task. Every value is exact. Nothing here requires interpretation.

**What changed v1 to v2 (summary for a quick diff):**
1. Purple night theme is out everywhere. The app runs on the light Dawn gradient. Dark exists only inside an opened memory (dusk gradient, exact values below).
2. Navigation is locked: three horizontal panes (Vault · Capture · Cards) plus a Profile sheet. The corner dropdown is deleted.
3. View names are locked: Capture (renamed from Chat in v2.2), Vault, Cortex, Cards, Profile. "Memorialize" and "Memorialization" are retired.
4. Voice is a voice NOTE, playable in the thread. Transcription is background metadata, never a replacement. This is a product rule, not a styling rule.
5. Type scale enforced: 36/22/16/13, nothing below 13 anywhere.
6. Icons: drawn line icons only. Emoji as UI is forbidden.
7. Photos always straight and full width. No tilted collages. No floating background particles.
8. New components specified: forming bar, Moment mode, lazy history, long press menus, heat bar, slideshow, Profile, On this day.

---

## 1. What Memmory should feel like

Modern. Human. Calm. This app holds people's memories, so it must feel safe to put something into it. Usability makes or breaks the product: capturing a memory must always be effortless, and the interface must never compete with the content.

Three design consequences, applied everywhere:

1. **The interface is quiet.** No accent color, no decoration, no badges fighting for attention. Hierarchy comes from the Dawn gradient, soft shadows and typography. The user's photos, videos and words are the only vivid things on screen.
2. **The AI is a keeper, not a friend.** It speaks only when it has something to say. No filler confirmations, no personality theater, no exclamation marks.
3. **Capture is sacred.** Getting something into Memmory (text, voice, photo, video) must never take more than two taps from the main screen. Anything that slows capture down is wrong by definition.

One retention principle above all mechanics: **attachment, not addiction.** People should love opening Memmory, not feel managed by it. No streak guilt, no red badges, no pressure copy. The habit loop is: one quiet daily cue (On this day), frictionless capture, a variable emotional reward (what the keeper made of it), compounding stored value.

---

## 2. Design tokens

Single source of truth. Use these exact values regardless of stack.

### 2.1 Color: the Dawn palette

There is **no accent color**. Interactive elements are identified by shape (pills, cards), elevation (shadow) and placement, not by color.

```json
{
  "gradient": {
    "top": "#C8D4EC",
    "middle": "#F5D6BC",
    "bottom": "#E0C5DC",
    "comment": "The app background for Capture and Vault (list). Cortex uses cortexDeep, opened memories and Cards use duskGradient, Profile is cream. Breathes slowly (60s cycle)."
  },
  "duskGradient": {
    "top": "#7A85A6",
    "middle": "#8D7A93",
    "bottom": "#6E5F80",
    "comment": "Inside an opened memory, the slideshow and the Cards pane. Dawn shifted toward dusk. Never flat black, never the old purple theme."
  },
  "cortexDeep": {
    "top": "#58607A",
    "middle": "#665869",
    "bottom": "#4F455C",
    "comment": "The Cortex map background only. Darker than dusk so nodes, web lines and depth read, but still derived from Dawn. Never the old purple."
  },
  "surface": {
    "white": "#FFFFFF",
    "cream": "#FAF7F2",
    "glass": "rgba(255, 255, 255, 0.72)",
    "glassOnDusk": "rgba(255, 255, 255, 0.14)",
    "comment": "Message and card surfaces. glass sits on Dawn, glassOnDusk sits on the dusk gradient."
  },
  "text": {
    "primary": "#1F2937",
    "secondary": "#6B7280",
    "tertiary": "#9CA3AF",
    "inverse": "#FFFFFF",
    "comment": "Primary for content, secondary for metadata, tertiary for timestamps only. Never lower opacity on text; use these solid values. On dusk surfaces text is inverse white, full opacity."
  },
  "ui": {
    "border": "rgba(255, 255, 255, 0.6)",
    "borderSoft": "rgba(0, 0, 0, 0.04)",
    "overlay": "rgba(0, 0, 0, 0.4)",
    "error": "#DC6B5E"
  },
  "data": {
    "heat1": "#C8D4EC",
    "heat2": "#E8CFC4",
    "heat3": "#F5D6BC",
    "heat4": "#ECB890",
    "heat5": "#DC8C5E",
    "comment": "Data color scale, cool to warm. ALLOWED ONLY for data visualization: the Cortex heat bar, the Profile year grid, Cortex node categories. Data is content, so it may have color. Interface chrome may not."
  }
}
```

Rules:
- `error` (#DC6B5E) is the only functional color. Destructive actions and failures, nowhere else.
- The purple night theme from the first build is retired completely. No screen ships with it.
- The `data` scale never appears on buttons, nav, chips, labels or any interactive chrome.

### 2.2 Typography

One typeface: **Geist** (variable, weights 400/500/600). Fallback: system sans (SF Pro on iOS, Roboto on Android).

Four roles carry the whole hierarchy. Do not invent sizes between them. **Nothing below 13 exists anywhere in the app.**

```json
{
  "roles": {
    "display":  { "size": 36, "weight": 600, "lineHeight": 1.2, "letterSpacing": -0.2, "use": "Memory titles in the detail view, big statements. The biggest text in the app." },
    "headline": { "size": 22, "weight": 600, "lineHeight": 1.2, "letterSpacing": -0.2, "use": "Card and row titles, section headers" },
    "body":     { "size": 16, "weight": 400, "lineHeight": 1.5, "letterSpacing": 0, "use": "Messages, summaries, all reading text. Weight 600 for Vault row titles." },
    "label":    { "size": 13, "weight": 500, "lineHeight": 1.5, "letterSpacing": 0, "use": "Metadata, timestamps, buttons, chips. The MINIMUM size in the app." }
  },
  "hardRules": [
    "If a screen feels crowded, remove elements. Never shrink text below these sizes.",
    "No italics. No colored or bolded single words for emphasis.",
    "No uppercase letter-spaced eyebrow labels in the app UI (MEMORIALIZATION-style headers are retired)."
  ]
}
```

### 2.3 Spacing

Base-4 scale. All padding, margins and gaps use these values only.

```json
{ "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32, "xxl": 48 }
```

- Screen edge padding: `md` (16).
- Vertical gap between messages: `sm` (8) within a group, `md` (16) between groups.
- Card inner padding: `lg` (24).

### 2.4 Radius

Everything is soft. No sharp corners exist anywhere.

```json
{ "sm": 12, "md": 18, "lg": 24, "xl": 32, "pill": 999 }
```

- Messages: `md` (18), corner nearest the sender flattened to `sm` (12).
- Cards: `lg` (24). Full screen sheets: `xl` (32) on top corners.
- Buttons, input bar, segmented controls: `pill`.

### 2.5 Elevation

```json
{
  "raised": { "y": 2, "blur": 6,  "opacity": 0.05, "use": "Chips, small controls" },
  "bubble": { "y": 4, "blur": 12, "opacity": 0.06, "use": "Messages, input bar" },
  "card":   { "y": 8, "blur": 20, "opacity": 0.08, "use": "Memory cards, sheets, overlays" }
}
```

Shadow color is always pure black at the given opacity. Never colored shadows, never glow, never particles. The drifting background dots from the first build are deleted.

### 2.6 Motion

```json
{
  "duration": { "fast": 200, "normal": 600, "slow": 900, "breathing": 60000 },
  "easing": "cubic-bezier(0.4, 0, 0.2, 1)",
  "rules": [
    "fast (200ms): state feedback, pane settle after a swipe, toggles.",
    "normal (600ms): content entering, dot-tap pane change, sheets.",
    "slow (900ms): ceremony. A memory saving, the detail view expanding from its thumbnail. This expansion IS the product feeling; if only one animation gets built, it is this one.",
    "breathing (60s): the Dawn gradient cycles imperceptibly.",
    "Pane swipes track the finger 1:1, then settle in fast (200ms).",
    "One easing curve for everything. Never linear, never spring/bounce.",
    "Text never fades out as an effect: content moves, it does not dissolve.",
    "Respect OS reduced-motion: replace movement with opacity-only transitions."
  ]
}
```

### 2.7 Iconography

Thin line icons only: **1.5px stroke, rounded caps and joins, 24px grid, color text.primary** (inverse on dusk). Touch targets minimum 44x44. No filled icons except the active state of a toggle (favorite heart). **Emoji as UI is forbidden** (the emoji camera, mic and trash in the first build must be replaced).

Required icon set: camera, mic, send (arrow up), play, pause, heart, share, plus, close, chevron left/right, search, trash, transcript (text lines), moment (concentric circle).

### 2.8 Tokens as CSS variables

```css
:root {
  --dawn-top: #C8D4EC; --dawn-mid: #F5D6BC; --dawn-bot: #E0C5DC;
  --dusk-top: #7A85A6; --dusk-mid: #8D7A93; --dusk-bot: #6E5F80;
  --surface-white: #FFFFFF; --surface-cream: #FAF7F2;
  --surface-glass: rgba(255,255,255,0.72); --surface-glass-dusk: rgba(255,255,255,0.14);
  --text-primary: #1F2937; --text-secondary: #6B7280; --text-tertiary: #9CA3AF;
  --border: rgba(255,255,255,0.6); --border-soft: rgba(0,0,0,0.04);
  --error: #DC6B5E;
  --heat-1: #C8D4EC; --heat-2: #E8CFC4; --heat-3: #F5D6BC; --heat-4: #ECB890; --heat-5: #DC8C5E;
  --space-xs: 4px; --space-sm: 8px; --space-md: 16px; --space-lg: 24px; --space-xl: 32px; --space-xxl: 48px;
  --radius-sm: 12px; --radius-md: 18px; --radius-lg: 24px; --radius-xl: 32px; --radius-pill: 999px;
  --type-display: 600 36px/1.2 'Geist'; --type-headline: 600 22px/1.2 'Geist';
  --type-body: 400 16px/1.5 'Geist'; --type-label: 500 13px/1.5 'Geist';
  --motion-fast: 200ms; --motion-normal: 600ms; --motion-slow: 900ms;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --shadow-raised: 0 2px 6px rgba(0,0,0,0.05);
  --shadow-bubble: 0 4px 12px rgba(0,0,0,0.06);
  --shadow-card: 0 8px 20px rgba(0,0,0,0.08);
}
```

---

## 3. Vocabulary (locked, use these words in code and UI)

| Term | Meaning | Never call it |
|---|---|---|
| **Message** | One unit sent into the chat: text, voice note, photo or video | Bubble, item, post |
| **Memory** | A cluster of messages captured close in time. The base unit users see | Cluster (internal only), entry |
| **Memory Card** | A curated, AI-synthesized collection spanning many memories. Shareable | Album, recap, story |
| **Capture** | The center pane. The one capture surface, one continuous thread | Chat (old working name), Memorialize, Memorialization, feed, timeline |
| **Vault** | The left pane: everything kept, as a list | Archive, history, gallery |
| **Cortex** | The map view inside Vault (toggle) | Graph, universe, brain |
| **Cards** | The right pane: Memory Cards and, later, Gifts | Collections, store |
| **Profile** | The sheet opened from the avatar | Settings, account |
| **Moment** | A user-opened capture window where everything becomes one memory | Session, event |
| **On this day** | The daily resurfaced memory card at the top of Chat | Throwback, flashback |

The mental model is a messaging app: the user sends messages to Memmory the way they send messages to a person, and the thread keeps everything, forever. "Memorialize", "Memorialization" and the working name "Chat" are retired words and must not appear anywhere in UI, code identifiers for UI copy, or marketing surfaces.

---

## 4. App structure and navigation (LOCKED)

```
                 [Profile sheet]  <- tap avatar, top left, from anywhere
                        |
  Vault  <->  Capture (HOME)  <->  Cards
  (list | Cortex toggle)
```

Requirements:
1. **Three horizontal panes.** Vault left, Capture center, Cards right. Swipe horizontally anywhere, or tap the pane dots. Panes track the finger 1:1 and settle in 200ms.
2. **Pane dots** at top center, always visible: three dots, active one solid and slightly larger, inactive at reduced size (shape difference, not opacity below 35%). Tapping a dot navigates (600ms).
3. **Capture is home.** The app always launches into Capture, keyboard ready within 2 seconds cold start. Capture is never more than one gesture away.
4. **Avatar top left** opens Profile as a sheet (radius xl top corners) over the current pane. Closing returns exactly where you were.
5. **The corner dropdown from the first build is deleted.** No dropdown menus exist anywhere in the app chrome.
6. **Person switching** (demo feature) moves into Profile as a quiet "Viewing as" row. It never appears in the main chrome and is stripped from production builds.
7. Navigation must be self-evident with zero labels explaining it. If a tester asks "where do I tap", the build has failed this section.

---

## 5. Components

### 5.1 Message (outgoing)

- Surface `white`, radius `md` with bottom-right corner `sm`, shadow `bubble`, padding `md` horizontal, `sm`+4 vertical. Max width 78% of screen. Aligned right.
- Text: `body`, text.primary.
- Photo/video: media edge to edge inside the radius, **always straight, never rotated or tilted**. Video shows a centered play glyph and duration (`label`, inverse) on a subtle dark bottom gradient.
- Voice note: play control left, static waveform bars (text.tertiary; played portion text.primary), duration right in `label`. **The audio is the message.** No transcript is shown in the thread.
- **States:** sending (small `label` "Sending" beneath in text.tertiary, never a spinner on the message) · sent (default) · failed (1px `error` border plus `label` line "Not saved. Tap to retry." in error).
- **Long press any message:** context menu with Add to a memory · Add context · Favorite · Share · Delete. Delete confirms.

### 5.2 Message (the keeper)

- Surface `glass`, geometry mirrored left. `body`, text.primary.
- Enters with 600ms rise (translateY 8px to 0 plus fade).
- The keeper writes one or two SHORT sentences, never two messages in a row, no em dashes, no exclamation marks. The current build's greeting bubble ("I'll ask a few small questions and keep this moment safe in your vault") is too long and uses an em dash: replace with copy bank strings.
- **States:** thinking (three dots pulsing 600ms, only when a reply is genuinely coming) · default.

### 5.3 Input bar

- Pill, surface `white`, shadow `bubble`, fixed above keyboard with `md` margin.
- Exactly three elements: **camera icon** (left) · **text field** (center, placeholder "What do you want to keep?") · **mic icon** (right), which becomes **send** when text exists (swap animated 200ms).
- **Camera: tap takes a photo, hold records video.** One control, both media. This replaces the separate photo-only flow in the first build.
- **Mic: hold to record a voice note** (max 60s in v1 of MVP). Recording state: bar surface shifts to `cream`, live waveform grows from left, elapsed time in `label`, slide left to cancel, release to send. Release always produces a playable voice note message. Transcription runs in the background (Whisper) and is stored as searchable metadata attached to the message. **Transcription never replaces the audio and never posts text into the thread.**
- **States:** empty (mic) · typing (send) · recording (as above) · offline (`label` line above bar: "Offline. Everything you send is kept and syncs later.", field stays active).

### 5.4 The forming bar (memory forming)

- While a memory is open (30s idle window since last message), a quiet indicator under the last message: thin progress line filling over 30s + "Keeping this together" (`label`, text.secondary) + a "Save now" pill (raised).
- Sending another message resets the line. "Save now" closes the memory immediately.
- On close, the bar settles (900ms) into a **memory summary card in the thread**: thumbnail, generated title, place. Tapping it opens the memory detail. Nothing blinks, no toasts.

### 5.5 Moment mode

- Entry: a "Moment" pill on the forming bar, or long press the send button. Starting a Moment pins a banner at the top of the thread: surface ink-deep, inverse text: "Moment · {name} · {n} kept" + "End" button. Name defaults from place/time ("Hike in the dunes", "Friday night") and is editable on tap.
- While active: **everything sent becomes one single memory**, regardless of idle gaps. The forming bar is hidden.
- Ends: manually via End, or automatically 2 hours after the last message (the keeper closes it silently and the summary card lands in the thread).
- Auto-suggest: if the user sends 5+ photos within 10 minutes without a Moment active, the keeper MAY ask once: "Looks like a moment. Keep it together as one?" (max once per day).

### 5.6 Thread history and cache (HARD RULE)

- **Saved memories never leave the thread.** The current build empties the chat when a memory saves. That is wrong and must change: like any messaging app, the thread is the full history. When a memory closes, its summary card appears inline and everything sent stays exactly where it was.
- The thread is infinite: everything ever sent stays reachable by scrolling up.
- Virtualized list. History loads in month pages from local cache/backend as the user scrolls up, showing `cream` skeleton shimmer placeholders (900ms cycle), never spinners.
- Month headers ("March 2026", `label`, text.secondary) are sticky while scrolling through that month.
- Scroll position is always preserved on load-in; content never jumps.

### 5.7 Buttons, chips, feedback

- **Primary:** pill, white, shadow raised, `label` 500, text.primary. Press: scale 0.97, 200ms. Never a color change. Max one primary per context.
- **Quiet:** text-only `label` in text.secondary. On dusk: glassOnDusk pill, inverse text.
- **Destructive:** as primary with `error` text, always behind a confirm.
- **Chips** (people, places, feelings, song): pill, `cream` surface (glassOnDusk on dusk), borderSoft 1px, `label`. **Neutral always: the green chips and green section labels from the first build are retired.** Chips never use the data scale.
- Success is silent or tiny ("Kept." as a keeper message only when meaningful). Errors are calm, on the affected element only. Skeletons in cream, no spinners on content.

---

## 6. View specifications (BINDING)

### 6.1 Capture (center pane, home)

- Dawn gradient background, breathing.
- Chrome: avatar (top left, 30px circle) + pane dots (top center). **Nothing else.** No permanent header, no eyebrow label, no title block: the thread starts at the top of the safe area.
- The greeting "Keep a moment, Simon." is the keeper's message (first open of the day), inside the thread, not a header.
- Contains: keeper messages, user messages, memory summary cards (permanently, inline, see 5.6), month dividers, the forming bar, Moment banner when active, On this day card (see 6.7), proactive prompt cards (see 6.8), input bar.
- Asking: the user asks questions in the same input ("when were we in Bled?"). Answers arrive as keeper messages with 0 to 2 memory summary cards.
- The avatar and pane dots keep clear air: thread content starts well below the top chrome and never collides with it. **The Capture thread is the only conversational surface in the app.**

### 6.2 Vault (left pane, list view)

- Top: pane dots chrome + segmented control [ List | Cortex ] (pill, white active segment) + search field ("Find a memory") with a heart filter button for favorites and sort control.
- **A row is exactly four elements:** thumbnail (56px, radius sm, straight) · title (`body` weight 600, max 1 line) · one metadata line ("Dec 27 · Luang Prabang", `label`, text.secondary) · heart icon ONLY if favorited.
- Forbidden on rows: quotes, feeling chips, people chips, audio chips, category dots, trash icons. All of that lives inside the memory.
- Roughly four rows visible per screen. Long press a row: Favorite · Add to a Card · Share · Delete (confirm: "This memory will be gone. That is the one thing Memmory cannot undo.").
- Scrolling loads history with the same cache behavior as chat (6.6/5.6): month pages, shimmer, sticky headers.

### 6.3 Cortex (map view, toggled inside Vault)

**The blend rule:** the first build's density, depth and connection web are RIGHT and must be kept (it should feel advanced, it is a signature view). What v2 adds is legibility. Do not simplify the field; clean the labels and the timeline.

- Same pane, same segmented control, flipped state.
- **Background: the cortexDeep gradient** (#58607A → #665869 → #4F455C). Darker than the rest of the app so the field reads. Never the old purple theme.
- **Dense node field with the connection web.** Many nodes visible, solid connection lines between related memories (1px, rgba(255,255,255,0.25)). The web is what makes it feel alive: it stays. Parallax depth on drag stays.
- **Heat pill** replaces the old wiggly timeline: ONE continuous rounded bar (height 12-14, radius pill) across the top with a smooth gradient through the `data` heat scale, warm where capture was dense, cool where it was quiet. No segments, no gaps, no blobs. Dragging along it travels in time. Year labels in `label` beneath, at most 4 visible.
- **Semantic zoom, three levels.** Far: constellations with theme labels (Travel, People, Work). Mid: clusters, only the largest nodes labeled. Near: individual memories with title labels. Zoom level decides label density.
- **Label rules (hard):** max 7 labels on screen at any zoom. Priority: favorites, node size, recency. Labels render on white pills (`label`, text.primary, radius pill, shadow raised). A label never overlaps a node or another label, never repeats, and either fits fully on screen or does not render.
- **Nodes are dark glass spheres, technical rather than playful:** muted jewel color by category (steel blue, copper, mauve, rose: the data scale desaturated toward the cortexDeep ground), one small specular point, a thin 1px light ring, deep drop shadow. No candy gloss, no toy pastels.
- **At near zoom, nodes carry the memory's photo:** circular photo nodes with a light ring, title label beneath. The map becomes your life in pictures up close.
- **Connection lines have a stated logic.** A line exists only when two memories share at least one of: a person, a place, a theme. Weight scales with the number of shared links (1 link: rgba(255,255,255,0.25) · 2: 0.4 · 3+: 0.55). Each node renders at most its three strongest connections. Lines are SOLID, 1px, never dashed or dotted.
- **A line always terminates exactly at the node.** A line ending in empty space is a rendering bug, not a style.
- **Connection lines appear only from mid zoom in.** The far view is clean constellations, no lines.
- **Search inside Cortex:** a search field at the BOTTOM of the view ("Search your memories") that finds and centers matching nodes. Search filters the map; conversational answers live only in Capture.
- Tap a node: it scales up and shows its summary card next to it. Tap the card to open the memory. Tap free space to release.
- **Floating background dust particles are deleted. The "Ask your memories" input is removed from Cortex** (asking lives in Chat). In its place: quiet filter chips (People · Places · Feelings · Years), glassOnDusk surface.

### 6.4 Memory detail (opened memory)

- **A scene change, not a floating card.** Full screen on the dusk gradient. The map or list never bleeds through. Opens with the 900ms expansion from its thumbnail; closing reverses it (swipe down or close icon in chrome, never on the photo).
- Top to bottom:
  1. **Media grid:** hero on top (full width, straight, radius lg), thumbnails beneath in a row. Mixes photos and videos (a video thumb shows a play glyph and duration). Tap any item for the edge-to-edge viewer. A memory with one item shows only the hero.
  2. **Title** in `display`, inverse. The biggest text in the app.
  3. **Location row, tappable:** pin icon + "Vernazza, Italy · June 2026" + a "Maps" affordance. Tapping opens the location in the maps app (Apple Maps default on iOS, Google Maps if installed). Location is a first-class fact, not buried metadata.
  4. **Voice notes** as playable rows (glassOnDusk): play, waveform, duration. A quiet "View transcript" per note reveals the text inline for those who want it.
  5. **Music row, upgraded:** play symbol + song and artist + the Spotify logo + an open link. One tap plays the snippet, the logo link opens the track in Spotify. The song is part of the memory.
  6. **Labeled sections.** Content is categorized under small neutral section labels (13, inverse, uppercase allowed here): **Feelings** (chips: Calm, Grateful), **People** (chips: Isabel), **About**. Chips are glassOnDusk, inverse text, no colors.
  6b. Correct name spelling matters: the person is "Isabel", never "Isabel". Person names come from the people registry, never free text per memory.
  7. **About** in `body`, inverse, max ~70ch: the story plus the concrete details worth keeping. What was said, what you ate, why it mattered. The keeper may add short factual insight lines here ("Isabel found the pasta place by the harbor").
  8. **Actions, three compact pills, centered:** "Slideshow" (white) · "Add" (glassOnDusk, plus icon + label) · "Tag people" (glassOnDusk, person icon + label). The About text (7) and the labeled sections (6) are visible parts of this view.
- **Add to this memory (via the plus):** photos, voice notes or a line of text appended afterwards. New items enter the carousel/rows with a 600ms rise.
- **Long press any photo:** Add context · Set as cover · Share · Remove.
- **Slideshow:** full screen on dusk. Photos breathe (slow Ken Burns, 900ms crossfades), voice notes play in capture order underneath, the music row's song carries scenes without voice. Ends on the why text. Exit: tap.

### 6.5 Cards (right pane)

- MVP scope: the pane exists with the empty state "Your first card will be woven here." plus one generatable card for the demo.
- Cards grid: big covers (radius lg) on the pane, title + date span on a bottom scrim. Opened cards follow the Memory Card anatomy from v1 (cover · summary · insights · media masonry · voices · memories list · quiet actions), on the dusk gradient.
- Generating state: cover first, calm skeletons, one `label` line "Weaving this together." Never a percent bar.
- Gifts: a labeled quiet row ("Photo books and prints, later."), not a store, until the feature is real.

### 6.6 Profile (sheet)

Elegant and detailed, not playful. Think a calm identity page, not a stats toy.

- Opens from the avatar, xl top radius, **cream background** (#FAF7F2), white rows, over any pane. Close icon top left.
- Contents top to bottom:
  1. **Portrait photo** (circle, 72-80px, real photo) centered.
  2. **Name** (`headline`) + one line beneath: "Born May 1993 · Amsterdam · 247 memories" (`label`).
  2b. **The numbers, big:** a white row with two large figures side by side: total memories and total memory cards ("247 memories · 12 memory cards"). This sits ABOVE Top people and is the proudest stat on the page.
  3. **Top people section** (`label` header "Top people"): rows with a small color dot per person (data scale, each person keeps their color across the app, including their Cortex nodes), name, and count right-aligned. "Isabel · 84". Facts, never sentiment. Beneath the rows: a "View all people" link that opens the full people catalogue.
  3b. **AI Insights row:** icon + "AI Insights" + chevron. Opens the future Insights view: patterns the keeper has found across travels, people, feelings and thoughts over time. Insights are printable and copyable, made to be taken into reflection or a therapy session. For now the row exists and the view can be a calm empty state; the insight types are decided later.
  4. **Activity gauge:** a semicircular meter (SVG arc, stroke gradient heat1 to heat5) with an ink needle that FLOATS FREE of the arc (clear gap between needle tip and the colored arc, pivot dot at the base), a value word ("Warm week") and the streak line beneath: "Kept something 5 days in a row." Warmth, never guilt: no fire icons, no "don't break it".
  5. **Three optional questions** that sharpen the keeper (who matters, places, what to remember more of). Skippable forever, answers editable.
  6. Boring rows: Face ID lock toggle, "Private by default. Your memories are never posted anywhere.", sign out.
  7. **"Viewing as" row:** the profile switcher is temporary (test phase). It lives here as a quiet row (current profile + dropdown), not in the main chrome. Every profile gets this same Profile view. Removed in production.
- The week-grid idea from v2.0 is dropped from Profile (read as too playful). The gauge plus Top people carry the numbers.

### 6.7 On this day (retention surface)

- At most ONE card per day, placed by the keeper at the top of the chat in the morning: small memory summary card labeled "A year ago today" (`label`).
- Tap opens the memory. Swipe dismisses. It disappears by noon either way. Never a push notification barrage: at most one quiet notification per day, and it is this.
- **Golden moment coaching:** if a user sends photos but no voice within a memory, the keeper MAY ask once "Want to say what this was?" Max once per day total. Never twice on the same memory.

### 6.8 The proactive keeper (context-aware nudges)

The keeper can open the conversation, not just answer. Purpose: nudge people to keep more, at the moment life is happening. This is a signature capability and it must stay gentle.

**Presentation:** a proactive question renders as a distinct **prompt card** in the thread: glass surface, the question in body size, two quick replies beneath ("Keep this" / "Later", or "Answer" / "Later"). Swipe dismisses it. It looks related to, but not identical to, a normal keeper message: the user learns to recognize an invitation.

**The question bank (calibrated examples, rotate, never repeat within a week):**
- "How do you feel today?"
- "What are you doing right now?"
- "What did you do today?"
- "Want to take a picture?"
- "Want to remember this moment forever?"
- "What is something you have been thinking about lately?"
- After training or sport (motion/health signal, if permitted): "How was the workout?"
- Mood, doing, places, thoughts, training: always ONE question, always skippable.

**Triggers (each fires as ONE prompt card in the thread):**
1. **Return to a known place:** the user is at a location where memories already exist. "You were here last week. What brings you back today?"
2. **Long dwell at a new place:** 2+ hours somewhere new (a trailhead, a venue, a city). "Don't forget to keep this."
3. **Quiet check-in:** an evening without any capture, at most twice a week. "How do you feel today?"
4. **Golden moment coaching** (6.7): photos without voice.

**Hard caps (non-negotiable):**
- Max 2 proactive keeper messages per day in the chat, total across all triggers.
- Max 1 push notification per day, total (On this day OR one location nudge, never both).
- Quiet hours 22:00 to 08:00: nothing fires.
- The same trigger never fires twice in the same week for the same place.
- Every proactive message is dismissible with a swipe and never repeats after dismissal.
- Quick replies under a nudge: "Keep this" (opens capture) and "Later" (dismisses). Nothing else.

**Privacy line:** location processing for triggers happens on device. Location data is never used for anything except the user's own memories and nudges. This sentence also lives in Profile.

**Tone:** every nudge is a question or a quiet reminder, never a demand, never guilt ("you haven't saved anything in 3 days" is banned).

---

## 7. Voice and microcopy

Position (locked): **Memmory is not a friend. Memmory is a keeper. It speaks only when there is something to say.**

- Short declarative sentences. Warm, calm, never eager. No exclamation marks anywhere in the UI.
- Mechanics over mood ("Kept.", never "Yay! Saved! 🎉").
- No emoji in system copy. **No em dashes anywhere** (the current build's placeholder "Find a memory — a" and the greeting bubble violate this).
- The user's content is "your memories", never "content", "data" or "items".

Copy bank (English, approved tone):

| Moment | Copy |
|---|---|
| Daily greeting (keeper message) | Keep a moment, Simon. |
| Proactive: known place | You were here last week. What brings you back today? |
| Proactive: long dwell | Don't forget to keep this. |
| Proactive: quiet check-in | How do you feel today? |
| Proactive quick replies | Keep this · Later · Answer |
| Proactive: check-in variants | What are you doing right now? · What did you do today? · Want to take a picture? · Want to remember this moment forever? · What is something you have been thinking about lately? |
| Location row link | Maps |
| Music row link | Open |
| Input placeholder | What do you want to keep? |
| Memory saved (only when meaningful) | Kept. |
| Forming bar | Keeping this together |
| Forming bar action | Save now |
| Moment banner | Moment · Hike in the dunes · 14 kept |
| Moment end action | End |
| Moment auto-suggest | Looks like a moment. Keep it together as one? |
| Card generating | Weaving this together. |
| Cards empty state | Your first card will be woven here. |
| Gifts placeholder | Photo books and prints, later. |
| Empty chat, first open | Send something you want to remember. |
| Empty vault | Your memories will live here. |
| Search placeholder | Find a memory |
| Search, no result | Nothing kept about that yet. |
| Voice transcript reveal | View transcript |
| Slideshow action | Play as slideshow |
| On this day label | A year ago today |
| Coaching prompt (max 1/day) | Want to say what this was? |
| Presence line | You kept something 5 days in a row. |
| Privacy row | Private by default. Your memories are never posted anywhere. |
| Failed send | Not saved. Tap to retry. |
| Offline | Offline. Everything you send is kept and syncs later. |
| Delete confirm | This memory will be gone. That is the one thing Memmory cannot undo. |

---

## 8. The rule sheet (paste this into every AI prompt)

```
MEMMORY DESIGN RULES (non-negotiable)
1.  Font: Geist only, weights 400/500/600. Four sizes: 36/22/16/13.
    NOTHING below 13. No italics, no uppercase eyebrow labels.
2.  Light app: Dawn gradient (#C8D4EC -> #F5D6BC -> #E0C5DC) + white/cream
    surfaces + slate text (#1F2937). Purple theme is retired. Dark exists in
    exactly two places: an opened memory (dusk #7A85A6 -> #8D7A93 -> #6E5F80)
    and the Cortex map (deep #58607A -> #665869 -> #4F455C). Profile is cream.
3.  No accent color. Only functional color: error #DC6B5E. Data color scale
    (heat1-5) allowed ONLY for heat bar, year grid, cortex nodes. Never on chrome.
4.  Full saturation text. Never opacity/rgba on text color. Hierarchy through
    size, weight, elevation.
5.  Everything rounded: radius 12/18/24/32/pill. Shadows soft, neutral. No glow,
    no colored shadows, no floating particles.
6.  Motion: 200/600/900ms, one easing cubic-bezier(0.4,0,0.2,1). No bounce.
    Panes track the finger, settle 200ms. Text never fades out as an effect.
7.  Navigation: three panes (Vault | Capture | Cards) + pane dots + Profile sheet
    from the avatar. No dropdowns anywhere. Chat is home and launch screen.
8.  Names: Capture, Vault, Cortex, Cards, Profile, Moment. "Memorialize",
    "Memorialization" and the old working name "Chat" are retired.
8b. Saved memories NEVER leave the thread. The thread is the full scrollable
    history with memory summary cards inline. Emptying the chat on save is a bug.
9.  Capture in max two taps. Camera: tap photo, hold video. Mic: hold records a
    playable voice note; transcription is background metadata, NEVER shown as
    the message and never replacing audio.
10. Photos and videos always straight, full width, rounded. Never tilted.
    Controls never float on top of photos.
11. Icons are 1.5px line drawings on a 24px grid, ink colored, 44px targets.
    Emoji as UI is forbidden.
12. The keeper speaks rarely and briefly. No exclamation marks, no emoji, no em
    dashes in UI copy. Spec every state: default, pressed, loading, empty,
    error, offline (use the copy bank).
13. Proactive keeper: max 2 nudges/day in chat, max 1 push/day, quiet hours
    22-08, always dismissible, questions never demands. Location on device.
14. Mockups and design surfaces always use real photos, never empty color
    blocks, so decisions are made against reality.
15. When in doubt: quieter, softer, slower, bigger type, fewer elements.
    The memories are the interface.
```

---

## 9. Build order (agreed July 23, 2026)

**Pass 1, the reset:** Dawn palette everywhere · type scale 36/22/16/13 · three-pane nav + dots, dropdown deleted · line icons replace emoji · photos straight and full width · background dust deleted · locked names (Capture, Vault, Cortex, Cards) · voice notes recorded and playable with background transcription · the thread keeps its history (5.6).

**Pass 2, the mechanics:** forming bar + Save now · infinite chat scroll with cached month pages · memory detail rebuilt (dusk scene, carousel, display title, Maps location row, Spotify music row, voice rows + transcript, neutral chips, why text, plus button) · long press menus · Vault rows to four elements · Cortex (cortexDeep ground, premium 3D nodes, photo nodes at near zoom, search field, gradient heat pill, lines from mid zoom, label rules, ask-bar removed) · Add to this memory.

**Pass 3, the magic:** Moment mode + auto suggest · proactive keeper (place, dwell, check-in, with the 6.8 caps) · Play as slideshow · On this day · Profile (portrait, counts row, Top people + View all, activity gauge, AI Insights row, Viewing as) · Cards pane with first woven card · semantic zoom in Cortex · widget + share sheet capture.

---

## 10. Document tone

All handoff text (this file and the visual document) is factual and declarative: state how it looks and what changes. No emotional framing, no anecdotes, no self-reference. Lists of examples render as separated bubbles or rows, never inline text walls. No orphan words at line ends (text-wrap pretty/balance).

## 11. Handoff mechanics

- **This file is the master.** Version at top bumps on every change. The visual twin for humans is `design-direction-v2.html` in the same folder (open it in a browser; screenshots annotated with what changes and target mockups per view).
- The Expo prototype (`app/`) implements most of section 5 in its pre-pane form; where a spec detail is ambiguous, this document wins over the prototype from v2 onward. Tokens in code: `app/src/constants/theme.ts` (update dusk + heat values from 2.8).
- **Open items, decided by Simon G:** final Memory Card layout details, Gifts commerce flow, notification strategy beyond On this day. Ask before inventing in these areas; everything else in this document you can build on without checking.

*v2.4, 2026-07-23. Build review plus four same-day review rounds. Sections 4, 6 and 9 are binding.*
