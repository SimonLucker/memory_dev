#!/usr/bin/env node
// Runs every showcase scene of one module through tools/shot.mjs across the
// critic's matrix (viewports, pixel densities, times of day) and writes
// docs/shots/<module>/summary.json. Usage: node tools/gauntlet.mjs <module> [--quick]
//   --quick  = phone only, dpr 2, morning only (a builder's smoke run)
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'

const [mod, ...rest] = process.argv.slice(2)
if (!mod) { console.error('usage: node tools/gauntlet.mjs <module> [--quick]'); process.exit(2) }
const quick = rest.includes('--quick')
const { scenes } = await import(`../src/${mod}/showcase.js`)
const outDir = `docs/shots/${mod}`
mkdirSync(outDir, { recursive: true })

const vps = quick ? ['phone'] : ['phone', 'phoneSmall', 'desktop']
const dprs = quick ? [2] : [2, 3]
const clocks = quick ? [['morning', '2026-09-04T09:00:00']] : [['morning', '2026-09-04T09:00:00'], ['evening', '2026-09-04T21:00:00']]
const results = []
for (const scene of Object.keys(scenes)) for (const vp of vps) for (const dpr of dprs) for (const [tod, iso] of clocks) {
  if (vp === 'desktop' && dpr === 3) continue
  const name = `${mod}/${scene}-${vp}-x${dpr}-${tod}`
  const url = `/?showcase=${mod}&scene=${scene}&now=${iso}&persona=${scenes[scene].persona || 'p5'}`
  const extra = scenes[scene].shot || [] // e.g. ['--full'] or ['--scroll', '600']
  const r = spawnSync('node', ['tools/shot.mjs', url, '--out', name, '--vp', vp, '--dpr', String(dpr), '--clock', iso, ...extra], { encoding: 'utf8' })
  process.stdout.write(r.stdout)
  const json = existsSync(`docs/shots/${name}.json`) ? JSON.parse(readFileSync(`docs/shots/${name}.json`, 'utf8')) : { errors: [{ type: 'no-output', text: r.stderr.slice(0, 300) }], failedRequests: [] }
  results.push({ name, url, vp, dpr, tod, ok: json.ok === true, ready: json.ready, readyMs: json.readyMs, errors: json.errors, failedRequests: json.failedRequests, perf: json.perf })
}
const summary = {
  module: mod, ran: new Date().toISOString(), quick, shots: results.length,
  failed: results.filter(r => !r.ok).length,
  errors: [...new Set(results.flatMap(r => r.errors.map(e => `${e.type}: ${e.text.slice(0, 160)}`)))],
  failedRequests: [...new Set(results.flatMap(r => r.failedRequests.map(f => `${f.status || f.reason} ${f.url}`)))],
  slowest: results.slice().sort((a, b) => (b.readyMs || 0) - (a.readyMs || 0)).slice(0, 3).map(r => ({ name: r.name, readyMs: r.readyMs })),
  results,
}
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 2))
console.log(`\n${mod}: ${results.length} shots, ${summary.failed} failed, ${summary.errors.length} distinct errors, ${summary.failedRequests.length} failed requests -> ${outDir}/summary.json`)
process.exit(summary.failed ? 1 : 0)
