// tokens.css + app.css load BEFORE App so component sheets (imported inside
// components) always cascade after the base type roles.
import './styles/tokens.css'
import './styles/app.css'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
