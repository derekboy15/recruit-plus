import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, describe } from 'vitest';
import { loadPolicy } from '../src/build';
import {
  addChild,
  addForce,
  addUnit,
  buildScope,
  childOptions,
  evaluate,
  resolve,
  rootEntriesFor,
  validateConstraints,
  COST_CP,
  COST_PTS,
  type Issue,
  type Roster,
  type Scope,
} from '../src/roster';
import {
  ARKS_OF_OMEN_PACK,
  BATTLE_SIZES,
  BATTLE_SIZE_ENTRY,
  BATTLE_SIZE_GROUP,
  ETERNAL_WAR,
  FORCE,
  GAME_TYPE_ENTRY,
  GAME_TYPE_GROUP,
  MATCHED_GROUP,
  createRoster,
  detachmentChoices,
  setBattleSize,
  validate,
  validatePolicy,
} from '../src/roster/policy';
import sororitas from './corpus/imperium/imperium-adepta-sororitas';
import { buildFromSpec, type ListSpec } from './corpus/spec';
import { realCatalogueId, realCatalogues, realFiles, realPolicy, realScope } from './helpers/realScope';

const policy = realPolicy();
const catalogues = realCatalogues();
const necronsScope = realScope('necrons');
const necrons = realCatalogueId('necrons');

const rootNamed = (scope: Scope, catalogueId: string, name: string): string => {
  const hit = rootEntriesFor(scope, catalogueId).find((n) => n.name === name);
  if (!hit) throw new Error(`no root entry ${name}`);
  return hit.id;
};
const ofRule = (issues: Issue[], rule: Issue['rule']) => issues.filter((i) => i.rule === rule);
/** The first root selection (any force) whose resolved target is targetId. */
const rootSel = (scope: Scope, r: Roster, targetId: string) =>
  evaluate(scope, r).forces.flatMap((f) => f.selections).find((v) => v.merged?.target.id === targetId);
const childEntryIds = (scope: Scope, r: Roster, targetId: string) => (rootSel(scope, r, targetId)?.sel.children ?? []).map((c) => c.entryId);

/** Adds the named root entry `times` times to a force; returns the roster and the new selection ids. */
function addNamed(scope: Scope, r: Roster, forceSelId: string, catalogueId: string, name: string, times = 1): { roster: Roster; ids: string[] } {
  const entryId = rootNamed(scope, catalogueId, name);
  const ids: string[] = [];
  let roster = r;
  for (let i = 0; i < times; i++) {
    const added = addUnit(scope, roster, forceSelId, entryId);
    expect(added.selId).not.toBe('');
    roster = added.roster;
    ids.push(added.selId);
  }
  return { roster, ids };
}

const necronRoster = (battleSize: Roster['battleSize'], forceId: string = FORCE.arksOfOmen) =>
  createRoster(necronsScope, { name: 'Necrons', catalogueId: necrons, battleSize, forceId });

describe('gst ids', () => {
  test('gst ids resolve to the expected names', () => {
    const s = necronsScope;
    const name = (id: string) => (s.node(id)?.name ?? s.force(id)?.name)?.trim();
    expect(name(GAME_TYPE_ENTRY)).toBe('Game Type');
    expect(name(GAME_TYPE_GROUP)).toBe('Game Type');
    expect(name(MATCHED_GROUP)).toBe('Matched');
    expect(s.parentGroups(MATCHED_GROUP)).toEqual([GAME_TYPE_GROUP]);
    expect(name(ETERNAL_WAR)).toBe('1. Eternal War');
    expect(name(ARKS_OF_OMEN_PACK)).toBe('5. Chapter Approved: Arks of Omen');
    expect(s.parentGroups(ETERNAL_WAR)).toEqual([MATCHED_GROUP, GAME_TYPE_GROUP]);
    expect(name(BATTLE_SIZE_ENTRY)).toBe('Battle Size');
    expect(name(BATTLE_SIZE_GROUP)).toBe('Battle Size');
    expect(name(BATTLE_SIZES['combat-patrol'].battleSizeEntryId)).toBe('1. Combat Patrol (0-50 Total PL / 0-500 Points)');
    expect(name(BATTLE_SIZES.incursion.battleSizeEntryId)).toBe('2. Incursion (51-100 Total PL / 501-1000 Points)');
    expect(name(BATTLE_SIZES['strike-force'].battleSizeEntryId)).toBe('3. Strike Force (101-200 Total PL / 1001-2000 Points)');
    expect(name(BATTLE_SIZES.onslaught.battleSizeEntryId)).toBe('4. Onslaught (201-300 Total PL / 2001-3000 Points)');
    for (const size of Object.values(BATTLE_SIZES)) {
      expect(size.gameTypeEntryId).toBe(MATCHED_GROUP);
      expect(size.missionPackEntryId).toBe(size.mode === 'aoo' ? ARKS_OF_OMEN_PACK : ETERNAL_WAR);
    }
    expect(Object.fromEntries(Object.entries(FORCE).map(([k, id]) => [k, name(id)]))).toEqual({
      patrol: 'Patrol Detachment -2CP',
      battalion: 'Battalion Detachment -3CP',
      brigade: 'Brigade Detachment -4CP',
      vanguard: 'Vanguard Detachment -3CP',
      spearhead: 'Spearhead Detachment -3CP',
      outrider: 'Outrider Detachment -3CP',
      supremeCommand: 'Supreme Command Detachment 0CP',
      superHeavy: 'Super-Heavy Detachment -3CP',
      superHeavyAuxiliary: 'Super-Heavy Auxiliary Detachment -3CP',
      fortificationNetwork: 'Fortification Network -1CP',
      auxiliarySupport: 'Auxiliary Support Detachment -2CP',
      arksOfOmen: 'Arks of Omen Detachment',
    });
  });

  test('battle sizes', () => {
    expect(Object.values(BATTLE_SIZES).map((b) => [b.id, b.points, b.mode, b.maxDetachments, b.sameDatasheetLimit])).toEqual([
      ['combat-patrol', 500, 'core', 1, 3],
      ['incursion', 1000, 'aoo', 2, 2],
      ['strike-force', 2000, 'aoo', 2, 3],
      ['onslaught', 3000, 'core', 4, 3],
    ]);
  });
});

