// Precompute the settled force layout for a person's memories (build-time physics).
// Runtime then seeds node positions directly: no warmup jank, instant person switching.
// Usage: node scripts/compute-layout.mjs [--person p2]
// Re-run whenever a person's memories change.
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force-3d';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pIdx = process.argv.indexOf('--person');
const person = pIdx > -1 ? process.argv[pIdx + 1] : 'p1';
const memFile = person === 'p2' ? 'memories-p2.json' : 'memories.json';
const outFile = person === 'p2' ? 'layout-p2.json' : 'layout-p1.json';

// Anisotropic gravity: screens are wide, so pull harder vertically — the layout settles
// into a screen-shaped oval. Defaults tuned per person size (more nodes = more repulsion
// to counter). Override with GRAVX/GRAVY env vars when tuning.
const defaults = person === 'p2' ? [0.10, 0.22] : [0.045, 0.10];
const GRAVX = Number(process.env.GRAVX || defaults[0]);
const GRAVY = Number(process.env.GRAVY || defaults[1]);
const memories = JSON.parse(readFileSync(join(root, 'src/data', memFile), 'utf8'));
const { deriveEdges } = await import(join(root, 'src/lib/edges.js'));
const edges = deriveEdges(memories);

const nodes = memories.map((m) => ({ id: m.id, importance: m.importance || 1 }));
const links = edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight }));
const rOf = (n) => 4 + n.importance * 2;

// Same physics the app used at runtime (graph-view/SKILL.md → Physics & spacing v2).
const sim = forceSimulation(nodes, 2)
  .force('link', forceLink(links).id((n) => n.id).distance((l) => 50 + 240 / l.weight).strength((l) => Math.min(0.5, l.weight / 12)))
  .force('charge', forceManyBody().strength(-250))
  .force('center', forceCenter())
  .force('collide', forceCollide((n) => rOf(n) + 16).iterations(2))
  // Weak gravity toward the origin: without it, disconnected clusters repel each other
  // into vast empty gulfs (the longer the settle, the further apart). Collision still
  // guarantees breathing room, so gravity compresses empty space, not memories.
  .force('gx', forceX(0).strength(GRAVX))
  .force('gy', forceY(0).strength(GRAVY))
  .stop();
for (let i = 0; i < 300; i++) sim.tick();

const layout = {};
for (const n of nodes) layout[n.id] = [Math.round(n.x * 10) / 10, Math.round(n.y * 10) / 10];
writeFileSync(join(root, 'src/data', outFile), JSON.stringify(layout) + '\n');
const xs = nodes.map((n) => n.x); const ys = nodes.map((n) => n.y);
console.log(`${outFile}: ${nodes.length} positions, bbox ${Math.round(Math.max(...xs) - Math.min(...xs))} x ${Math.round(Math.max(...ys) - Math.min(...ys))}`);
