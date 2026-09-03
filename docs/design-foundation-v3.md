# Memmory Design Foundation v3.0

**Status: the master design spec for the gallery redesign.** This version replaces v2.4 completely. The app described here is the one in the visual roadmap (`roadmap-2026-08-21.html`, live at https://memmory-design.vercel.app) and in the Expo MVP (`app/`). Where this document and the prototype disagree, this document wins.

**How to use this document:** it is machine readable. Paste the relevant section (tokens, a component spec, a screen spec, the rule sheet) straight into your AI coding tool together with your task. Every value is exact. Nothing here requires interpretation.

**What changed v2.4 to v3 (quick diff):**
1. The app no longer opens into a chat. It opens into your memories. Home is the launch screen.
2. Two color worlds. The gallery (Home, Memories, opened memories, recap) is dark: near-black ground, white text, photography carries all the color. Capture keeps the light Dawn gradient and opens as a sheet from the plus button.
3. Navigation is a bottom tab bar: Home · plus button (opens Capture) · Memories. The three horizontal panes, the pane dots and the swipe navigation from v2 are retired.
4. Vault, Cortex and Cards are retired as MVP surfaces. Memories (the photo grid) replaces Vault. Cortex and photobooks come after the MVP.
5. An opened memory is a story you scroll: photo blocks, the voice note with its transcript, the song, related memories, one question. The dusk gradient detail view from v2 is retired; the story sits on the same dark ground.
6. New surfaces: the shared memory view (people row, photo badges, person filter) and the recap player (full screen, auto-advancing).
7. All UI copy follows the copy reset (section 8): the app never talks about itself, plain beats poetic, one idea per line.
8. The capture engine itself is unchanged: same chat, same mechanics, same Dawn colors.

---

## 1. What Memmory should feel like

Modern. Human. Calm. This app holds people's memories, so it must feel safe to put something into it.

1. **The first thing you see is what you get back, never an input field.** Home leads with a finished recap, a year-ago memory, a question, or something new in a shared memory.
2. **The interface is quiet.** On the dark ground there is no accent color and no decoration. The user's photos are the only vivid thing on screen. Hierarchy comes from surface tone, size and weight.
3. **Capture is sacred.** Getting something into Memmory must never take more than two taps from anywhere. The plus button is always reachable.
4. **The intelligence is felt, never announced.** The app shows transcripts, connections and stories. It never says that it is smart, and it never speaks about itself (section 8).
5. **Attachment, not addiction.** One quiet daily cue, frictionless capture, a real emotional reward. No streaks, no red badges, no pressure copy.

---

## 2. Design tokens

Single source of truth. Use these exact values regardless of stack. Tokens in code: `app/src/constants/theme.ts`.

### 2.1 Color: the gallery (dark world)

Home, Memories, opened memories, shared memories and the recap all live here. There is **no accent color**. Photography carries all the color.

```json
{
  "gallery": {
    "ground": "#101014",
    "surface": "#1D1D25",
    "surfaceDeep": "#14141A",
    "hairline": "rgba(255,255,255,0.14)",
    "scrim": "rgba(11,11,15,0.66)",
    "comment": "ground is every gallery screen's background. surface is cards and rows. surfaceDeep is inputs inside cards. hairline is the only allowed border, used sparingly (tab bar top). scrim sits behind text on photos (badges, hero text blocks)."
  },
  "text": {
    "primary": "#FFFFFF",
    "comment": "One text color on dark. Full saturation always: never rgba, never opacity, never a gray tier. Hierarchy comes from size and weight only."
  },
  "photoScrim": {
    "value": "linear-gradient(180deg, rgba(11,11,15,0.25), rgba(11,11,15,0) 30% 55%, rgba(11,11,15,0.72))",
    "comment": "Overlay on hero photos that carry text, so white text always reads. Text never sits on a raw photo."
  },
  "functional": {
    "error": "#DC6B5E",
    "spotify": "#1DB954",
    "comment": "error for destructive actions and failures only. spotify only on the song row icon and the recap song credit, never elsewhere."
  }
}
```

### 2.2 Color: the Dawn palette (Capture sheet only)

Unchanged from v2. The Capture sheet is the only light room in the app.

```json
{
  "gradient": { "top": "#C8D4EC", "middle": "#F5D6BC", "bottom": "#E0C5DC" },
  "surface": { "white": "#FFFFFF", "cream": "#FAF7F2", "glass": "rgba(255,255,255,0.72)" },
  "text": { "primary": "#1F2937" },
  "comment": "Dawn text is slate #1F2937, full saturation. The dusk gradient and cortexDeep from v2 are retired: no screen ships with them."
}
```

### 2.3 Typography

One typeface: **Geist** (weights 400/500/600/700). Fallback: system sans.

Four roles carry the whole hierarchy. Do not invent sizes between them.

```json
{
  "roles": {
    "display":  { "size": 30, "weight": 600, "lineHeight": 1.1, "letterSpacing": -0.5, "use": "Screen titles: the Home greeting, Memories, a memory's title" },
    "headline": { "size": 20, "weight": 600, "lineHeight": 1.15, "letterSpacing": -0.3, "use": "Hero card titles, detail header titles (22 allowed there), the question text (17 allowed there)" },
    "body":     { "size": 16, "weight": 400, "lineHeight": 1.45, "letterSpacing": 0, "use": "Transcripts, chat messages, reading text. 400 default, 500 for row titles" },
    "label":    { "size": 12, "weight": 600, "lineHeight": 1.3, "letterSpacing": 0.4, "use": "Card labels (What you said, Playing then), metadata, dates, chips, buttons" }
  },
  "exceptions": [
    "Tab bar labels and photo badges render at 11 (platform convention). Nothing else goes below 12.",
    "The wordmark 'Memmory' is 16 at weight 700."
  ],
  "hardRules": [
    "Full saturation text everywhere. Hierarchy through size and weight, never through gray or opacity.",
    "No italics. No colored or bolded single words for emphasis.",
    "No uppercase letter-spaced eyebrow labels."
  ]
}
```

### 2.4 Spacing

Base-4 scale. All padding, margins and gaps use these values only.

```json
{ "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32 }
```

- Screen edge padding: `md` (16).
- Gap between blocks in a story and between cards on Home: 11 to 12 (between sm and md; pick 12 and keep it).
- Card inner padding: 14 to 16.

### 2.5 Radius

```json
{ "sm": 12, "md": 18, "lg": 24, "xl": 32, "pill": 999 }
```

- Cards, rows, photo tiles: `md` (18). Story blocks and the hero photo: 20 to 24.
- The Capture sheet: `xl` (32) on top corners.
- Buttons, chips, inputs, badges: `pill`.

### 2.6 Elevation and separation

On the dark ground, separation comes from **surface tone, not borders and not shadows**: ground #101014, card #1D1D25, input-in-card #14141A. Hairline borders are allowed only on the tab bar top edge. The raised capture button carries the one strong shadow in the gallery: `0 8px 18px rgba(0,0,0,0.45)`.

On the Dawn sheet, the v2 soft shadows still apply: bubbles `0 4px 12px rgba(0,0,0,0.06)`, big buttons `0 6px 16px rgba(0,0,0,0.10)`.

### 2.7 Motion

```json
{
  "duration": { "fast": 200, "normal": 600, "slow": 900 },
  "easing": "cubic-bezier(0.4, 0, 0.2, 1)",
  "rules": [
    "fast (200ms): state feedback, toggles, chip selection.",
    "normal (600ms): content entering, the Capture sheet presenting and dismissing, navigation pushes.",
    "slow (900ms): ceremony. A memory opening from its tile. If only one animation gets built, it is this one.",
    "Recap photos zoom slowly (Ken Burns style) for the length of the beat, crossfades 900ms.",
    "One easing curve for everything. Never linear, never spring or bounce.",
    "Text never fades out as an effect: content moves, it does not dissolve.",
    "Respect OS reduced-motion: replace movement with opacity-only transitions."
  ]
}
```

### 2.8 Iconography

Thin line icons: **1.5 to 1.8px stroke, rounded caps and joins, 24px grid**. White on the gallery, slate #1F2937 on Dawn. Touch targets minimum 44x44. Emoji as UI is forbidden. The Spotify mark is the one brand icon and appears only on song rows and the recap song credit.

Required set: home, grid (Memories), plus, chevron left, chevron down, play, pause, mic, camera, heart, share, close, search, trash.

### 2.9 Tokens as CSS variables

```css
:root {
  /* gallery */
  --ground: #101014; --surface: #1D1D25; --surface-deep: #14141A;
  --hairline: rgba(255,255,255,0.14); --scrim: rgba(11,11,15,0.66);
  --text: #FFFFFF;
  /* dawn (capture sheet) */
  --dawn-top: #C8D4EC; --dawn-mid: #F5D6BC; --dawn-bot: #E0C5DC;
  --dawn-text: #1F2937; --dawn-white: #FFFFFF; --dawn-glass: rgba(255,255,255,0.72);
  /* functional */
  --error: #DC6B5E; --spotify: #1DB954;
  /* scale */
  --space-xs: 4px; --space-sm: 8px; --space-md: 16px; --space-lg: 24px; --space-xl: 32px;
  --radius-sm: 12px; --radius-md: 18px; --radius-lg: 24px; --radius-xl: 32px; --radius-pill: 999px;
  --type-display: 600 30px/1.1 'Geist'; --type-headline: 600 20px/1.15 'Geist';
  --type-body: 400 16px/1.45 'Geist'; --type-label: 600 12px/1.3 'Geist';
  --motion-fast: 200ms; --motion-normal: 600ms; --motion-slow: 900ms;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 3. Vocabulary (locked, use these words in code and UI)

| Term | Meaning | Never call it |
|---|---|---|
| **Memory** | The thing itself: a cluster of moments captured close in time | Cluster (internal only), entry, item |
| **Story** | How a memory reads when opened: the scrolling page of blocks | Detail view, record, sheet |
| **Recap** | The short film of a memory, in the full screen player | Slideshow, movie, reel |
| **Shared memory** | A memory several people add to. Always one story | Collective, feed, thread |
| **Moment** | One thing inside a memory: a photo, a voice note, a line | Item, asset, upload |
| **Home** | The first screen: what came back | Feed, dashboard |
| **Memories** | The photo grid of everything kept | Vault, archive, gallery, library |
| **Capture** | The chat sheet where things go in | Chat (old name), Memorialize |
| **Profile** | The sheet opened from the avatar | Settings, account |

Only three words describe the core objects: **memory** (the thing), **story** (how it reads), **recap** (the film). No other synonyms anywhere in the UI. On photo badges in a shared memory, the person **generated** the moment (never "kept"). "Vault", "Cortex", "Cards", "collective", "Memorialize" and "Chat" are retired words.

---

## 4. App structure and navigation (LOCKED, supersedes v2)

```
            [Profile sheet]  <- tap avatar, from Home
                   |
   Home  ·  ( + ) ·  Memories        <- bottom tab bar, plus is raised
     |                  |
     |                  '-- Memory story (push)
     |                        |-- Photo viewer (full screen)
     |                        |-- Recap player (full screen modal)
     |                        '-- Shared memory = same story view + people row
     '-- same pushes from Home cards
   ( + ) opens the Capture sheet (modal, slides up, chevron-down closes)
```

Requirements:
1. **The app launches into Home.** Never into the chat.
2. **Bottom tab bar:** Home (house icon) and Memories (grid icon), labels at 11, active tab marked with a 4px dot beneath. Between them the **raised capture button**: white circle 54px, black plus icon, lifted 22px above the bar, shadow `0 8px 18px rgba(0,0,0,0.45)`.
3. **Capture opens as a sheet** over the current screen (600ms up), top corners radius 32, closed with a chevron-down button. Closing returns exactly where you were.
4. **Story views push** with a back button: 32px circle, surface #1D1D25, chevron-left icon. Detail screens have no tab bar.
5. **The recap is a full screen modal.** No chrome except the progress bar, the caption and the song credit.
6. Navigation must be self-evident with zero explaining labels. If a tester asks "where do I tap", the build has failed this section.

---

## 5. Gallery screen specifications (BINDING)

### 5.1 Home

Top to bottom, ground #101014, edge padding 16:

1. **Top row:** wordmark "Memmory" (16/700) left, avatar (30px circle, surface, initial) right. Avatar opens Profile.
2. **Greeting** in display (30/600): "Good morning." Nothing else. No name.
3. **Hero card:** the newest thing that came back. Photo, aspect ratio about 4:3.6, radius 24, with the photoScrim overlay. Top row inside: avatar stack (22px circles, 2px ground-colored borders, overlapping -8px) left, white play button (42px circle, black play glyph) right. Bottom: title (20/600 white) + meta line (12.5/500 white), for example "The house in Greece" + "7 people · July 12–19". Tapping the play button starts the recap; tapping the card opens the memory.
4. **Activity cards**, stacked, gap 8: row cards (surface, radius 18, padding 9) with a 48px photo thumb (radius 12), a label (11/600) and one line (13.5/400). Types: "A year ago today", "A question for you", "Elena added to your memory". Tap opens the memory.
5. **Latest:** a "Latest" label (12/600) and one row of three square photo tiles (radius 14). The newest memories, real captures mixed with demo content.

The rule of the screen: the top card is always something that came back. Never an input field, never an empty state that asks for content.

### 5.2 Memories

1. **Title** "Memories" (30/600) + count line ("12 memories", 12/500).
2. **Grid:** solo memories in two columns, square tiles (1:1, radius 18). A shared memory takes the full width (16:9.5, radius 18) and carries an avatar stack in its caption. Captions under tiles: title (14/600) + one meta line (11.5/500), for example "June 14 · Amsterdam". Nothing else: no badges, no counts, no file details.
3. **The layout rule is automatic:** a memory with several people gets the wide format.
4. Real memories sort first, then demo content. Tap any tile to open the memory as a story.

### 5.3 Memory story (an opened memory)

Pushed full screen on the ground. Header: back button + title (22/600) + meta line (12/500), for example "Dinner at Marco's" + "June 14 · Amsterdam".

The page is built from blocks, gap 12, in capture order (the composer in `src/lib/story.ts` decides; what you captured first comes first):

1. **Hero photo:** full width, radius 20, aspect about 16:10.5.
2. **Photo pairs:** two columns, radius 18.
3. **Voice card** (surface, radius 20, padding 14): play button (32px white circle, black glyph) + static waveform (2px white bars) + duration (12/600). Beneath: label "What you said" (11/600) + the transcript (15.5/400). The audio is real and playable; the transcript is what makes the card readable.
4. **Song row** (surface, radius 18): the Spotify mark (26px, green circle) + label "Playing then" (11/600) + "Caruso · Lucio Dalla" (13.5/400). Tap opens the track.
5. **Related memories row** (surface, radius 18): three stacked photo thumbs (34px, radius 10, overlapping) + label "Related memories" + "3 earlier nights with Marco". Tap opens the list. The connection is shown, never explained.
6. **Question card** (surface, radius 20), always last: a small mic chip (26px circle) + label "A question for you" (11/600), the question (17/400, for example "What did you and Marco talk about after Sofia left?"), and an input row (surfaceDeep pill: placeholder "What do you remember?", a mic icon, a white "Save" pill). The user answers by typing or speaking. The answer is saved into the memory instantly and the confirmation is one word: **Saved.**

Tap any photo for the edge-to-edge viewer. A memory should read like a story, not like a list of files.

### 5.4 Shared memory

The same story view plus exactly three additions:

1. **People row** under the header: horizontally scrolling pill chips. First chip "Everyone" (text only, selected by default: white background, dark text). Then one chip per person: avatar (22px) + first name (12/600). A chip cut off at the screen edge signals that the row scrolls. Tap a person to see only their moments; tap Everyone to come back. Same page, filtered. Never separate feeds.
2. **Photo badges:** every photo block carries a small pill badge (scrim background, bottom left, 8px inset): avatar (16px) + first name (10/600). The badge names **who generated each moment**.
3. **Watch the story pill** under the people row: white play circle (30px) + "Watch the story" (12/600), surface pill. Opens the recap.

Voice cards from other people are labeled with the person: "Jonas said".

### 5.5 Recap player

Full screen modal. The experience is the product.

1. **Photo fills the screen**, slow zoom for the length of the beat. A soft gradient scrim top and bottom so overlays read.
2. **Progress segments** at the top (2.5px bars, gap 4, white at 0.35 opacity, played segments solid white). Advances by itself; tap right to move on, left to go back.
3. **Voice notes play over the pictures.** Text someone wrote appears as a quote on top of the photo or video. Everything captured can come together here.
4. **Caption pill** (scrim, bottom left): avatar (24px) + the person's first name (13/600). The caption only names the person. Nothing more.
5. **Song credit** bottom center: the Spotify mark (15px) + "Ta Paidia tou Peiraia · Melina Mercouri" (10.5/600).
6. **It ends on the last moment.** No closing slogan, no summary card. The story just ends.

Simon is cutting a test recap that shows the format and could work in the MVP. Later idea, not in scope: tag the people in the recap so it is sent straight to them.

### 5.6 Profile

Unchanged from v2: opens from the avatar as a sheet (radius 32 top corners), **cream background** (#FAF7F2), white rows. Portrait photo, name, one fact line ("Born July 1992 · Amsterdam · 247 memories"), the big counts row, Top people with "View all people", the activity gauge (warmth, never guilt), the three optional questions, Face ID toggle, the privacy row, sign out. The person is "Isabel", never "Isabelle"; person names come from the people registry, never free text.

---

## 6. The Capture sheet (unchanged engine, new frame)

The chat works exactly like today. Everything in this section is v2 behavior that still binds, plus the sheet frame.

- **Frame:** modal sheet, Dawn gradient, radius 32 top corners. Header: close button (34px white circle, chevron-down) left, "Capture" (16/600 slate) center, avatar right.
- **Input bar:** white pill, three elements: camera icon · text field (placeholder "What do you want to keep?") · mic icon that becomes send when text exists. Camera: tap takes a photo, hold records video. Mic: hold records a voice note (release sends; slide left cancels). Transcription runs in the background and never replaces the audio.
- **Open question, to test in the MVP:** two big buttons above the input bar (58px white circles, soft shadow): a mic button ("Hold to talk", hold to record) and a camera button ("Camera"). Labels 11/600 slate. Typing stays in the bar below. The idea: when you land in the sheet it is instantly obvious how to speak and how to shoot.
- **The forming window:** everything sent within the window becomes one memory. The forming bar shows the mechanic plainly: "2 moments · one memory" + a "Save now" pill. No poetic status lines.
- **Thread history (HARD RULE):** saved memories never leave the thread. The thread is the full scrollable history with memory summary cards inline. Emptying the chat on save is a bug.
- **Messages:** outgoing white bubbles (radius 18, sender corner 12, max width 78%), photos edge to edge inside the radius, always straight. The keeper's messages on glass, short, rare.
- **The proactive keeper** (unchanged caps, non-negotiable): max 2 nudges per day in the chat, max 1 push notification per day total, quiet hours 22:00 to 08:00, every nudge dismissible and never repeated after dismissal, questions never demands. Location processing on device.
- Moment mode, message states (sending, failed, offline), month headers and lazy history behave exactly as specified in v2.4 and as built in `app/chat.tsx`. Nothing in the capture engine changes in v3.

---

## 7. Copy rules and copy bank

Position (locked): **Memmory is not a friend. Memmory is a keeper. It speaks only when there is something to say.**

Five rules, applied to every string in the app:

1. **The app never talks about itself.** No "Memmory asks", "Memmory wove", "Memmory kept". Write what the user sees: "A question for you", "Related memories", "Saved".
2. **Plain beats poetic.** "Saved." beats "Kept. The memory just got richer." The richer memory is visible on screen; it does not need announcing.
3. **People's own words carry the feeling.** "Best pasta of my life. Marco finally met Sofia." is the strongest line in the product. Nothing we write competes with it.
4. **One idea per line.** Never a headline plus an explanation plus an emotional conclusion in the same place. Strong screens are allowed to just end.
5. **Three words, used precisely:** memory, story, recap (section 3).

Also: no exclamation marks, no emoji in system copy, no em dashes anywhere, the user's content is "your memories" (never "content", "data" or "items").

Copy bank (English, approved):

| Surface | String |
|---|---|
| Home greeting | Good morning. |
| Home hero meta | 7 people · July 12–19 |
| Year-ago label | A year ago today |
| Question label | A question for you |
| Someone contributed | Elena added to your memory · A few more moments from Greece. |
| Latest section | Latest · See all |
| Memories count | 12 memories |
| Memories empty state | Nothing here yet. Start capturing a memory. |
| Transcript label | What you said |
| While transcribing | Listening… |
| Voice card, other person | Jonas said |
| Song label | Playing then |
| Song added by someone | Leo added the song |
| Related label | Related memories · 3 earlier nights with Marco |
| Question example | What do you want to remember about this? |
| Answer placeholder | What do you remember? |
| Answer action | Save |
| After answering | Saved. |
| Recap button | Watch the story |
| Shared filter chips | Everyone · Elena · You |
| Filtered heading | Elena's memories / Your memories |
| Recap caption | {first name} |
| Recap ending | (nothing: the story just ends) |
| Deleted memory | This memory is gone. |
| Capture input | What do you want to keep? |
| Capture big buttons | Hold to talk · Camera |
| Forming bar | 2 moments · one memory |
| Forming action | Save now |
| Capture saved | Saved |
| Several moments saved | Saved as one memory |
| First launch | What do you want to remember? Send a photo, voice note or thought. |
| Ask result, found | I found one. |
| Ask result, nothing | I couldn't find anything about that yet. |
| Save a question as memory | Save as a memory |
| Failed send | Not saved. Tap to retry. |
| Offline | Offline. Everything you send is kept and syncs later. |
| Delete confirm | This memory will be gone. That is the one thing Memmory cannot undo. |
| Privacy row | Private by default. Your memories are never posted anywhere. |

---

## 8. The rule sheet (paste this into every AI prompt)

```
MEMMORY DESIGN RULES v3 (non-negotiable)
1.  Two worlds. Gallery is dark: ground #101014, cards #1D1D25, inputs #14141A,
    text pure #FFFFFF. Capture sheet is light: Dawn gradient
    (#C8D4EC -> #F5D6BC -> #E0C5DC), white surfaces, slate text #1F2937.
    No other backgrounds exist. Dusk and cortexDeep are retired.
2.  No accent color. Functional only: error #DC6B5E, Spotify green #1DB954 on
    song rows and the recap credit. Photography carries all other color.
3.  Full saturation text always. Never rgba, opacity or gray tiers on text.
    Hierarchy through size and weight only.
4.  Font: Geist 400/500/600/700. Four sizes: 30/20/16/12. Tab labels and photo
    badges may use 11. Nothing else below 12. No italics, no uppercase eyebrows.
5.  Dark separation comes from surface tone, not borders or shadows. Hairline
    borders only on the tab bar. Text on photos always sits on a scrim.
6.  Everything rounded: 12/18/24/32/pill. Cards 18-20, hero photos 20-24,
    buttons and chips pill.
7.  Motion: 200/600/900ms, one easing cubic-bezier(0.4,0,0.2,1). No bounce.
    A memory opening from its tile (900ms) is the signature animation.
    Text never fades out as an effect.
8.  Navigation: bottom tab bar Home · raised plus (54px white circle, opens the
    Capture sheet) · Memories. The app launches into Home, never into the chat.
    Stories push with a back button. The recap is a full screen modal.
9.  Words: memory (the thing), story (how it reads), recap (the film),
    shared memory, moment, Home, Memories, Capture, Profile. Badges say who
    GENERATED a moment. Retired: Vault, Cortex, Cards, collective, Chat,
    Memorialize.
10. Copy: the app never talks about itself ("A question for you", never
    "Memmory asks"). Plain beats poetic ("Saved."). One idea per line. No
    exclamation marks, no emoji, no em dashes. People's own words carry the
    feeling.
11. Capture engine unchanged: two taps from anywhere, camera tap=photo
    hold=video, mic hold=voice note, transcription in background and never
    replacing audio, saved memories never leave the thread.
12. Photos and videos always straight, full width, rounded. Never tilted.
    Icons are 1.5-1.8px line drawings, 24px grid, 44px targets. Emoji as UI
    is forbidden.
13. Proactive keeper caps: max 2 nudges/day in chat, max 1 push/day, quiet
    hours 22-08, always dismissible, questions never demands. Location on
    device.
14. Mockups and design surfaces always use real photos, never empty color
    blocks. No AI-generated images anywhere in Memmory material.
15. When in doubt: quieter, darker ground, bigger photography, fewer words.
    The memories are the interface.
```

---

## 9. Handoff mechanics

- **This file is the master.** The version at the top bumps on every change. The visual twin for humans is `roadmap-2026-08-21.html`, live at https://memmory-design.vercel.app.
- The Expo prototype (`app/`) implements every gallery screen in section 5. Where a detail is ambiguous, this document wins over the prototype.
- Tokens in code: `app/src/constants/theme.ts`.
- **Open items, decided by Simon G:** the capture big-buttons test (6), recap tagging (5.5), photobooks and Cortex (both after the MVP), notification strategy beyond On this day. Ask before inventing in these areas; everything else in this document you can build on without checking.

*v3.0, 2026-08-31. The gallery redesign, the copy reset and the roadmap iterations are folded in. Sections 3, 4, 5 and 8 are binding.*
