import { test, expect, describe } from 'vitest';
import {
  addChild,
  addForce,
  addUnit,
  armyOptions,
  availableUnits,
  buildScope,
  childConstraintCount,
  childLimits,
  childOptions,
  chooseInGroup,
  countIn,
  duplicateSelection,
  evaluate,
  newId,
  removeForce,
  removeSelection,
  rootEntriesFor,
  setCount,
  splitSelection,
  COST_PTS,
  type Constraint,
  type Roster,
  type RosterFile,
  type RosterView,
  type Sel,
  type SelView,
} from '../src/roster';
import * as M from './fixtures/roster/mini';
import { realCatalogueId, realScope } from './helpers/realScope';

const scope = buildScope(M.miniFiles);

const empty = (forceId = M.FORCE_PATROL): Roster =>
  addForce(scope, { schema: 1, name: 'Test', catalogueId: M.CAT_ID, battleSize: 'strike-force', forces: [] }, forceId, M.CAT_ID);

function find(view: RosterView, selId: string): SelView {
  const walk = (vs: SelView[]): SelView | undefined => {
    for (const v of vs) {
      if (v.sel.id === selId) return v;
      const hit = walk(v.children);
      if (hit) return hit;
    }
  };
  const hit = walk(view.forces.flatMap((f) => f.selections));
  if (!hit) throw new Error(`no view for ${selId}`);
  return hit;
}
function findSel(r: Roster, selId: string): Sel {
  const walk = (ss: Sel[]): Sel | undefined => {
    for (const s of ss) {
      if (s.id === selId) return s;
      const hit = walk(s.children);
      if (hit) return hit;
    }
  };
  const hit = walk(r.forces.flatMap((f) => f.selections));
  if (!hit) throw new Error(`no selection ${selId}`);
  return hit;
}
/** entryId:count tree, ignoring ids. */
const shape = (s: Sel): unknown => ({ entryId: s.entryId, count: s.count, children: s.children.map(shape) });

function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object') {
    Object.values(x).forEach(deepFreeze);
    Object.freeze(x);
  }
  return x;
}

/**
 * The mini files plus a Configuration category linked from every force, a Configuration root entry, a [Reference]
 * Configuration entry, and an upgrade-type root entry with a battlefield role (shaped like the Aquila Strongpoints).
 */
const CAT_CONFIG = 'cat-config';
const E_CONFIG = 'se-config';
const E_REFERENCE = 'se-reference';
const E_STRONGPOINT = 'se-strongpoint';
const configScope = buildScope([
  M.catalogue,
  M.library,
  {
    ...M.system,
    rootEntries: [
      ...M.system.rootEntries,
      { id: E_CONFIG, kind: 'entry', name: 'Detachment Choice', type: 'upgrade', cats: [{ id: 'cl-config', targetId: CAT_CONFIG, primary: true }] },
      { id: E_REFERENCE, kind: 'entry', name: '[Reference] Rules', type: 'upgrade', cats: [{ id: 'cl-ref', targetId: CAT_CONFIG, primary: true }] },
      { id: E_STRONGPOINT, kind: 'entry', name: 'Strongpoint', type: 'upgrade', costs: { [COST_PTS]: 50 }, cats: [{ id: 'cl-sp', targetId: M.CAT_ELITES, primary: true }] },
    ],
    categories: [...M.system.categories, { id: CAT_CONFIG, name: 'Configuration' }],
    forces: M.system.forces.map((f) => ({ ...f, cats: [{ id: `cl-${f.id}-config`, targetId: CAT_CONFIG }, ...f.cats] })),
  } satisfies RosterFile,
]);

