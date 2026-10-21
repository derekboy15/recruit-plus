import { test, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadWahapedia } from '../src/wahapedia/load';

const RAW = join(__dirname, '..', 'raw');

test('Wahapedia snapshot is the final 9th edition export', () => {
  const w = loadWahapedia(join(RAW, 'wahapedia'));
  expect(w.lastUpdate.startsWith('2023-06-26')).toBe(true);
  expect(w.factions.some((f) => f.name === 'Necrons')).toBe(true);
  expect(w.datasheets.length).toBeGreaterThan(1500);
});

test('BSData v9.8.0 is fetched: 1 game system and 52 catalogues', () => {
  const files = readdirSync(join(RAW, 'bsdata'));
  expect(files).toContain('Warhammer 40,000.gst');
  expect(files.filter((f) => f.endsWith('.cat'))).toHaveLength(52);
});
