import { test, expect, describe } from 'vitest';
import { join } from 'node:path';
import { loadGameData, isPlayableCatalogue } from '../src/bsdata/gamedata';
import { extractUnits } from '../src/extract/units';
import { loadWahapedia } from '../src/wahapedia/load';
import { joinWahapedia, loadOverrides, minimumPoints, matchKeys } from '../src/join/wahapedia';

const ROOT = join(__dirname, '..');
const gd = loadGameData(join(ROOT, 'raw', 'bsdata'));
const w = loadWahapedia(join(ROOT, 'raw', 'wahapedia'));
const overrides = loadOverrides(join(ROOT, 'overrides'));
const cat = (name: string) => [...gd.catalogues.values()].find((c) => c.name === name)!;
const joined = (name: string) => joinWahapedia(extractUnits(gd, cat(name).id), name, w, overrides);

test('minimumPoints multiplies cost by the minimum model count', () => {
  expect(minimumPoints([{ Cost: '18', models_per_unit: '4-9' }, { Cost: '18', models_per_unit: '1' }])).toBe(90);
  expect(minimumPoints([{ Cost: '11', models_per_unit: '10-20' }])).toBe(110);
  expect(minimumPoints([{ Cost: '', models_per_unit: '1' }])).toBeNull();
});

test('matchKeys loosens names in a fixed order', () => {
  expect(matchKeys('Hearthkyn Warriors w/ bolters')).toEqual(['hearthkyn warriors w/ bolters', 'hearthkyn warriors', 'hearthkyn warrior']);
  expect(matchKeys('Shield-Captain in Allarus Terminator Armor')[0]).toBe('shield-captain in allarus terminator armour');
  expect(matchKeys('War Dog Huntsman Squadron')).toContain('war dog huntsman');
  expect(matchKeys('Storm Eagle Assault Gunship - ROC Pattern [Legends}')[0]).toBe('storm eagle assault gunship - roc pattern');
});

test('every catalogue has a faction-map entry', () => {
  for (const c of gd.catalogues.values()) expect(overrides.factionMap[c.name], c.name).toBeDefined();
});

test('Necron Warriors get points, base size and a Wahapedia id', () => {
  const u = joined('Necrons').units.find((x) => x.name === 'Necron Warriors')!;
  expect(u.wahapediaId).toBe('000000534');
  expect(u.baseSize).toContain('32mm');
  expect(u.points).toBe(110);
});

test("T'au catalogue name with apostrophe still matches", () => {
  const u = joined("T'au Empire").units.find((x) => x.name === 'Commander in Coldstar Battlesuit');
  expect(u?.wahapediaId).not.toBeNull();
});

describe('match rate per playable catalogue', () => {
  for (const c of [...gd.catalogues.values()].filter(isPlayableCatalogue)) {
    test(`${c.name} matches >= 90% of units (catalogues with 10+ units)`, () => {
      const { units, unmatched } = joined(c.name);
      if (units.length < 10) return;
      expect(units.length - unmatched.length).toBeGreaterThanOrEqual(Math.ceil(units.length * 0.9));
    });
  }
});
