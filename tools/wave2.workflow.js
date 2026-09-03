export const meta = {
  name: 'memmory-v3-lean-loop',
  description: 'Lean gauntlet: ONE Sonnet critic scores all modules from the quick matrix, then one Sonnet fixer per failing module; max 2 rounds',
  phases: [{ title: 'Critic' }, { title: 'Fix' }],
}
// Cost controls versus wave 1: model sonnet everywhere, one critic for all modules
// (docs read once instead of six times), quick shot matrix (5-7 shots per module,
// not 30-70), at most 4 PNG reads per module, no reference page re-shots (the
// mockup crops live in docs/reference/mockups), fix rounds capped at 2.
const REPO = '/home/claude/work/graph_prototype'
const MODULES = args?.modules || ['home', 'memories', 'story', 'recap', 'capture', 'profile']
const MAX_ROUNDS = args?.maxRounds || 2
const MODEL = args?.model || 'sonnet'

const VERDICTS = { type: 'object', required: ['modules'], properties: { modules: { type: 'array', items: { type: 'object', required: ['module', 'score', 'pass', 'errors', 'issues', 'notes'], properties: {
  module: { type: 'string' }, score: { type: 'number' }, pass: { type: 'boolean' }, errors: { type: 'number' }, notes: { type: 'string' },
  issues: { type: 'array', items: { type: 'object', required: ['rank', 'severity', 'text', 'shot'], properties: { rank: { type: 'number' }, severity: { type: 'string' }, text: { type: 'string' }, shot: { type: 'string' } } } } } } } } }
const REPORT = { type: 'object', required: ['summary', 'coreRequests', 'openIssues'], properties: { summary: { type: 'string' }, coreRequests: { type: 'array', items: { type: 'string' } }, openIssues: { type: 'array', items: { type: 'string' } } } }

const critic = (round, mods) => `You are the art-director critic for the Memmory v3 web app in ${REPO}. You write no code. Budget: be economical, no exploratory reading. Read ONLY: ${REPO}/docs/CRITIC.md (the rule sheet, scoring scale and per-module checklist, about 200 lines). Then for each module in ${JSON.stringify(mods)}: run "node tools/gauntlet.mjs <module> --quick" (dev server http://127.0.0.1:5173 must answer; if not, start it with: nohup npx vite --port 5173 --host 127.0.0.1 > /tmp/vite.log 2>&1 &), read docs/shots/<module>/summary.json (any error, failed request or ready timeout = errors > 0 = fail), then Read at most 3 PNGs per module from docs/shots/<module>/ (the default scene, plus the two scenes most likely to hide problems) and the matching mockup crop docs/reference/mockups/<module>.png when it exists. For long screens take ONE extra shot with --scroll 900. Score 0-10 (10 indistinguishable from a shipped AAA app and the mockup; 8.5 AAA with nits; 7 good; 5 programmer art). pass = score >= 8.5 and errors == 0. Never inflate. Issues: ranked, concrete, each naming the shot; at most 6 per module; only things a builder can act on inside src/<module>/ (put store/core/data problems in notes prefixed "core:"). Write each verdict to ${REPO}/docs/status/<module>.json as {"score","round":${round},"pass","errors","issues":[{rank,severity,text,shot}],"shots":[..],"notes","updated":"<ISO from date -u>"} then run "node tools/status.mjs --print". Return all verdicts as structured output.`

const fixer = (mod, v) => `You are the ${mod} fixer for the Memmory v3 web app in ${REPO} (React + Vite, plain JSX, no new deps). Invoke the Skill tool with skill "ponytail" first. Edit ONLY src/${mod}/. Read only src/${mod}/* and, if an issue references it, the exact file it names; ${REPO}/docs/CRITIC.md has the rule sheet. Critic score ${v.score}/10, notes: ${v.notes}
Ranked issues:
${v.issues.map(i => `${i.rank}. [${i.severity}] ${i.text} (shot: ${i.shot})`).join('\n')}
Fix them in order. Then: npx vite build must pass and "node tools/gauntlet.mjs ${mod} --quick" must report 0 errors; Read ONE resulting PNG to confirm the top fix. Keep the report short: what changed per issue, what you could not fix and why (spec beats critic), and any request for core/data as one line each.`

let mods = MODULES
for (let round = 1; round <= MAX_ROUNDS && mods.length; round++) {
  phase('Critic')
  const v = await agent(critic(round + (args?.roundOffset || 0), mods), { label: `critic:r${round}`, phase: 'Critic', schema: VERDICTS, model: MODEL })
  if (!v) { log('critic returned nothing'); break }
  const failing = v.modules.filter(m => !m.pass)
  log(`round ${round}: ${v.modules.map(m => `${m.module}=${m.score}${m.pass ? ' pass' : ''}`).join(', ')}`)
  if (!failing.length || round === MAX_ROUNDS) { return v }
  phase('Fix')
  await parallel(failing.map(m => () => agent(fixer(m.module, m), { label: `fix:${m.module}:r${round}`, phase: 'Fix', schema: REPORT, model: MODEL })))
  mods = failing.map(m => m.module)
}
return 'done'
