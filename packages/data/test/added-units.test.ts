/**
 * Units BSData v9.8.0 (the final 9th-edition release) never added, copied in by overrides/added-units.json:
 * World Eaters' Khorne Berzerkers and the Chaos Warlord Titan. Reads generated/ (npm run data:build).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadGameData } from '../src/bsdata/gamedata';
import type { CatalogueOut, UnitOut } from '../src/model/types';
import { applyAddedUnits, type AddedUnit } from '../src/patch/addedUnits';
import { addUnit, availableUnits, createRoster, detachmentChoices, displayName, setCount, validate, type Roster, type Sel } from '../src/roster';
import { realCatalogueId, realCatalogues, realPolicy, realScope } from './helpers/realScope';

const GENERATED = join(__dirname, '..', 'generated');
const catalogue = (slug: string): CatalogueOut => JSON.parse(readFileSync(join(GENERATED, 'catalogues', `${slug}.json`), 'utf8'));
const unit = (slug: string, name: string): UnitOut => {
  const u = catalogue(slug).units.find((x) => x.name === name);
  if (!u) throw new Error(`${slug} has no unit "${name}"`);
  return u;
};

/** A fresh roster of the catalogue's first own detachment at the size, its picker, and the scope. */
function freshList(slug: string, size: Roster['battleSize']) {
  const scope = realScope(slug);
  const catalogueId = realCatalogueId(slug);
  const empty: Roster = { schema: 1, name: '', catalogueId, battleSize: size, forces: [] };
  const own = detachmentChoices(scope, empty, realPolicy(), realCatalogues()).find((d) => !d.allied)!;
  const roster = createRoster(scope, { name: 'test', catalogueId, battleSize: size, forceId: own.forceId });
  return { scope, roster, forceSelId: roster.forces[0].id, picker: availableUnits(scope, roster, roster.forces[0].id) };
}

const findSel = (sels: Sel[], pred: (s: Sel) => boolean): Sel | undefined => {
  for (const s of sels) {
    if (pred(s)) return s;
    const inner = findSel(s.children, pred);
    if (inner) return inner;
  }
  return undefined;
};

describe('World Eaters Khorne Berzerkers', () => {
  test('Troops, 5–10 models, 22 pts each, the World Eaters datasheet', () => {
    const u = unit('chaos-world-eaters', 'Khorne Berzerkers');
    expect(u).toMatchObject({ role: 'Troops', minModels: 5, maxModels: 10, points: 110, wahapediaId: '000002627' });
    expect(u.models.find((m) => m.name === 'Khorne Berzerker')!.chars).toMatchObject({ M: '6"', S: '5', W: '2', A: '4', Save: '3+' });
    expect(u.weapons.map((w) => w.name)).toEqual(expect.arrayContaining(['Berserker chainblade', 'Bolt pistol', 'Khornate eviscerator']));
    expect(u.weapons.some((w) => /Maelstrom|Ashen Axe|Black Mace|Viper/.test(w.name))).toBe(false);
    expect(u.abilities.map((a) => a.name)).not.toContain('Let the Galaxy Burn');
    expect(u.abilities.map((a) => a.name)).toEqual(expect.arrayContaining(['Blood Surge', 'The Blood Tithe', 'Berzerker icon']));
    expect(u.abilities.map((a) => a.name)).not.toContain('Berserker icon'); // one icon, spelled as the World Eaters datasheet spells it
    expect(u.models.map((m) => m.name)).toEqual(['Khorne Berzerker Champion', 'Khorne Berzerker']);
    // World Eaters' own Astartes units (Eightbound) carry these; the Chaos Space Marine-only keyword doesn't come along.
    expect(u.factionKeywords).toEqual(expect.arrayContaining(['Chaos', 'Khorne', 'Heretic Astartes', 'Butcher Astartes', 'World Eaters']));
    expect(u.factionKeywords).not.toContain('Traitoris Astartes');
  });

  test('the builder offers them as Troops for 110 pts', () => {
    const { picker } = freshList('chaos-world-eaters', 'strike-force');
    const b = picker.find((o) => displayName(o.name) === 'Khorne Berzerkers');
    expect(b).toMatchObject({ role: 'Troops', points: 110 });
  });

  test('a Strike Force with an HQ and three Berzerker squads fills its Troops', () => {
    const { scope, picker, forceSelId, roster: start } = freshList('chaos-world-eaters', 'strike-force');
    let roster = start;
    const hq = picker.filter((o) => o.role === 'HQ' && !o.legends).sort((a, b) => a.points - b.points)[0];
    roster = addUnit(scope, roster, forceSelId, hq.entryId).roster;
    const b = picker.find((o) => displayName(o.name) === 'Khorne Berzerkers')!;
    for (let i = 0; i < 3; i++) roster = addUnit(scope, roster, forceSelId, b.entryId).roster;
    const { issues } = validate(scope, roster, realPolicy());
    expect(issues.filter((i) => i.rule === 'slot-min' || i.rule === 'slot-max')).toEqual([]);
    expect(validate(scope, roster, realPolicy()).view.forces[0].selections.filter((v) => v.name === 'Khorne Berzerkers')).toHaveLength(3);
  });

  test('ten Berzerkers cost 220 pts', () => {
    const { scope, picker, forceSelId, roster: start } = freshList('chaos-world-eaters', 'strike-force');
    let roster = start;
    const b = picker.find((o) => displayName(o.name) === 'Khorne Berzerkers')!;
    const added = addUnit(scope, roster, forceSelId, b.entryId);
    roster = added.roster;
    const unitSel = findSel(roster.forces[0].selections, (s) => s.id === added.selId)!;
    const stack = findSel(unitSel.children, (s) => /w\/ chainblade$/.test(displayName(scope.node(s.entryId)?.name ?? '')))!;
    roster = setCount(scope, roster, stack.id, 9);
    const { view } = validate(scope, roster, realPolicy());
    const v = view.forces[0].selections.find((s) => s.sel.id === added.selId)!;
    expect(v.models).toBe(10);
    expect(v.total.points).toBe(220);
  });
});

describe('applyAddedUnits', () => {
  test('a correction naming a missing entry fails the build, naming the file and the id', () => {
    const raw = join(__dirname, '..', 'raw', 'bsdata');
    if (!existsSync(raw)) return; // raw data is fetched in CI before the build
    const gd = loadGameData(raw);
    const bad: AddedUnit = {
      catalogueName: 'Chaos - World Eaters',
      entryName: 'Khorne Berzerkers',
      from: { catalogueName: 'Chaos - Chaos Space Marines', entryId: 'nope' },
      newId: 'test-added',
      primaryRole: 'Troops',
      factionCategories: [],
      wahapediaId: '000002627',
      source: 'test',
    };
    expect(() => applyAddedUnits(gd, [bad])).toThrow(/added-units\.json.*nope/);
  });
});
