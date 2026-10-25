import { test, expect, describe } from 'vitest';
import {
  addChild,
  addForce,
  addUnit,
  availableUnits,
  buildScope,
  evaluate,
  explain,
  rootEntriesFor,
  setCount,
  validateConstraints,
  COST_CP,
  COST_PTS,
  type Issue,
  type Roster,
  type RosterFile,
  type Scope,
} from '../src/roster';
import { FORCE, createRoster, validate, validatePolicy } from '../src/roster/policy';
import * as M from './fixtures/roster/mini';
import blackTemplarsCorpus from './corpus/imperium/imperium-adeptus-astartes-black-templars';
import ravenGuardCorpus from './corpus/imperium/imperium-adeptus-astartes-raven-guard';
import whiteScarsCorpus from './corpus/imperium/imperium-adeptus-astartes-white-scars';
import { buildFromSpec, type CatalogueCorpus } from './corpus/spec';
import { realCatalogueId, realCatalogues, realFiles, realPolicy, realScope } from './helpers/realScope';

const policy = realPolicy();

// ---------- helpers ----------

/** Every issue of the roster as [rule, text, fixLabel]. */
function explained(scope: Scope, r: Roster, issues?: Issue[]): { issue: Issue; text: string; fixLabel?: string }[] {
  const view = evaluate(scope, r);
  return (issues ?? validateConstraints(scope, view)).map((issue) => ({ issue, ...explain(issue, view, scope) }));
}
const of = (rows: ReturnType<typeof explained>, rule: Issue['rule']) => rows.filter((x) => x.issue.rule === rule);
const texts = (rows: ReturnType<typeof explained>) => rows.map((x) => x.text);

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

const atLeast1 = (scopeKey: string, childId: string) => ({ type: 'atLeast' as const, field: 'selections', scope: scopeKey, childId, value: 1, childSel: true as const });
/** Mini files with the Warlord category min/max 1 per roster, the Lord unique per force and Imps hidden by a Warlord. */
function rulesFiles(): RosterFile[] {
  const files = structuredClone(M.miniFiles);
  const [catalogue, , system] = files;
  system.categories.find((c) => c.id === M.CAT_WARLORD)!.constraints = [
    { id: 'con-warlord-cat-max', type: 'max', field: 'selections', scope: 'roster', value: 1, childSel: true, childForces: true },
    { id: 'con-warlord-cat-min', type: 'min', field: 'selections', scope: 'roster', value: 1, childSel: true, childForces: true },
  ];
  catalogue.rootEntries.find((n) => n.id === M.L_LORD)!.constraints = [{ id: 'con-lord-unique', type: 'max', field: 'selections', scope: 'force', value: 1 }];
  catalogue.shared.find((n) => n.id === M.E_IMP)!.mods = [{ type: 'set', field: 'hidden', value: 'true', when: { type: 'and', conds: [atLeast1('roster', M.CAT_WARLORD)], groups: [] } }];
  return files;
}

const mini = buildScope(M.miniFiles);
const rules = buildScope(rulesFiles());
const emptyRoster = (s: Scope, forceId = M.FORCE_PATROL): Roster =>
  addForce(s, { schema: 1, name: 'Test', catalogueId: M.CAT_ID, battleSize: 'strike-force', forces: [] }, forceId, M.CAT_ID);

// ---------- mini fixture ----------