describe('edits', () => {
  test('newId is a UUID v4', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newId()).not.toBe(newId());
  });

  test('addUnit fills a 10-model default stack', () => {
    const r0 = empty();
    const { roster, selId } = addUnit(scope, r0, r0.forces[0].id, M.L_WARRIORS);
    expect(shape(findSel(roster, selId))).toEqual({
      entryId: M.L_WARRIORS,
      count: 1,
      children: [{ entryId: M.L_WARRIOR_MODEL, count: 10, children: [{ entryId: M.L_GAUSS, count: 1, children: [] }] }],
    });
    expect(evaluate(scope, roster).total[COST_PTS]).toBe(110);
  });

  test('addUnit picks the group default', () => {
    const r0 = empty();
    const { roster, selId } = addUnit(scope, r0, r0.forces[0].id, M.L_SQUAD);
    expect(shape(findSel(roster, selId))).toEqual({
      entryId: M.L_SQUAD,
      count: 1,
      children: [{ entryId: M.L_SQUAD_MODEL, count: 5, children: [{ entryId: M.E_BOLTER, count: 1, children: [] }] }],
    });
  });

  test('a required group without a default is filled only when it has a single visible choice', () => {
    const files = structuredClone(M.miniFiles);
    const group = files[0].shared.find((n) => n.id === M.E_SQUAD_MODEL)!.children![0];
    delete group.defaultId;
    const weapons = (s: ReturnType<typeof buildScope>) => {
      const r0 = empty();
      const { roster, selId } = addUnit(s, r0, r0.forces[0].id, M.L_SQUAD);
      return findSel(roster, selId).children[0].children.map((c) => c.entryId);
    };
    expect(weapons(buildScope(files))).toEqual([]); // Bolter or Plasma: the user chooses
    group.children![0].hidden = true; // Bolter
    expect(weapons(buildScope(structuredClone(files)))).toEqual([M.E_PLASMA]);
  });

  test("a group default is never added beyond its own maximum", () => {
    const files = structuredClone(M.miniFiles);
    const group = files[0].shared.find((n) => n.id === M.E_SQUAD_MODEL)!.children![0];
    // Two weapons, the default Bolter at most once: one Bolter, and the second weapon is left for the user.
    group.constraints = group.constraints!.map((c) => ({ ...c, value: 2 }));
    group.children![0].constraints = [{ id: 'c-bolter-max', type: 'max', field: 'selections', scope: 'parent', value: 1 }];
    const s = buildScope(files);
    const r0 = empty();
    const { roster, selId } = addUnit(s, r0, r0.forces[0].id, M.L_SQUAD);
    expect(findSel(roster, selId).children[0].children.map((c) => [c.entryId, c.count])).toEqual([[M.E_BOLTER, 1]]);
  });

  test('addChild adds an option with its required children; unknown ids leave the roster unchanged', () => {
    const r0 = empty();
    const { roster, selId } = addUnit(scope, r0, r0.forces[0].id, M.L_WARRIORS);
    const r1 = addChild(scope, roster, selId, M.L_WARRIOR_MODEL, 2);
    const added = findSel(r1, selId).children[1];
    expect(shape(added)).toEqual({ entryId: M.L_WARRIOR_MODEL, count: 2, children: [{ entryId: M.L_GAUSS, count: 1, children: [] }] });
    expect(addChild(scope, roster, 'stale', M.L_WARRIOR_MODEL)).toBe(roster);
    expect(addChild(scope, roster, selId, M.E_PLASMA)).toBe(roster); // not an option of Warriors
    expect(addUnit(scope, roster, 'stale', M.L_LORD).roster).toBe(roster);
  });

  test('chooseInGroup replaces the previous choice', () => {
    const r0 = empty();
    const { roster, selId } = addUnit(scope, r0, r0.forces[0].id, M.L_LORD);
    const blade = chooseInGroup(scope, roster, selId, M.G_LORD_MELEE, M.L_LORD_BLADE);
    expect(findSel(blade, selId).children.map((c) => c.entryId)).toEqual([M.L_LORD_BLADE]);
    const claws = chooseInGroup(scope, addChild(scope, blade, selId, M.E_WARLORD_UPG), selId, M.G_LORD_MELEE, M.L_LORD_CLAWS);
    expect(findSel(claws, selId).children.map((c) => c.entryId)).toEqual([M.E_WARLORD_UPG, M.L_LORD_CLAWS]);
    expect(chooseInGroup(scope, claws, selId, M.G_LORD_MELEE, M.L_LORD_CLAWS)).toBe(claws); // already chosen
    expect(chooseInGroup(scope, claws, selId, M.G_LORD_MELEE, M.E_WARLORD_UPG)).toBe(claws); // not in the group
  });

  test('setCount 0 removes the selection', () => {
    const r0 = empty();
    const { roster, selId } = addUnit(scope, r0, r0.forces[0].id, M.L_WARRIORS);
    const model = findSel(roster, selId).children[0];
    expect(findSel(setCount(scope, roster, model.id, 12), model.id).count).toBe(12);
    expect(findSel(setCount(scope, roster, model.id, 0), selId).children).toEqual([]);
    expect(setCount(scope, roster, selId, 0).forces[0].selections).toEqual([]);
    expect(setCount(scope, roster, 'stale', 3)).toBe(roster);
  });

  test('removeSelection and duplicateSelection', () => {
    const r0 = empty();
    const a = addUnit(scope, r0, r0.forces[0].id, M.L_WARRIORS);
    const b = addUnit(scope, a.roster, r0.forces[0].id, M.L_LORD);
    expect(removeSelection(b.roster, a.selId).forces[0].selections.map((s) => s.id)).toEqual([b.selId]);
    expect(removeSelection(b.roster, 'stale')).toBe(b.roster);
    const dup = duplicateSelection(b.roster, a.selId).forces[0].selections;
    expect(dup.map((s) => s.entryId)).toEqual([M.L_WARRIORS, M.L_WARRIORS, M.L_LORD]);
    expect(shape(dup[1])).toEqual(shape(dup[0]));
    const ids = (s: Sel): string[] => [s.id, ...s.children.flatMap(ids)];
    expect(ids(dup[1]).filter((id) => ids(dup[0]).includes(id))).toEqual([]);
    expect(duplicateSelection(b.roster, 'stale')).toBe(b.roster);
  });

  test('edits never mutate the input roster', () => {
    const r0 = empty();
    const unit = addUnit(scope, r0, r0.forces[0].id, M.L_SQUAD);
    const lord = addUnit(scope, unit.roster, r0.forces[0].id, M.L_LORD);
    const frozen = deepFreeze(addForce(scope, lord.roster, M.FORCE_BATTALION, M.CAT_ID));
    const snapshot = structuredClone(frozen);
    const model = findSel(frozen, unit.selId).children[0];
    const fs = frozen.forces[0].id;
    expect(() => {
      addForce(scope, frozen, M.FORCE_PATROL, M.CAT_ID);
      removeForce(scope, frozen, fs);
      addUnit(scope, frozen, fs, M.L_WARRIORS);
      addChild(scope, frozen, lord.selId, M.E_WARLORD_UPG);
      setCount(scope, frozen, model.id, 7);
      setCount(scope, frozen, model.id, 0);
      removeSelection(frozen, model.id);
      splitSelection(frozen, model.id);
      duplicateSelection(frozen, unit.selId);
      chooseInGroup(scope, frozen, model.id, M.G_SQUAD_WEAPON, M.E_PLASMA);
      chooseInGroup(scope, frozen, lord.selId, M.G_LORD_MELEE, M.L_LORD_BLADE);
    }).not.toThrow();
    expect(frozen).toEqual(snapshot);
  });

  test('split then shrink keeps per-model wargear', () => {
    const r0 = empty();
    const unit = addUnit(scope, r0, r0.forces[0].id, M.L_SQUAD);
    const stack = findSel(unit.roster, unit.selId).children[0];
    const ten = setCount(scope, unit.roster, stack.id, 10);
    const split = splitSelection(ten, stack.id);
    expect(findSel(split.roster, unit.selId).children.map((c) => [c.id, c.count])).toEqual([
      [stack.id, 9],
      [split.selId, 1],
    ]);
    const plasma = chooseInGroup(scope, split.roster, split.selId, M.G_SQUAD_WEAPON, M.E_PLASMA);
    const final = setCount(scope, plasma, stack.id, 8);

    const view = evaluate(scope, final);
    const unitView = find(view, unit.selId);
    expect(unitView.models).toBe(9);
    expect(unitView.children.map((m) => [m.sel.count, m.children.map((w) => w.sel.entryId)])).toEqual([
      [8, [M.E_BOLTER]],
      [1, [M.E_PLASMA]],
    ]);
    expect(view.total[COST_PTS]).toBe(9 * 18 + 5);
    for (const m of unitView.children) {
      expect(countIn({ scope, view, at: m }, 'self', 'selections', M.G_SQUAD_WEAPON, { childSel: false, childForces: false })).toBe(1);
    }
  });

  test('splitSelection on a single copy keeps it; unknown ids are ignored', () => {
    const r0 = empty();
    const { roster, selId } = addUnit(scope, r0, r0.forces[0].id, M.L_LORD);
    expect(splitSelection(roster, selId)).toEqual({ roster, selId });
    expect(splitSelection(roster, 'stale').roster).toBe(roster);
  });

  test('removeForce keeps configuration selections', () => {
    let r: Roster = { schema: 1, name: 'Test', catalogueId: M.CAT_ID, battleSize: 'strike-force', forces: [] };
    r = addForce(configScope, r, M.FORCE_PATROL, M.CAT_ID);
    r = addForce(configScope, r, M.FORCE_BATTALION, M.CAT_ID);
    const [first, second] = r.forces.map((f) => f.id);
    const config = addUnit(configScope, r, first, E_CONFIG);
    const lord = addUnit(configScope, config.roster, first, M.L_LORD);
    const warriors = addUnit(configScope, lord.roster, second, M.L_WARRIORS);
    const after = removeForce(configScope, warriors.roster, first);
    expect(after.forces.map((f) => f.id)).toEqual([second]);
    expect(after.forces[0].selections.map((s) => s.id).sort()).toEqual([config.selId, warriors.selId].sort());
    // Removing a later force moves nothing.
    expect(removeForce(configScope, warriors.roster, second).forces[0].selections.map((s) => s.id)).toEqual([config.selId, lord.selId]);
    expect(removeForce(configScope, warriors.roster, 'stale')).toBe(warriors.roster);
  });
});

