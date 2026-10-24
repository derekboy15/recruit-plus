import { describe, expect, test } from 'vitest';
import { evaluateBudgets, type BuiltFile } from './budgets.mjs';

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
const ENTRY = 'assets/index-abc.js';
const failed = (r: ReturnType<typeof evaluateBudgets>) => r.lines.filter((l) => l.startsWith('FAIL'));

describe('evaluateBudgets', () => {
  test('passes the measured baseline', () => {
    const r = evaluateBudgets(baseline, ENTRY, 2400 * 1024);
    expect(failed(r)).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test('flags an entry over 110 kB gzip', () => {
    const files = baseline.map((f) => (f.path === ENTRY ? { ...f, gzip: 111 * kB } : f));
    const r = evaluateBudgets(files, ENTRY, 0);
    expect(r.ok).toBe(false);
    expect(failed(r).join()).toContain('main entry');
  });

  test('flags another chunk over 120 kB gzip', () => {
    const r = evaluateBudgets([...baseline, { path: 'assets/big-abc.js', bytes: 400 * kB, gzip: 121 * kB }], ENTRY, 0);
    expect(failed(r).join()).toContain('assets/big-abc.js');
  });

  test('flags a catalogue over 300 kB gzip', () => {
    const r = evaluateBudgets([...baseline, { path: 'data/catalogues/huge.json', bytes: 3000 * kB, gzip: 301 * kB }], ENTRY, 0);
    expect(failed(r).join()).toContain('data/catalogues/huge.json');
  });

  test('flags a roster over 250 kB gzip and rules over 100 kB gzip', () => {
    const r = evaluateBudgets(
      [...baseline.filter((f) => f.path !== 'data/rules.json'), { path: 'data/roster/huge.json', bytes: 2000 * kB, gzip: 251 * kB }, { path: 'data/rules.json', bytes: 900 * kB, gzip: 101 * kB }],
      ENTRY,
      0,
    );
    expect(failed(r)).toHaveLength(2);
  });

  test('flags an info file over 150 kB gzip', () => {
    const at = (gzip: number) => evaluateBudgets([...baseline, { path: 'data/info/necrons.json', bytes: 900 * kB, gzip }], ENTRY, 0);
    expect(failed(at(151 * kB)).join()).toContain('data/info/necrons.json');
    expect(failed(at(149 * kB))).toEqual([]);
    expect(at(149 * kB).lines.join('\n')).toContain('largest info (data/info/necrons.json)');
  });

  test('flags CSS over 25 kB gzip', () => {
    const r = evaluateBudgets([...baseline, { path: 'assets/more-abc.css', bytes: 200 * kB, gzip: 26 * kB }], ENTRY, 0);
    expect(failed(r).join()).toContain('CSS');
  });

  test('precache over 2.6 MB fails', () => {
    const r = evaluateBudgets(baseline, ENTRY, 2.61 * 1024 * 1024);
    expect(failed(r).join()).toContain('precache');
  });
});
