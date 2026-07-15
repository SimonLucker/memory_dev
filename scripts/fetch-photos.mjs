// One-time: fetch a stock photo per memory from Pexels into public/photos/.
// Usage: PEXELS_API_KEY=... node scripts/fetch-photos.mjs
// The key lives only in the environment — never in the repo.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) { console.error('PEXELS_API_KEY not set'); process.exit(1); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const memPath = join(root, 'src/data/memories.json');
const outDir = join(root, 'public/photos');
mkdirSync(outDir, { recursive: true });

const memories = JSON.parse(readFileSync(memPath, 'utf8'));

// Query from the memory's content, minus personal names that confuse stock search.
const q = (m) => `${m.what} ${m.where}`.replace(/[A-Z][a-z]+'s/g, '').replace(/\s+/g, ' ').trim() || m.class;

for (const m of memories) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q(m))}&per_page=1&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
  if (!res.ok) { console.error(m.id, 'search failed', res.status); continue; }
  const data = await res.json();
  const photo = data.photos?.[0];
  if (!photo) { console.error(m.id, 'no result for', q(m)); continue; }
  const img = await fetch(photo.src.medium);
  writeFileSync(join(outDir, `${m.id}.jpg`), Buffer.from(await img.arrayBuffer()));
  m.photos = [`photos/${m.id}.jpg`];
  console.log(m.id, '←', q(m));
  await new Promise((r) => setTimeout(r, 250)); // stay friendly to the rate limit
}

writeFileSync(memPath, JSON.stringify(memories, null, 2) + '\n');
console.log('done —', memories.filter((m) => m.photos?.length).length, 'memories with photos');
