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
  expect(matchKeys('Hearthkyn Warriors w/ bolters')).toEqual(['hearthkyn warriors with bolters', 'hearthkyn warriors', 'hearthkyn warrior']);
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
  for (const c of [...gd.catalogues.values()].filter((c) => isPlayableCatalogue(c, overrides.playableCatalogues))) {
    test(`${c.name} matches >= 90% of units (catalogues with 10+ units)`, () => {
      const { units, unmatched } = joined(c.name);
      if (units.length < 10) return;
      expect(units.length - unmatched.length).toBeGreaterThanOrEqual(Math.ceil(units.length * 0.9));
    });
  }
});

const unit = (catalogue: string, name: string) => joined(catalogue).units.find((u) => u.name === name)!;

test('per-unit costs (cost_per_unit) are used: Havocs cost 125', () => {
  expect(unit('Chaos - Chaos Space Marines', 'Havocs').points).toBe(125);
});

test('"w/" variants match their own datasheet, not the base unit', () => {
  const sag = unit('Orks', 'Big Mek w/ Shokk Attack Gun');
  expect(sag.wahapediaId).toBe('000001536');
  expect(sag.baseSize).toContain('40mm');
  expect(unit('Orks', 'Big Mek w/ Kustom Force Field').wahapediaId).toBe('000002080');
});

test('left curly quotes in Wahapedia names still match', () => {
  expect(unit('Imperium - Astra Militarum', "'Iron Hand' Straken").wahapediaId).not.toBeNull();
  expect(unit('Orks', "Looted 'Eavy Wagon").wahapediaId).not.toBeNull();
});

test('units whose model lines are all optional cost minimum models x cheapest model, never 0', () => {
  expect(minimumPoints([{ Cost: '16', models_per_unit: '0-4' }, { Cost: '22', models_per_unit: '0-4' }], 4)).toBe(64);
  expect(minimumPoints([{ Cost: '16', models_per_unit: '0-4' }], null)).toBeNull();
  expect(unit('Aeldari - Drukhari', 'Court of the Archon').points).toBe(64);
  for (const c of [...gd.catalogues.values()].filter((c) => isPlayableCatalogue(c, overrides.playableCatalogues)))
    for (const u of joined(c.name).units) expect(u.points, `${c.name}: ${u.name}`).not.toBe(0);
});

test('units without a BSData primary role take the Wahapedia role', () => {
  expect(unit('Chaos - Death Guard', 'Mortarion').role).toBe('Lord of War');
  for (const c of [...gd.catalogues.values()].filter((c) => isPlayableCatalogue(c, overrides.playableCatalogues)))
    for (const u of joined(c.name).units) if (u.wahapediaId) expect(u.role, `${c.name}: ${u.name}`).not.toBeNull();
});

test("units BSData gives no keywords take Wahapedia's (Exaction Squad, Sagitaur Squadron)", () => {
  expect(unit('Imperium - Agents of the Imperium', 'Exaction Squad').keywords).toEqual(expect.arrayContaining(['Core', 'Infantry']));
  expect(unit('Leagues of Votann', 'Sagitaur Squadron').keywords).toEqual(expect.arrayContaining(['Vehicle', 'Transport']));
});

test('every playable unit has at least one keyword besides its faction keywords', () => {
  // Open-play-only BSData entry with no Wahapedia datasheet and no keywords anywhere.
  const allowed = new Set(['Imperium - Grey Knights: Land Raider Variant (Open Play)']);
  const empty: string[] = [];
  for (const c of [...gd.catalogues.values()].filter((x) => isPlayableCatalogue(x, overrides.playableCatalogues)))
    for (const u of joined(c.name).units) if (u.keywords.length === 0 && !allowed.has(`${c.name}: ${u.name}`)) empty.push(`${c.name}: ${u.name}`);
  expect(empty).toEqual([]);
});
