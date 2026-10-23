/**
 * Size budgets for the production build (docs/perf.md). Pure: check-budgets.mjs measures dist/ and calls this.
 * @typedef {{ path: string; bytes: number; gzip: number }} BuiltFile   path relative to dist/, forward slashes
 */
const kB = 1000;
export const BUDGETS = {
  entryGzip: 110 * kB,
  chunkGzip: 120 * kB,
  cssGzip: 25 * kB,
  precacheBytes: 2.6 * 1024 * 1024,
  catalogueGzip: 300 * kB,
  rosterGzip: 250 * kB,
  rulesGzip: 100 * kB,
};

const size = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / kB).toFixed(1)} kB`);

/**
 * @param {BuiltFile[]} files every file in dist/
 * @param {string} entry the JS file index.html loads
 * @param {number} precacheBytes total size of the service worker's precache
 * @returns {{ ok: boolean; lines: string[] }}
 */
export function evaluateBudgets(files, entry, precacheBytes) {
  const lines = [];
  const check = (label, value, limit, unit = 'gzip') => lines.push(`${value <= limit ? 'ok  ' : 'FAIL'} ${label} ${size(value)}${unit ? ` ${unit}` : ''} ≤ ${size(limit)}`);
  const js = files.filter((f) => /^assets\/.*\.js$/.test(f.path));
  const entryFile = js.find((f) => f.path === entry);
  if (!entryFile) lines.push(`FAIL main entry ${entry} not found`);
  else check('main entry', entryFile.gzip, BUDGETS.entryGzip);
  const biggest = (list) => [...list].sort((a, b) => b.gzip - a.gzip);
  for (const f of biggest(js.filter((f) => f !== entryFile))) if (f.gzip > BUDGETS.chunkGzip) check(f.path, f.gzip, BUDGETS.chunkGzip);
  const [topChunk] = biggest(js.filter((f) => f !== entryFile));
  if (topChunk && topChunk.gzip <= BUDGETS.chunkGzip) check(`largest chunk (${topChunk.path})`, topChunk.gzip, BUDGETS.chunkGzip);
  check('CSS', files.filter((f) => /^assets\/.*\.css$/.test(f.path)).reduce((s, f) => s + f.gzip, 0), BUDGETS.cssGzip);
  check('precache', precacheBytes, BUDGETS.precacheBytes, '');
  const each = (label, re, limit) => {
    const list = biggest(files.filter((f) => re.test(f.path)));
    for (const f of list) if (f.gzip > limit) check(f.path, f.gzip, limit);
    if (list[0] && list[0].gzip <= limit) check(`largest ${label} (${list[0].path})`, list[0].gzip, limit);
  };
  each('catalogue', /^data\/catalogues\//, BUDGETS.catalogueGzip);
  each('roster', /^data\/roster\//, BUDGETS.rosterGzip);
  each('rules', /^data\/rules\.json$/, BUDGETS.rulesGzip);
  return { ok: !lines.some((l) => l.startsWith('FAIL')), lines };
}
