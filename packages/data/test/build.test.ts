import { test, expect, beforeAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { buildAll } from '../src/build';
import type { CatalogueOut, DataIndex } from '../src/model/types';

const ROOT = join(__dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'recruit-data-'));
let index: DataIndex;

beforeAll(() => {
  index = buildAll({ rawDir: join(ROOT, 'raw'), overridesDir: join(ROOT, 'overrides'), outDir: out }).index;
});

test('index lists all 52 catalogues and every catalogue file exists', () => {
  expect(index.catalogues).toHaveLength(52);
  expect(index.sources.bsdata).toBe('v9.8.0');
  expect(index.sources.wahapediaLastUpdate.startsWith('2023-06-26')).toBe(true);
  for (const c of index.catalogues) expect(existsSync(join(out, 'catalogues', `${c.slug}.json`)), c.slug).toBe(true);
});

test('every playable catalogue has units and each file is under 4 MB', () => {
  for (const c of index.catalogues) {
    if (!c.library) expect(c.unitCount, c.name).toBeGreaterThan(0);
    expect(statSync(join(out, 'catalogues', `${c.slug}.json`)).size, c.slug).toBeLessThan(4 * 1024 * 1024);
  }
});

test('every generated catalogue, plain English included, fits the app budget of 300 kB gzip (budgets.mjs catalogueGzip)', () => {
  const gen = join(ROOT, 'generated', 'catalogues');
  for (const c of index.catalogues) expect(gzipSync(readFileSync(join(gen, `${c.slug}.json`)), { level: 9 }).length, c.slug).toBeLessThanOrEqual(300_000);
});

test('necrons.json has Necron Warriors with points and shared rules', () => {
  const necrons: CatalogueOut = JSON.parse(readFileSync(join(out, 'catalogues', 'necrons.json'), 'utf8'));
  expect(necrons.group).toBe('Xenos');
  expect(necrons.units.find((u) => u.name === 'Necron Warriors')!.points).toBe(110);
  expect(necrons.rules.some((r) => r.name === 'Reanimation Protocols' && r.text.length > 0)).toBe(true);
});

test('report records match counts per catalogue', () => {
  const report = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
  expect(report.necrons.units).toBeGreaterThan(0);
  expect(Array.isArray(report.necrons.unmatched)).toBe(true);
});

test('Fallen is a playable catalogue with its units', () => {
  const fallen = index.catalogues.find((c) => c.name === 'Fallen')!;
  expect(fallen.library).toBe(false);
  expect(fallen.unitCount).toBeGreaterThanOrEqual(4);
});

test('exactly 42 playable catalogues', () => {
  expect(index.catalogues.filter((c) => !c.library)).toHaveLength(42);
});
