// Bottom tab bar: Home · raised capture button · Memories (spec 4.2).
import { Home, Grid, Plus } from './Icons.jsx'

export default function TabBar({ tab, setTab, openCapture, hidden }) {
  const Tab = ({ name, label, Icon }) => (
    <button className={`tab-item${tab === name ? ' active' : ''}`} onClick={() => setTab(name)} aria-label={label}>
      <Icon size={24} />
      <span className="tab-label">{label}</span>
    </button>
  )
  return (
    <nav className="tab-bar" hidden={hidden} aria-label="Tabs">
      <Tab name="home" label="Home" Icon={Home} />
      <button className="tab-plus" onClick={openCapture} aria-label="Capture"><Plus size={26} /></button>
      <Tab name="memories" label="Memories" Icon={Grid} />
    </nav>
  )
}
