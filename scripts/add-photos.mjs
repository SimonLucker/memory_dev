// Add extra Pexels photos to specific memories.
// Usage: PEXELS_API_KEY=... node scripts/add-photos.mjs m001:4 m007:3 m015:2
//   or:  PEXELS_API_KEY=... node scripts/add-photos.mjs --spread 12
//        (--spread N picks N random memories and gives each 2-4 photos)
// Counts are TOTALS per memory (existing photos included). Key via env only.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) { console.error('PEXELS_API_KEY not set'); process.exit(1); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// --person p2 targets Maya's file; default is person 1
const pIdx = process.argv.indexOf('--person');
const person = pIdx > -1 ? process.argv.splice(pIdx, 2)[1] : 'p1';
const memPath = join(root, person === 'p2' ? 'src/data/memories-p2.json' : 'src/data/memories.json');
const outDir = join(root, 'public/photos');
mkdirSync(outDir, { recursive: true });
const memories = JSON.parse(readFileSync(memPath, 'utf8'));

// Parse targets: explicit "id:count" args, or --spread N
let targets = [];
const args = process.argv.slice(2);
if (args[0] === '--spread') {
  const n = Number(args[1]) || 10;
  const shuffled = [...memories].sort(() => Math.random() - 0.5).slice(0, n);
  targets = shuffled.map((m) => [m.id, 2 + Math.floor(Math.random() * 3)]); // totals of 2-4
} else {
  targets = args.map((a) => { const [id, c] = a.split(':'); return [id, Number(c) || 2]; });
}
if (!targets.length) { console.error('nothing to do — pass id:count args or --spread N'); process.exit(1); }

const q = (m) => `${m.what} ${m.where}`.replace(/[A-Z][a-z]+'s/g, '').replace(/\s+/g, ' ').trim() || m.class;

for (const [id, total] of targets) {
  const m = memories.find((x) => x.id === id);
  if (!m) { console.error(id, 'not found'); continue; }
  m.photos = m.photos || [];
  const need = total - m.photos.length;
  if (need <= 0) { console.log(id, 'already has', m.photos.length); continue; }
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q(m))}&per_page=${total + m.photos.length + 2}&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
  if (!res.ok) { console.error(id, 'search failed', res.status); continue; }
  // Skip the results the memory already owns (fetch-photos used result #0 as the hero —
  // starting at 0 again re-downloaded it as a duplicate under a new filename).
  const photos = ((await res.json()).photos || []).slice(m.photos.length);
  let added = 0;
  for (const photo of photos) {
    if (added >= need) break;
    const idx = m.photos.length + 1;
    const file = `${id}_${idx}.jpg`;
    const img = await fetch(photo.src.medium);
    writeFileSync(join(outDir, file), Buffer.from(await img.arrayBuffer()));
    m.photos.push(`photos/${file}`);
    added++;
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(id, `→ ${m.photos.length} photos (${added} added)`);
}

writeFileSync(memPath, JSON.stringify(memories, null, 2) + '\n');
console.log('done');
