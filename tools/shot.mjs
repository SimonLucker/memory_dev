#!/usr/bin/env node
// Verification loop: headless Chromium loads the app, waits until it says it is
// ready, writes a PNG and a JSON log (console errors, page errors, failed
// requests, timing, ready state). Every claim about the UI is backed by one of
// these files. No agent may claim anything it has not screenshotted.
//
//   node tools/shot.mjs <url-or-path> [--out name] [--vp phone|desktop|WxH]
//        [--dpr 2] [--wait ms] [--full] [--tap "selector"] [--scroll px]
//        [--dark|--light] [--reduced-motion] [--clock ISO]
//
// Examples
//   node tools/shot.mjs "/?showcase=home&now=2026-07-13T09:00" --out home-morning
//   node tools/shot.mjs "/?showcase=story&id=isa_marco" --vp desktop --full
//
// Output: docs/shots/<name>.png and docs/shots/<name>.json (exit 1 on errors).
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const has = k => args.includes(k)
const target = args.find(a => !a.startsWith('--') && !args.includes(`--${a}`) && (args.indexOf(a) === 0 || !args[args.indexOf(a) - 1].startsWith('--')))
const base = process.env.SHOT_BASE || 'http://127.0.0.1:5173'
const url = target?.startsWith('http') || target?.startsWith('file:') ? target : base + (target || '/')
// The dev server dies when the container idles; bring it back rather than fail every shot.
if (!url.startsWith('file:')) {
  const up = async () => fetch(base).then(r => r.ok).catch(() => false)
  if (!(await up())) {
    const { spawn } = await import('node:child_process')
    spawn('npx', ['vite', '--port', '5173', '--host', '127.0.0.1'], { detached: true, stdio: 'ignore' }).unref()
    for (let i = 0; i < 40 && !(await up()); i++) await new Promise(r => setTimeout(r, 500))
  }
}

const VP = { phone: [390, 844], phoneSmall: [360, 780], phoneLarge: [430, 932], desktop: [1280, 900] }
const vpArg = flag('--vp', 'phone')
const [w, h] = VP[vpArg] || vpArg.split('x').map(Number)
const dpr = Number(flag('--dpr', 2))
const name = flag('--out', (target || 'root').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root')
const outDir = resolve('docs/shots')
mkdirSync(outDir, { recursive: true })

const log = { url, viewport: { w, h, dpr }, console: [], errors: [], failedRequests: [], warnings: [], ready: false, readyMs: null, perf: {} }
const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: vpArg.startsWith('phone'), hasTouch: vpArg.startsWith('phone'),
  colorScheme: has('--light') ? 'light' : 'dark', reducedMotion: has('--reduced-motion') ? 'reduce' : 'no-preference',
})
if (flag('--clock')) await ctx.addInitScript(iso => {
  // Freeze "now" for greeting/time-of-day logic. The app reads ?now= too; this covers Date.now() users.
  const fixed = new Date(iso).getTime(); const RealDate = Date
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])) } static now() { return fixed } }
  window.Date = FakeDate
}, flag('--clock'))
const page = await ctx.newPage()
page.on('console', m => { const t = m.type(); const e = { type: t, text: m.text().slice(0, 500) }; if (t === 'error') log.errors.push(e); else if (t === 'warning') log.warnings.push(e); else log.console.push(e) })
page.on('pageerror', e => log.errors.push({ type: 'pageerror', text: String(e).slice(0, 800) }))
page.on('requestfailed', r => log.failedRequests.push({ url: r.url().slice(0, 300), reason: r.failure()?.errorText }))
page.on('response', r => { if (r.status() >= 400) log.failedRequests.push({ url: r.url().slice(0, 300), status: r.status() }) })

const t0 = Date.now()
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  // The app sets window.__ready = true once its first real frame is painted (fonts + data).
  await page.waitForFunction(() => window.__ready === true, null, { timeout: Number(flag('--wait', 15000)) })
  log.ready = true
} catch (e) { log.errors.push({ type: 'ready-timeout', text: String(e).slice(0, 300) }) }
log.readyMs = Date.now() - t0
await page.evaluate(() => document.fonts?.ready)
if (flag('--tap')) { await page.locator(flag('--tap')).first().click(); await page.waitForTimeout(1000) }
if (flag('--scroll')) { await page.evaluate(px => { const s = document.querySelector('[data-scroll]') || document.scrollingElement; s.scrollTop = px }, Number(flag('--scroll'))); await page.waitForTimeout(300) }
await page.waitForTimeout(Number(flag('--settle', 700)))
log.perf = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {}
  const res = performance.getEntriesByType('resource')
  return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0), resources: res.length, transferKB: Math.round(res.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024), jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }
})
log.state = await page.evaluate(() => window.__state || null)
log.title = await page.title()
await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: has('--full') })
await browser.close()
log.ok = log.ready && log.errors.length === 0
writeFileSync(`${outDir}/${name}.json`, JSON.stringify(log, null, 2))
console.log(`${log.ok ? 'OK ' : 'FAIL'} ${name}.png  ready=${log.ready} ${log.readyMs}ms  errors=${log.errors.length} failedReq=${log.failedRequests.length} warnings=${log.warnings.length}`)
for (const e of log.errors) console.log('  ERR', e.type, e.text.slice(0, 200))
process.exit(log.ok ? 0 : 1)