describe('createRoster and setBattleSize', () => {
  test('createRoster(Strike Force) selects Matched, Arks of Omen and Strike Force', () => {
    const r = necronRoster('strike-force');
    expect(r).toMatchObject({ schema: 1, name: 'Necrons', catalogueId: necrons, battleSize: 'strike-force' });
    expect(r.forces).toHaveLength(1);
    expect(r.forces[0]).toMatchObject({ forceId: FORCE.arksOfOmen, catalogueId: necrons });
    expect(childEntryIds(necronsScope, r, GAME_TYPE_ENTRY)).toEqual([ARKS_OF_OMEN_PACK]);
    expect(childEntryIds(necronsScope, r, BATTLE_SIZE_ENTRY)).toEqual([BATTLE_SIZES['strike-force'].battleSizeEntryId]);
    // Strike Force under the Arks of Omen pack starts with 6 CP; the Arks of Omen Detachment costs 0.
    expect(evaluate(necronsScope, r).total).toMatchObject({ '2d3b-b544-ad49-fb75': 6 });
  });

  test('createRoster(Combat Patrol) selects Eternal War and Combat Patrol', () => {
    const r = necronRoster('combat-patrol', FORCE.patrol);
    expect(childEntryIds(necronsScope, r, GAME_TYPE_ENTRY)).toEqual([ETERNAL_WAR]);
    expect(childEntryIds(necronsScope, r, BATTLE_SIZE_ENTRY)).toEqual([BATTLE_SIZES['combat-patrol'].battleSizeEntryId]);
  });

  test('the new force gets its required root entries: once per force, or once per roster', () => {
    let r = necronRoster('strike-force');
    const names = (i: number) => evaluate(necronsScope, r).forces[i].selections.map((v) => v.name.trim()).sort();
    expect(names(0)).toEqual(['Arks of Omen Compulsory Type', 'Battle Size', 'Detachment Command Cost', 'Dynasty Choice', 'Game Type']);
    r = addForce(necronsScope, r, FORCE.patrol, necrons);
    // Game Type and Battle Size are once per roster; the rest once per detachment (Compulsory Type only in Arks of Omen).
    expect(names(1)).toEqual(['Detachment Command Cost', 'Dynasty Choice']);
  });

  test('setBattleSize swaps the mission pack and battle size, keeping everything else', () => {
    const r0 = necronRoster('strike-force');
    const { roster, ids } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Canoptek Wraiths');
    const cp = setBattleSize(necronsScope, roster, 'combat-patrol');
    expect(cp.battleSize).toBe('combat-patrol');
    expect(cp.forces.map((f) => f.id)).toEqual(roster.forces.map((f) => f.id));
    expect(childEntryIds(necronsScope, cp, GAME_TYPE_ENTRY)).toEqual([ETERNAL_WAR]);
    expect(childEntryIds(necronsScope, cp, BATTLE_SIZE_ENTRY)).toEqual([BATTLE_SIZES['combat-patrol'].battleSizeEntryId]);
    expect(cp.forces[0].selections.map((s) => s.id)).toContain(ids[0]);
    expect(cp.forces[0].selections).toHaveLength(roster.forces[0].selections.length);
  });
});

