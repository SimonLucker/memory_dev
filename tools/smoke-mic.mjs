#!/usr/bin/env node
// Capture gesture smoke against the dev server, as a touch device:
//   1. hold the BIG mic 600ms and release: a user-voice row must land (headless
//      Chromium has no microphone, so the calm failure row counts), no console error
//   2. type a line, Save now: the memory card and the "Saved" line appear and
//      every earlier row is still in the thread (spec 6: the thread never empties)
//   node tools/smoke-mic.mjs [--persona p4]
// The persona's thread file is set aside for the run and restored after; the
// saved memory is deleted from the dev db.
import { chromium } from 'playwright'
import { existsSync, renameSync, unlinkSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const base = process.env.SHOT_BASE || 'http://127.0.0.1:5173'
const pid = flag('--persona', 'p4')
const line = `Mic smoke ${Date.now().toString(36)}`
const thread = `src/data/threads-${pid}.json`
const aside = `${thread}.smoke-bak`
const had = existsSync(thread)
if (had) renameSync(thread, aside)
process.on('exit', () => { if (had) renameSync(aside, thread); else if (existsSync(thread)) unlinkSync(thread) })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
const rows = () => page.evaluate(() => [...document.querySelectorAll('.msg-row')].map(r => r.className + ':' + (r.textContent || '').slice(0, 40)))

await page.goto(`${base}/?persona=${pid}`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true)
await page.click('.tab-plus')
await page.waitForFunction(() => window.__state?.sheet === 'capture')
await page.waitForTimeout(700)

// 1. touch-hold the big mic
const before = await rows()
const box = await page.locator('.cap-big-btn').first().boundingBox()
const cdp = await ctx.newCDPSession(page)
const touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }]
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints })
await page.waitForTimeout(600)
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await page.waitForTimeout(1500)
const afterHold = await rows()
const voiceRow = await page.locator('.msg-voice').count()

// 2. type a line and Save now
await page.fill('.cap-field', line)
await page.press('.cap-field', 'Enter')
await page.getByText('Save now', { exact: true }).click({ timeout: 10000 })
await page.waitForTimeout(1500)
const afterSave = await rows()
const card = await page.locator('.mem-card').count()
const saved = await page.getByText(/^Saved( as one memory)?$/).count()
const kept = before.every(r => afterSave.includes(r)) && afterHold.every(r => afterSave.includes(r))
await page.screenshot({ path: 'docs/shots/capture/smoke-saved.png' })
await browser.close()

const space = await (await fetch(`${base}/__db?space=${pid}`)).json()
const hit = space.memories.find(m => `${m.title} ${m.about}`.toLowerCase().includes('mic smoke'))
if (hit) await fetch(`${base}/__db`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'memories', delete: hit.id }) })

const ok = voiceRow >= 1 && card >= 1 && saved >= 1 && kept && !errors.length
console.log(JSON.stringify({ persona: pid, rowsBefore: before.length, rowsAfterHold: afterHold.length, rowsAfterSave: afterSave.length, voiceRow, card, saved, kept, memoryDeleted: hit?.id || null, errors, ok }, null, 2))
process.exit(ok ? 0 : 1)