describe('option queries', () => {
  test('availableUnits lists unit and model root entries in the force, by role then name, with filled-in pts', () => {
    const r = empty();
    expect(availableUnits(scope, r, r.forces[0].id)).toEqual([
      { entryId: M.L_LORD, name: 'Lord', role: 'HQ', points: 80, legends: false },
      { entryId: M.L_HORDE, name: 'Horde', role: 'Troops', points: 0, legends: false },
      { entryId: M.L_WARRIORS, name: 'Warriors', role: 'Troops', points: 110, legends: false },
      { entryId: M.E_BEAST, name: 'Beast', role: 'Elites', points: 20, legends: false },
      { entryId: M.L_IMP, name: 'Imps', role: 'Elites', points: 30, legends: false },
      { entryId: M.L_SQUAD, name: 'Squad', role: 'Elites', points: 90, legends: false },
    ]);
    expect(availableUnits(scope, r, 'stale')).toEqual([]);
  });

  test('armyOptions lists Configuration upgrades except [Reference] ones; role upgrades are units', () => {
    const r = addForce(configScope, { schema: 1, name: 'Test', catalogueId: M.CAT_ID, battleSize: 'strike-force', forces: [] }, M.FORCE_PATROL, M.CAT_ID);
    // The system's Pact has no primary category, so it is never offered.
    expect(armyOptions(configScope, r, r.forces[0].id)).toEqual([
      { entryId: E_CONFIG, name: 'Detachment Choice', role: 'Configuration', points: 0, legends: false },
    ]);
    expect(availableUnits(configScope, r, r.forces[0].id).filter((u) => u.role === 'Elites').map((u) => [u.name, u.points])).toEqual([
      ['Beast', 20],
      ['Imps', 30],
      ['Squad', 90],
      ['Strongpoint', 50],
    ]);
  });

  test('availableUnits prices units against the roster configuration and caches them', () => {
    let r = addForce(configScope, { schema: 1, name: 'Test', catalogueId: M.CAT_ID, battleSize: 'strike-force', forces: [] }, M.FORCE_PATROL, M.CAT_ID);
    const fs = r.forces[0].id;
    const first = availableUnits(configScope, r, fs);
    r = addUnit(configScope, r, fs, M.L_WARRIORS).roster;
    r = addUnit(configScope, r, fs, E_CONFIG).roster;
    expect(availableUnits(configScope, r, fs)).toEqual(first);
  });

  test('childOptions: groups with their options, limits, counts and pts', () => {
    const r0 = empty();
    const unit = addUnit(scope, r0, r0.forces[0].id, M.L_SQUAD);
    const stack = findSel(unit.roster, unit.selId).children[0];
    expect(childOptions(scope, unit.roster, unit.selId)).toEqual([
      { kind: 'option', id: M.L_SQUAD_MODEL, name: 'Squad Marine', min: 5, max: 10, count: 5, pointsEach: 18, collective: false, selIds: [stack.id], children: [] },
    ]);
    const bolter = stack.children[0];
    expect(childOptions(scope, unit.roster, stack.id)).toEqual([
      {
        kind: 'group', id: M.G_SQUAD_WEAPON, name: 'Weapon', min: 1, max: 1, count: 1, pointsEach: 0, collective: false, selIds: [bolter.id],
        children: [
          { kind: 'option', id: M.E_BOLTER, name: 'Bolter', min: 0, max: -1, count: 1, pointsEach: 0, collective: false, selIds: [bolter.id], children: [] },
          { kind: 'option', id: M.E_PLASMA, name: 'Plasma', min: 0, max: -1, count: 0, pointsEach: 5, collective: false, selIds: [], children: [] },
        ],
      },
    ]);
    const lord = addUnit(scope, r0, r0.forces[0].id, M.L_LORD);
    const opts = childOptions(scope, lord.roster, lord.selId);
    expect(opts.map((o) => [o.kind, o.id, o.max, o.pointsEach])).toEqual([
      ['option', M.E_WARLORD_UPG, 1, 0],
      ['group', M.G_LORD_MELEE, 1, 0],
    ]);
    expect(opts[1].children.map((o) => [o.id, o.pointsEach])).toEqual([
      [M.L_LORD_BLADE, 5],
      [M.L_LORD_CLAWS, 0],
    ]);
    expect(childOptions(scope, lord.roster, 'stale')).toEqual([]);
  });

  test('a child constraint counts through every link to its target when shared, and only its own link when not', () => {
    const r0 = empty();
    const lord = addUnit(scope, r0, r0.forces[0].id, M.L_LORD);
    const r = addChild(scope, addChild(scope, lord.roster, lord.selId, M.L_LORD_BLADE), lord.selId, M.L_LORD_CLAWS);
    const view = evaluate(scope, r);
    const container = find(view, lord.selId);
    const max1: Constraint = { id: 'x', type: 'max', field: 'selections', scope: 'parent', value: 1 };
    const claws = scope.node(M.L_LORD_CLAWS)!;
    expect(childConstraintCount(scope, view, container, claws, max1)).toBe(2);
    expect(childConstraintCount(scope, view, container, claws, { ...max1, shared: false })).toBe(1);
    // A group's own constraint counts the selections inside it.
    expect(childConstraintCount(scope, view, container, scope.node(M.G_LORD_MELEE)!, max1)).toBe(2);
    expect(childLimits(scope, view, container, scope.node(M.G_LORD_MELEE)!)).toEqual({ min: 0, max: 1 });
  });
});

