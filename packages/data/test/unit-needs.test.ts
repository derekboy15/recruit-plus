/**
 * Faction pages list what the builder can field (Plan G Task 6): units stored as upgrades included, each unit that needs
 * an army choice tagged with it, and units only Open Play or Narrative can reveal left off. Reads generated/
 * (npm run data:build).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { availability } from '../src/extract/units';
import type { CatalogueOut, DataIndex } from '../src/model/types';
import { availableUnits, createRoster, resolve, type Cond, type CondGroup, type Mod } from '../src/roster';
import { FORCE } from '../src/roster/policy';
import { realCatalogueId, realScope } from './helpers/realScope';

const GENERATED = join(__dirname, '..', 'generated');
const index: DataIndex = JSON.parse(readFileSync(join(GENERATED, 'index.json'), 'utf8'));
const catalogue = (slug: string): CatalogueOut => JSON.parse(readFileSync(join(GENERATED, 'catalogues', `${slug}.json`), 'utf8'));
const unit = (slug: string, name: string) => {
  const u = catalogue(slug).units.find((x) => x.name === name);
  if (!u) throw new Error(`${slug} has no unit "${name}"`);
  return u;
};
const PLAYABLE = index.catalogues.filter((c) => !c.library).map((c) => c.slug);

test('units BattleScribe stores as upgrades are listed', () => {
  for (const [slug, name] of [
    ['chaos-chaos-space-marines', 'Vashtorr the Arkifane'],
    ['chaos-daemons', 'Skull Altar'],
    ['chaos-servants-of-the-abyss', 'Cultist Firebrand'],
    ['chaos-servants-of-the-abyss', 'Rogue Psyker'],
    ['imperium-astra-militarum', 'Crassus'],
    ['imperium-grey-knights', 'Stormraven Gunship'],
  ]) {
    expect(catalogue(slug).units.map((u) => u.name), slug).toContain(name);
  }
});

test('a unit that needs an army choice says which, not what rules it out', () => {
  // Imotekh is also hidden in an Annihilation Legion and in a Cult of the Cryptek army: those exclude him.
  expect(unit('necrons', 'Imotekh the Stormlord').needs).toEqual(['Sautekh dynasty']);
  expect(unit('imperium-adeptus-astartes-ultramarines', 'Gabriel Angelos').needs).toContain('Blood Ravens');
  expect(unit('imperium-grey-knights', 'Brother-Captain Stern').needs).toEqual(['Wardmakers']);
  expect(unit('necrons', 'Necron Warriors').needs).toBeUndefined();
});

test('units only Open Play or Narrative games can field are left off', () => {
  for (const slug of PLAYABLE) {
    expect(catalogue(slug).units.filter((u) => /\(open play\)/i.test(u.name)).map((u) => u.name), slug).toEqual([]);
  }
  const orks = catalogue('orks').units.map((u) => u.name);
  for (const name of ['Kart', 'Wagon', 'Manik Gorg', 'Looted Wagon']) expect(orks).not.toContain(name);
});

describe('the faction page and the builder agree on a fresh Strike Force list', () => {
  test.each(PLAYABLE)('%s', (slug) => {
    const scope = realScope(slug);
    const catalogueId = realCatalogueId(slug);
    const r = createRoster(scope, { name: slug, catalogueId, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
    // Every army may take the .gst's fortifications; they aren't on any faction page.
    const systemRoots = new Set(scope.system.rootEntries.map((n) => n.id));
    const picker = availableUnits(scope, r, r.forces[0].id)
      .filter((o) => !systemRoots.has(o.entryId))
      .map((o) => resolve(scope, scope.node(o.entryId)!).target);
    const page = catalogue(slug).units;
    const pageIds = new Set(page.map((u) => u.id));
    const pickerIds = new Set(picker.map((t) => t.id));
    expect(picker.filter((t) => !pageIds.has(t.id)).map((t) => t.name), 'in the builder, not on the page').toEqual([]);
    expect(page.filter((u) => !pickerIds.has(u.id) && !u.needs?.length && !u.legends).map((u) => u.name), 'on the page, not in the builder').toEqual([]);
  });
});

describe('what a unit needs: one choice of several, or several at once', () => {
  const c = (type: Cond['type'], childId: string, value: number): Cond => ({ type, field: 'selections', scope: 'force', childId, value });
  const group = (type: CondGroup['type'], ...conds: Cond[]): CondGroup => ({ type, conds, groups: [] });
  const hide = (when: CondGroup): Mod => ({ type: 'set', field: 'hidden', value: 'true', when });
  const reveal = (when: CondGroup): Mod => ({ type: 'set', field: 'hidden', value: 'false', when });
  const needs = (mods: Mod[], hiddenByDefault = false) => availability(mods, hiddenByDefault).needIdSets;

  test('revealed by two choices together: both', () => {
    expect(needs([reveal(group('and', c('greaterThan', 'A', 0), c('equalTo', 'B', 1)))], true)).toEqual([['A', 'B']]);
  });
  test('revealed by either of two choices: either', () => {
    expect(needs([reveal(group('or', c('atLeast', 'A', 1), c('atLeast', 'B', 1)))], true)).toEqual([['A'], ['B']]);
  });
  test('hidden unless one of two choices: either (Skull Altar)', () => {
    expect(needs([hide(group('and', c('equalTo', 'A', 0), c('equalTo', 'B', 0)))])).toEqual([['A'], ['B']]);
  });
  test('hidden unless both of two choices: both', () => {
    expect(needs([hide(group('or', c('equalTo', 'A', 0), c('lessThan', 'B', 1)))])).toEqual([['A', 'B']]);
  });
  test('two hides that each need a choice: both', () => {
    expect(needs([hide(group('and', c('equalTo', 'A', 0))), hide(group('and', c('equalTo', 'B', 0)))])).toEqual([['A', 'B']]);
  });
  test('exclusions and context add nothing (Imotekh)', () => {
    const mods = [
      hide(group('and', c('atLeast', 'Annihilation Legion', 1))),
      hide(group('and', c('atLeast', 'Dynasty Choice', 1), c('lessThan', 'Sautekh', 1))),
      hide(group('and', c('atLeast', 'Cult of the Cryptek', 1))),
    ];
    expect(needs(mods)).toEqual([['Sautekh']]);
  });

  test('on real data: Court of the Archon needs an Archon and Ynnari together; Skull Altar needs either god', () => {
    expect(unit('aeldari-craftworlds', 'Court of the Archon').needs).toEqual(['Archon and Ynnari: Strength From Death']);
    expect(unit('chaos-daemons', 'Skull Altar').needs).toEqual(['Khorne', 'Chaos Undivided']);
  });
});
