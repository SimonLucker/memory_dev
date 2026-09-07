// Bottom tab bar: Home · raised capture button · Memories (spec 4.2).
import { Home, Grid, Plus } from './Icons.jsx'

// Declared out here on purpose: as a component defined inside TabBar it was a
// new type on every render, so any state change during the pointerdown of a
// tap remounted the buttons and the tap's click landed on a dead node.
const Tab = ({ name, label, Icon, tab, setTab }) => (
  <button className={`tab-item${tab === name ? ' active' : ''}`} onClick={() => setTab(name)} aria-label={label}>
    <Icon size={24} />
    <span className="tab-label">{label}</span>
  </button>
)

export default function TabBar({ tab, setTab, openCapture, hidden }) {
  return (
    <nav className="tab-bar" hidden={hidden} aria-label="Tabs">
      <Tab name="home" label="Home" Icon={Home} tab={tab} setTab={setTab} />
      <button className="tab-plus" onClick={openCapture} aria-label="Capture"><Plus size={26} /></button>
      <Tab name="memories" label="Memories" Icon={Grid} tab={tab} setTab={setTab} />
    </nav>
  )
}