describe('real BSData v9.8.0', () => {
  test('Necrons Arks of Omen: available units and army options', () => {
    const real = realScope('necrons');
    const necrons = realCatalogueId('necrons');
    const r = addForce(real, { schema: 1, name: 'Necrons', catalogueId: necrons, battleSize: 'strike-force', forces: [] }, 'fa51-993c-2f8b-9be4', necrons);
    const units = availableUnits(real, r, r.forces[0].id);
    expect(units.find((u) => u.name === 'Necron Warriors')).toMatchObject({ points: 110, role: 'Troops', legends: false });
    expect(units.filter((u) => /\[reference\]/i.test(u.name))).toEqual([]);
    expect(units.find((u) => u.entryId === '46df-b154-20ff-cce1')).toBeUndefined(); // Aegis Defence Line: always hidden
    expect(units.some((u) => u.legends)).toBe(true);
    // Upgrade-typed Fortifications are units.
    expect(units.find((u) => u.name === 'Macro-cannon Aquila Strongpoint')).toMatchObject({ role: 'Fortification' });
    const army = armyOptions(real, r, r.forces[0].id).map((o) => o.name);
    expect(army).toContain('Dynasty Choice');
    expect(army.filter((n) => n.startsWith('[') || /Aquila Strongpoint/.test(n))).toEqual([]);
  });

  test('adding Dynasty Choice leaves the dynasty for the user to choose', () => {
    const real = realScope('necrons');
    const necrons = realCatalogueId('necrons');
    const r = addForce(real, { schema: 1, name: 'Necrons', catalogueId: necrons, battleSize: 'strike-force', forces: [] }, 'fa51-993c-2f8b-9be4', necrons);
    const { roster, selId } = addUnit(real, r, r.forces[0].id, 'fb30-1514-c892-86b5');
    const code = childOptions(real, roster, selId).find((o) => o.name === '-Dynastic Code-')!;
    expect(code).toMatchObject({ kind: 'group', min: 1, count: 0 });
  });

  test('removing the first force moves roster-wide configuration, not entries the next force already has', () => {
    const real = realScope('necrons');
    const necrons = realCatalogueId('necrons');
    const patrol = 'a0c7-2a71-bae0-215d';
    let r = addForce(real, { schema: 1, name: 'Necrons', catalogueId: necrons, battleSize: 'onslaught', forces: [] }, patrol, necrons);
    r = addForce(real, r, patrol, necrons);
    const names = (roster: Roster) => evaluate(real, roster).forces[0].selections.map((v) => v.name.trim()).sort();
    expect(names(removeForce(real, r, r.forces[0].id))).toEqual(['Battle Size', 'Detachment Command Cost', 'Dynasty Choice', 'Game Type']);
  });

  test("units are listed under their target's name, not the link's authoring label", () => {
    const real = realScope('imperium-grey-knights');
    const gk = realCatalogueId('imperium-grey-knights');
    const r = addForce(real, { schema: 1, name: 'GK', catalogueId: gk, battleSize: 'strike-force', forces: [] }, 'fa51-993c-2f8b-9be4', gk);
    const units = availableUnits(real, r, r.forces[0].id);
    // The root entry cd08-… is a link labelled "New EntryLink" to Castellan Crowe.
    expect(units.find((u) => u.entryId === 'cd08-22f1-42d1-b0e2')).toMatchObject({ name: 'Castellan Crowe', role: 'HQ' });
    expect(units.filter((u) => /new entrylink/i.test(u.name))).toEqual([]);
  });

  test('a unit that takes no slot is offered (Rogue Psyker beside Obsidius Mallex); a slot-free wrapper holding a unit is not', () => {
    const real = realScope('chaos-servants-of-the-abyss');
    const sota = realCatalogueId('chaos-servants-of-the-abyss');
    let r = addForce(real, { schema: 1, name: 'SotA', catalogueId: sota, battleSize: 'strike-force', forces: [] }, 'fa51-993c-2f8b-9be4', sota);
    const fs = r.forces[0].id;
    const named = (name: string) => availableUnits(real, r, fs).filter((u) => u.name === name).map((u) => u.role);
    expect(named('Rogue Psyker')).toEqual(['Elites']);
    r = addUnit(real, r, fs, availableUnits(real, r, fs).find((u) => u.name === 'Obsidius Mallex')!.entryId).roster;
    // Slaves to Mallex: with Mallex in the detachment, BSData offers the Rogue Psyker as an upgrade taking no slot.
    expect(named('Rogue Psyker')).toEqual(['No Force Org Slot']);

    // Brotherhood of the Cog only holds a Tech-Priest Enginseer or Technoarcheologist: it is not a unit itself.
    const admech = realScope('imperium-adeptus-mechanicus');
    const am = realCatalogueId('imperium-adeptus-mechanicus');
    const a = addForce(admech, { schema: 1, name: 'AdMech', catalogueId: am, battleSize: 'strike-force', forces: [] }, 'fa51-993c-2f8b-9be4', am);
    expect(availableUnits(admech, a, a.forces[0].id).filter((u) => u.role === 'No Force Org Slot').map((u) => u.name)).toEqual([]);
  });

  test('availableUnits for a 40-unit Ultramarines roster is fast', () => {
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[1];
    const firsts: number[] = [];
    const seconds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const real = realScope('imperium-adeptus-astartes-ultramarines'); // a fresh scope: nothing cached
      const id = realCatalogueId('imperium-adeptus-astartes-ultramarines');
      let r = addForce(real, { schema: 1, name: 'UM', catalogueId: id, battleSize: 'strike-force', forces: [] }, 'fa51-993c-2f8b-9be4', id);
      const fs = r.forces[0].id;
      for (const u of rootEntriesFor(real, id).slice(0, 80)) r = addUnit(real, r, fs, u.id).roster;
      expect(r.forces[0].selections.length).toBeGreaterThanOrEqual(40);
      r = { ...r, forces: [{ ...r.forces[0], selections: r.forces[0].selections.slice(0, 40) }] };
      let t = performance.now();
      const a = availableUnits(real, r, fs);
      firsts.push(performance.now() - t);
      t = performance.now();
      expect(availableUnits(real, r, fs)).toEqual(a);
      seconds.push(performance.now() - t);
    }
    expect(median(firsts)).toBeLessThan(250);
    expect(median(seconds)).toBeLessThan(50);
  });
});
