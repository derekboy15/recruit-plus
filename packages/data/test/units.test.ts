import { test, expect, describe } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { loadGameData, isPlayableCatalogue } from '../src/bsdata/gamedata';
import { extractUnits } from '../src/extract/units';

const gd = loadGameData(join(__dirname, '..', 'raw', 'bsdata'));
const byName = (name: string) => [...gd.catalogues.values()].find((c) => c.name === name)!.id;

describe('Necron Warriors', () => {
  const warriors = extractUnits(gd, byName('Necrons')).find((u) => u.name === 'Necron Warriors')!;
  test('role, stats and keywords', () => {
    expect(warriors.role).toBe('Troops');
    expect(warriors.models[0].chars).toMatchObject({ M: '5"', WS: '3+', BS: '3+', S: '4', T: '4', W: '1', A: '1', Ld: '10', Save: '4+' });
    expect(warriors.keywords).toEqual(expect.arrayContaining(['Core', 'Infantry']));
    expect(warriors.factionKeywords).toEqual(expect.arrayContaining(['Necrons']));
  });
  test('weapons, abilities and model counts', () => {
    expect(warriors.weapons.map((w) => w.name)).toEqual(expect.arrayContaining(['Gauss Flayer', 'Gauss Reaper']));
    expect(warriors.abilities.map((a) => a.name)).toEqual(expect.arrayContaining(['Reanimation Protocols', 'Their Number Is Legion']));
    expect([warriors.minModels, warriors.maxModels]).toEqual([10, 20]);
    expect(warriors.powerLevel).toBe(6);
    expect(warriors.slug).toBe('necron-warriors');
  });
});

test('Blood Angels Intercessor Squad gets its profile through the Space Marines library', () => {
  const ba = extractUnits(gd, byName('Imperium - Adeptus Astartes - Blood Angels')).find((u) => u.name === 'Intercessor Squad')!;
  expect(ba).toBeDefined();
  expect(ba.models.length).toBeGreaterThan(0);
  expect(ba.models[0].chars.T).toBe('4');
});

test('Legends and Forge World flags', () => {
  const sm = extractUnits(gd, byName('Imperium - Adeptus Astartes - Ultramarines'));
  expect(sm.find((u) => u.name === 'Company Veterans on Bikes [Legends]')?.legends).toBe(true);
  const warhound = extractUnits(gd, byName('Imperium - Titan Legions')).find((u) => u.name === 'Warhound Titan')!;
  expect(warhound.forgeWorld).toBe(true);
  expect(warhound.models.length).toBeGreaterThan(0);
});

test('libraries are not playable; chapter catalogues are', () => {
  const playable = [...gd.catalogues.values()].filter(isPlayableCatalogue).map((c) => c.name);
  expect(playable).toContain('Imperium - Adeptus Astartes - Ultramarines');
  expect(playable).not.toContain('Imperium - Space Marines');
  expect(playable).not.toContain('Aeldari - Aeldari Library');
});

describe('every playable catalogue', () => {
  const allowed: { catalogue: string; unit: string }[] = JSON.parse(
    readFileSync(join(__dirname, '..', 'overrides', 'units-without-profiles.json'), 'utf8'),
  );
  for (const cat of [...gd.catalogues.values()].filter(isPlayableCatalogue)) {
    test(`${cat.name}: has units, no reference/hidden entries, every unit has a model profile`, () => {
      const units = extractUnits(gd, cat.id);
      expect(units.length).toBeGreaterThan(0);
      for (const u of units) {
        expect(u.name.startsWith('['), u.name).toBe(false);
        if (u.models.length === 0) expect(allowed.some((a) => a.catalogue === cat.name && a.unit === u.name), `${cat.name}: ${u.name} has no model profile`).toBe(true);
      }
    });
  }
});
