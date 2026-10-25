/** Plan H Task 5: a unit in a list, in New Recruit's order, from the player's own selections. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogueOut, UnitOut } from '@recruit/data/model';
import { addUnit, availableUnits, evaluate, findSelView, FORCE, removeSelection, type Roster, type Scope, type Sel, type SelView } from '@recruit/data/roster';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getIndex, getRosterScope, resetDataCache } from '../../factions/dataClient';
import { stubGeneratedData } from '../../lists/__fixtures__/generatedData';
import { novokhPatrol, pickOption } from '../../lists/__fixtures__/patrolList';
import { startingRoster } from '../../lists/newListSetup';
import { listSheet } from './sheetModel';

vi.setConfig({ testTimeout: 20_000 });
beforeEach(() => {
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

const GENERATED = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'data', 'generated');
const unitOut = (slug: string, name: string): UnitOut => {
  const cat: CatalogueOut = JSON.parse(readFileSync(join(GENERATED, 'catalogues', `${slug}.json`), 'utf8'));
  return cat.units.find((u) => u.name === name)!;
};

const AM = 'imperium-astra-militarum';

/** A new Strike Force list for the catalogue with the named unit added; the unit's selection id. */
async function withUnit(slug: string, name: string): Promise<{ scope: Scope; roster: Roster; selId: string }> {
  const [scope, index] = await Promise.all([getRosterScope([slug]), getIndex()]);
  const catalogueId = index.catalogues.find((c) => c.slug === slug)!.id;
  const start = startingRoster(scope, { name: 'x', catalogueId, sizeId: 'strike-force', forceId: FORCE.arksOfOmen });
  const entry = availableUnits(scope, start, start.forces[0].id).find((u) => u.name === name)!;
  const { roster, selId } = addUnit(scope, start, start.forces[0].id, entry.entryId);
  return { scope, roster, selId };
}
const view = (scope: Scope, roster: Roster, selId: string): SelView => findSelView(evaluate(scope, roster), selId)!;
const findSel = (sels: Sel[], pred: (s: Sel) => boolean): Sel | undefined => {
  for (const s of sels) {
    if (pred(s)) return s;
    const inner = findSel(s.children, pred);
    if (inner) return inner;
  }
  return undefined;
};

describe('a Cadian Command Squad in a list', () => {
  test('each model with what it carries; only the weapons carried, with counts and who', async () => {
    const { scope, roster: start, selId } = await withUnit(AM, 'Cadian Command Squad');
    // The Commander swaps the laspistol for a plasma pistol.
    let roster = start;
    const v0 = view(scope, roster, selId);
    const commander = v0.children.find((c) => c.name === 'Cadian Commander')!;
    const laspistol = findSel(commander.sel.children, (s) => /laspistol/i.test(scope.node(s.entryId)?.name ?? ''))!;
    roster = removeSelection(roster, laspistol.id);
    roster = pickOption(scope, roster, commander.sel.id, 'Plasma pistol');
    const sheet = listSheet(unitOut(AM, 'Cadian Command Squad'), view(scope, roster, selId));

    const rows = sheet.models.map((m) => `${m.count}x ${m.name}: ${m.gear.join(', ')}`);
    // As New Recruit lists it: every choice on the model, abilities' upgrades included.
    expect(rows).toContain('1x Cadian Commander: Chainsword, Commanding Authority, Frag grenades, Plasma pistol');
    // A choice that wraps others shows them in brackets.
    expect(rows).toContain('1x Cadian Veteran w/ Regimental Standard: Frag grenades, Lasgun and Regimental Standard (Lasgun, Regimental Standard)');
    expect(rows).toContain('1x Cadian Veteran w/ Medi-pack: Frag grenades, Lasgun, Medi-pack');
    expect(sheet.stats.map((s) => [s.label, s.count])).toEqual([
      ['Cadian Commander', 1],
      ['Veteran', 4],
    ]);
    const weapon = (n: string) => sheet.weapons.find((w) => w.name === n);
    expect(weapon('Plasma pistol')).toMatchObject({ count: 1, carriedBy: 'Cadian Commander' });
    expect(weapon('Laspistol')).toMatchObject({ count: 2, carriedBy: '2 Veterans' });
    expect(weapon('Power fist')).toBeUndefined();
    // Nothing to choose here: the list is what it is.
    expect(sheet.options).toEqual([]);
    expect(sheet.canAlsoTake).toEqual([]);
  });

  test('an attaché taken shows in Models and Stats', async () => {
    const { scope, roster: start, selId } = await withUnit(AM, 'Cadian Command Squad');
    const roster = pickOption(scope, start, selId, 'Astropath');
    const sheet = listSheet(unitOut(AM, 'Cadian Command Squad'), view(scope, roster, selId));
    expect(sheet.models.map((m) => m.name)).toContain('Astropath');
    expect(sheet.stats.map((s) => s.label)).toContain('Astropath');
  });
});

test('identical models are one row; gear on the unit itself is a row of its own (Cadian Shock Troops)', async () => {
  const { scope, roster, selId } = await withUnit(AM, 'Cadian Shock Troops');
  const sheet = listSheet(unitOut(AM, 'Cadian Shock Troops'), view(scope, roster, selId));
  const rows = sheet.models.map((m) => `${m.count ? `${m.count}x ` : ''}${m.name}: ${m.gear.join(', ')}`);
  expect(rows).toContain('9x Shock Trooper: Lasgun');
  expect(rows).toContain('Unit: Frag grenades');
});

test('a list made before per-model data still renders: every unit of the Novokh patrol', async () => {
  const scope = await getRosterScope(['necrons']);
  const roster = novokhPatrol(scope);
  for (const v of evaluate(scope, roster).forces[0].selections.filter((s) => s.type === 'unit' || s.type === 'model')) {
    const unit = unitOut('necrons', v.name.replace(/\s*\[.*$/, ''));
    if (!unit) continue;
    const sheet = listSheet(unit, v);
    expect(sheet.models.length, v.name).toBeGreaterThan(0);
    expect(sheet.stats.length, v.name).toBeGreaterThan(0);
  }
});
