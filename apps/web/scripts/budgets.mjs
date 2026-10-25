/**
 * Size budgets for the production build (docs/perf.md). Pure: check-budgets.mjs measures dist/ and calls this.
 * @typedef {{ path: string; bytes: number; gzip: number }} BuiltFile   path relative to dist/, forward slashes
 */
const kB = 1000;
export const BUDGETS = {
  // Everything index.html loads at startup (the entry plus its modulepreloaded chunks), however the bundler splits it.
  startupGzip: 150 * kB,
  chunkGzip: 120 * kB,
  cssGzip: 25 * kB,
  // Raw bytes: the app's code, its fonts and the shell data, all precached so every route works offline. The download
  // is compressed, so a phone fetches about a third of this (0.81 MB for 2.73 MB after the UI overhaul).
  precacheBytes: 3.0 * 1024 * 1024,
  catalogueGzip: 300 * kB,
  rosterGzip: 250 * kB,
  rulesGzip: 100 * kB,
  infoGzip: 150 * kB,
};

const size = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / kB).toFixed(1)} kB`);

/**
 * The JS files index.html loads at startup: its module entry script, then every modulepreloaded chunk, in page order.
 * @param {string} html dist/index.html
 * @returns {string[]} paths relative to dist/
 */
export function startupFiles(html) {
  const entry = /<script\b[^>]*type="module"[^>]*\bsrc="\/([^"]+)"/.exec(html)?.[1];
  const preloads = [...html.matchAll(/<link\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => /\brel="modulepreload"/.test(tag))
    .map((tag) => /\bhref="\/([^"]+)"/.exec(tag)?.[1])
    .filter(Boolean);
  return entry ? [entry, ...preloads] : preloads;
}

/**
 * @param {BuiltFile[]} files every file in dist/
 * @param {string[]} startup the JS files index.html loads at startup: the entry first, then its preloaded chunks
 * @param {number} precacheBytes total size of the service worker's precache
 * @returns {{ ok: boolean; lines: string[] }}
 */
export function evaluateBudgets(files, startup, precacheBytes) {
  const lines = [];
  const check = (label, value, limit, unit = 'gzip') => lines.push(`${value <= limit ? 'ok  ' : 'FAIL'} ${label} ${size(value)}${unit ? ` ${unit}` : ''} ≤ ${size(limit)}`);
  const js = files.filter((f) => /^assets\/.*\.js$/.test(f.path));
  const [entry] = startup;
  const entryFile = js.find((f) => f.path === entry);
  const missing = startup.filter((p) => !js.some((f) => f.path === p));
  if (!entry || missing.length) lines.push(`FAIL startup JS: ${missing.join(', ') || 'no entry'} not found`);
  else {
    const total = startup.reduce((s, p) => s + js.find((f) => f.path === p).gzip, 0);
    check(`startup JS (entry + ${startup.length - 1} preloaded)`, total, BUDGETS.startupGzip);
  }
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
  each('info', /^data\/info\//, BUDGETS.infoGzip);
  return { ok: !lines.some((l) => l.startsWith('FAIL')), lines };
}
