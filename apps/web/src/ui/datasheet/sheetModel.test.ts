import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogueOut, UnitOut } from '@recruit/data/model';
import { describe, expect, test } from 'vitest';
import { factionSheet } from './sheetModel';

const GENERATED = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'data', 'generated');
const unit = (slug: string, name: string): UnitOut => {
  const cat: CatalogueOut = JSON.parse(readFileSync(join(GENERATED, 'catalogues', `${slug}.json`), 'utf8'));
  const u = cat.units.find((x) => x.name === name);
  if (!u) throw new Error(`${slug} has no unit "${name}"`);
  return u;
};

describe('factionSheet: the Cadian Command Squad as added (layout B)', () => {
  const sheet = factionSheet(unit('imperium-astra-militarum', 'Cadian Command Squad'));
  const carried = (name: string) => sheet.weapons.find((w) => w.name === name)?.carriedBy;
  const who = (name: string) => sheet.abilities.find((a) => a.ability.name === name)?.who;

  test('one stats row per kind of model, labelled with its name and count', () => {
    expect(sheet.stats.map((s) => [s.label, s.count])).toEqual([
      ['Cadian Commander', 1],
      ['Veteran', 4],
    ]);
  });

  test('each weapon says who carries it', () => {
    expect(carried('Laspistol')).toBe('Cadian Commander, 2 Veterans');
    expect(carried('Lasgun')).toBe('2 Veterans');
    expect(carried('Frag grenades')).toBe('Everyone');
    expect(carried('Chainsword')).toBe('Cadian Commander, Veteran');
  });

  test('each ability says who has it: the unit, a model, or a model with its gear', () => {
    expect(who('Regimental Tactics')).toBe('Unit');
    expect(who('Refractor Field')).toBe('Cadian Commander');
    expect(who('Medi-pack')).toBe('Cadian Veteran with Medi-pack');
    // On the unit and on the Commander in the data: the model is the more useful answer.
    expect(who('Commanding Authority')).toBe('Cadian Commander');
  });

  test('the attachés are extras to take, and the swaps are options', () => {
    expect(sheet.canAlsoTake.map((k) => k.name).sort()).toEqual(['Astropath', 'Master of Ordnance', 'Nork Deddog', 'Officer of the Fleet', 'Ogryn Bodyguard']);
    expect(sheet.options.some((o) => o.who.includes('Cadian Commander'))).toBe(true);
    // Weapons only an option or an extra brings aren't in the default weapons table.
    expect(sheet.weapons.map((w) => w.name)).not.toContain('Power fist');
  });
});

test('a degrading model is one stats row with its wound track (Chaos Warlord Titan)', () => {
  const sheet = factionSheet(unit('chaos-chaos-titan-legions', 'Chaos Warlord Titan'));
  expect(sheet.stats).toHaveLength(1);
  expect(sheet.stats[0].track?.length).toBeGreaterThan(1);
  // One model: nobody to tell apart.
  expect(sheet.weapons.every((w) => w.carriedBy === '')).toBe(true);
});

test("a weapon's profiles sit under one row (plasma gun: standard and supercharge)", () => {
  const sheet = factionSheet(unit('imperium-astra-militarum', 'Cadian Command Squad'));
  const plasma = sheet.options.flatMap((o) => o.choices).find((c) => c.name === 'Plasma pistol');
  expect(plasma).toBeDefined();
  const u = unit('imperium-astra-militarum', 'Cadian Command Squad');
  expect(plasma!.weapons.map((i) => u.weapons[i].name)).toEqual(['Plasma pistol, Standard', 'Plasma pistol, Supercharge']);
});

test('Shock Troops: the unit’s own frag grenades read "Unit"; identical troopers are one row', () => {
  const sheet = factionSheet(unit('imperium-astra-militarum', 'Cadian Shock Troops'));
  expect(sheet.stats.map((s) => s.label)).toContain('Shock Trooper');
  expect(sheet.weapons.find((w) => w.name === 'Frag grenades')?.carriedBy).toBe('Unit');
  expect(sheet.weapons.find((w) => w.name === 'Lasgun')?.carriedBy).toBe('9 Shock Troopers');
});

test('a unit without per-model data still shows every stat line and weapon (older data)', () => {
  const u = unit('necrons', 'Necron Warriors');
  const sheet = factionSheet({ ...u, modelKinds: undefined, entries: undefined, unitGear: undefined, options: undefined });
  expect(sheet.stats.map((s) => s.label)).toEqual(['Necron Warrior']);
  expect(sheet.weapons.length).toBeGreaterThan(0);
});

describe('final review: every faction sheet', () => {
  const catalogues = readdirSync(join(GENERATED, 'catalogues')).map((f) => JSON.parse(readFileSync(join(GENERATED, 'catalogues', f), 'utf8')) as CatalogueOut).filter((c) => !c.library);

  test('has a stats row whenever the unit has a stat line', () => {
    const blank = catalogues.flatMap((c) => c.units.filter((u) => u.models.length && !factionSheet(u).stats.length).map((u) => `${c.name}: ${u.name}`));
    expect(blank).toEqual([]);
  });

  test("shows each of the unit's own weapons somewhere: in Weapons, in Options or on a model it can also take", () => {
    const lost: string[] = [];
    for (const c of catalogues)
      for (const u of c.units) {
        const sheet = factionSheet(u);
        const shown = new Set([
          ...sheet.weapons.flatMap((w) => w.profiles.map((p) => p.name)),
          ...sheet.options.flatMap((o) => [...o.choices.flatMap((ch) => ch.weapons), ...(o.replaces ?? [])]).map((i) => u.weapons[i]?.name),
          ...sheet.canAlsoTake.flatMap((k) => k.weapons).map((i) => u.weapons[i]?.name),
        ]);
        u.weapons.forEach((w) => !w.extra && !shown.has(w.name) && lost.push(`${c.name}: ${u.name}: ${w.name}`));
      }
    expect(lost.length, lost.slice(0, 20).join('\n')).toBe(0);
  });
});

test('Tactical Squad: the stat lines BSData keeps on the unit, counted', () => {
  const sheet = factionSheet(unit('imperium-adeptus-astartes-ultramarines', 'Tactical Squad'));
  expect(sheet.stats.map((s) => [s.label, s.count])).toEqual([
    ['Space Marine', 4],
    ['Space Marine Sergeant', 1],
  ]);
});
