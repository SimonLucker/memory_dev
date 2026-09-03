// Shim for legacy/LegacyApp.jsx, which still imports this path with v2 props
// (no db, no settings). Delete with legacy/.
import Profile from './index.jsx'
import { emptyDb } from '../data/store.js'
import { getSettings, setSetting } from '../lib/settings.js'

const EMPTY = emptyDb()

export default function LegacyProfile(props) {
  const pid = props.person.id
  return <Profile db={EMPTY} settings={getSettings(pid)} setSetting={(name, value) => setSetting(pid, name, value)} {...props} />
}
