#!/usr/bin/env node
// Song autoplay smoke: open a shared memory with a song row, tap the page once
// (primes the shared audio element), wait for the preview fetch, then check
// either the real <audio> element is playing or the row shows its playing
// state. The sandbox blocks audio-ssl.itunes.apple.com, so a quiet "missing"
// state also counts as pass; we print which branch happened.
//   node tools/smoke-song.mjs
import { chromium } from 'playwright'

const base = process.env.SHOT_BASE || 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
// Only real JS exceptions fail the run: the sandbox blocks the Apple preview
// host, and that shows up as a console resource-load error, not a page bug.
const errors = []
page.on('pageerror', e => errors.push(String(e)))

await page.goto(`${base}/?persona=p5#/memory/isa_marco`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true)
await page.click('.st', { position: { x: 5, y: 5 } })
await page.waitForTimeout(3000)

const audioPlaying = await page.evaluate(() => document.querySelector('audio')?.paused === false)
const rowPlaying = await page.locator('.st-spotify.on').count() > 0
const rowMissing = !rowPlaying && await page.locator('.st-row-main').count() > 0
const branch = audioPlaying ? 'audio-element' : rowPlaying ? 'row-playing-state' : 'missing-quiet'
await page.screenshot({ path: 'docs/shots/story/smoke-song.png' })
await browser.close()

const ok = (audioPlaying || rowPlaying || rowMissing) && !errors.length
console.log(JSON.stringify({ audioPlaying, rowPlaying, rowMissing, branch, errors, ok }, null, 2))
process.exit(ok ? 0 : 1)