describe('explain (mini fixture)', () => {
  test('slot-min names the cheapest candidates', () => {
    const rows = explained(mini, emptyRoster(mini));
    expect(texts(rows)).toEqual([
      'Your Patrol Detachment needs 1 more HQ unit. Add Lord.',
      'Your Patrol Detachment needs 1 more Troops unit. Add Horde or Warriors.',
    ]);
    // One candidate adds it by name; several open a picker.
    expect(rows.map((x) => x.fixLabel)).toEqual(['Add Lord', 'Add a Troops unit']);
  });

  test('slot-min counts how many more units are needed', () => {
    const r = emptyRoster(mini, M.FORCE_BATTALION);
    const rows = explained(mini, r);
    expect(texts(rows)).toEqual([
      'Your Battalion Detachment needs 2 more HQ units. Add Lord.',
      'Your Battalion Detachment needs 3 more Troops units. Add Horde or Warriors.',
    ]);
  });

  test('slot-min with nothing to add says so and has no button', () => {
    const files = structuredClone(M.miniFiles);
    files[0].rootEntries = files[0].rootEntries.filter((n) => n.id !== M.L_LORD);
    const s = buildScope(files);
    const [hq] = explained(s, emptyRoster(s));
    expect(hq.text).toBe('Your Patrol Detachment needs 1 more HQ unit, but Mini Faction has nothing it can take there. Pick a different detachment.');
    expect(hq.fixLabel).toBeUndefined();
  });

  test('slot-max', () => {
    const { roster, ids } = withUnits(mini, emptyRoster(mini), M.L_LORD, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS);
    const [row] = explained(mini, roster);
    expect(row.issue.fix).toEqual({ kind: 'remove', selIds: [ids[4]] });
    expect(row.text).toBe('Your Patrol Detachment has 4 Troops units but can only take 3. Remove 1, or move it to another detachment.');
    expect(row.fixLabel).toBe('Remove Warriors');
  });

  test('slot-max says "them" for several and shrinks a stack with Set to', () => {
    const { roster } = withUnits(mini, emptyRoster(mini), M.L_LORD, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS);
    const [many] = explained(mini, roster);
    expect(many.text).toBe('Your Patrol Detachment has 5 Troops units but can only take 3. Remove 2, or move them to another detachment.');
    expect(many.fixLabel).toBe('Remove 2 Warriors');
    const four = withUnits(mini, emptyRoster(mini), M.L_LORD, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS);
    const [shrink] = explained(mini, setCount(mini, four.roster, four.ids[3], 2));
    expect(shrink.issue.fix).toEqual({ kind: 'set-count', selId: four.ids[3], count: 1 });
    expect(shrink.fixLabel).toBe('Set to 1');
  });

  test('"Add a/an {category} unit" picks the article by sound', () => {
    const roster = withUnits(mini, emptyRoster(mini), M.L_LORD).roster;
    const view = evaluate(mini, roster);
    const label = (category: string) =>
      explain({ rule: 'slot-min', subject: { id: 'c', name: category }, limit: 1, actual: 0, fix: { kind: 'add-unit', forceSelId: roster.forces[0].id, entryIds: [M.L_WARRIORS, M.L_LORD] } }, view, mini).fixLabel;
    expect(label('Elites')).toBe('Add an Elites unit');
    expect(label('HQ')).toBe('Add an HQ unit');
    expect(label('Troops')).toBe('Add a Troops unit');
    expect(label('Heavy Support')).toBe('Add a Heavy Support unit');
    expect(label('Fast Attack')).toBe('Add a Fast Attack unit');
    expect(label('')).toBe('Add a unit');
  });

  test('counts of one use the singular noun', () => {
    const { roster, ids } = withUnits(mini, emptyRoster(mini), M.L_LORD, M.L_WARRIORS);
    const view = evaluate(mini, roster);
    const stack = roster.forces[0].selections[1].children[0];
    const setTo = (count: number) => explain({ rule: 'model-count', selId: stack.id, subject: { id: stack.entryId, name: 'Warriors' }, limit: 1, actual: 0, fix: { kind: 'set-count', selId: stack.id, count } }, view, mini).fixLabel;
    expect(setTo(1)).toBe('Set to 1 model');
    expect(setTo(2)).toBe('Set to 2 models');
    const unit = explain({ rule: 'rule-of-three', subject: { id: 'x', name: 'Lord' }, limit: 0, actual: 1 }, view, mini).text;
    expect(unit).toContain('You have 1 Lord unit.');
    expect(ids).toHaveLength(2);
  });

  test('warlord-missing and warlord-extra', () => {
    const { roster } = withUnits(rules, emptyRoster(rules), M.L_LORD, M.L_WARRIORS);
    const [missing] = explained(rules, roster);
    expect(missing.issue.rule).toBe('warlord-missing');
    expect(missing.text).toBe('Choose a Warlord. Open a Character such as Lord and turn on "Warlord".');
    expect(missing.fixLabel).toBe('Open Lord');

    const b = withUnits(rules, emptyRoster(rules, M.FORCE_BATTALION), M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS);
    const lord1 = addUnit(rules, b.roster, b.roster.forces[0].id, M.L_LORD);
    let r = addChild(rules, lord1.roster, lord1.selId, M.E_WARLORD_UPG);
    r = addForce(rules, r, M.FORCE_PATROL, M.CAT_ID);
    const lord2 = addUnit(rules, r, r.forces[1].id, M.L_LORD);
    r = addChild(rules, lord2.roster, lord2.selId, M.E_WARLORD_UPG);
    r = addUnit(rules, r, r.forces[1].id, M.L_WARRIORS).roster;
    const [extra] = of(explained(rules, r), 'warlord-extra');
    expect(extra.text).toBe('You have 2 Warlords, but an army has exactly 1. Turn "Warlord" off on 1 of them.');
    expect(extra.fixLabel).toBe('Open Lord');
  });

  test('unique (one per army)', () => {
    const files = rulesFiles();
    files[0].rootEntries.find((n) => n.id === M.L_LORD)!.constraints = [{ id: 'con-lord-unique', type: 'max', field: 'selections', scope: 'roster', value: 1 }];
    const s = buildScope(files);
    const { roster, ids } = withUnits(s, emptyRoster(s), M.L_LORD, M.L_WARRIORS, M.L_LORD);
    const r = addChild(s, roster, ids[0], M.E_WARLORD_UPG);
    const [row] = explained(s, r);
    expect(row.issue).toMatchObject({ rule: 'unique', scope: 'roster' });
    expect(row.text).toBe('Lord is a unique unit, so your army can include only 1. Remove 1.');
    expect(row.fixLabel).toBe('Remove Lord');
  });

  test('unique (one per detachment) says so and names the detachment', () => {
    const { roster, ids } = withUnits(rules, emptyRoster(rules), M.L_LORD, M.L_WARRIORS, M.L_LORD);
    const r = addChild(rules, roster, ids[0], M.E_WARLORD_UPG);
    const [row] = explained(rules, r);
    expect(row.issue).toMatchObject({ rule: 'unique', scope: 'force' });
    expect(row.text).toBe('Lord is limited to 1 per detachment. Remove 1 from your Patrol Detachment.');
    expect(row.fixLabel).toBe('Remove Lord');
  });

  test('unit-limit (a most-N limit)', () => {
    const files = structuredClone(M.miniFiles);
    files[0].rootEntries.find((n) => n.id === M.L_WARRIORS)!.constraints = [{ id: 'con-warriors-roster-max', type: 'max', field: 'selections', scope: 'roster', value: 2 }];
    const s = buildScope(files);
    const { roster } = withUnits(s, emptyRoster(s), M.L_LORD, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS);
    const [row] = of(explained(s, roster), 'unit-limit');
    expect(row.text).toBe('Your army can include at most 2 Warriors. Remove 1.');
    expect(row.fixLabel).toBe('Remove Warriors');
  });

  test('unit-limit per detachment: at most, and at least', () => {
    const files = structuredClone(M.miniFiles);
    files[0].rootEntries.find((n) => n.id === M.L_WARRIORS)!.constraints = [{ id: 'con-warriors-force-max', type: 'max', field: 'selections', scope: 'force', value: 2 }];
    const s = buildScope(files);
    const { roster } = withUnits(s, emptyRoster(s), M.L_LORD, M.L_WARRIORS, M.L_WARRIORS, M.L_WARRIORS);
    const [row] = of(explained(s, roster), 'unit-limit');
    expect(row.issue.scope).toBe('force');
    expect(row.text).toBe('Your Patrol Detachment can include at most 2 Warriors. Remove 1.');
    expect(row.fixLabel).toBe('Remove Warriors');

    const r1 = withUnits(mini, emptyRoster(mini), M.L_LORD, M.L_WARRIORS).roster;
    const view = evaluate(mini, r1);
    const forceSelId = r1.forces[0].id;
    const issue: Issue = {
      rule: 'unit-limit', scope: 'force', subject: { id: M.L_WARRIORS, name: 'Warriors' }, limit: 2, actual: 1, forceSelId,
      fix: { kind: 'add-unit', forceSelId, entryIds: [M.L_WARRIORS] },
    };
    expect(explain(issue, view, mini).text).toBe('Your Patrol Detachment needs at least 2 Warriors. Add 1 more.');
    // Without an add fix there is no "Add" sentence.
    expect(explain({ ...issue, fix: undefined }, view, mini).text).toBe('Your Patrol Detachment needs at least 2 Warriors.');
    // The roster-wide wording is unchanged, with or without a scope.
    for (const scope of ['roster', undefined]) expect(explain({ ...issue, scope }, view, mini).text).toBe('Your army needs at least 2 Warriors. Add 1 more.');
  });

  test('unit-limit as a minimum asks for more, never "at most"', () => {
    const roster = withUnits(mini, emptyRoster(mini), M.L_LORD, M.L_WARRIORS).roster;
    const view = evaluate(mini, roster);
    const issue: Issue = {
      rule: 'unit-limit', subject: { id: M.L_WARRIORS, name: 'Warriors' }, limit: 2, actual: 1,
      fix: { kind: 'add-unit', forceSelId: roster.forces[0].id, entryIds: [M.L_WARRIORS] },
    };
    const row = explain(issue, view, mini);
    expect(row.text).toBe('Your army needs at least 2 Warriors. Add 1 more.');
    expect(row.fixLabel).toBe('Add Warriors');
  });

  test('model-count: min and max, only a min, only a max', () => {
    const { roster } = withUnits(mini, emptyRoster(mini), M.L_LORD, M.L_WARRIORS);
    const stack = roster.forces[0].selections[1].children[0];
    const [low] = explained(mini, setCount(mini, roster, stack.id, 9));
    expect(low.text).toBe('Warriors must have between 10 and 20 models. It has 9.');
    expect(low.fixLabel).toBe('Set to 10 models');
    const over = explained(mini, setCount(mini, roster, stack.id, 21));
    expect(texts(over)).toEqual(['Warriors must have between 10 and 20 models. It has 21.', 'Warriors must have at most 20 models. It has 21.']);
    expect(over.map((x) => x.fixLabel)).toEqual(['Set to 20 models', 'Set to 20 models']);

    const files = structuredClone(M.miniFiles);
    const link = files[0].shared.find((n) => n.id === M.E_SQUAD)!.children![0];
    link.constraints = link.constraints!.filter((c) => c.type === 'min');
    const s = buildScope(files);
    const squad = withUnits(s, emptyRoster(s), M.L_LORD, M.L_WARRIORS, M.L_SQUAD);
    const model = squad.roster.forces[0].selections[2].children[0];
    const [atLeast] = explained(s, setCount(s, squad.roster, model.id, 4));
    expect(atLeast.text).toBe('Squad must have at least 5 models. It has 4.');
  });

  test('wargear-max and option-required', () => {
    const { roster } = withUnits(mini, emptyRoster(mini), M.L_LORD, M.L_WARRIORS, M.L_SQUAD);
    const stack = roster.forces[0].selections[2].children[0];
    const [two] = explained(mini, addChild(mini, roster, stack.id, M.E_PLASMA));
    expect(two.issue.rule).toBe('wargear-max');
    expect(two.text).toBe('Squad can take at most 1 Weapon. It has 2.');
    expect(two.fixLabel).toBe('Open Squad');
    const [none] = explained(mini, setCount(mini, roster, stack.children[0].id, 0));
    expect(none.issue.rule).toBe('option-required');
    expect(none.text).toBe('Squad needs 1 more from "Weapon".');
    expect(none.fixLabel).toBe('Open Squad');
  });

  test('hidden-selected and unknown-entry', () => {
    const { roster, ids } = withUnits(rules, emptyRoster(rules), M.L_IMP, M.L_WARRIORS, M.L_LORD);
    const [hidden] = explained(rules, addChild(rules, roster, ids[2], M.E_WARLORD_UPG));
    expect(hidden.text).toBe("Imps can't be in this army any more because of an earlier choice. Remove it, or change that choice.");
    expect(hidden.fixLabel).toBe('Remove Imps');

    const stale = { id: 'stale-sel', entryId: 'gone', count: 1, children: [] };
    const base = withUnits(mini, emptyRoster(mini), M.L_LORD, M.L_WARRIORS).roster;
    const r = { ...base, forces: [{ ...base.forces[0], selections: [...base.forces[0].selections, stale] }] };
    const [unknown] = explained(mini, r);
    expect(unknown.text).toBe("One item in this list isn't in the current rules data, so it was skipped. Remove it.");
    expect(unknown.fixLabel).toBe('Remove it');
  });

  test('other, in the right direction, and no fix means no fixLabel', () => {
    const view = evaluate(mini, emptyRoster(mini));
    const issue = (limit: number, actual: number): Issue => ({ rule: 'other', subject: { id: 'x', name: 'Battalion Detachment -3CP' }, limit, actual });
    expect(explain(issue(2, 3), view, mini)).toEqual({ text: 'Battalion Detachment can have at most 2 here. It has 3.' });
    expect(explain(issue(2, 1), view, mini)).toEqual({ text: 'Battalion Detachment needs at least 2 here. It has 1.' });
  });

  test('numbers use en-GB grouping', () => {
    const view = evaluate(mini, emptyRoster(mini));
    const issue: Issue = { rule: 'points-over', subject: { id: 'onslaught', name: 'Onslaught' }, limit: 3000, actual: 3123 };
    expect(explain(issue, view, mini).text).toBe('Your army is 123 pts over the 3,000 pts limit for Onslaught. Remove units or wargear worth at least 123 pts.');
  });
});