describe('points, CP and Rule of Two/Three', () => {
  test('2001 pts in Strike Force is points-over by 1', () => {
    const view = evaluate(necronsScope, necronRoster('strike-force'));
    const at = (pts: number) => validatePolicy(necronsScope, { ...view, total: { ...view.total, [COST_PTS]: pts } }, policy);
    expect(ofRule(at(2000), 'points-over')).toEqual([]);
    expect(ofRule(at(2001), 'points-over')).toEqual([{ rule: 'points-over', subject: { id: 'strike-force', name: 'Strike Force' }, limit: 2000, actual: 2001 }]);
  });

  test('negative CP is cp-negative', () => {
    const view = evaluate(necronsScope, necronRoster('strike-force'));
    expect(ofRule(validatePolicy(necronsScope, view, policy), 'cp-negative')).toEqual([]);
    const negative = { ...view, total: { ...view.total, '2d3b-b544-ad49-fb75': -1 } };
    expect(ofRule(validatePolicy(necronsScope, negative, policy), 'cp-negative')).toEqual([{ rule: 'cp-negative', subject: { id: '2d3b-b544-ad49-fb75', name: 'CP' }, limit: 0, actual: -1 }]);
  });

  describe('Arks of Omen detachments cost 0 CP (§2.3, §7.5)', () => {
    const scope = realScope('imperium-adepta-sororitas', 'imperium-imperial-knights');
    const sisters = realCatalogueId('imperium-adepta-sororitas');
    // Sororitas Arks of Omen Strike Force + Imperial Knights Freeblade Super-Heavy Auxiliary (BSData: -3 CP).
    const freeblade = sororitas.legal.find((s) => s.title.includes('Freeblade'))!;
    const withCanoness = (options: string[]): ListSpec => ({
      ...freeblade,
      detachments: freeblade.detachments.map((d, i) => (i === 0 ? { ...d, units: d.units.map((u) => (u.name === 'Canoness' ? { ...u, options } : u)) } : d)),
    });
    const cpOf = (r: Roster) => validate(scope, r, policy).view.total[COST_CP] ?? 0;

    test('an allied Super-Heavy Auxiliary costs nothing: 6 CP from the Battle Size', () => {
      const r = buildFromSpec(scope, sisters, freeblade);
      expect(evaluate(scope, r).total[COST_CP]).toBe(3); // BSData charges the ally 3 CP
      const { view, issues } = validate(scope, r, policy);
      expect(view.total[COST_CP]).toBe(6);
      expect(issues).toEqual([]);
      const ally = view.forces[1];
      expect(ally.total[COST_CP] ?? 0).toBe(0);
      expect(ally.selections.find((v) => v.name === 'Detachment Command Cost')!.total[COST_CP] ?? 0).toBe(0);
    });

    test('Requisition Stratagems still cost CP', () => {
      expect(cpOf(buildFromSpec(scope, sisters, withCanoness(['Stratagem: Relic'])))).toBe(5);
    });

    test('cp-negative counts the ally as 0 CP', () => {
      // Relic, Warlord Trait and two A Sacred Burden (twice at Strike Force, Wahapedia Stratagems): 4 CP of 6.
      const spec = withCanoness(['Stratagem: Relic']);
      const burden = { options: ['Sister Superior > Stratagem: A Sacred Burden'] };
      spec.detachments[0].units = spec.detachments[0].units.map((u, i) => (i === 1 || i === 2 ? { ...u, ...burden } : u));
      let r = buildFromSpec(scope, sisters, spec);
      const canoness = evaluate(scope, r).forces[0].selections.find((v) => v.name === 'Canoness')!;
      const trait = childOptions(scope, r, canoness.sel.id).find((o) => o.kind !== 'group' && o.name === 'Stratagem: Warlord Trait')!;
      r = addChild(scope, r, canoness.sel.id, trait.id);
      expect(evaluate(scope, r).total[COST_CP]).toBe(-1); // what BSData alone would say
      const { view, issues } = validate(scope, r, policy);
      expect(view.total[COST_CP]).toBe(2);
      expect(ofRule(issues, 'cp-negative')).toEqual([]);
    });

    test('Combat Patrol and Onslaught still pay detachment CP as BSData says', () => {
      const patrol = sororitas.legal.find((s) => s.battleSize === 'combat-patrol')!;
      const cp = buildFromSpec(scope, sisters, patrol);
      expect(cpOf(cp)).toBe(evaluate(scope, cp).total[COST_CP]);
      // Onslaught: 18 CP; the Warlord's Patrol is refunded, a second Patrol costs 2 (§2.1, §5).
      const onslaught: ListSpec = {
        ...patrol,
        battleSize: 'onslaught',
        detachments: [patrol.detachments[0], { detachment: 'Patrol Detachment -2CP', units: [{ name: 'Palatine' }, { name: 'Battle Sister Squad' }] }],
      };
      const r = buildFromSpec(scope, sisters, onslaught);
      expect(cpOf(r)).toBe(16);
      expect(validate(scope, r, policy).view.forces[1].selections.find((v) => v.name === 'Detachment Command Cost')!.total[COST_CP]).toBe(-2);
    });
  });

  test('Arks of Omen named Warlords may go without the Warlord Trait Requisition Stratagem (§5, §6)', () => {
    const scope = realScope('imperium-adeptus-astartes-ultramarines');
    const um = realCatalogueId('imperium-adeptus-astartes-ultramarines');
    const named = ['Uriel Ventris', 'Marneus Calgar', 'Captain Sicarius', 'Chief Librarian Tigurius', 'Chaplain Cassius', 'Sergeant Chronus', 'Sergeant Telion', 'Roboute Guilliman'];
    for (const name of named) {
      const spec: ListSpec = {
        title: name,
        battleSize: 'strike-force',
        detachments: [{ detachment: 'Arks of Omen Detachment', units: [{ name, warlord: true }, { name: 'Intercessor Squad' }, { name: 'Intercessor Squad' }, { name: 'Intercessor Squad' }] }],
        expect: { points: 0, powerLevel: 0 },
      };
      // Raw BSData issues: validate() would merge this one with another issue on the same unit (Cassius' Litanies).
      const issues = validateConstraints(scope, evaluate(scope, buildFromSpec(scope, um, spec)));
      expect(issues.filter((i) => /Warlord Trait/.test(i.subject.name)), name).toEqual([]);
    }
  });

  test('fourth Canoptek Wraiths unit at Strike Force is rule-of-three, third is fine', () => {
    const r0 = necronRoster('strike-force');
    const fs = r0.forces[0].id;
    const three = addNamed(necronsScope, r0, fs, necrons, 'Canoptek Wraiths', 3);
    expect(ofRule(validate(necronsScope, three.roster, policy).issues, 'rule-of-three')).toEqual([]);
    const four = addNamed(necronsScope, three.roster, fs, necrons, 'Canoptek Wraiths');
    const wraiths = resolve(necronsScope, necronsScope.node(rootNamed(necronsScope, necrons, 'Canoptek Wraiths'))!).target.id;
    expect(ofRule(validate(necronsScope, four.roster, policy).issues, 'rule-of-three')).toEqual([
      { rule: 'rule-of-three', forceSelId: fs, selId: four.ids[0], subject: { id: wraiths, name: 'Canoptek Wraiths' }, limit: 3, actual: 4, fix: { kind: 'remove', selIds: [four.ids[0]] } },
    ]);
  });

  test('a stack of copies counts each copy and shrinks to fix', () => {
    const r0 = necronRoster('strike-force');
    const { roster, ids } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Canoptek Wraiths');
    const stacked: Roster = { ...roster, forces: [{ ...roster.forces[0], selections: roster.forces[0].selections.map((s) => (s.id === ids[0] ? { ...s, count: 5 } : s)) }] };
    const [issue] = ofRule(validate(necronsScope, stacked, policy).issues, 'rule-of-three');
    expect(issue).toMatchObject({ limit: 3, actual: 5, fix: { kind: 'set-count', selId: ids[0], count: 3 } });
  });

  test('an older stack shrinks when that alone fixes the excess', () => {
    const r0 = necronRoster('strike-force');
    const { roster, ids } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Canoptek Wraiths', 2);
    // Counts [4, 1]: 5 copies, 2 too many; the newest stack alone can't absorb that, the older one can.
    const stacked: Roster = { ...roster, forces: [{ ...roster.forces[0], selections: roster.forces[0].selections.map((s) => (s.id === ids[0] ? { ...s, count: 4 } : s)) }] };
    const [issue] = ofRule(validate(necronsScope, stacked, policy).issues, 'rule-of-three');
    expect(issue).toMatchObject({ selId: ids[1], limit: 3, actual: 5, fix: { kind: 'set-count', selId: ids[0], count: 2 } });
  });

  test('Troops are exempt from rule-of-three', () => {
    const r0 = necronRoster('strike-force');
    const { roster } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Necron Warriors', 4);
    expect(ofRule(validate(necronsScope, roster, policy).issues, 'rule-of-three')).toEqual([]);
  });

  test('switching to Incursion flags the third copy', () => {
    const r0 = necronRoster('strike-force');
    const { roster, ids } = addNamed(necronsScope, r0, r0.forces[0].id, necrons, 'Canoptek Wraiths', 3);
    const incursion = setBattleSize(necronsScope, roster, 'incursion');
    expect(childEntryIds(necronsScope, incursion, GAME_TYPE_ENTRY)).toEqual([ARKS_OF_OMEN_PACK]);
    expect(childEntryIds(necronsScope, incursion, BATTLE_SIZE_ENTRY)).toEqual([BATTLE_SIZES.incursion.battleSizeEntryId]);
    expect(ofRule(validate(necronsScope, incursion, policy).issues, 'rule-of-three')).toEqual([
      expect.objectContaining({ selId: ids[2], limit: 2, actual: 3, fix: { kind: 'remove', selIds: [ids[2]] } }),
    ]);
  });

  test('two Daemon Prince datasheets count together', () => {
    // Chaos Space Marines with a Daemons Patrol ally (both catalogues in one scope).
    const scope = realScope('chaos-chaos-space-marines', 'chaos-daemons');
    const csm = realCatalogueId('chaos-chaos-space-marines');
    const daemons = realCatalogueId('chaos-daemons');
    let r = createRoster(scope, { name: 'CSM', catalogueId: csm, battleSize: 'incursion', forceId: FORCE.arksOfOmen });
    const two = addNamed(scope, r, r.forces[0].id, csm, 'Heretic Astartes Daemon Prince', 2);
    expect(ofRule(validate(scope, two.roster, policy).issues, 'rule-of-three')).toEqual([]);
    r = addForce(scope, two.roster, FORCE.patrol, daemons);
    const third = addNamed(scope, r, r.forces[1].id, daemons, 'Daemon Prince of Chaos');
    const issues = validate(scope, third.roster, policy).issues;
    expect(ofRule(issues, 'detachment-not-allowed')).toEqual([]);
    expect(ofRule(issues, 'rule-of-three')).toEqual([
      { rule: 'rule-of-three', forceSelId: r.forces[1].id, selId: third.ids[0], subject: { id: 'Daemon Prince', name: 'Daemon Prince' }, limit: 2, actual: 3, fix: { kind: 'remove', selIds: [third.ids[0]] } },
    ]);
  });
});

