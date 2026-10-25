/** Checks the production build in dist/ against the size budgets (scripts/budgets.mjs). Run after `npm run build`. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { evaluateBudgets, startupFiles } from './budgets.mjs';

const dist = join(import.meta.dirname, '..', 'dist');
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
let paths;
try {
  paths = walk(dist);
} catch {
  console.error('No dist/ found: run npm run build first.');
  process.exit(1);
}
const files = paths
  .filter((p) => /\.(js|css|json|html|webmanifest|svg|png)$/.test(p))
  .map((p) => {
    const buf = readFileSync(p);
    return { path: relative(dist, p).split(sep).join('/'), bytes: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
  });
const startup = startupFiles(readFileSync(join(dist, 'index.html'), 'utf8'));
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
const precached = [...sw.matchAll(/"?url"?:"([^"]+)"/g)].map((m) => m[1].replace(/^\//, ''));
const bytesOf = new Map(files.map((f) => [f.path, f.bytes]));
const precacheBytes = precached.reduce((s, u) => s + (bytesOf.get(u) ?? statSync(join(dist, u)).size), 0);

const { ok, lines } = evaluateBudgets(files, startup, precacheBytes);
console.log(`Budgets (${precached.length} precached files):\n${lines.join('\n')}`);
if (!ok) process.exit(1);
