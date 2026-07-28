# Component contract (design-foundation v2.4 rebuild)

App.jsx owns all shared state. Panes and overlays receive exactly these props.
Do not add or rename props without updating App.jsx and this file.

App.jsx owns: pane 0|1|2 (Vault, Capture=home, Cards); vaultMode 'list'|'cortex';
personId/person; memories (active person, non-pending) + pending; openMemoryId;
slideshowId; profileOpen; actions addMemory(draft)->memory, updateMemory(m),
deleteMemory(id), toggleFavorite(id), acceptShare(id), declineShare(id),
switchPerson(id), openMemory(id), closeMemory(), openSlideshow(id).

```
<Capture person memories addMemory openMemory updateMemory />
  files: src/components/Capture.jsx, src/styles/capture.css

<Vault memories pending mode setMode openMemory toggleFavorite deleteMemory
  acceptShare declineShare cortexSlot />
  files: src/components/Vault.jsx, src/styles/vault.css
  (renders segmented [List | Cortex]; when mode==='cortex' renders the
   cortexSlot children element in its body)

<Cortex memories edges layout openMemory />
  files: src/components/Cortex.jsx, src/components/GraphView.jsx, src/styles/cortex.css

<MemoryDetail memory onClose updateMemory openSlideshow />
  files: src/components/MemoryDetail.jsx, src/styles/memory.css

<Slideshow memory onClose />
  files: src/components/Slideshow.jsx (styles in memory.css)

<Profile person persons memories onClose switchPerson />
  files: src/components/Profile.jsx, src/styles/profile.css

<Cards memories person openMemory />
  files: src/components/Cards.jsx, src/styles/cards.css
```

Shared, read-only unless listed yours: src/styles/tokens.css,
src/components/Icons.jsx, src/lib/*, src/data/*.

MEMORY SCHEMA v2 (see src/lib/SCHEMA.md, written by the data agent): existing
fields id, class, when 'DD-MM-YYYY HH:MM', what (title), where, who[{id,name}],
feeling[], music{name,artist}, importance, photos[], favorite, _pos, _pending
stay; new: about (string, the story; falls back to why/summary),
videos[{src,duration}], voice[{src,duration,transcript}].

Shell notes (foundation agent):
- Panes mount inside `.pane` (100% width/height, vertical scroll). The pager
  owns horizontal swipe with `touch-action: pan-y`; vertical scrolling inside a
  pane is untouched. Chrome (avatar + pane dots) overlays the top ~56px; pane
  content should start below it.
- MemoryDetail and Slideshow mount as `.overlay` (absolute, inset 0) above the
  pager; Profile mounts inside `.profile-sheet` which App animates.
- Icons come only from src/components/Icons.jsx (1.5px line, `size` prop).
- App also owns the lightbox (openLightbox internal) and the mini music player
  (playMusic internal); not yet exposed through the contract.
