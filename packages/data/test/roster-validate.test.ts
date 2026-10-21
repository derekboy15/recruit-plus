import { test, expect, describe } from 'vitest';
import {
  addChild,
  addForce,
  addUnit,
  buildScope,
  childOptions,
  chooseInGroup,
  evaluate,
  rootEntriesFor,
  setCount,
  validateConstraints,
  COST_PTS,
  type Issue,
  type OptionNode,
  type Roster,
  type RosterFile,
  type Scope,
} from '../src/roster';
import * as M from './fixtures/roster/mini';
import { realCatalogueId, realScope } from './helpers/realScope';

const scope = buildScope(M.miniFiles);

const empty = (s: Scope = scope, forceId = M.FORCE_PATROL): Roster =>
  addForce(s, { schema: 1, name: 'Test', catalogueId: M.CAT_ID, battleSize: 'strike-force', forces: [] }, forceId, M.CAT_ID);

const validate = (s: Scope, r: Roster): Issue[] => validateConstraints(s, evaluate(s, r));
const summary = (issues: Issue[]) => issues.map((i) => [i.rule, i.subject.name, i.limit, i.actual]);

/** Adds root entries in order; returns the roster and each new selection id. */
function withUnits(s: Scope, r: Roster, ...entryIds: string[]): { roster: Roster; ids: string[] } {
  const ids: string[] = [];
  let roster = r;
  for (const id of entryIds) {
    const added = addUnit(s, roster, roster.forces[0].id, id);
    roster = added.roster;
    ids.push(added.selId);
  }
  return { roster, ids };
}

/**
 * The mini files plus rules shaped like the v9.8.0 data: the Warlord category is min 1 / max 1 per roster, the Lord
 * is max 1 per force (like the Overlord), and Imps are hidden once the roster has a Warlord.
 */
const atLeast1 = (scopeKey: string, childId: string) => ({ type: 'atLeast' as const, field: 'selections', scope: scopeKey, childId, value: 1, childSel: true as const });
function rulesFiles(): RosterFile[] {
  const files = structuredClone(M.miniFiles);
  const [catalogue, , system] = files;
  const warlord = system.categories.find((c) => c.id === M.CAT_WARLORD)!;
  warlord.constraints = [
    { id: 'con-warlord-cat-max', type: 'max', field: 'selections', scope: 'roster', value: 1, childSel: true, childForces: true },
    { id: 'con-warlord-cat-min', type: 'min', field: 'selections', scope: 'roster', value: 1, childSel: true, childForces: true },
  ];
  catalogue.rootEntries.find((n) => n.id === M.L_LORD)!.constraints = [{ id: 'con-lord-unique', type: 'max', field: 'selections', scope: 'force', value: 1 }];
  catalogue.shared.find((n) => n.id === M.E_IMP)!.mods = [
    { type: 'set', field: 'hidden', value: 'true', when: { type: 'and', conds: [atLeast1('roster', M.CAT_WARLORD)], groups: [] } },
  ];
  return files;
}
const rules = buildScope(rulesFiles());

