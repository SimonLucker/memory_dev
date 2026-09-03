#!/usr/bin/env node
// Merges docs/status/<module>.json (written by critics, one file per module so
// parallel critics never clobber each other) into docs/STATUS.json, the single
// scoreboard. Usage: node tools/status.mjs [--print]
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

const dir = 'docs/status'
mkdirSync(dir, { recursive: true })
const board = existsSync('docs/STATUS.json') ? JSON.parse(readFileSync('docs/STATUS.json', 'utf8')) : { passThreshold: 8.5, modules: {} }
for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const m = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))
  const name = f.replace(/\.json$/, '')
  const prev = board.modules[name] || {}
  board.modules[name] = { ...prev, ...m, history: [...(prev.history || []), { round: m.round, score: m.score, pass: m.pass, errors: m.errors, at: m.updated }].slice(-8) }
}
board.updated = new Date().toISOString()
board.weakest = Object.entries(board.modules).filter(([, m]) => m.score != null).sort((a, b) => a[1].score - b[1].score).map(([n, m]) => `${n}:${m.score}`).slice(0, 3)
board.allPass = Object.values(board.modules).every(m => m.pass === true)
writeFileSync('docs/STATUS.json', JSON.stringify(board, null, 2))
if (process.argv.includes('--print')) for (const [n, m] of Object.entries(board.modules)) console.log(`${n.padEnd(9)} score=${m.score ?? '-'} round=${m.round ?? 0} pass=${m.pass} errors=${m.errors ?? '-'} issues=${(m.issues || []).length}`)
console.log(`STATUS.json updated. allPass=${board.allPass} weakest=${board.weakest.join(', ')}`)
