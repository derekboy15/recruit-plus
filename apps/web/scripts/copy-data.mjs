// Copies the generated faction data into public/data so Vite serves it at /data/*.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..', 'packages', 'data', 'generated');
const dest = join(here, '..', 'public', 'data');

if (!existsSync(join(src, 'index.json'))) {
  console.error('Faction data not found. Run "npm run data:fetch && npm run data:build" from the repo root first.');
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied faction data to ${dest}`);
