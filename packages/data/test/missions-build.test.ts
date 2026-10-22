import { beforeAll, expect, test } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeMissions, type MissionsReport } from '../src/missions/build';
import type { MissionsOut } from '../src/missions/types';
import { loadWahapedia } from '../src/wahapedia/load';
import { loadGameData, isPlayableCatalogue } from '../src/bsdata/gamedata';
import { loadOverrides } from '../src/join/wahapedia';
import { slugify } from '../src/text';

const ROOT = join(__dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'recruit-missions-'));
let data: MissionsOut;
let report: MissionsReport;

beforeAll(() => {
  const w = loadWahapedia(join(ROOT, 'raw', 'wahapedia'));
  report = writeMissions({ rawDir: join(ROOT, 'raw'), overridesDir: join(ROOT, 'overrides'), outDir: out, contentDir: join(ROOT, '..', 'content') }, w);
  data = JSON.parse(readFileSync(join(out, 'missions.json'), 'utf8'));
});

test('missions.json has 24 missions and 2 packs with their secondaries', () => {
  expect(data.missions).toHaveLength(24);
  expect(data.packs.map((p) => p.id).sort()).toEqual(['arks-of-omen', 'core-book']);
  expect(data.packs.find((p) => p.id === 'arks-of-omen')!.secondaries).toHaveLength(96);
  expect(data.packs.find((p) => p.id === 'core-book')!.secondaries).toHaveLength(102);
  expect(Object.keys(JSON.parse(readFileSync(join(out, 'missions-report.json'), 'utf8')))).toContain('total');
});

test('secondaryFactions has every playable catalogue slug', () => {
  const gd = loadGameData(join(ROOT, 'raw', 'bsdata'));
  const overrides = loadOverrides(join(ROOT, 'overrides'));
  const slugs = [...gd.catalogues.values()].filter((c) => isPlayableCatalogue(c, overrides.playableCatalogues)).map((c) => slugify(c.name)).sort();
  expect(Object.keys(data.secondaryFactions).sort()).toEqual(slugs);
  expect(data.secondaryFactions['imperium-adeptus-astartes-blood-angels'].map((f) => f.factionId)).toEqual(['SM', 'CHBA']);
});

test('every Arks of Omen mission says the pack errata was not checked', () => {
  for (const m of data.missions.filter((x) => x.pack === 'arks-of-omen')) expect(m.unverified.join(' '), m.id).toMatch(/errata/);
});

test('report totals add up', () => {
  expect(report.written).toBeLessThanOrEqual(report.total);
  expect(report.faction.written).toBeLessThanOrEqual(report.faction.total);
});
