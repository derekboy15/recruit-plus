/**
 * A faction's unit list (generated/units/<slug>.json): what the faction page shows of each unit, so the page doesn't
 * download the whole catalogue (per-model data made Space Wolves' 209 kB gzip, 1.2 s on a phone's 1.6 Mbps).
 * Reads generated/ (npm run data:build).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import type { CatalogueOut, DataIndex, UnitListOut } from '../src/model/types';
import { unitList } from '../src/model/unitList';

const GENERATED = join(__dirname, '..', 'generated');
const index: DataIndex = JSON.parse(readFileSync(join(GENERATED, 'index.json'), 'utf8'));
const read = <T>(...path: string[]): T => JSON.parse(readFileSync(join(GENERATED, ...path), 'utf8'));

describe('every catalogue has its unit list', () => {
  for (const c of index.catalogues) {
    test(`${c.slug}: the same units, each with what the faction page shows`, () => {
      expect(existsSync(join(GENERATED, 'units', `${c.slug}.json`))).toBe(true);
      const cat = read<CatalogueOut>('catalogues', `${c.slug}.json`);
      const list = read<UnitListOut>('units', `${c.slug}.json`);
      expect(list).toEqual(unitList(cat));
      expect(list.units.map((u) => [u.id, u.slug, u.name, u.role, u.points])).toEqual(cat.units.map((u) => [u.id, u.slug, u.name, u.role, u.points]));
    });
  }
});

test('the largest unit list is a small part of its catalogue (Space Wolves: ≤ 40 kB gzip)', () => {
  const gz = (p: string) => gzipSync(readFileSync(join(GENERATED, p))).length;
  expect(gz('units/imperium-adeptus-astartes-space-wolves.json')).toBeLessThanOrEqual(40_000);
});

test('a unit in the list keeps only the fields the faction page reads', () => {
  const list = read<UnitListOut>('units', 'imperium-adeptus-astartes-space-wolves.json');
  const keys = new Set(list.units.flatMap((u) => Object.keys(u)));
  expect([...keys].sort()).toEqual(['forgeWorld', 'id', 'legends', 'maxModels', 'minModels', 'models', 'name', 'needs', 'points', 'role', 'slug'].filter((k) => keys.has(k)).sort());
  expect(keys.has('entries') || keys.has('weapons') || keys.has('abilities') || keys.has('options')).toBe(false);
});
