#!/usr/bin/env node
// End-to-end capture round trip against the dev server: open the sheet as p3,
// type a line, Save now, reload, and assert the memory came back from /__db.
//   node tools/smoke-capture.mjs [--persona p3] [--keep]
// The persona's capture thread (src/data/threads-<pid>.json) is set aside for
// the run and restored after, so a keeper question left by a previous run
// cannot swallow the typed line; without --keep the memory is deleted too.
import { chromium } from 'playwright'
import { existsSync, renameSync, unlinkSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const base = process.env.SHOT_BASE || 'http://127.0.0.1:5173'
const pid = flag('--persona', 'p3')
const line = `Test line from smoke ${Date.now().toString(36)}`
const thread = `src/data/threads-${pid}.json`
const aside = `${thread}.smoke-bak`

const had = existsSync(thread)
if (had) renameSync(thread, aside)
const restore = () => { if (had) renameSync(aside, thread); else if (existsSync(thread)) unlinkSync(thread) }
process.on('exit', restore)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(`${base}/?persona=${pid}`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true)
await page.click('.tab-plus')
await page.waitForFunction(() => window.__state?.sheet === 'capture')
await page.fill('.cap-field', line)
await page.press('.cap-field', 'Enter')
await page.getByText('Save now', { exact: true }).click({ timeout: 10000 })
// Synthesis runs after the instant save and patches the memory; let it land.
await page.waitForTimeout(3000)

await page.goto(`${base}/?persona=${pid}`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true)
const space = await (await fetch(`${base}/__db?space=${pid}`)).json()
// Synthesis (real or mock) may rewrite the title, so match the fixed prefix.
const hit = space.memories.find(m => `${m.title} ${m.about}`.toLowerCase().includes('test line from smoke'))
const state = await page.evaluate(() => window.__state)
await browser.close()

console.log(JSON.stringify({ persona: pid, state, memories: space.memories.length, hit: hit && { id: hit.id, title: hit.title, about: hit.about, owner_id: hit.owner_id }, errors }, null, 2))
if (hit && !args.includes('--keep')) {
  await fetch(`${base}/__db`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'memories', delete: hit.id }) })
  console.log(`cleaned up ${hit.id}`)
}
process.exit(hit && !errors.length ? 0 : 1)
