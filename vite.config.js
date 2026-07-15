import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = dirname(fileURLToPath(import.meta.url))

// Dev-only persistence: the edit button in the memory card POSTs the person's full
// memories array here and it is written straight back into the source JSON. The watcher
// ignores data files so a save doesn't trigger a full page reload (the app already has
// the edit in memory; the file catches up for the next load / git).
const saveMemories = () => ({
  name: 'save-memories',
  configureServer(server) {
    server.middlewares.use('/__save-memories', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
      let body = ''
      req.on('data', (c) => { body += c })
      req.on('end', () => {
        try {
          const { person, memories } = JSON.parse(body)
          const file = person === 'p2' ? 'memories-p2.json' : 'memories.json'
          writeFileSync(join(root, 'src/data', file), JSON.stringify(memories, null, 2) + '\n')
          res.end('ok')
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
        }
      })
    })
  },
})

export default defineConfig({
  base: './',
  plugins: [react(), saveMemories()],
  server: { watch: { ignored: ['**/src/data/memories*.json'] } },
})
