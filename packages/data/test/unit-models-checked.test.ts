/**
 * Plan H Task 7: ten units' models and gear, checked by hand against the BSData v9.8.0 tree (the unit's selection
 * entries, their min/max and default choices) and the codex notes in the research library (03_Codexes). Each unit's
 * source is named; where the two disagree, BSData wins (the data precedence). Reads generated/ (npm run data:build).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { CatalogueOut, UnitOut } from '../src/model/types';

const GENERATED = join(__dirname, '..', 'generated');
const unit = (slug: string, name: string): UnitOut => {
  const cat: CatalogueOut = JSON.parse(readFileSync(join(GENERATED, 'catalogues', `${slug}.json`), 'utf8'));
  const u = cat.units.find((x) => x.name === name);
  if (!u) throw new Error(`${slug} has no unit "${name}"`);
  return u;
};
/** The unit as added, one line per kind of model it starts with: "4x Intercessor [Intercessor]: Bolt pistol, …". */
const asAdded = (u: UnitOut) =>
  (u.modelKinds ?? [])
    .filter((k) => k.defaultCount > 0)
    .map((k) => `${k.defaultCount}x ${k.name} [${u.models[k.profile]?.name}]: ${k.weapons.map((i) => u.weapons[i].name).sort().join(', ')}`)
    .sort();
const everyone = (u: UnitOut) => (u.everyone ?? []).map((i) => u.weapons[i].name).sort();
const onUnit = (u: UnitOut) => ({ weapons: (u.unitGear?.weapons ?? []).map((i) => u.weapons[i].name).sort(), abilities: (u.unitGear?.abilities ?? []).map((i) => u.abilities[i].name).sort() });
const extras = (u: UnitOut) => (u.modelKinds ?? []).filter((k) => k.optional).map((k) => k.name).sort();
const kindAbilities = (u: UnitOut, name: string) => (u.modelKinds ?? []).find((k) => k.name === name)!.abilities.map((i) => u.abilities[i].name).sort();

describe('Astra Militarum', () => {
  test('Cadian Command Squad (BSData: Commander, a squad of four Veterans each with their own kit, five attachés)', () => {
    const u = unit('imperium-astra-militarum', 'Cadian Command Squad');
    expect(asAdded(u)).toEqual([
      '1x Cadian Commander [Cadian Commander]: Chainsword, Frag grenades, Laspistol',
      '1x Cadian Veteran w/ Master-Vox [Veteran]: Frag grenades, Laspistol',
      '1x Cadian Veteran w/ Medi-pack [Veteran]: Frag grenades, Lasgun',
      '1x Cadian Veteran w/ Regimental Standard [Veteran]: Frag grenades, Lasgun',
      '1x Cadian Veteran w/ chainsword [Veteran]: Chainsword, Frag grenades, Laspistol',
    ]);
    expect(kindAbilities(u, 'Cadian Veteran w/ Medi-pack')).toEqual(['Medi-pack']);
    expect(kindAbilities(u, 'Cadian Commander')).toEqual(expect.arrayContaining(['Refractor Field', 'Voice of Command']));
    expect(extras(u)).toEqual(['Astropath', 'Master of Ordnance', 'Nork Deddog', 'Officer of the Fleet', 'Ogryn Bodyguard']);
    expect(onUnit(u).abilities).toContain('Regimental Tactics');
  });

  test('Infantry Squad (BSData: a Sergeant with a laspistol, the chainsword an optional pick; nine Guardsmen with lasguns; frag grenades on the unit)', () => {
    const u = unit('imperium-astra-militarum', 'Infantry Squad');
    expect(asAdded(u)).toEqual(['1x Sergeant [Sergeant]: Laspistol', '9x Guardsman [Guardsman]: Lasgun']);
    expect(onUnit(u).weapons).toEqual(['Frag grenades']);
    // The heavy weapons team is a different stat line the squad can take in place of Guardsmen.
    expect(extras(u)).toEqual(['Heavy Weapon Team']);
  });
});

test('Intercessor Squad, Ultramarines (BSData + codex notes: Sergeant and four Intercessors; bolt pistol and grenades each, a bolt rifle for everyone)', () => {
  const u = unit('imperium-adeptus-astartes-ultramarines', 'Intercessor Squad');
  expect(asAdded(u)).toEqual([
    '1x Intercessor Sergeant [Intercessor Sergeant]: Bolt pistol, Frag grenades, Krak grenades',
    '4x Intercessor [Intercessor]: Bolt pistol, Frag grenades, Krak grenades',
  ]);
  expect(everyone(u)).toEqual(['Bolt rifle']);
  expect(onUnit(u).abilities).toEqual(expect.arrayContaining(['Angels of Death', 'Combat Squads']));
});

