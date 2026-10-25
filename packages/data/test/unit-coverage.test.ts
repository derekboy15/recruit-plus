/**
 * Two units the 25 Oct 2026 audit took for missing were in BSData v9.8.0 all along: World Eaters' own Khorne Berserkers
 * (BSData's spelling, so it didn't match Wahapedia's Khorne Berzerkers datasheet; overrides/name-matches.json joins them)
 * and the Chaos Warlord Titan (stored as an upgrade, so listed only once faction pages used the builder's unit rule).
 * Each is listed, and offered, once. Reads generated/ (npm run data:build).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { CatalogueOut, DataIndex, UnitOut } from '../src/model/types';
import { addUnit, availableUnits, createRoster, detachmentChoices, displayName, setCount, validate, type Roster, type Sel } from '../src/roster';
import { realCatalogueId, realCatalogues, realPolicy, realScope } from './helpers/realScope';

const GENERATED = join(__dirname, '..', 'generated');
const index: DataIndex = JSON.parse(readFileSync(join(GENERATED, 'index.json'), 'utf8'));
const catalogue = (slug: string): CatalogueOut => JSON.parse(readFileSync(join(GENERATED, 'catalogues', `${slug}.json`), 'utf8'));
const unit = (slug: string, name: string): UnitOut => {
  const u = catalogue(slug).units.find((x) => x.name === name);
  if (!u) throw new Error(`${slug} has no unit "${name}"`);
  return u;
};
/** Either spelling: BSData's "Berserkers" or the World Eaters codex's "Berzerkers". */
const BERZERKERS = /^Khorne Ber[sz]erkers$/;

/** A fresh roster of the catalogue's first own detachment (or the one named) at the size, its picker, and the scope. */
function freshList(slug: string, size: Roster['battleSize'], detachment?: string) {
  const scope = realScope(slug);
  const catalogueId = realCatalogueId(slug);
  const empty: Roster = { schema: 1, name: '', catalogueId, battleSize: size, forces: [] };
  const own = detachmentChoices(scope, empty, realPolicy(), realCatalogues()).find((d) => !d.allied && (!detachment || d.name.startsWith(detachment)))!;
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

test('no faction page lists two units of the same name', () => {
  for (const c of index.catalogues) {
    const names = catalogue(c.slug).units.map((u) => u.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i), c.slug).toEqual([]);
  }
});

describe('World Eaters Khorne Berserkers', () => {
  test('listed once, joined to Wahapedia’s World Eaters datasheet: Troops, 5–10 models, 22 pts each', () => {
    const listed = catalogue('chaos-world-eaters').units.filter((u) => BERZERKERS.test(u.name));
    expect(listed.map((u) => u.name)).toEqual(['Khorne Berserkers']);
    const u = listed[0];
    expect(u).toMatchObject({ role: 'Troops', minModels: 5, maxModels: 10, points: 110, wahapediaId: '000002627' });
    expect(u.models.map((m) => m.chars)).toEqual(expect.arrayContaining([expect.objectContaining({ M: '6"', S: '5', W: '2', A: '4', Save: '3+' })]));
    expect(u.weapons.map((w) => w.name)).toEqual(expect.arrayContaining(['Berserker chainblade', 'Bolt pistol']));
    expect(u.abilities.map((a) => a.name)).toEqual(expect.arrayContaining(['Blood Surge'])); // from the Wahapedia datasheet
    expect(u.factionKeywords).toEqual(expect.arrayContaining(['Chaos', 'Khorne', 'World Eaters']));
  });

  test('the builder offers them once, as Troops for 110 pts', () => {
    const { picker } = freshList('chaos-world-eaters', 'strike-force');
    const offered = picker.filter((o) => BERZERKERS.test(displayName(o.name)));
    expect(offered).toHaveLength(1);
    expect(offered[0]).toMatchObject({ role: 'Troops', points: 110 });
  });

  test('a Strike Force with an HQ and three Berserker squads fills its Troops', () => {
    const { scope, picker, forceSelId, roster: start } = freshList('chaos-world-eaters', 'strike-force');
    let roster = start;
    const hq = picker.filter((o) => o.role === 'HQ' && !o.legends).sort((a, b) => a.points - b.points)[0];
    roster = addUnit(scope, roster, forceSelId, hq.entryId).roster;
    const b = picker.find((o) => BERZERKERS.test(displayName(o.name)))!;
    for (let i = 0; i < 3; i++) roster = addUnit(scope, roster, forceSelId, b.entryId).roster;
    const { issues, view } = validate(scope, roster, realPolicy());
    expect(issues.filter((i) => i.rule === 'slot-min' || i.rule === 'slot-max')).toEqual([]);
    expect(view.forces[0].selections.filter((v) => BERZERKERS.test(v.name))).toHaveLength(3);
  });

  test('ten Berserkers cost 220 pts', () => {
    const { scope, picker, forceSelId, roster: start } = freshList('chaos-world-eaters', 'strike-force');
    const b = picker.find((o) => BERZERKERS.test(displayName(o.name)))!;
    const added = addUnit(scope, start, forceSelId, b.entryId);
    const unitSel = findSel(added.roster.forces[0].selections, (s) => s.id === added.selId)!;
    const stack = findSel(unitSel.children, (s) => /w\/ chainblade$/.test(displayName(scope.node(s.entryId)?.name ?? '')))!;
    const roster = setCount(scope, added.roster, stack.id, 9);
    const v = validate(scope, roster, realPolicy()).view.forces[0].selections.find((s) => s.sel.id === added.selId)!;
    expect(v.models).toBe(10);
    expect(v.total.points).toBe(220);
  });
});

describe('Chaos Warlord Titan', () => {
  test('listed once: Lords of War, 5,500 pts, Chaos keywords, the Warlord weapons', () => {
    expect(catalogue('chaos-chaos-titan-legions').units.filter((x) => x.name === 'Chaos Warlord Titan')).toHaveLength(1);
    const u = unit('chaos-chaos-titan-legions', 'Chaos Warlord Titan');
    expect(u).toMatchObject({ role: 'Lord of War', points: 5500, wahapediaId: '000002451' });
    expect(u.factionKeywords).toEqual(expect.arrayContaining(['Titanicus Traitoris', 'Chaos']));
    expect(u.factionKeywords).not.toContain('Imperium');
    expect(u.weapons.map((w) => w.name)).toEqual(
      // Wahapedia's spelling, as the other Chaos Titans' weapons have it.
      expect.arrayContaining(['Apocalypse launcher', 'Ardex-defensor lascannon', 'Ardex-defensor maulers', 'Arioch power claw (melee)', 'Warlord feet', 'Belicosa volcano cannon']),
    );
    expect(u.abilities.map((a) => a.name)).toEqual(expect.arrayContaining(['Void Shields', 'Reactor Meltdown', 'War Engine']));
  });

  test('offered once by the builder; in an Onslaught Super-Heavy Auxiliary its only problem is the points', () => {
    const { scope, picker, forceSelId, roster: start } = freshList('chaos-chaos-titan-legions', 'onslaught', 'Super-Heavy Auxiliary Detachment');
    const offered = picker.filter((o) => displayName(o.name) === 'Chaos Warlord Titan');
    expect(offered).toHaveLength(1);
    expect(offered[0]).toMatchObject({ role: 'Lord of War', points: 5500 });
    const roster = addUnit(scope, start, forceSelId, offered[0].entryId).roster;
    const { issues } = validate(scope, roster, realPolicy());
    expect(issues.map((i) => i.rule)).toContain('points-over');
    expect(issues.filter((i) => i.rule !== 'points-over')).toEqual([]);
  });
});
