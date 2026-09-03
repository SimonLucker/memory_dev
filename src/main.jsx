// tokens.css loads before either app so component sheets cascade after the base.
import './core/tokens.css'
import { createRoot } from 'react-dom/client'

// ?legacy=1 mounts the v2.5 surfaces (ARCHITECTURE.md: kept, no nav entry).
const legacy = new URLSearchParams(location.search).get('legacy') === '1'
;(legacy ? import('./legacy/LegacyApp.jsx') : import('./core/App.jsx'))
  .then(({ default: App }) => createRoot(document.getElementById('root')).render(<App />))