// ---------- real BSData v9.8.0 ----------

const necronsScope = realScope('necrons');
const necrons = realCatalogueId('necrons');
const necronRoster = (battleSize: Roster['battleSize'], forceId: string = FORCE.arksOfOmen) =>
  createRoster(necronsScope, { name: 'Necrons', catalogueId: necrons, battleSize, forceId });

function addNamed(scope: Scope, r: Roster, forceSelId: string, catalogueId: string, name: string, times = 1): { roster: Roster; ids: string[] } {
  const entry = rootEntriesFor(scope, catalogueId).find((n) => n.name === name);
  if (!entry) throw new Error(`no root entry ${name}`);
  const ids: string[] = [];
  let roster = r;
  for (let i = 0; i < times; i++) {
    const added = addUnit(scope, roster, forceSelId, entry.id);
    expect(added.selId).not.toBe('');
    roster = added.roster;
    ids.push(added.selId);
  }
  return { roster, ids };
}
const explainPolicy = (scope: Scope, r: Roster) => {
  const { view, issues } = validate(scope, r, policy);
  return issues.map((issue) => ({ issue, ...explain(issue, view, scope) }));
};

describe('explain (real Necrons)', () => {
  test("the spec's own example: a Battalion with 2 Troops needs 1 more", () => {
    const r0 = necronRoster('onslaught', FORCE.battalion);
    const { roster } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Necron Warriors', 2);
    const troops = of(explainPolicy(necronsScope, roster), 'slot-min').find((x) => x.issue.subject.name === 'Troops')!;
    expect(troops.text).toBe('Your Battalion Detachment needs 1 more Troops unit. Add Immortals or Necron Warriors.');
    expect(troops.fixLabel).toBe('Add a Troops unit');
  });

  test('suggested units list current datasheets before Legends ones, cheapest first within each (Craftworlds Troops)', () => {
    const scope = realScope('aeldari-craftworlds');
    const cw = realCatalogueId('aeldari-craftworlds');
    const r = createRoster(scope, { name: 'CW', catalogueId: cw, battleSize: 'onslaught', forceId: FORCE.battalion });
    const troops = of(explainPolicy(scope, r), 'slot-min').find((x) => x.issue.subject.name === 'Troops')!;
    const units = availableUnits(scope, r, r.forces[0].id);
    const suggested = (troops.issue.fix as { entryIds: string[] }).entryIds.map((id) => units.find((u) => u.entryId === id)!);
    expect(suggested).toHaveLength(3);
    expect(suggested.some((u) => u.legends)).toBe(false);
    expect(suggested.map((u) => u.points)).toEqual([...suggested.map((u) => u.points)].sort((a, b) => a - b));
    const cheapestCurrent = units.filter((u) => u.role === 'Troops' && !u.legends).sort((a, b) => a.points - b.points)[0];
    expect(suggested[0].points).toBe(cheapestCurrent.points);
    // Before: "Add Corsair Reaver Band, Corsair Skyreaver Band or Corsair Voidreavers" (two Legends units at 0 pts).
    expect(troops.text).toBe('Your Battalion Detachment needs 3 more Troops units. Add Corsair Voidreavers, Rangers or Storm Guardians.');
  });

  test('when there are not enough current datasheets, Legends ones follow', () => {
    const r = necronRoster('onslaught', FORCE.auxiliarySupport);
    const issue = validate(necronsScope, r, policy).issues.find((i) => i.rule === 'slot-min' && i.forceSelId === r.forces[0].id && i.fix?.kind === 'add-unit' && i.subject.name === '')!;
    const units = availableUnits(necronsScope, r, r.forces[0].id);
    const legends = (issue.fix as { entryIds: string[] }).entryIds.map((id) => units.find((u) => u.entryId === id)!.legends);
    expect(legends).toEqual([...legends].sort((a, b) => Number(a) - Number(b)));
  });

  test('a missing Battle Size choice asks for it rather than "at most"', () => {
    const r = necronRoster('strike-force');
    const battleSize = r.forces[0].selections.find((s) => evaluate(necronsScope, r).forces[0].selections.find((v) => v.sel.id === s.id)?.name.trim() === 'Battle Size')!;
    const without: Roster = { ...r, forces: [{ ...r.forces[0], selections: r.forces[0].selections.filter((s) => s.id !== battleSize.id) }] };
    const rows = explainPolicy(necronsScope, without).filter((x) => x.issue.fix?.kind === 'add-unit' && x.issue.subject.name.trim() === 'Battle Size');
    expect(rows.map((x) => [x.text, x.fixLabel])).toEqual([['Your army needs a "Battle Size" choice. Tap to add it.', 'Choose Battle Size']]);
  });

  test('an option group wrapped in dashes in the data reads without them ("-Dynastic Code-")', () => {
    const r = necronRoster('strike-force');
    const [row] = of(explainPolicy(necronsScope, r), 'option-required');
    expect(row.text).toBe('Dynasty Choice needs 1 more from "Dynastic Code".');
  });

  test('warlord-missing on real data', () => {
    const r0 = necronRoster('strike-force');
    const { roster } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Overlord');
    const [row] = of(explainPolicy(necronsScope, roster), 'warlord-missing');
    expect(row.text).toBe('Choose a Warlord. Open a Character such as Overlord and turn on "Warlord".');
    expect(row.fixLabel).toBe('Open Overlord');
  });

  test("warlord-missing shown in that Character's own editor says to turn it on below", () => {
    const r0 = necronRoster('strike-force');
    const { roster, ids } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Overlord');
    const { view, issues } = validate(necronsScope, roster, policy);
    const issue = issues.find((i) => i.rule === 'warlord-missing')!;
    expect(explain(issue, view, necronsScope, { shownUnitId: ids[0] }).text).toBe('Choose a Warlord. Turn on "Warlord" below.');
    // In another unit's editor (or none) the hint still names the Character to open.
    expect(explain(issue, view, necronsScope, { shownUnitId: 'another-unit' }).text).toBe('Choose a Warlord. Open a Character such as Overlord and turn on "Warlord".');
  });

  test('points-over and cp-negative', () => {
    const view = evaluate(necronsScope, necronRoster('strike-force'));
    const over = validatePolicy(necronsScope, { ...view, total: { ...view.total, [COST_PTS]: 2150 } }, policy).find((i) => i.rule === 'points-over')!;
    expect(explain(over, view, necronsScope)).toEqual({ text: 'Your army is 150 pts over the 2,000 pts limit for Strike Force. Remove units or wargear worth at least 150 pts.' });
    const negative = validatePolicy(necronsScope, { ...view, total: { ...view.total, [COST_CP]: -2 } }, policy).find((i) => i.rule === 'cp-negative')!;
    expect(explain(negative, view, necronsScope)).toEqual({ text: "You've spent 2 CP more than you have. Remove a detachment or an upgrade that costs CP." });
  });

  test('rule-of-three', () => {
    const r0 = necronRoster('strike-force');
    const { roster } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Canoptek Wraiths', 4);
    const [row] = of(explainPolicy(necronsScope, roster), 'rule-of-three');
    expect(row.text).toBe("You have 4 Canoptek Wraiths units. Strike Force allows 3 of the same datasheet (Troops and Dedicated Transports don't count). Remove 1.");
    expect(row.fixLabel).toBe('Remove Canoptek Wraiths');
  });

  test('rule-of-three: the remove fix names the unit it takes out', () => {
    const r0 = necronRoster('strike-force');
    const { roster } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Doomsday Ark', 4);
    const [row] = of(explainPolicy(necronsScope, roster), 'rule-of-three');
    expect(row.fixLabel).toBe('Remove Doomsday Ark');
  });

  test('detachment-count: core, one per army and Arks of Omen', () => {
    const cp = addForce(necronsScope, necronRoster('combat-patrol', FORCE.patrol), FORCE.patrol, necrons);
    expect(texts(of(explainPolicy(necronsScope, cp), 'detachment-count'))).toEqual(['Combat Patrol allows 1 detachment. Remove 1.']);

    let on = necronRoster('onslaught', FORCE.patrol);
    for (let i = 0; i < 4; i++) on = addForce(necronsScope, on, FORCE.battalion, necrons);
    expect(texts(of(explainPolicy(necronsScope, on), 'detachment-count'))).toEqual(['Onslaught allows 4 detachments. Remove 1.']);

    let sc = necronRoster('onslaught', FORCE.supremeCommand);
    sc = addForce(necronsScope, sc, FORCE.supremeCommand, necrons);
    expect(texts(of(explainPolicy(necronsScope, sc), 'detachment-count'))).toEqual(['An army can include only 1 Supreme Command Detachment. Remove 1.']);

    const aoo = addForce(necronsScope, necronRoster('strike-force'), FORCE.arksOfOmen, necrons);
    expect(texts(of(explainPolicy(necronsScope, aoo), 'detachment-count'))).toEqual([
      'An Arks of Omen army has exactly 1 Arks of Omen Detachment and at most 1 allied detachment. Remove the extra detachment.',
    ]);

    const none = necronRoster('strike-force', FORCE.patrol);
    expect(texts(of(explainPolicy(necronsScope, none), 'detachment-count'))).toEqual([
      'An Arks of Omen army has exactly 1 Arks of Omen Detachment and at most 1 allied detachment. Add an Arks of Omen Detachment.',
    ]);
  });

  test('detachment-not-allowed', () => {
    const r = addForce(necronsScope, necronRoster('onslaught', FORCE.patrol), FORCE.arksOfOmen, necrons);
    const [row] = of(explainPolicy(necronsScope, r), 'detachment-not-allowed');
    expect(row.text).toBe("Arks of Omen Detachment isn't allowed at Onslaught. Remove it and pick from the detachments offered.");
    expect(row.fixLabel).toBeUndefined();
  });

  test('detachment-not-allowed names an allied detachment’s faction (an add-on kept after a change to an Arks of Omen size)', () => {
    const scope = realScope('imperium-adeptus-astartes-ultramarines', 'imperium-legion-of-the-damned');
    const um = realCatalogueId('imperium-adeptus-astartes-ultramarines');
    const r = addForce(scope, createRoster(scope, { name: 'UM', catalogueId: um, battleSize: 'strike-force', forceId: FORCE.arksOfOmen }), FORCE.auxiliarySupport, realCatalogueId('imperium-legion-of-the-damned'));
    expect(texts(of(explainPolicy(scope, r), 'detachment-not-allowed'))).toEqual([
      "The Legion of the Damned Auxiliary Support Detachment isn't allowed at Strike Force. Remove it and pick from the detachments offered.",
    ]);
  });

  test('an Auxiliary Support Detachment reads without an empty category word', () => {
    let r = necronRoster('onslaught', FORCE.patrol);
    r = addForce(necronsScope, r, FORCE.auxiliarySupport, necrons);
    const aux = r.forces[1].id;
    const slot = (roster: Roster, rule: Issue['rule']) => of(explainPolicy(necronsScope, roster), rule).filter((x) => x.issue.forceSelId === aux);
    const [min] = slot(r, 'slot-min');
    expect(min.text).toMatch(/^Your Auxiliary Support Detachment needs 1 more unit\. Add [^,]+, [^,]+ or [^.]+\.$/);
    expect(min.text).not.toContain('  ');
    expect(min.fixLabel).toBe('Add a unit');
    const two = addNamed(necronsScope, addNamed(necronsScope, r, aux, necrons, 'Canoptek Wraiths').roster, aux, necrons, 'Necron Warriors');
    const [max] = slot(two.roster, 'slot-max');
    expect(max.text).toBe('Your Auxiliary Support Detachment has 2 units but can only take 1. Remove 1, or move it to another detachment.');
    expect(max.fixLabel).toBe('Remove Necron Warriors');
  });

  test('model-count on real data names the unit and the models', () => {
    const r0 = necronRoster('strike-force');
    const { roster, ids } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Necron Warriors');
    const stack = roster.forces[0].selections.find((s) => s.id === ids[0])!.children[0];
    const [row] = of(explainPolicy(necronsScope, setCount(necronsScope, roster, stack.id, 9)), 'model-count');
    expect(row.text).toBe('Necron Warriors must have between 10 and 20 models. It has 9.');
    expect(row.fixLabel).toBe('Set to 10 models');
  });
});

