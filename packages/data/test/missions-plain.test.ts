import { beforeAll, expect, test } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeMissions, type MissionsReport } from '../src/missions/build';
import type { MissionsOut } from '../src/missions/types';
import { loadWahapedia } from '../src/wahapedia/load';

const ROOT = join(__dirname, '..');
let report: MissionsReport;
let data: MissionsOut;

beforeAll(() => {
  const out = mkdtempSync(join(tmpdir(), 'recruit-missions-plain-'));
  report = writeMissions({ rawDir: join(ROOT, 'raw'), overridesDir: join(ROOT, 'overrides'), outDir: out, contentDir: join(ROOT, '..', 'content') }, loadWahapedia(join(ROOT, 'raw', 'wahapedia')));
  data = JSON.parse(readFileSync(join(out, 'missions.json'), 'utf8'));
});

test('every mission and universal-secondary text has checked plain English', () => {
  expect(report.flagged).toEqual([]);
  expect(report.missing).toEqual([]);
  expect(report.written).toBe(report.total);
  for (const m of data.missions) {
    for (const r of [...m.rules, m.primary, ...(m.missionSecondary ? [m.missionSecondary] : [])]) expect(r.plain, `${m.id}: ${r.name}`).toBeTruthy();
  }
});

test('every faction secondary has checked plain English', () => {
  expect(report.faction.total).toBeGreaterThan(150);
  expect(report.faction.written).toBe(report.faction.total);
  for (const p of data.packs) for (const s of p.secondaries) expect(s.plain, `${p.id}: ${s.name}`).toBeTruthy();
});

test('no orphan plain entries', () => {
  expect(report.orphans).toEqual([]);
});