describe('Necrons', () => {
  test('Necron Warriors (BSData + codex notes: ten Warriors with gauss flayers; the reaper the other loadout)', () => {
    const u = unit('necrons', 'Necron Warriors');
    expect(asAdded(u)).toEqual(['10x Necron Warrior (Gauss Flayer) [Necron Warrior]: Gauss Flayer']);
    expect(onUnit(u).abilities).toEqual(expect.arrayContaining(['Reanimation Protocols', 'Their Number Is Legion']));
    expect(extras(u)).toEqual([]);
  });

  test('Lychguard (BSData: five Lychguard; the warscythe or sword-and-shield is one choice for the whole unit)', () => {
    const u = unit('necrons', 'Lychguard');
    expect(asAdded(u)).toEqual(['5x Lychguard [Lychguard]: ']);
    expect(everyone(u)).toEqual(['Warscythe']);
    expect(onUnit(u).abilities).toEqual(expect.arrayContaining(['Guardian Protocols', 'Living Metal']));
  });
});

test('Boyz (BSData + codex notes: a Boss Nob and nine Boyz, all with slugga, choppa and stikkbombs)', () => {
  const u = unit('orks', 'Boyz');
  expect(asAdded(u)).toEqual([
    '1x Boss Nob [Boss Nob]: Choppa, Slugga, Stikkbomb',
    '9x Ork Boy w/ Slugga & Choppa [Ork Boy]: Choppa, Slugga, Stikkbomb',
  ]);
  expect(onUnit(u).abilities).toEqual(expect.arrayContaining(['Mob Rule']));
});

test('Termagants (BSData + codex notes: ten Termagants with fleshborers)', () => {
  const u = unit('tyranids', 'Termagants');
  expect(asAdded(u)).toEqual(['10x Termagant [Termagant]: ']);
  expect(everyone(u)).toEqual(['Fleshborer']);
});

test("Crisis Battlesuits (BSData: a Shas'vre and two Shas'ui with a burst cannon each; drones are extras)", () => {
  const u = unit('tau-empire', 'Crisis Battlesuits');
  expect(asAdded(u)).toEqual(["1x Crisis Shas'vre [Crisis Shas'vre]: Burst Cannon", "2x Crisis Shas'ui [Crisis Shas'ui]: Burst Cannon"]);
  expect(extras(u)).toEqual(['Guardian Drone', 'Gun Drone', 'Marker Drone', 'Shield Drone']);
  expect(kindAbilities(u, 'Shield Drone')).toContain('Valued Sacrifice');
});

test('Khorne Berserkers, World Eaters (BSData: a Champion and four Berserkers with chainblades and bolt pistols; the icon is a choice)', () => {
  const u = unit('chaos-world-eaters', 'Khorne Berserkers');
  expect(asAdded(u)).toEqual([
    '1x Khorne Berserker Champion [Khorne Berserker Champion]: Berserker chainblade, Bolt pistol',
    '4x Khorne Berserker w/ chainblade [Khorne Berserker]: Berserker chainblade, Bolt pistol',
  ]);
  expect(onUnit(u).abilities).toEqual(expect.arrayContaining(['Blood Surge']));
  expect((u.options ?? []).some((o) => o.choices.some((c) => c.name === 'Berserker icon'))).toBe(true);
});

test('Chaos Warlord Titan (BSData: one model, one stat line that degrades, its default arms and carapace weapons)', () => {
  const u = unit('chaos-chaos-titan-legions', 'Chaos Warlord Titan');
  expect(u.modelKinds).toHaveLength(1);
  expect(asAdded(u)).toEqual([
    '1x Chaos Warlord Titan [Chaos Warlord Titan 1 (91+ wounds remaining)]: Apocalypse launcher, Ardex-defensor lascannon, Ardex-defensor maulers, Arioch power claw (melee), Arioch power claw (shooting), Warlord feet',
  ]);
  expect(kindAbilities(u, 'Chaos Warlord Titan')).toEqual(expect.arrayContaining(['Void Shields', 'Reactor Meltdown']));
});
