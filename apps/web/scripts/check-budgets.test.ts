import { describe, expect, test } from 'vitest';
import { evaluateBudgets, startupFiles, type BuiltFile } from './budgets.mjs';

const kB = 1000;
/** The production build measured before Milestone 8 (docs/perf.md). */
const baseline: BuiltFile[] = [
  { path: 'assets/index-abc.js', bytes: 238 * kB, gzip: 75 * kB },
  { path: 'assets/pixiRenderer-abc.js', bytes: 284 * kB, gzip: 84 * kB },
  { path: 'assets/index-abc.css', bytes: 40 * kB, gzip: 9 * kB },
  { path: 'data/catalogues/imperium-adeptus-astartes-space-wolves.json', bytes: 1967 * kB, gzip: 190 * kB },
  { path: 'data/roster/imperium-space-marines.json', bytes: 956 * kB, gzip: 161 * kB },
  { path: 'data/rules.json', bytes: 366 * kB, gzip: 62 * kB },
];
/** What index.html loads at startup: the entry and the chunks it modulepreloads. */
const STARTUP = ['assets/index-abc.js'];
const failed = (r: ReturnType<typeof evaluateBudgets>) => r.lines.filter((l) => l.startsWith('FAIL'));

describe('evaluateBudgets', () => {
  test('passes the measured baseline', () => {
    const r = evaluateBudgets(baseline, STARTUP, 2400 * 1024);
    expect(failed(r)).toEqual([]);
    expect(r.ok).toBe(true);
  });

  // Startup JS is the entry plus every chunk index.html modulepreloads: the bundler may fold a shared chunk into the
  // entry or split it out again, so the entry alone isn't a stable measure of what a first visit downloads.
  test('flags startup JS (entry + preloaded chunks) over 150 kB gzip', () => {
    const files = [...baseline, { path: 'assets/ids-abc.js', bytes: 120 * kB, gzip: 76 * kB }];
    const r = evaluateBudgets(files, [...STARTUP, 'assets/ids-abc.js'], 0);
    expect(r.ok).toBe(false);
    expect(failed(r).join()).toContain('startup JS');
  });

  test('startup JS under 150 kB gzip passes, however it is split', () => {
    const merged = baseline.map((f) => (f.path === STARTUP[0] ? { ...f, gzip: 121 * kB } : f));
    expect(failed(evaluateBudgets(merged, STARTUP, 0))).toEqual([]);
    expect(evaluateBudgets(merged, STARTUP, 0).lines.join('\n')).toContain('startup JS (entry + 0 preloaded)');
  });

  test('startupFiles reads the entry script and the modulepreload links from index.html', () => {
    const html = [
      '<script type="module" crossorigin src="/assets/index-abc.js"></script>',
      '<link rel="modulepreload" crossorigin href="/assets/rolldown-runtime-abc.js">',
      '<link rel="stylesheet" crossorigin href="/assets/index-abc.css">',
      '<link href="/assets/ids-abc.js" rel="modulepreload">',
    ].join('\n');
    expect(startupFiles(html)).toEqual(['assets/index-abc.js', 'assets/rolldown-runtime-abc.js', 'assets/ids-abc.js']);
  });

  test('flags another chunk over 120 kB gzip', () => {
    const r = evaluateBudgets([...baseline, { path: 'assets/big-abc.js', bytes: 400 * kB, gzip: 121 * kB }], STARTUP, 0);
    expect(failed(r).join()).toContain('assets/big-abc.js');
  });

  test('flags a catalogue over 300 kB gzip', () => {
    const r = evaluateBudgets([...baseline, { path: 'data/catalogues/huge.json', bytes: 3000 * kB, gzip: 301 * kB }], STARTUP, 0);
    expect(failed(r).join()).toContain('data/catalogues/huge.json');
  });

  test('flags a roster over 250 kB gzip and rules over 100 kB gzip', () => {
    const r = evaluateBudgets(
      [...baseline.filter((f) => f.path !== 'data/rules.json'), { path: 'data/roster/huge.json', bytes: 2000 * kB, gzip: 251 * kB }, { path: 'data/rules.json', bytes: 900 * kB, gzip: 101 * kB }],
      STARTUP,
      0,
    );
    expect(failed(r)).toHaveLength(2);
  });

  test('flags an info file over 150 kB gzip', () => {
    const at = (gzip: number) => evaluateBudgets([...baseline, { path: 'data/info/necrons.json', bytes: 900 * kB, gzip }], STARTUP, 0);
    expect(failed(at(151 * kB)).join()).toContain('data/info/necrons.json');
    expect(failed(at(149 * kB))).toEqual([]);
    expect(at(149 * kB).lines.join('\n')).toContain('largest info (data/info/necrons.json)');
  });

  test('flags CSS over 25 kB gzip', () => {
    const r = evaluateBudgets([...baseline, { path: 'assets/more-abc.css', bytes: 200 * kB, gzip: 26 * kB }], STARTUP, 0);
    expect(failed(r).join()).toContain('CSS');
  });

  test('precache over 2.75 MB fails', () => {
    const r = evaluateBudgets(baseline, STARTUP, 2.76 * 1024 * 1024);
    expect(failed(r).join()).toContain('precache');
  });

  // The self-hosted fonts (about 114 kB of woff2) are precached so the app looks the same offline.
  test('a precache with the fonts, up to 2.75 MB, is ok', () => {
    const r = evaluateBudgets(baseline, STARTUP, 2.74 * 1024 * 1024);
    expect(failed(r).join()).not.toContain('precache');
  });
});