describe('detachments', () => {
  test('two Arks of Omen Detachments is detachment-count', () => {
    const r = addForce(necronsScope, necronRoster('strike-force'), FORCE.arksOfOmen, necrons);
    const issues = validate(necronsScope, r, policy).issues;
    expect(ofRule(issues, 'detachment-count')).toEqual([
      { rule: 'detachment-count', forceSelId: r.forces[1].id, subject: { id: FORCE.arksOfOmen, name: 'Arks of Omen Detachment' }, limit: 1, actual: 2 },
    ]);
    expect(ofRule(issues, 'detachment-not-allowed')).toEqual([]);
    // BSData's own max-1-per-roster constraint on the Arks of Omen Detachment is left to the policy layer.
    expect(issues.filter((i) => i.subject.id === FORCE.arksOfOmen && i.rule !== 'detachment-count')).toEqual([]);
  });

  test('Combat Patrol with two detachments is detachment-count', () => {
    const r = addForce(necronsScope, necronRoster('combat-patrol', FORCE.patrol), FORCE.patrol, necrons);
    const issues = validate(necronsScope, r, policy).issues;
    expect(ofRule(issues, 'detachment-count')).toEqual([
      { rule: 'detachment-count', forceSelId: r.forces[1].id, subject: { id: 'combat-patrol', name: 'Combat Patrol' }, limit: 1, actual: 2 },
    ]);
    expect(issues.filter((i) => i.subject.id === FORCE.patrol)).toEqual([]);
    expect(ofRule(issues, 'detachment-not-allowed')).toEqual([]);
  });

  test('Onslaught allows four Core Book detachments, not five', () => {
    let r = necronRoster('onslaught', FORCE.patrol);
    for (let i = 0; i < 3; i++) r = addForce(necronsScope, r, FORCE.battalion, necrons);
    expect(ofRule(validate(necronsScope, r, policy).issues, 'detachment-count')).toEqual([]);
    r = addForce(necronsScope, r, FORCE.vanguard, necrons);
    expect(ofRule(validate(necronsScope, r, policy).issues, 'detachment-count')).toMatchObject([{ limit: 4, actual: 5, forceSelId: r.forces[4].id }]);
  });

  test('one Supreme Command Detachment and one Fortification Network per army', () => {
    let r = necronRoster('onslaught', FORCE.supremeCommand);
    r = addForce(necronsScope, r, FORCE.fortificationNetwork, necrons);
    expect(ofRule(validate(necronsScope, r, policy).issues, 'detachment-count')).toEqual([]);
    r = addForce(necronsScope, r, FORCE.supremeCommand, necrons);
    r = addForce(necronsScope, r, FORCE.fortificationNetwork, necrons);
    expect(ofRule(validate(necronsScope, r, policy).issues, 'detachment-count')).toEqual([
      { rule: 'detachment-count', forceSelId: r.forces[2].id, subject: { id: FORCE.supremeCommand, name: expect.stringMatching(/^Supreme Command Detachment/) }, limit: 1, actual: 2 },
      { rule: 'detachment-count', forceSelId: r.forces[3].id, subject: { id: FORCE.fortificationNetwork, name: expect.stringMatching(/^Fortification Network/) }, limit: 1, actual: 2 },
    ]);
  });

  test('Core Book battle sizes never take an Arks of Omen, Unbound or Boarding Patrol detachment', () => {
    const r0 = necronRoster('onslaught', FORCE.patrol);
    for (const name of ['Arks of Omen Detachment', 'Unbound Army (Faction)', 'Boarding Patrol', 'Reinforcements', 'Order of Battle']) {
      const forceId = necronsScope.system.forces.find((f) => f.name === name)!.id;
      const r = addForce(necronsScope, r0, forceId, necrons);
      expect(ofRule(validatePolicy(necronsScope, evaluate(necronsScope, r), policy), 'detachment-not-allowed'), name).toEqual([
        { rule: 'detachment-not-allowed', forceSelId: r.forces[1].id, subject: { id: forceId, name: expect.any(String) }, limit: 0, actual: 1 },
      ]);
    }
  });

  test('an unknown detachment is detachment-not-allowed', () => {
    const r0 = necronRoster('strike-force');
    const r: Roster = { ...r0, forces: [...r0.forces, { id: 'f-unknown', forceId: 'no-such-force', catalogueId: necrons, selections: [] }] };
    expect(ofRule(validatePolicy(necronsScope, evaluate(necronsScope, r), policy), 'detachment-not-allowed')).toMatchObject([{ forceSelId: 'f-unknown', subject: { id: 'no-such-force' } }]);
  });

  test('a hidden detachment is detachment-not-allowed and never offered', () => {
    const files = realFiles('necrons').map((f) =>
      f.slug === 'system' ? { ...f, forces: f.forces.map((fe) => (fe.id === FORCE.battalion ? { ...fe, hidden: true as const } : fe)) } : f,
    );
    const scope = buildScope(files);
    const r = addForce(scope, createRoster(scope, { name: 'N', catalogueId: necrons, battleSize: 'onslaught', forceId: FORCE.patrol }), FORCE.battalion, necrons);
    expect(ofRule(validatePolicy(scope, evaluate(scope, r), policy), 'detachment-not-allowed')).toMatchObject([{ forceSelId: r.forces[1].id, subject: { id: FORCE.battalion } }]);
    expect(detachmentChoices(scope, r, policy, catalogues).map((c) => c.forceId)).not.toContain(FORCE.battalion);
  });

  test('Harlequins Patrol ally is allowed for Craftworlds, Orks Patrol is not', () => {
    const scope = realScope('aeldari-craftworlds', 'aeldari-harlequins', 'orks');
    const cw = realCatalogueId('aeldari-craftworlds');
    const harlequins = realCatalogueId('aeldari-harlequins');
    const orks = realCatalogueId('orks');
    const r = createRoster(scope, { name: 'CW', catalogueId: cw, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });

    expect(detachmentChoices(scope, { ...r, forces: [] }, policy, catalogues)).toEqual([
      { forceId: FORCE.arksOfOmen, name: 'Arks of Omen Detachment', catalogueId: cw, allied: false },
    ]);
    expect(detachmentChoices(scope, r, policy, catalogues)).toEqual([
      { forceId: FORCE.patrol, name: 'Patrol Detachment -2CP', catalogueId: harlequins, allied: true },
    ]);

    const withHarlequins = addForce(scope, r, FORCE.patrol, harlequins);
    expect(ofRule(validate(scope, withHarlequins, policy).issues, 'detachment-not-allowed')).toEqual([]);
    expect(detachmentChoices(scope, withHarlequins, policy, catalogues)).toEqual([]); // one ally at most

    const withOrks = addForce(scope, r, FORCE.patrol, orks);
    expect(ofRule(validate(scope, withOrks, policy).issues, 'detachment-not-allowed')).toEqual([
      { rule: 'detachment-not-allowed', forceSelId: withOrks.forces[1].id, subject: { id: FORCE.patrol, name: expect.stringMatching(/^Patrol Detachment/) }, limit: 0, actual: 1 },
    ]);
  });

  test('two allies is detachment-count', () => {
    const scope = realScope('aeldari-craftworlds', 'aeldari-harlequins');
    const cw = realCatalogueId('aeldari-craftworlds');
    const harlequins = realCatalogueId('aeldari-harlequins');
    let r = createRoster(scope, { name: 'CW', catalogueId: cw, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
    r = addForce(scope, addForce(scope, r, FORCE.patrol, harlequins), FORCE.patrol, harlequins);
    expect(ofRule(validate(scope, r, policy).issues, 'detachment-count')).toMatchObject([{ forceSelId: r.forces[2].id, limit: 1, actual: 2 }]);
  });

  test('Imperium armies may ally Agents, Imperial Knights and Leagues of Votann', () => {
    const scope = realScope('imperium-adeptus-astartes-ultramarines');
    const um = realCatalogueId('imperium-adeptus-astartes-ultramarines');
    const r = createRoster(scope, { name: 'UM', catalogueId: um, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
    expect(detachmentChoices(scope, r, policy, catalogues).map((c) => [catalogues.find((s) => s.id === c.catalogueId)!.name, c.name, c.allied])).toEqual([
      ['Imperium - Agents of the Imperium', 'Patrol Detachment -2CP', true],
      ['Imperium - Agents of the Imperium', 'Auxiliary Support Detachment -2CP', true],
      ['Imperium - Imperial Knights', 'Super-Heavy Auxiliary Detachment -3CP', true],
      ['Leagues of Votann', 'Patrol Detachment -2CP', true],
    ]);
  });

  test('Core Book battle sizes offer the Core Book detachments of the primary catalogue and its faction group', () => {
    const lotd = realCatalogueId('imperium-legion-of-the-damned');
    const scope = realScope('imperium-legion-of-the-damned');
    const r = createRoster(scope, { name: 'LotD', catalogueId: lotd, battleSize: 'onslaught', forceId: FORCE.patrol });
    const choices = detachmentChoices(scope, r, policy, catalogues);
    const own = choices.filter((c) => c.catalogueId === lotd);
    expect(own.map((c) => c.name)).toEqual([
      'Patrol Detachment -2CP',
      'Battalion Detachment -3CP',
      'Brigade Detachment -4CP',
      'Vanguard Detachment -3CP',
      'Spearhead Detachment -3CP',
      'Outrider Detachment -3CP',
      'Supreme Command Detachment 0CP',
      'Super-Heavy Detachment -3CP',
      'Super-Heavy Auxiliary Detachment -3CP',
      'Fortification Network -1CP',
      'Auxiliary Support Detachment -2CP',
      'Vanguard Detachment', // Legion of the Damned's own
    ]);
    expect(own.every((c) => !c.allied)).toBe(true);
    const groups = new Set(choices.map((c) => catalogues.find((s) => s.id === c.catalogueId)!.group));
    expect([...groups]).toEqual(['Imperium']);
    expect(choices.some((c) => c.catalogueId === realCatalogueId('imperium-astra-militarum') && c.allied)).toBe(true);
    expect(choices.some((c) => catalogues.find((s) => s.id === c.catalogueId)!.library)).toBe(false);
  });

  test('an Auxiliary Support Detachment holds exactly one unit', () => {
    let r = necronRoster('onslaught', FORCE.patrol);
    r = addForce(necronsScope, r, FORCE.auxiliarySupport, necrons);
    const aux = r.forces[1].id;
    const slot = (roster: Roster) => validate(necronsScope, roster, policy).issues.filter((i) => i.forceSelId === aux && (i.rule === 'slot-min' || i.rule === 'slot-max'));
    const empty = slot(r);
    expect(empty).toMatchObject([{ rule: 'slot-min', subject: { id: FORCE.auxiliarySupport, name: '' }, limit: 1, actual: 0, fix: { kind: 'add-unit', forceSelId: aux } }]);
    expect((empty[0].fix as { entryIds: string[] }).entryIds).toHaveLength(3);
    const one = addNamed(necronsScope, r, aux, necrons, 'Canoptek Wraiths');
    expect(slot(one.roster)).toEqual([]);
    const two = addNamed(necronsScope, one.roster, aux, necrons, 'Necron Warriors');
    expect(slot(two.roster)).toEqual([
      { rule: 'slot-max', forceSelId: aux, selId: two.ids[0], subject: { id: FORCE.auxiliarySupport, name: '' }, limit: 1, actual: 2, fix: { kind: 'remove', selIds: [two.ids[0]] } },
    ]);
  });
});

describe('factions', () => {
  test('Space Marines with an Astra Militarum unit in one detachment is detachment-faction', () => {
    // BSData never offers Astra Militarum units to a Space Marines force, so this scope imports them into Ultramarines.
    const um = realCatalogueId('imperium-adeptus-astartes-ultramarines');
    const am = realCatalogueId('imperium-astra-militarum');
    const files = realFiles('imperium-adeptus-astartes-ultramarines', 'imperium-astra-militarum').map((f) =>
      f.id === um ? { ...f, links: [...f.links, { targetId: am, importRootEntries: true }] } : f,
    );
    const scope = buildScope(files);
    const r = createRoster(scope, { name: 'UM', catalogueId: um, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
    const fs = r.forces[0].id;
    const marines = addNamed(scope, r, fs, um, 'Intercessor Squad');
    expect(ofRule(validate(scope, marines.roster, policy).issues, 'detachment-faction')).toEqual([]);
    const mixed = addNamed(scope, marines.roster, fs, am, 'Infantry Squad');
    const issues = validate(scope, mixed.roster, policy).issues;
    expect(ofRule(issues, 'detachment-faction')).toEqual([
      { rule: 'detachment-faction', forceSelId: fs, subject: { id: FORCE.arksOfOmen, name: expect.stringMatching(/^Arks of Omen Detachment/) }, limit: 1, actual: 0 },
    ]);
    expect(ofRule(issues, 'army-faction')).toEqual([]); // both are IMPERIUM
  });

  test('Talons of the Emperor: Sisters of Silence share a faction with an Adeptus Custodes detachment', () => {
    const scope = realScope('imperium-adeptus-custodes');
    const spec: ListSpec = {
      title: 'Custodes with Sisters of Silence',
      battleSize: 'strike-force',
      detachments: [{
        detachment: 'Arks of Omen Detachment',
        units: [
          { name: 'Shield-Captain', warlord: true },
          { name: 'Aleya' },
          { name: 'Custodian Guard Squad' }, { name: 'Custodian Guard Squad' }, { name: 'Custodian Guard Squad' },
          { name: 'Prosecutors' },
        ],
      }],
      expect: { points: 0, powerLevel: 0 },
    };
    const r = buildFromSpec(scope, realCatalogueId('imperium-adeptus-custodes'), spec);
    // Aleya had no Faction: Imperium in BSData (overrides/faction-keywords.json), so army-faction would fire too.
    expect(validate(scope, r, policy).issues).toEqual([]);
    const issues = validate(scope, r, { ...policy, battleBrothers: [] }).issues;
    expect(issues.map((i) => i.rule)).toEqual(['detachment-faction']);
  });

  test('battle-brothers.json ships in policy.json and its names are checked at build', () => {
    expect(policy.battleBrothers).toEqual([expect.objectContaining({ catalogueName: 'Imperium - Adeptus Custodes', alsoAllowFactions: ['Anathema Psykana'] })]);
    const files = realFiles(...catalogues.map((c) => c.slug));
    const withBrothers = (entries: unknown) => {
      const dir = mkdtempSync(join(tmpdir(), 'recruit-overrides-'));
      cpSync(join(import.meta.dirname, '..', 'overrides'), dir, { recursive: true });
      writeFileSync(join(dir, 'battle-brothers.json'), JSON.stringify(entries));
      return () => loadPolicy(dir, files);
    };
    expect(withBrothers([{ catalogueName: 'No Such Army', alsoAllowFactions: ['Anathema Psykana'], source: 't' }])).toThrow('battle-brothers.json (No Such Army) names unknown catalogue "No Such Army"');
    expect(withBrothers([{ catalogueName: 'Imperium - Adeptus Custodes', alsoAllowFactions: ['Silence'], source: 't' }])).toThrow('names unknown category "Faction: Silence"');
  });

  test('an Orks detachment in a Necrons army is army-faction', () => {
    const scope = realScope('necrons', 'orks');
    const orks = realCatalogueId('orks');
    let r = createRoster(scope, { name: 'Necrons', catalogueId: necrons, battleSize: 'onslaught', forceId: FORCE.patrol });
    r = addNamed(scope, r, r.forces[0].id, necrons, 'Overlord').roster;
    expect(ofRule(validate(scope, r, policy).issues, 'army-faction')).toEqual([]);
    r = addForce(scope, r, FORCE.patrol, orks);
    r = addNamed(scope, r, r.forces[1].id, orks, 'Warboss').roster;
    const issues = validate(scope, r, policy).issues;
    expect(ofRule(issues, 'army-faction')).toEqual([{ rule: 'army-faction', subject: { id: necrons, name: 'Necrons' }, limit: 1, actual: 0 }]);
    expect(ofRule(issues, 'detachment-faction')).toEqual([]);
  });

  test('a Militarum Tempestus-only ally Patrol must be all Militarum Tempestus', () => {
    const scope = realScope('imperium-astra-militarum');
    const am = realCatalogueId('imperium-astra-militarum');
    let r = createRoster(scope, { name: 'AM', catalogueId: am, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
    expect(detachmentChoices(scope, r, policy, catalogues)).toContainEqual({ forceId: FORCE.patrol, name: 'Patrol Detachment -2CP', catalogueId: am, allied: true });
    r = addForce(scope, r, FORCE.patrol, am);
    const ally = r.forces[1].id;
    const scions = addNamed(scope, r, ally, am, 'Tempestus Scions');
    expect(ofRule(validate(scope, scions.roster, policy).issues, 'detachment-faction')).toEqual([]);
    const tank = addNamed(scope, scions.roster, ally, am, 'Leman Russ Battle Tanks');
    expect(ofRule(validate(scope, tank.roster, policy).issues, 'detachment-faction')).toMatchObject([{ forceSelId: ally, selId: tank.ids[0] }]);
  });
});

describe('validate', () => {
  test('a second Warlord is reported once', () => {
    const r0 = necronRoster('strike-force');
    const fs = r0.forces[0].id;
    let r = r0;
    const lords: string[] = [];
    for (let i = 0; i < 2; i++) {
      const added = addNamed(necronsScope, r, fs, necrons, 'Overlord');
      r = added.roster;
      lords.push(added.ids[0]);
    }
    const warlordOption = (selId: string) => {
      const v = evaluate(necronsScope, r).forces[0].selections.find((s) => s.sel.id === selId)!;
      return v.merged!.children.map((n) => resolve(necronsScope, n)).find((m) => m.name === 'Warlord')!.node.id;
    };
    for (const id of lords) r = { ...r, forces: [{ ...r.forces[0], selections: r.forces[0].selections.map((s) => (s.id === id ? { ...s, children: [...s.children, { id: `${id}-wl`, entryId: warlordOption(id), count: 1, children: [] }] } : s)) }] };
    const raw = validateConstraints(necronsScope, evaluate(necronsScope, r)).filter((i) => i.fix?.kind === 'open' && i.fix.selId === lords[1]);
    expect(raw.length).toBeGreaterThan(1);
    const { issues } = validate(necronsScope, r, policy);
    expect(issues.filter((i) => i.fix?.kind === 'open' && i.fix.selId === lords[1])).toHaveLength(1);
  });

  test('a legal Necrons Arks of Omen army has no issues', () => {
    let r = necronRoster('strike-force');
    const fs = r.forces[0].id;
    const dynasty = evaluate(necronsScope, r).forces[0].selections.find((v) => v.name === 'Dynasty Choice')!;
    const code = dynasty.merged!.children.map((n) => resolve(necronsScope, n)).find((m) => m.name.trim() === '-Dynastic Code-')!;
    const sautekh = code.children.map((n) => resolve(necronsScope, n)).find((m) => m.name.trim() === 'Dynasty: Sautekh')!;
    r = { ...r, forces: [{ ...r.forces[0], selections: r.forces[0].selections.map((s) => (s.id === dynasty.sel.id ? { ...s, children: [{ id: 'sautekh', entryId: sautekh.node.id, count: 1, children: [] }] } : s)) }] };
    const overlord = addNamed(necronsScope, r, fs, necrons, 'Overlord');
    r = overlord.roster;
    const v = evaluate(necronsScope, r).forces[0].selections.find((s) => s.sel.id === overlord.ids[0])!;
    const warlord = v.merged!.children.map((n) => resolve(necronsScope, n)).find((m) => m.name === 'Warlord')!;
    r = { ...r, forces: [{ ...r.forces[0], selections: r.forces[0].selections.map((s) => (s.id === overlord.ids[0] ? { ...s, children: [...s.children, { id: 'wl', entryId: warlord.node.id, count: 1, children: [] }] } : s)) }] };
    r = addNamed(necronsScope, r, fs, necrons, 'Necron Warriors', 3).roster;
    expect(validate(necronsScope, r, policy).issues).toEqual([]);
  });
});