describe('validateConstraints (mini fixture)', () => {
  test('empty Patrol needs 1 HQ and 1 Troops', () => {
    const r = empty();
    const issues = validate(scope, r);
    expect(summary(issues)).toEqual([
      ['slot-min', 'HQ', 1, 0],
      ['slot-min', 'Troops', 1, 0],
    ]);
    expect(issues[0]).toMatchObject({ forceSelId: r.forces[0].id, subject: { id: M.CAT_HQ } });
    expect(issues[0].fix).toEqual({ kind: 'add-unit', forceSelId: r.forces[0].id, entryIds: [M.L_LORD] });
    // Cheapest first: Horde (0 pts) before Warriors (110 pts).
    expect(issues[1].fix).toEqual({ kind: 'add-unit', forceSelId: r.forces[0].id, entryIds: [M.L_HORDE, M.L_WARRIORS] });
  });

  test('4 Troops in a Patrol is slot-max', () => {
    const { roster, ids } = withUnits(scope, empty(), M.L_LORD, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS);
    const issues = validate(scope, roster);
    expect(summary(issues)).toEqual([['slot-max', 'Troops', 3, 4]]);
    expect(issues[0].fix).toEqual({ kind: 'remove', selIds: [ids[4]] });
  });

  test('no Warlord', () => {
    const { roster, ids } = withUnits(rules, empty(rules), M.L_LORD, M.L_WARRIORS);
    const issues = validate(rules, roster);
    expect(summary(issues)).toEqual([['warlord-missing', 'Warlord', 1, 0]]);
    expect(issues[0].fix).toEqual({ kind: 'open', selId: ids[0] });
  });

  test('two Warlords', () => {
    // The Lord is max 1 per force, so the second Warlord is in a second detachment.
    const { roster } = withUnits(rules, empty(rules, M.FORCE_BATTALION), M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS);
    const lord1 = addUnit(rules, roster, roster.forces[0].id, M.L_LORD);
    let r = addChild(rules, lord1.roster, lord1.selId, M.E_WARLORD_UPG);
    r = addForce(rules, r, M.FORCE_PATROL, M.CAT_ID);
    const lord2 = addUnit(rules, r, r.forces[1].id, M.L_LORD);
    r = addChild(rules, lord2.roster, lord2.selId, M.E_WARLORD_UPG);
    const warriors = addUnit(rules, r, r.forces[1].id, M.L_WARRIORS);
    const issues = validate(rules, warriors.roster).filter((i) => i.rule !== 'slot-min');
    expect(summary(issues)).toEqual([['warlord-extra', 'Warlord', 1, 2]]);
    expect(issues[0].fix).toEqual({ kind: 'open', selId: lord2.selId });
  });

  test('9 warriors is model-count with set-count 10', () => {
    const { roster, ids } = withUnits(scope, empty(), M.L_LORD, M.L_WARRIORS);
    const unit = roster.forces[0].selections[1];
    const stack = unit.children[0];
    const issues = validate(scope, setCount(scope, roster, stack.id, 9));
    expect(summary(issues)).toEqual([['model-count', 'Warriors', 10, 9]]);
    expect(issues[0]).toMatchObject({ selId: ids[1], subject: { id: M.G_WARRIORS } });
    expect(issues[0].fix).toEqual({ kind: 'set-count', selId: stack.id, count: 10 });
    // 21 is over the maximum of 20.
    const over = validate(scope, setCount(scope, roster, stack.id, 21));
    expect(summary(over)).toEqual([
      ['model-count', 'Warriors', 20, 21],
      ['model-count', 'Warrior', 20, 21],
    ]);
    expect(over.map((i) => i.fix)).toEqual([
      { kind: 'set-count', selId: stack.id, count: 20 },
      { kind: 'set-count', selId: stack.id, count: 20 },
    ]);
  });

  test('a second copy of a unique character is unique', () => {
    const { roster, ids } = withUnits(rules, empty(rules), M.L_LORD, M.L_WARRIORS, M.L_LORD);
    const r = addChild(rules, roster, ids[0], M.E_WARLORD_UPG);
    const issues = validate(rules, r);
    expect(summary(issues)).toEqual([['unique', 'Lord', 1, 2]]);
    expect(issues[0]).toMatchObject({ forceSelId: r.forces[0].id, selId: ids[2], subject: { id: M.L_LORD } });
    expect(issues[0].fix).toEqual({ kind: 'remove', selIds: [ids[2]] });
  });

  test('two weapons on a one-weapon model is wargear-max', () => {
    const { roster, ids } = withUnits(scope, empty(), M.L_LORD, M.L_WARRIORS, M.L_SQUAD);
    const stack = roster.forces[0].selections[2].children[0];
    const issues = validate(scope, addChild(scope, roster, stack.id, M.E_PLASMA));
    expect(summary(issues)).toEqual([['wargear-max', 'Weapon', 1, 2]]);
    expect(issues[0]).toMatchObject({ selId: stack.id, subject: { id: M.G_SQUAD_WEAPON } });
    expect(issues[0].fix).toEqual({ kind: 'open', selId: ids[2] });
    // Removing the default leaves the required choice empty.
    const none = validate(scope, setCount(scope, roster, stack.children[0].id, 0));
    expect(summary(none)).toEqual([['option-required', 'Weapon', 1, 0]]);
    expect(none[0].fix).toEqual({ kind: 'open', selId: ids[2] });
  });

  test('a unit hidden by a later choice stays listed with hidden-selected', () => {
    const { roster, ids } = withUnits(rules, empty(rules), M.L_IMP, M.L_WARRIORS, M.L_LORD);
    expect(validate(rules, roster).map((i) => i.rule)).toEqual(['warlord-missing']);
    const r = addChild(rules, roster, ids[2], M.E_WARLORD_UPG); // the Warlord hides Imps
    const view = evaluate(rules, r);
    expect(view.forces[0].selections.map((v) => [v.sel.id, v.hidden])).toEqual([
      [ids[0], true],
      [ids[1], false],
      [ids[2], false],
    ]);
    const issues = validateConstraints(rules, view);
    expect(summary(issues)).toEqual([['hidden-selected', 'Imps', 0, 1]]);
    expect(issues[0]).toMatchObject({ forceSelId: r.forces[0].id, selId: ids[0], subject: { id: M.L_IMP } });
    expect(issues[0].fix).toEqual({ kind: 'remove', selIds: [ids[0]] });
  });

  test('a choice inside a group hidden by a later choice is hidden-selected', () => {
    // The Lord's melee group is hidden once the Lord is the Warlord (shaped like Relics / Warlord Trait groups).
    const files = structuredClone(M.miniFiles);
    const lord = files[0].shared.find((n) => n.id === M.E_LORD)!;
    lord.children!.find((n) => n.id === M.G_LORD_MELEE)!.mods = [
      { type: 'set', field: 'hidden', value: 'true', when: { type: 'and', conds: [atLeast1('parent', M.E_WARLORD_UPG)], groups: [] } },
    ];
    const s = buildScope(files);
    const { roster, ids } = withUnits(s, empty(s), M.L_LORD, M.L_WARRIORS);
    const blade = chooseInGroup(s, roster, ids[0], M.G_LORD_MELEE, M.L_LORD_BLADE);
    expect(validate(s, blade)).toEqual([]);
    const r = addChild(s, blade, ids[0], M.E_WARLORD_UPG);
    const bladeSel = r.forces[0].selections[0].children.find((c) => c.entryId === M.L_LORD_BLADE)!;
    const issues = validate(s, r);
    expect(summary(issues)).toEqual([['hidden-selected', 'Blade', 0, 1]]);
    expect(issues[0]).toMatchObject({ forceSelId: r.forces[0].id, selId: bladeSel.id, fix: { kind: 'remove', selIds: [bladeSel.id] } });
  });

  test('over-limit stacks shrink instead of being removed; cost limits get no remove fix', () => {
    const { roster, ids } = withUnits(scope, empty(), M.L_LORD, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS);
    const stacked = setCount(scope, roster, ids[3], 2); // 4 Troops: the newest is a stack of 2
    const issues = validate(scope, stacked);
    expect(summary(issues)).toEqual([['slot-max', 'Troops', 3, 4]]);
    expect(issues[0].fix).toEqual({ kind: 'set-count', selId: ids[3], count: 1 });

    const files = structuredClone(M.miniFiles);
    const troops = files[2].forces.find((f) => f.id === M.FORCE_PATROL)!.cats.find((c) => c.targetId === M.CAT_TROOPS)!;
    troops.constraints!.push({ id: 'con-troops-pts', type: 'max', field: COST_PTS, scope: 'force', value: 100, childSel: true });
    const s = buildScope(files);
    const pts = validate(s, withUnits(s, empty(s), M.L_LORD, M.L_WARRIORS).roster);
    expect(summary(pts)).toEqual([['slot-max', 'Troops', 100, 110]]);
    expect(pts[0].fix).toBeUndefined();
  });

  test('unknown items are unknown-entry', () => {
    const { roster } = withUnits(scope, empty(), M.L_LORD, M.L_WARRIORS);
    const stale = { id: 'stale-sel', entryId: 'gone', count: 1, children: [] };
    const r = { ...roster, forces: [{ ...roster.forces[0], selections: [...roster.forces[0].selections, stale] }] };
    const issues = validate(scope, r);
    expect(summary(issues)).toEqual([['unknown-entry', 'Unknown item', 0, 1]]);
    expect(issues[0]).toMatchObject({ selId: 'stale-sel', subject: { id: 'gone' }, fix: { kind: 'remove', selIds: ['stale-sel'] } });
  });

  test('-1 limits are ignored', () => {
    const files = rulesFiles();
    const patrol = files[2].forces.find((f) => f.id === M.FORCE_PATROL)!;
    const troops = patrol.cats.find((c) => c.targetId === M.CAT_TROOPS)!;
    troops.constraints = troops.constraints!.map((c) => (c.type === 'max' ? { ...c, value: -1 } : c));
    // A modifier can also lift a limit: HQ max 2 becomes -1.
    patrol.cats.find((c) => c.targetId === M.CAT_HQ)!.mods = [{ type: 'set', field: 'con-patrol-hq-max', value: '-1.0' }];
    files[0].rootEntries.find((n) => n.id === M.L_LORD)!.constraints![0].value = -1;
    const s = buildScope(files);
    const { roster, ids } = withUnits(s, empty(s), M.L_LORD, M.L_LORD, M.L_LORD, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS);
    expect(validate(s, addChild(s, roster, ids[0], M.E_WARLORD_UPG))).toEqual([]);
  });

  test('self-scope limits are checked per selection, counting the selection itself', () => {
    const files = structuredClone(M.miniFiles);
    const weapons = files[0].shared.find((n) => n.id === M.E_SQUAD_MODEL)!.children![0].children!;
    for (const w of weapons) w.constraints = [{ id: `con-${w.id}-self`, type: 'min', field: 'selections', scope: 'self', value: 1 }];
    weapons[1].constraints!.push({ id: 'con-plasma-self-max', type: 'max', field: 'selections', scope: 'self', value: 0 });
    const s = buildScope(files);
    const { roster } = withUnits(s, empty(s), M.L_LORD, M.L_WARRIORS, M.L_SQUAD);
    // The selected Bolter meets its min 1; the unselected Plasma's min isn't checked.
    expect(validate(s, roster)).toEqual([]);
    const stack = roster.forces[0].selections[2].children[0];
    const plasma = chooseInGroup(s, roster, stack.id, M.G_SQUAD_WEAPON, M.E_PLASMA);
    expect(summary(validate(s, plasma))).toEqual([['wargear-max', 'Plasma', 0, 1]]);
  });

  test('issues are ordered by force, then selection, then constraint', () => {
    let r = empty();
    r = addForce(scope, r, M.FORCE_PATROL, M.CAT_ID);
    const issues = validate(scope, r);
    expect(issues.map((i) => [i.forceSelId, i.subject.name])).toEqual([
      [r.forces[0].id, 'HQ'],
      [r.forces[0].id, 'Troops'],
      [r.forces[1].id, 'HQ'],
      [r.forces[1].id, 'Troops'],
    ]);
  });
});