describe('factions', () => {
  test('detachment-faction names the unit that does not fit', () => {
    const scope = realScope('imperium-astra-militarum');
    const am = realCatalogueId('imperium-astra-militarum');
    let r = createRoster(scope, { name: 'AM', catalogueId: am, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
    r = addForce(scope, r, FORCE.patrol, am);
    const ally = r.forces[1].id;
    const scions = addNamed(scope, r, ally, am, 'Tempestus Scions');
    const tank = addNamed(scope, scions.roster, ally, am, 'Leman Russ Battle Tanks');
    const [row] = of(explainPolicy(scope, tank.roster), 'detachment-faction');
    expect(row.text).toBe('Every unit in your Patrol Detachment must share a faction, such as Astra Militarum. Move Leman Russ Battle Tanks to its own detachment or remove it.');
    expect(row.fixLabel).toBeUndefined();
  });

  test('detachment-faction without a single culprit asks to split the detachment', () => {
    const um = realCatalogueId('imperium-adeptus-astartes-ultramarines');
    const am = realCatalogueId('imperium-astra-militarum');
    const files = realFiles('imperium-adeptus-astartes-ultramarines', 'imperium-astra-militarum').map((f) =>
      f.id === um ? { ...f, links: [...f.links, { targetId: am, importRootEntries: true }] } : f,
    );
    const scope = buildScope(files);
    const r = createRoster(scope, { name: 'UM', catalogueId: um, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
    const marines = addNamed(scope, r, r.forces[0].id, um, 'Intercessor Squad');
    const mixed = addNamed(scope, marines.roster, r.forces[0].id, am, 'Infantry Squad');
    const [row] = of(explainPolicy(scope, mixed.roster), 'detachment-faction');
    expect(row.text).toBe(
      "Every unit in your Arks of Omen Detachment must share a faction, such as Ultramarines. Move the units that don't match to their own detachment or remove them.",
    );
  });

  test('army-faction names the unit from another faction', () => {
    const scope = realScope('necrons', 'orks');
    const orks = realCatalogueId('orks');
    let r = createRoster(scope, { name: 'Necrons', catalogueId: necrons, battleSize: 'onslaught', forceId: FORCE.patrol });
    r = addNamed(scope, r, r.forces[0].id, necrons, 'Overlord').roster;
    r = addForce(scope, r, FORCE.patrol, orks);
    r = addNamed(scope, r, r.forces[1].id, orks, 'Warboss').roster;
    const [row] = of(explainPolicy(scope, r), 'army-faction');
    expect(row.text).toBe("Every unit in your army must share a faction keyword. Warboss doesn't share one with the rest. Remove it.");
  });
});

describe('explain (per-detachment limits on real lists)', () => {
  const build = (corpus: CatalogueCorpus, title: string) => {
    const slug = realCatalogues().find((c) => c.name === corpus.catalogue)!.slug;
    const scope = realScope(slug);
    const spec = corpus.illegal.find((s) => s.title === title)!;
    const { view, issues } = validate(scope, buildFromSpec(scope, realCatalogueId(slug), spec), policy);
    return issues.map((issue) => ({ issue, ...explain(issue, view, scope) }));
  };

  test('a named vehicle limited per detachment (Damocles Command Rhino)', () => {
    const [row] = of(build(whiteScarsCorpus, 'two Damocles Command Rhinos in one detachment'), 'unique');
    expect(row.issue.scope).toBe('force');
    expect(row.text).toBe('Damocles Command Rhino is limited to 1 per detachment. Remove 1 from your Arks of Omen Detachment.');
  });

  test('Lieutenants are limited per detachment', () => {
    for (const corpus of [whiteScarsCorpus, ravenGuardCorpus]) {
      const [row] = of(build(corpus, 'three Lieutenants in one detachment'), 'unit-limit');
      expect(row.issue.scope).toBe('force');
      expect(row.text).toBe('Your Arks of Omen Detachment can include at most 2 Lieutenant. Remove 1.');
    }
  });

  test("a named character limited per army keeps the army wording (The Emperor's Champion)", () => {
    const [row] = of(build(blackTemplarsCorpus, "two Emperor's Champions"), 'unique');
    expect(row.issue.scope).toBe('roster');
    expect(row.text).toBe("The Emperor's Champion is a unique unit, so your army can include only 1. Remove 1.");
  });
});
