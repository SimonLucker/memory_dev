import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { writeFileSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = dirname(fileURLToPath(import.meta.url))

const readBody = (req) => new Promise((resolve) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => resolve(Buffer.concat(chunks)))
})

// Dev-only persistence + AI proxy. Keys live in .env (never shipped to the browser);
// the browser talks to these endpoints. Swaps to Supabase edge functions later —
// the client-side fetch paths are the only contract.
const devApi = (env) => ({
  name: 'dev-api',
  configureServer(server) {
    // Per-memory persistence into the source JSON (mirrors the Supabase upsert/delete
    // the deployed build uses — lib/api.js is the shared contract).
    // Body: { person, upsert: memory } or { person, delete: id }.
    server.middlewares.use('/__save-memories', async (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
      try {
        const { person, upsert, delete: delId } = JSON.parse(await readBody(req))
        const memFile = join(root, 'src/data', person === 'p1' ? 'memories.json' : `memories-${person}.json`)
        let memories = JSON.parse(readFileSync(memFile, 'utf8'))
        if (upsert) {
          const i = memories.findIndex((m) => m.id === upsert.id)
          i === -1 ? memories.push(upsert) : (memories[i] = upsert)
        }
        if (delId) memories = memories.filter((m) => m.id !== delId)
        writeFileSync(memFile, JSON.stringify(memories, null, 2) + '\n')
        // The watcher ignores these files (no mid-edit page reload), so vite's module
        // cache must be invalidated by hand or reloads serve the stale JSON.
        server.moduleGraph.onFileChange(memFile)
        res.end('ok')
      } catch (e) { res.statusCode = 500; res.end(String(e)) }
    })

    // Serve photos straight from disk. Vite's own public-file serving relies on a
    // watcher-fed file list, and the watcher deliberately ignores public/photos
    // (uploads must not trigger reloads) — so photos uploaded mid-session fell
    // through to the index.html fallback until a server restart.
    server.middlewares.use('/photos', (req, res, next) => {
      try {
        const name = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\//, '')
        if (!name || name.includes('..') || name.includes('/')) return next()
        const buf = readFileSync(join(root, 'public/photos', name))
        res.setHeader('Content-Type', name.endsWith('.png') ? 'image/png' : 'image/jpeg')
        res.end(buf)
      } catch { next() }
    })

    // Save an uploaded photo into public/photos; returns its memory-relative path.
    server.middlewares.use('/__upload-photo', async (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
      try {
        const ext = (req.headers['content-type'] || '').includes('png') ? 'png' : 'jpg'
        const name = `new_${Date.now()}.${ext}`
        writeFileSync(join(root, 'public/photos', name), await readBody(req))
        res.end(JSON.stringify({ path: `photos/${name}` }))
      } catch (e) { res.statusCode = 500; res.end(String(e)) }
    })

    // Memorialization chat → Azure OpenAI (later: any Claude-compatible endpoint).
    // Body: { messages: [...] } in OpenAI chat format, images as data-URL image_url parts.
    server.middlewares.use('/__ai/chat', async (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
      const body = JSON.parse(await readBody(req))
      const { AZURE_OPENAI_ENDPOINT: ep, AZURE_OPENAI_DEPLOYMENT: dep, AZURE_OPENAI_API_VERSION: ver, AZURE_OPENAI_API_KEY: key } = env
      if (!key) return res.end(JSON.stringify({ content: mockChat(body.messages), mock: true }))
      try {
        // "preview"/v1 surface vs legacy deployments path — both live in the wild.
        const url = ver === 'preview'
          ? `${ep.replace(/\/$/, '')}/openai/v1/chat/completions`
          : `${ep.replace(/\/$/, '')}/openai/deployments/${dep}/chat/completions?api-version=${ver}`
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': key },
          body: JSON.stringify({ model: dep, messages: body.messages }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data.error?.message || r.statusText)
        res.end(JSON.stringify({ content: data.choices[0].message.content }))
      } catch (e) { res.statusCode = 502; res.end(JSON.stringify({ error: String(e) })) }
    })

    // Voice → text via Deepgram. Body: raw audio bytes, content-type preserved.
    server.middlewares.use('/__ai/transcribe', async (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
      const key = env.DEEPGRAM_API_KEY
      const audio = await readBody(req)
      if (!key) return res.end(JSON.stringify({ transcript: '', error: 'DEEPGRAM_API_KEY missing — add it to .env' }))
      try {
        const r = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true', {
          method: 'POST',
          headers: { Authorization: `Token ${key}`, 'Content-Type': req.headers['content-type'] || 'audio/webm' },
          body: audio,
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data.err_msg || r.statusText)
        res.end(JSON.stringify({ transcript: data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '' }))
      } catch (e) { res.statusCode = 502; res.end(JSON.stringify({ error: String(e) })) }
    })
  },
})

// Scripted stand-in while AZURE_OPENAI_API_KEY is empty: walks the same
// question flow and emits a valid memory JSON so the pipeline is demoable.
const mockChat = (messages) => {
  const userTurns = messages.filter((m) => m.role === 'user').length
  const lastText = (() => {
    const c = messages.filter((m) => m.role === 'user')[0]?.content
    return typeof c === 'string' ? c : (c || []).map((p) => p.text || '').join(' ')
  })()
  const qs = [
    'I’d love to help you keep this memory. Tell me — when did this happen, and where were you?',
    'That sounds special. Who was there with you, and what were you all doing?',
    'How did it feel? And is there a song or sound that brings it back?',
  ]
  if (userTurns <= qs.length) return `(offline stand-in — add AZURE_OPENAI_API_KEY to .env for the real guide)\n\n${qs[userTurns - 1]}`
  return 'Here is your memory, ready for the vault.\n```json\n' + JSON.stringify({
    class: 'Friends', what: (lastText || 'A remembered moment').slice(0, 40), when: '15-07-2026 18:00',
    where: 'Somewhere dear', why: 'A moment worth keeping', who: [{ name: 'Sarah' }],
    feeling: ['Happy'], music: null, summary: 'A stand-in memory created without an AI key.', importance: 3,
  }, null, 2) + '\n```'
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '')
  return {
    base: './',
    // HTTPS=1 (npm run dev:phone): self-signed cert so Safari on the phone grants
    // mic access — getUserMedia needs a secure context off localhost.
    plugins: [react(), devApi(env), ...(process.env.HTTPS ? [basicSsl()] : [])],
    server: { watch: { ignored: ['**/src/data/memories*.json', '**/src/data/layout-*.json', '**/public/photos/**'] } },
  }
})