// ---------- real BSData v9.8.0 ----------

const real = realScope('necrons');
const necrons = realCatalogueId('necrons');
const forceNamed = (name: string) => real.system.forces.find((f) => f.name === name)!.id;
const rootNamed = (name: string) => {
  const hit = rootEntriesFor(real, necrons).find((n) => n.name === name);
  if (!hit) throw new Error(`no root entry ${name}`);
  return hit.id;
};
/** The option (or group) with this name under a selection, searching nested groups. Names compare trimmed. */
function optionNamed(r: Roster, selId: string, name: string): OptionNode {
  const walk = (os: OptionNode[]): OptionNode | undefined => {
    for (const o of os) {
      if (o.name.trim() === name.trim()) return o;
      const hit = walk(o.children);
      if (hit) return hit;
    }
  };
  const hit = walk(childOptions(real, r, selId));
  if (!hit) throw new Error(`no option ${name}`);
  return hit;
}

describe('validateConstraints (real BSData v9.8.0)', () => {
  test('an empty Necrons Arks of Omen roster needs an HQ', () => {
    const r = addForce(real, { schema: 1, name: 'Necrons', catalogueId: necrons, battleSize: 'strike-force', forces: [] }, forceNamed('Arks of Omen Detachment'), necrons);
    const issues = validate(real, r);
    expect(issues).toContainEqual(expect.objectContaining({ rule: 'slot-min', subject: expect.objectContaining({ name: 'HQ' }), limit: 1, actual: 0 }));
  });

  test('a legal Necrons Patrol has no issues', () => {
    let r: Roster = addForce(real, { schema: 1, name: 'Necrons', catalogueId: necrons, battleSize: 'combat-patrol', forces: [] }, forceNamed('Patrol Detachment -2CP'), necrons);
    const fs = r.forces[0].id;
    const add = (name: string) => {
      const added = addUnit(real, r, fs, rootNamed(name));
      expect(added.selId).not.toBe('');
      r = added.roster;
      return added.selId;
    };
    const choose = (selId: string, group: string, option: string) => {
      r = chooseInGroup(real, r, selId, optionNamed(r, selId, group).id, optionNamed(r, selId, option).id);
    };

    const gameType = add('Game Type');
    choose(gameType, 'Matched', '1. Eternal War');
    const battleSize = add('Battle Size');
    choose(battleSize, 'Battle Size', '1. Combat Patrol (0-50 Total PL / 0-500 Points) ');
    add('Detachment Command Cost'); // BattleScribe requires one per detachment (min 1 per force)
    const dynasty = add('Dynasty Choice');
    expect(validate(real, r).filter((i) => i.rule === 'option-required').map((i) => i.subject.name)).toEqual(['-Dynastic Code-']);
    choose(dynasty, '-Dynastic Code-', 'Dynasty: Sautekh');
    const overlord = add('Overlord');
    r = addChild(real, r, overlord, optionNamed(r, overlord, 'Warlord').id);
    add('Necron Warriors');

    expect(validate(real, r)).toEqual([]);
  });
});
