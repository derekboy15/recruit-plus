import { test, expect, describe } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { loadGameData, isPlayableCatalogue } from '../src/bsdata/gamedata';
import { extractUnits } from '../src/extract/units';
import { loadOverrides } from '../src/join/wahapedia';

const gd = loadGameData(join(__dirname, '..', 'raw', 'bsdata'));
const playableCatalogues = loadOverrides(join(__dirname, '..', 'overrides')).playableCatalogues;
const byNameCat = (name: string) => [...gd.catalogues.values()].find((c) => c.name === name)!;
const byName = (name: string) => byNameCat(name).id;

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

describe('wargear of its own and list-building extras', () => {
  const necrons = extractUnits(gd, byName('Necrons'));
  const unit = (name: string) => necrons.find((u) => u.name === name)!;

  test("the Royal Warden's own Relic Gauss Blaster is its weapon, not an extra", () => {
    const w = unit('Royal Warden').weapons.find((x) => x.name === 'Relic Gauss Blaster');
    expect(w).toBeDefined();
    expect(w!.extra).toBeUndefined();
  });

  test("Necron Warriors' gauss weapons are their own", () => {
    const weapons = unit('Necron Warriors').weapons.filter((w) => w.name === 'Gauss Flayer' || w.name === 'Gauss Reaper');
    expect(weapons).toHaveLength(2);
    for (const w of weapons) expect(w.extra, w.name).toBeUndefined();
  });

  test("the Overlord's Voidreaper (a Necron relic, Artefacts of the Aeons) is flagged extra", () => {
    const overlord = unit('Overlord');
    expect(overlord.weapons.find((w) => w.name === 'Voidreaper')?.extra).toBe(true);
    expect(overlord.weapons.find((w) => w.name === 'Staff of Light (Shooting)')?.extra).toBeUndefined();
  });

  test("a datasheet's abilities are its own: no relic, Warlord trait or stratagem texts (those are in the info files)", () => {
    const overlord = unit('Overlord');
    expect(overlord.abilities.find((a) => a.name === 'Living Metal')?.extra).toBeUndefined();
    const names = overlord.abilities.map((a) => a.name);
    for (const n of ['Blood-Fuelled Fury', 'Enduring Will', 'Stratagem: Warlord Trait', 'Veil of Darkness']) expect(names).not.toContain(n);
    for (const c of [...gd.catalogues.values()].filter((x) => isPlayableCatalogue(x, playableCatalogues))) {
      for (const u of extractUnits(gd, c.id)) expect(u.abilities.filter((a) => a.extra).map((a) => a.name), `${c.name}: ${u.name}`).toEqual([]);
    }
  });

  describe('Ultramarines', () => {
    const um = extractUnits(gd, byName('Imperium - Adeptus Astartes - Ultramarines'));
    const intercessors = um.find((u) => u.name === 'Intercessor Squad')!;

    test("the Intercessor Squad's own weapons are not extras; its special-issue and relic wargear is", () => {
      expect(intercessors.weapons.find((w) => w.name === 'Bolt rifle')?.extra).toBeUndefined();
      // Special-Issue Wargear (Ultramarines) and a Codex relic a sergeant can take.
      const extras = intercessors.weapons.filter((w) => w.extra).map((w) => w.name);
      expect(extras).toEqual(expect.arrayContaining(['Sunwrath Pistol']));
      expect(extras).not.toContain('Bolt rifle');
    });

    test('units named "Relic …" are units, with their models', () => {
      for (const name of ['Relic Terminator Squad', 'Relic Contemptor Dreadnought']) {
        const u = um.find((x) => x.name === name);
        expect(u, name).toBeDefined();
        expect(u!.models.length, name).toBeGreaterThan(0);
        expect(u!.weapons.filter((w) => !w.extra).length, name).toBeGreaterThan(0);
      }
    });
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
  const playable = [...gd.catalogues.values()].filter((c) => isPlayableCatalogue(c, playableCatalogues)).map((c) => c.name);
  expect(playable).toContain('Imperium - Adeptus Astartes - Ultramarines');
  expect(playable).not.toContain('Imperium - Space Marines');
  expect(playable).not.toContain('Aeldari - Aeldari Library');
});

test('Death Korps and Elysian units imported into Astra Militarum are flagged Forge World', () => {
  const am = extractUnits(gd, byName('Imperium - Astra Militarum'));
  const fwIds = new Set(
    ['Imperium - Death Korps of Krieg', 'Imperium - Elysian Drop Troops'].flatMap((n) =>
      byNameCat(n).root.children.filter((c) => c.tag === 'entryLinks' || c.tag === 'selectionEntries').flatMap((c) => c.children).map((e) => e.attrs.targetId ?? e.attrs.id),
    ),
  );
  const fwUnits = am.filter((u) => fwIds.has(u.id));
  expect(fwUnits.length).toBeGreaterThan(10);
  expect(fwUnits.filter((u) => !u.forgeWorld).map((u) => u.name)).toEqual([]);
  expect(am.find((u) => u.name === 'Infantry Squad')?.forgeWorld).toBe(false);
});

test('hidden root entries and Crusade honours never appear as units', () => {
  for (const cat of [...gd.catalogues.values()].filter((c) => isPlayableCatalogue(c, playableCatalogues))) {
    const hiddenRootIds = cat.root.children
      .filter((c) => c.tag === 'entryLinks' || c.tag === 'selectionEntries')
      .flatMap((c) => c.children)
      .filter((e) => e.attrs.hidden === 'true')
      .map((e) => e.attrs.targetId ?? e.attrs.id);
    const visibleRootIds = cat.root.children
      .filter((c) => c.tag === 'entryLinks' || c.tag === 'selectionEntries')
      .flatMap((c) => c.children)
      .filter((e) => e.attrs.hidden !== 'true')
      .map((e) => e.attrs.targetId ?? e.attrs.id);
    for (const u of extractUnits(gd, cat.id)) {
      expect(/battle honours|crusade/i.test(u.name), u.name).toBe(false);
    }
    const ownUnitIds = new Set(extractUnits(gd, cat.id).map((u) => u.id));
    for (const id of hiddenRootIds) if (!visibleRootIds.includes(id)) expect(ownUnitIds.has(id), `${cat.name}: hidden root ${id}`).toBe(false);
  }
});

describe('keywords held by the models inside a unit', () => {
  // Core rules: a unit has every keyword its models have for unit-level rules; model-level rules
  // only affect the models that carry the keyword (research library, Glossary_and_Keywords.md).
  const tfc = extractUnits(gd, byName('Imperium - Adeptus Astartes - Ultramarines')).find((u) => u.name === 'Thunderfire Cannon')!;

  test('the unit carries the union of its models’ keywords', () => {
    expect(tfc.keywords).toEqual(expect.arrayContaining(['Vehicle', 'Artillery', 'Infantry']));
    const huntsman = extractUnits(gd, byName('Chaos - Chaos Knights')).find((u) => u.name === 'War Dog Huntsman Squadron')!;
    expect(huntsman.keywords).toEqual(expect.arrayContaining(['Vehicle']));
  });

  test('each model keeps its own keywords when they differ', () => {
    const byModel = Object.fromEntries((tfc.modelKeywords ?? []).map((m) => [m.model, m.keywords]));
    expect(byModel['Techmarine Gunner']).toEqual(expect.arrayContaining(['Infantry']));
    expect(byModel['Techmarine Gunner']).not.toContain('Vehicle');
    expect(byModel['Thunderfire Cannon']).toEqual(expect.arrayContaining(['Vehicle', 'Artillery']));
  });
});

describe('every playable catalogue', () => {
  const allowed: { catalogue: string; unit: string }[] = JSON.parse(
    readFileSync(join(__dirname, '..', 'overrides', 'units-without-profiles.json'), 'utf8'),
  );
  for (const cat of [...gd.catalogues.values()].filter((c) => isPlayableCatalogue(c, playableCatalogues))) {
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
