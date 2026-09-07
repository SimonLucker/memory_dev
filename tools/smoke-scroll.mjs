#!/usr/bin/env node
// Scroll regression: a touch phone context walks the paths Simon reported as
// dead (story opened from Memories, Home after the Capture sheet closes) and
// asserts each scroller still moves under a real finger swipe. Touches go
// through CDP Input.dispatchTouchEvent, so touch-action, pointer-events and
// anything painted on top are all exercised for real.
//   node tools/smoke-scroll.mjs [--persona p5]
import { chromium, devices } from 'playwright'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const base = process.env.SHOT_BASE || 'http://127.0.0.1:5173'
const pid = flag('--persona', 'p5')
const fails = []
const check = (name, ok, detail) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); if (!ok) fails.push(name) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
const errors = []
page.on('pageerror', e => errors.push(String(e)))

const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
  type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 12, radiusY: 12, force: 1, id: 1 }],
})

// One finger dragged straight up over the middle of `sel`.
const swipeUp = async (sel, dy = 260) => {
  const b = await page.locator(sel).first().boundingBox()
  const x = Math.round(b.x + b.width / 2)
  const y = Math.round(b.y + b.height * 0.75)
  await touch('touchStart', x, y)
  for (let i = 1; i <= 12; i++) { await touch('touchMove', x, y - (dy * i) / 12); await page.waitForTimeout(16) }
  await touch('touchEnd', x, y - dy)
  await page.waitForTimeout(500) // let momentum settle
}

const scrollState = sel => page.evaluate(s => {
  const el = document.querySelector(s)
  if (!el) return { missing: true }
  const r = el.getBoundingClientRect()
  const over = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height * 0.75))
  return {
    top: el.scrollTop,
    scrollable: el.scrollHeight > el.clientHeight + 4,
    touchAction: getComputedStyle(el).touchAction,
    // What a finger would actually land on: anything else is covering the scroller.
    hitBy: over && !el.contains(over) && over !== el ? `${over.tagName}.${over.className}` : null,
  }
}, sel)

// Swipe, then report whether the container moved and why not.
const swipeScrolls = async sel => {
  const before = await scrollState(sel)
  if (before.missing) return { ok: false, why: 'element missing' }
  if (!before.scrollable) return { ok: false, why: 'content shorter than the viewport' }
  await swipeUp(sel)
  const after = await scrollState(sel)
  const moved = after.top - before.top
  return { ok: moved > 20, why: `moved=${moved}px touchAction=${before.touchAction} hitBy=${before.hitBy || 'itself'}` }
}

await page.goto(`${base}/?persona=${pid}`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true)

const HOME = '.app-screen:not([hidden])'

// 1. Memories -> tap a tile -> the story must scroll.
await page.click('.tab-item:last-of-type')
await page.waitForFunction(() => window.__state?.tab === 'memories')
await page.waitForTimeout(300)
await page.click('.mg-tile')
await page.waitForFunction(() => window.__state?.stack?.length === 1)
await page.waitForTimeout(1200) // the 900ms grow plus slack
let r = await swipeScrolls('.st')
check('story scrolls after opening from Memories', r.ok, r.why)

// 2. Back -> Memories must still scroll (the popped layer lingers 600ms).
await page.click('.st-back')
await page.waitForFunction(() => window.__state?.stack?.length === 0)
await page.waitForTimeout(700)
r = await swipeScrolls(HOME)
check('memories scrolls after back', r.ok, r.why)

// 3. Pop and push again inside the linger window: the popped layer must be
//    gone, not stranded on top of the new one for the rest of the session.
await page.click('.mg-tile')
await page.waitForFunction(() => window.__state?.stack?.length === 1)
await page.waitForTimeout(1200)
await page.click('.st-back')
await page.waitForTimeout(120)
await page.click('.mg-tile')
await page.waitForFunction(() => window.__state?.stack?.length === 1)
await page.waitForTimeout(1200)
const ghosts = await page.locator('.app-push.leaving').count()
check('popped layer is not stranded by a push inside the linger window', ghosts === 0, `${ghosts} leaving layers`)
r = await swipeScrolls('.st')
check('story scrolls after a fast back-open', r.ok, r.why)

await page.click('.st-back')
await page.waitForFunction(() => window.__state?.stack?.length === 0)
await page.waitForTimeout(900)
const stuck = await page.locator('.app-push').count()
check('no pushed layer left mounted after back', stuck === 0, `${stuck} .app-push in the tree`)
r = await swipeScrolls(HOME)
check('memories scrolls after a fast back-open-back', r.ok, r.why)

// 4. Home -> open the Capture sheet -> close it -> Home must scroll.
await page.click('.tab-item:first-of-type')
await page.waitForFunction(() => window.__state?.tab === 'home')
await page.waitForTimeout(300)
await page.click('.tab-plus')
await page.waitForFunction(() => window.__state?.sheet === 'capture')
await page.waitForTimeout(900)
await page.click('.cs-close')
await page.waitForFunction(() => window.__state?.sheet === null)
await page.waitForTimeout(900)
r = await swipeScrolls(HOME)
check('home scrolls after closing Capture', r.ok, r.why)

check('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
if (fails.length) { console.log(`\n${fails.length} failing: ${fails.join(', ')}`); process.exit(1) }
console.log('\nall scroll paths alive')
