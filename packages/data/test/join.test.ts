import { test, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
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
  // Units Wahapedia has no datasheet for (test/corpus/chaos/chaos-servants-of-the-abyss.ts).
  const NO_DATASHEET: Record<string, string[]> = { 'Chaos - Servants of the Abyss': ['Traitor Commissar', 'Chaos Ogryn'] };
  for (const c of [...gd.catalogues.values()].filter((c) => isPlayableCatalogue(c, overrides.playableCatalogues))) {
    test(`${c.name} matches >= 90% of units (catalogues with 10+ units)`, () => {
      const { units, unmatched } = joined(c.name);
      if (units.length < 10) return;
      expect(unmatched.filter((n) => !NO_DATASHEET[c.name]?.includes(n)).length).toBeLessThanOrEqual(units.length - Math.ceil(units.length * 0.9));
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
  // The other one, Looted ‘Eavy Wagon, is a Narrative and Open Play unit, so it isn't listed (Plan G).
  expect(unit('Imperium - Astra Militarum', "'Iron Hand' Straken").wahapediaId).not.toBeNull();
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
  // The unit the Seer Council Stratagem forms (Codex: Aeldari p158, shown once a Farseer is taken): BSData gives it no
  // keywords anywhere and Wahapedia has no datasheet for it.
  const allowed = new Set(['Aeldari - Craftworlds: Seer Council (Unit)']);
  const empty: string[] = [];
  for (const c of [...gd.catalogues.values()].filter((x) => isPlayableCatalogue(x, overrides.playableCatalogues)))
    for (const u of joined(c.name).units) if (u.keywords.length === 0 && !allowed.has(`${c.name}: ${u.name}`)) empty.push(`${c.name}: ${u.name}`);
  expect(empty).toEqual([]);
});

describe('Legends from Wahapedia source books', () => {
  const unitIn = (catalogueName: string, name: string) => {
    const u = joined(catalogueName).units.find((x) => x.name === name);
    if (!u) throw new Error(`${catalogueName} has no unit "${name}"`);
    return u;
  };

  test('units Wahapedia files under a Warhammer Legends book are Legends', () => {
    expect(unitIn('Imperium - Legion of the Damned', 'Damned Legionnaires').legends).toBe(true);
    expect(unitIn('Chaos - Renegades & Heretics [LEGENDS]', 'Renegade Cultists').legends).toBe(true);
    expect(unitIn('Aeldari - Drukhari', 'Kabalite Trueborn').legends).toBe(true);
    expect(unitIn('Imperium - Adeptus Astartes - Ultramarines', 'Carnac Commodus').legends).toBe(true);
  });

  test('units from current books are not', () => {
    expect(unitIn('Necrons', 'Necron Warriors').legends).toBe(false);
    expect(unitIn('Imperium - Adeptus Astartes - Ultramarines', 'Intercessor Squad').legends).toBe(false);
    // Added by overrides/added-units.json, so read from the build.
    const we = JSON.parse(readFileSync(join(ROOT, 'generated', 'catalogues', 'chaos-world-eaters.json'), 'utf8'));
    expect(we.units.find((u: { name: string }) => u.name === 'Khorne Berzerkers').legends).toBe(false);
  });

  // The audit's 26 entries (18 names), plus the Renegade Commander, which BSData stores as an upgrade (listed since Task 6).
  test('exactly the audited units gain the badge (27 entries, 19 names; 25 Oct 2026)', () => {
    const chapters = ['Blood Angels', 'Dark Angels', 'Imperial Fists', 'Iron Hands', 'Raven Guard', 'Salamanders', 'Space Wolves', 'Ultramarines', 'White Scars'];
    const renegades = [
      'Malefic Lord', 'Rogue Psyker Coven', 'Renegade Cultists', 'Renegade Militia Squad', 'Renegade Mutant Rabble', 'Renegade Command Squad',
      'Renegade Disciple Squad', 'Renegade Enforcer', 'Renegade Marauder Squad', 'Renegade Ogryn Beast Handlers', 'Renegade Ogryn Brutes',
      'Renegade Plague Ogryns', 'Renegade Chaos Spawn', 'Renegade Heavy Weapons Squad', 'Renegade Commander',
    ];
    const audited = [
      'Aeldari - Drukhari: Hekatrix Bloodbrides',
      'Aeldari - Drukhari: Kabalite Trueborn',
      ...renegades.map((n) => `Chaos - Renegades & Heretics [LEGENDS]: ${n}`),
      ...chapters.map((c) => `Imperium - Adeptus Astartes - ${c}: Carnac Commodus`),
      'Imperium - Legion of the Damned: Damned Legionnaires',
    ];
    // Without a [Legends] tag in the name, the badge can only come from the Wahapedia source.
    const gained = [...gd.catalogues.values()].flatMap((c) => joined(c.name).units.filter((u) => u.legends && !/\[legends\]/i.test(u.name)).map((u) => `${c.name}: ${u.name}`));
    expect(gained.sort()).toEqual(audited.sort());
    expect(new Set(gained.map((g) => g.split(': ')[1])).size).toBe(19);
  });
});
