import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, describe } from 'vitest';
import { loadPolicy } from '../src/build';
import {
  addChild,
  addForce,
  addUnit,
  availableUnits,
  buildScope,
  childOptions,
  evaluate,
  explain,
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
  type MustBeWarlord,
} from '../src/roster/policy';
import sororitas from './corpus/imperium/imperium-adepta-sororitas';
import { buildFromSpec, type DetachmentSpec, type ListSpec } from './corpus/spec';
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
      boardingPatrol: 'Boarding Patrol',
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

  test('Arks of Omen Warlords BSData forces to take the Warlord Trait Requisition Stratagem may go without it (§5, §6)', () => {
    const CRIMSON_FISTS = { '**Chapter Selector**': ['Imperial Fists Successor', 'Crimson Fists'] };
    const named: Record<string, string[]> = {
      'imperium-adeptus-astartes-ultramarines': ['Uriel Ventris', 'Marneus Calgar', 'Captain Sicarius', 'Chief Librarian Tigurius', 'Chaplain Cassius', 'Sergeant Chronus', 'Sergeant Telion', 'Roboute Guilliman'],
      'imperium-adeptus-astartes-imperial-fists': ['Captain Lysander', 'Pedro Kantor', 'Tor Garadon'], // Kantor: a Crimson Fists army
      'imperium-adeptus-astartes-iron-hands': ['Iron Father Feirros'],
      'imperium-adeptus-astartes-raven-guard': ['Kayvaan Shrike', 'Kayvaan Shrike [Legends]'],
      'imperium-adeptus-astartes-salamanders': ['Adrax Agatone', "Vulkan He'stan"],
      'imperium-adeptus-astartes-white-scars': ['Khan on Bike', "Kor'sarro Khan", "Kor'sarro Khan [Legends]", "Kor'sarro Khan on Moondrakkan [Legends]"],
      // BSData demands these Warlords' fixed Warlord Trait itself (not the stratagem) outside War Zone Nephilim.
      necrons: ['The Silent King', 'Anrakyr the Traveller', 'Illuminor Szeras', 'Trazyn the Infinite', 'Orikan the Diviner'],
    };
    const SAUTEKH = { 'Dynasty Choice': 'Dynasty: Sautekh' };
    for (const [slug, names] of Object.entries(named)) for (const name of names) {
      const scope = realScope(slug);
      const catId = realCatalogueId(slug);
      const necrons = slug === 'necrons';
      const troops = { name: necrons ? 'Necron Warriors' : 'Intercessor Squad' };
      const spec: ListSpec = {
        title: name,
        battleSize: 'strike-force',
        detachments: [{ detachment: 'Arks of Omen Detachment', army: name === 'Pedro Kantor' ? CRIMSON_FISTS : necrons ? SAUTEKH : undefined, units: [{ name, warlord: true }, troops, troops, troops] }],
        expect: { points: 0, powerLevel: 0 },
      };
      // Raw BSData issues: validate() would merge this one with another issue on the same unit (Cassius' Litanies).
      const issues = validateConstraints(scope, evaluate(scope, buildFromSpec(scope, catId, spec)));
      expect(issues.filter((i) => /Warlord Trait/.test(i.subject.name)), `${slug}: ${name}`).toEqual([]);
    }
  });

  test('named characters BSData limits per detachment are unique per army (Wahapedia datasheets)', () => {
    const named: Record<string, string[]> = {
      'imperium-adeptus-astartes-space-wolves': ['Arjac Rockfist', 'Bjorn the Fell-handed', 'Ulrik The Slayer', 'Lukas the Trickster', 'Murderfang'],
      'imperium-adeptus-astartes-dark-angels': ['Lazarus'],
    };
    for (const [slug, names] of Object.entries(named)) for (const name of names) {
      const scope = realScope(slug);
      const patrol = (warlord: boolean) => ({
        detachment: 'Patrol Detachment -2CP',
        units: [{ name: 'Primaris Captain', warlord }, { name: 'Intercessor Squad' }, { name }],
      });
      // One in each of two Onslaught Patrols: no per-detachment limit is broken, only the per-army one.
      const spec: ListSpec = { title: name, battleSize: 'onslaught', detachments: [patrol(true), patrol(false)], expect: { points: 0, powerLevel: 0 } };
      const { issues } = validate(scope, buildFromSpec(scope, realCatalogueId(slug), spec), policy);
      expect(issues.filter((i) => i.subject.name === name).map((i) => [i.rule, i.limit, i.actual]), `${slug}: ${name}`).toEqual([['unique', 1, 2]]);
    }
  });

  test("an Onager Dunecrawler's smoke launchers or data-tether are optional (Wahapedia datasheet options)", () => {
    const scope = realScope('imperium-adeptus-mechanicus');
    const spec: ListSpec = {
      title: 'Onager',
      battleSize: 'strike-force',
      detachments: [{
        detachment: 'Arks of Omen Detachment',
        army: { 'Forge World Choice': 'Forge World: Mars' },
        units: [{ name: 'Tech-Priest Dominus', warlord: true }, { name: 'Skitarii Rangers' }, { name: 'Skitarii Rangers' }, { name: 'Skitarii Rangers' }, { name: 'Onager Dunecrawler' }],
      }],
      expect: { points: 0, powerLevel: 0 },
    };
    expect(validate(scope, buildFromSpec(scope, realCatalogueId('imperium-adeptus-mechanicus'), spec), policy).issues.map((i) => i.rule)).toEqual([]);
  });

  test('a Land Raider Banisher or Stormhawk Interceptor shares GREY KNIGHTS with its detachment (faction-keywords.json, catalogue category)', () => {
    const scope = realScope('imperium-grey-knights');
    for (const name of ['Land Raider Banisher', 'Stormhawk Interceptor']) {
      const spec: ListSpec = {
        title: name,
        battleSize: 'strike-force',
        detachments: [{ detachment: 'Arks of Omen Detachment', units: [{ name: 'Brother-Captain', warlord: true }, { name: 'Strike Squad' }, { name: 'Strike Squad' }, { name: 'Strike Squad' }, { name }] }],
        expect: { points: 0, powerLevel: 0 },
      };
      expect(validate(scope, buildFromSpec(scope, realCatalogueId('imperium-grey-knights'), spec), policy).issues.map((i) => i.rule), name).toEqual([]);
    }
  });

  test('one-per-army units BSData leaves unlimited or limits per detachment are unique per army (Wahapedia datasheets)', () => {
    const MARINES = ['Primaris Captain', 'Intercessor Squad'];
    const successor = (chapter: string, successors: string) => ({ '**Chapter Selector**': [successors, chapter] });
    // [catalogue, unit, [HQ, Troops] to fill each Patrol, army choices that make the unit available]
    const cases: [string, string, string[], Record<string, string[]>?][] = [
      ['imperium-adeptus-astartes-imperial-fists', 'Tor Garadon', MARINES],
      ['imperium-adeptus-astartes-imperial-fists', 'Pedro Kantor', MARINES, successor('Crimson Fists', 'Imperial Fists Successor')],
      ['imperium-adeptus-astartes-salamanders', 'Adrax Agatone', MARINES],
      ['imperium-adeptus-astartes-black-templars', "The Emperor's Champion", MARINES],
      ['imperium-adeptus-astartes-ultramarines', 'Sergeant Telion', MARINES],
      ['imperium-adeptus-astartes-ultramarines', 'Sergeant Chronus', MARINES],
      ['imperium-adeptus-astartes-ultramarines', 'Epistolary Lykandos', MARINES, successor('Tome Keepers', 'Ultramarines Successor')],
      ['imperium-adeptus-astartes-ultramarines', 'Orator Sephax', MARINES, successor('Tome Keepers', 'Ultramarines Successor')],
      ['imperium-adeptus-astartes-ultramarines', 'Ancient Kae', MARINES, successor('Tome Keepers', 'Ultramarines Successor')],
      ['imperium-adeptus-astartes-ultramarines', 'Asterion Moloc', MARINES, successor('Minotaurs', 'Ultramarines Successor')],
      ['imperium-adeptus-astartes-ultramarines', 'Ivanus Enkomi', MARINES, successor('Minotaurs', 'Ultramarines Successor')],
      ['imperium-adeptus-astartes-ultramarines', 'Agent of the Imperium > Lord Inquisitor Kyria Draxus', MARINES],
      ['imperium-adeptus-astartes-blood-angels', 'Sanguinary Ancient', MARINES],
      ['imperium-adepta-sororitas', 'Arch-Confessor Kyrinov [Legends]', ['Canoness', 'Battle Sister Squad']],
      ['imperium-grey-knights', 'Paladin Ancient', ['Brother-Captain', 'Strike Squad']],
      ['imperium-adeptus-mechanicus', 'X-101', ['Tech-Priest Dominus', 'Skitarii Rangers']],
      ['chaos-daemons', 'Rotigus', ['Great Unclean One', 'Plaguebearers']],
      ['chaos-daemons', 'Shalaxi Helbane', ['Keeper of Secrets', 'Daemonettes']],
    ];
    for (const [slug, unit, [hq, troops], army] of cases) {
      const scope = realScope(slug);
      const patrol = (warlord: boolean) => ({ detachment: 'Patrol Detachment -2CP', army, units: [{ name: hq, warlord }, { name: troops }, { name: unit }] });
      // One in each of two Onslaught Patrols: no per-detachment limit is broken, only the per-army one.
      const spec: ListSpec = { title: unit, battleSize: 'onslaught', detachments: [patrol(true), patrol(false)], expect: { points: 0, powerLevel: 0 } };
      const name = unit.split('>').pop()!.trim();
      const { issues } = validate(scope, buildFromSpec(scope, realCatalogueId(slug), spec), policy);
      expect(issues.filter((i) => i.subject.name === name).map((i) => [i.rule, i.limit, i.actual]), `${slug}: ${name}`).toEqual([['unique', 1, 2]]);
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

  describe('an AGENT OF THE IMPERIUM unit skips Battle Brothers only in an IMPERIUM detachment without FALLEN units (§8.2)', () => {
    // Wahapedia Agent of the Imperium (000008049): "one AGENT OF THE IMPERIUM unit in each IMPERIUM (excluding FALLEN
    // units) … Detachment"; the research library's §8.2: "each IMPERIUM (excluding Fallen) Patrol, Battalion or Brigade".
    const INQUISITOR = { name: 'Inquisitor', options: ['Bolt pistol', 'Ordo Xenos'] };
    const rules = (scope: Scope, slug: string, spec: ListSpec) =>
      validate(scope, buildFromSpec(scope, realCatalogueId(slug), spec), policy).issues.map((i) => i.rule).sort();

    test('an Inquisitor in a Renegades & Heretics detachment is detachment-faction (and army-faction)', () => {
      const slug = 'chaos-renegades-heretics-legends';
      const spec: ListSpec = {
        title: 'Renegades with an Inquisitor',
        battleSize: 'incursion',
        detachments: [{
          detachment: 'Arks of Omen Detachment',
          army: { 'Arks of Omen Compulsory Type': 'Troops' },
          units: [
            { name: 'Malefic Lord', warlord: true },
            { name: 'Renegade Militia Squad', options: ['Renegade Militia Champion > Autogun'] },
            { name: 'Renegade Cultists' },
            { name: 'Renegade Mutant Rabble' },
            INQUISITOR,
          ],
        }],
        expect: { points: 0, powerLevel: 0 },
      };
      expect(rules(realScope(slug), slug, spec)).toEqual(['army-faction', 'detachment-faction']);
    });

    test('an Inquisitor in an Ultramarines detachment is fine', () => {
      const slug = 'imperium-adeptus-astartes-ultramarines';
      const spec: ListSpec = {
        title: 'Ultramarines with an Inquisitor',
        battleSize: 'strike-force',
        detachments: [{
          detachment: 'Arks of Omen Detachment',
          units: [{ name: 'Uriel Ventris', warlord: true }, { name: 'Intercessor Squad' }, { name: 'Intercessor Squad' }, { name: 'Intercessor Squad' }, INQUISITOR],
        }],
        expect: { points: 0, powerLevel: 0 },
      };
      expect(rules(realScope(slug), slug, spec)).toEqual([]);
    });

    test('an Inquisitor beside Cypher (IMPERIUM, CHAOS, FALLEN) is detachment-faction', () => {
      // BSData never offers Agents to the Fallen catalogue, so this scope imports them into it.
      const fallen = realCatalogueId('fallen');
      const agents = realCatalogueId('imperium-agents-of-the-imperium');
      const scope = buildScope(realFiles('fallen', 'imperium-agents-of-the-imperium').map((f) =>
        f.id === fallen ? { ...f, links: [...f.links, { targetId: agents, importRootEntries: true }] } : f,
      ));
      const spec: ListSpec = {
        title: 'Cypher with an Inquisitor',
        battleSize: 'onslaught',
        detachments: [{ detachment: 'Patrol Detachment -2CP', units: [{ name: 'Cypher', warlord: true }, INQUISITOR] }],
        expect: { points: 0, powerLevel: 0 },
      };
      const issues = validate(scope, buildFromSpec(scope, fallen, spec), policy).issues;
      expect(ofRule(issues, 'detachment-faction')).toHaveLength(1);
    });

    test('only in a Patrol, Boarding Patrol, Battalion, Brigade or Arks of Omen Detachment: in a Vanguard it is detachment-faction', () => {
      // Wahapedia 000008049 (April 2023): "each IMPERIUM (excluding FALLEN units) Patrol, Boarding Patrol, Battalion,
      // Brigade and Arks of Omen Detachment"; the research library's §8.2 says the same. BSData only offers Agents in
      // those detachments, so the Inquisitor the Battalion offers is added to the Vanguard by its entry, past the picker.
      const slug = 'imperium-adeptus-astartes-ultramarines';
      const scope = realScope(slug);
      const id = realCatalogueId(slug);
      const build = (detachment: string, units: DetachmentSpec['units']) =>
        buildFromSpec(scope, id, { title: `${detachment} with an Inquisitor`, battleSize: 'onslaught', detachments: [{ detachment, units }], expect: { points: 0, powerLevel: 0 } });
      const battalion = build('Battalion Detachment -3CP', []);
      const inquisitor = availableUnits(scope, battalion, battalion.forces[0].id).filter((u) => u.name === 'Inquisitor');
      expect(inquisitor).toHaveLength(1);
      const withInquisitor = (detachment: string, units: DetachmentSpec['units']) => {
        const r = build(detachment, units);
        const { roster } = addUnit(scope, r, r.forces[0].id, inquisitor[0].entryId);
        return ofRule(validate(scope, roster, policy).issues, 'detachment-faction');
      };
      const bladeguard = { name: 'Bladeguard Veteran Squad' };
      const intercessors = { name: 'Intercessor Squad' };
      expect(withInquisitor('Vanguard Detachment -3CP', [{ name: 'Uriel Ventris', warlord: true }, bladeguard, bladeguard, bladeguard])).toHaveLength(1);
      expect(withInquisitor('Battalion Detachment -3CP', [{ name: 'Uriel Ventris', warlord: true }, { name: 'Captain' }, intercessors, intercessors, intercessors])).toEqual([]);
    });
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

  test('Drukhari and Craftworlds Patrols share AELDARI for Army Faction (faction-keywords.json)', () => {
    const scope = realScope('aeldari-drukhari', 'aeldari-craftworlds');
    const spec: ListSpec = {
      title: 'Drukhari and Craftworlds',
      battleSize: 'onslaught',
      detachments: [
        { detachment: 'Patrol Detachment -2CP', army: { Obsession: 'Kabal of the Black Heart: Thirst for Power' }, units: [{ name: 'Archon', warlord: true }, { name: 'Kabalite Warriors' }] },
        { detachment: 'Patrol Detachment -2CP', catalogue: 'Aeldari - Craftworlds', units: [{ name: 'Farseer' }, { name: 'Rangers' }] },
      ],
      expect: { points: 0, powerLevel: 0 },
    };
    const issues = validate(scope, buildFromSpec(scope, realCatalogueId('aeldari-drukhari'), spec), policy).issues;
    expect(issues.filter((i) => i.rule === 'army-faction' || i.rule === 'detachment-faction')).toEqual([]);
  });

  test("a Kroot Shaper shares T'AU EMPIRE with the rest of a T'au detachment (faction-keywords.json)", () => {
    const scope = realScope('tau-empire');
    const spec: ListSpec = {
      title: "T'au with a Kroot Shaper",
      battleSize: 'strike-force',
      detachments: [{
        detachment: 'Arks of Omen Detachment',
        army: { 'Sept Choice': "T'au Sept" },
        units: [{ name: 'Cadre Fireblade', warlord: true }, { name: 'Kroot Shaper' }, { name: 'Strike Team' }, { name: 'Strike Team' }, { name: 'Strike Team' }],
      }],
      expect: { points: 0, powerLevel: 0 },
    };
    const issues = validate(scope, buildFromSpec(scope, realCatalogueId('tau-empire'), spec), policy).issues;
    expect(issues.filter((i) => i.rule === 'army-faction' || i.rule === 'detachment-faction')).toEqual([]);
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

  test('a Chaos Knights Super-Heavy Auxiliary ally must hold a Dreadblade (§7.5)', () => {
    const knightAllies = policy.aooAllies.flatMap((a) => a.allies.filter((x) => x.catalogueName === 'Chaos - Chaos Knights').map(() => a.catalogueName));
    expect(knightAllies.length).toBeGreaterThan(0);
    for (const name of knightAllies) {
      const ally = policy.aooAllies.find((a) => a.catalogueName === name)!.allies.find((x) => x.catalogueName === 'Chaos - Chaos Knights')!;
      expect(ally.onlyFactions, name).toEqual(['Faction: Dreadblade']);
    }
    const scope = realScope('chaos-renegades-heretics-legends', 'chaos-chaos-knights');
    const list = (household: string[]): ListSpec => ({
      title: 'Renegades with a Chaos Knights ally',
      battleSize: 'incursion',
      detachments: [
        {
          detachment: 'Arks of Omen Detachment',
          army: { 'Arks of Omen Compulsory Type': 'Troops' },
          units: [
            { name: 'Malefic Lord', warlord: true },
            { name: 'Renegade Militia Squad', options: ['Renegade Militia Champion > Autogun'] },
            { name: 'Renegade Cultists' },
            { name: 'Renegade Mutant Rabble' },
          ],
        },
        { detachment: 'Super-Heavy Auxiliary Detachment -3CP', catalogue: 'Chaos - Chaos Knights', units: [{ name: 'War Dog Karnivore Squadron', options: household }] },
      ],
      expect: { points: 0, powerLevel: 0 },
    });
    const rules = (household: string[]) => validate(scope, buildFromSpec(scope, realCatalogueId('chaos-renegades-heretics-legends'), list(household)), policy).issues.map((i) => i.rule);
    expect(rules(['Infernal Dreadblade', 'Biomechanical Fusion'])).toEqual([]);
    expect(rules(['House Vextrix'])).toEqual(['detachment-faction']);
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

describe('must-be-Warlord units (must-be-warlord.json)', () => {
  const TS = 'chaos-thousand-sons';
  const DG = 'chaos-death-guard';
  const CSM = 'chaos-chaos-space-marines';
  const SUPER_HEAVY_AUX = 'Super-Heavy Auxiliary Detachment -3CP';
  const PATROL = 'Patrol Detachment -2CP';
  const magnus = (warlord = false): DetachmentSpec => ({ detachment: SUPER_HEAVY_AUX, units: [{ name: 'Magnus the Red', warlord }] });
  const mortarion = (warlord = false): DetachmentSpec => ({ detachment: SUPER_HEAVY_AUX, catalogue: 'Chaos - Death Guard', units: [{ name: 'Mortarion', warlord }] });
  const onslaught = (...detachments: DetachmentSpec[]): ListSpec => ({ title: 'must be Warlord', battleSize: 'onslaught', detachments, expect: { points: 0, powerLevel: 0 } });
  function run(slugs: string[], spec: ListSpec) {
    const scope = realScope(...slugs);
    const { view, issues } = validate(scope, buildFromSpec(scope, realCatalogueId(slugs[0]), spec), policy);
    /** Where an issue about the named unit points: its detachment and its selection. */
    const unitAt = (name: string) => {
      const v = view.forces.flatMap((f) => f.selections).find((s) => s.name.trim() === name)!;
      return { forceSelId: v.force.force.id, selId: v.sel.id };
    };
    return { issues, unitAt, explained: issues.map((i) => ({ rule: i.rule, ...explain(i, view, scope) })) };
  }
  /**
   * Warlord issues, and BSData's own "Warlord" option minimums (option-required). Named characters' Warlord Traits,
   * which BSData asks a Warlord for in Eternal War, are another rule and left out.
   */
  const warlordIssues = (issues: Issue[]) => issues.filter((i) => i.rule === 'warlord-missing' || i.rule === 'warlord-extra' || i.subject.name.trim() === 'Warlord');
  const entry = (name: string) => {
    const hit = policy.mustBeWarlord.find((m) => m.entryName === name);
    if (!hit) throw new Error(`${name} is not in must-be-warlord.json`);
    return { id: hit.entryId, name };
  };

  test('Magnus and Mortarion, with Mortarion as the Warlord, are legal (Daemon Primarch: one of them must be the Warlord)', () => {
    expect(warlordIssues(run([TS, DG], onslaught(magnus(), mortarion(true))).issues)).toEqual([]);
    expect(warlordIssues(run([TS, DG], onslaught(magnus(true), mortarion())).issues)).toEqual([]);
  });

  test('Magnus and Mortarion with a Chaos Lord as the Warlord is one warlord-missing naming both', () => {
    const chaosLord: DetachmentSpec = {
      detachment: PATROL, catalogue: 'Chaos - Chaos Space Marines', army: { Legion: 'Black Legion' }, units: [{ name: 'Chaos Lord', warlord: true }, { name: 'Legionaries' }],
    };
    const { issues, unitAt, explained } = run([TS, DG, CSM], onslaught(magnus(), mortarion(), chaosLord));
    const at = unitAt('Magnus the Red');
    expect(warlordIssues(issues)).toEqual([{
      rule: 'warlord-missing', ...at, subject: entry('Magnus the Red'), subjects: [entry('Magnus the Red'), entry('Mortarion')],
      limit: 1, actual: 0, fix: { kind: 'open', selId: at.selId },
    }]);
    expect(explained.filter((x) => x.rule === 'warlord-missing')).toEqual([{
      rule: 'warlord-missing', text: 'Magnus the Red or Mortarion must be your Warlord. Open one of them and turn on "Warlord".', fixLabel: 'Open Magnus the Red',
    }]);
  });

  test('Magnus alone with no Warlord is a single warlord-missing that names him', () => {
    const { issues, unitAt, explained } = run([TS], onslaught(magnus()));
    expect(warlordIssues(issues)).toEqual([{
      rule: 'warlord-missing', ...unitAt('Magnus the Red'), subject: entry('Magnus the Red'), subjects: [entry('Magnus the Red')],
      limit: 1, actual: 0, fix: { kind: 'open', selId: unitAt('Magnus the Red').selId },
    }]);
    expect(explained.filter((x) => x.rule === 'warlord-missing').map((x) => x.text)).toEqual(['Magnus the Red must be your Warlord. Open Magnus the Red and turn on "Warlord".']);
  });

  test('a detachment that needs the Warlord keeps its own warlord-missing beside the policy one (only the roster-wide one is dropped)', () => {
    // Core Book §4: a Supreme Command Detachment's unit must be the Warlord. With an Exalted Sorcerer as the Warlord,
    // Magnus there breaks both that and Daemon Primarch.
    const sorcerer: DetachmentSpec = { detachment: PATROL, units: [{ name: 'Exalted Sorcerer', warlord: true }, { name: 'Rubric Marines' }] };
    const supreme: DetachmentSpec = { detachment: 'Supreme Command Detachment 0CP', units: [{ name: 'Magnus the Red' }] };
    const { issues, unitAt } = run([TS], onslaught(sorcerer, supreme));
    const at = unitAt('Magnus the Red');
    expect(warlordIssues(issues).map((i) => [i.rule, i.subject.name, i.scope ?? null, i.forceSelId, i.subjects?.length ?? 0])).toEqual([
      ['warlord-missing', 'Warlord', 'force', at.forceSelId, 0],
      ['warlord-missing', 'Magnus the Red', null, at.forceSelId, 1],
    ]);
  });

  test('Abaddon and Mortarion, with Abaddon as the Warlord, are legal (The Warmaster, Daemon Primarch)', () => {
    const abaddon: DetachmentSpec = { detachment: PATROL, army: { Legion: 'Black Legion' }, units: [{ name: 'Abaddon the Despoiler', warlord: true }, { name: 'Legionaries' }] };
    expect(warlordIssues(run([CSM, DG], onslaught(abaddon, mortarion())).issues)).toEqual([]);
  });

  test('Roboute Guilliman must be the Warlord even beside Trajann Valoris (The Avenging Son)', () => {
    const UM = 'imperium-adeptus-astartes-ultramarines';
    const list = (guilliman: boolean) => onslaught(
      { detachment: SUPER_HEAVY_AUX, units: [{ name: 'Roboute Guilliman', warlord: guilliman }] },
      { detachment: PATROL, catalogue: 'Imperium - Adeptus Custodes', units: [{ name: 'Trajann Valoris', warlord: !guilliman }, { name: 'Custodian Guard Squad' }] },
    );
    expect(warlordIssues(run([UM, 'imperium-adeptus-custodes'], list(true)).issues)).toEqual([]);
    const { issues, unitAt, explained } = run([UM, 'imperium-adeptus-custodes'], list(false));
    expect(warlordIssues(issues)).toEqual([{
      rule: 'warlord-missing', ...unitAt('Roboute Guilliman'), subject: entry('Roboute Guilliman'), subjects: [entry('Roboute Guilliman')],
      limit: 1, actual: 0, fix: { kind: 'open', selId: unitAt('Roboute Guilliman').selId },
    }]);
    expect(explained.filter((x) => x.rule === 'warlord-missing').map((x) => x.text)).toEqual(['Roboute Guilliman must be your Warlord. Open Roboute Guilliman and turn on "Warlord".']);
  });

  test('BSData no longer makes these units the Warlord on its own (constraints.json pins)', () => {
    // Magnus beside an Exalted Sorcerer Warlord: one Warlord, the wrong one.
    const { issues } = run([TS], onslaught(magnus(), { detachment: PATROL, units: [{ name: 'Exalted Sorcerer', warlord: true }, { name: 'Rubric Marines' }] }));
    expect(issues.map((i) => i.rule)).toEqual(['warlord-missing']);
  });

  /**
   * Validates an Onslaught list of one detachment per entry of `warlords`, each holding the unit (its Warlord when
   * true). Lords of War go in a Super-Heavy Auxiliary Detachment, HQs in a Patrol (other slot rules aren't checked).
   */
  function alone(m: MustBeWarlord, warlords: boolean[]): Issue[] {
    const slug = catalogues.find((c) => c.name === m.catalogueName)!.slug;
    /** Army choices a unit needs before it can be added. */
    const army: Record<string, Record<string, string>> = { 'Abaddon the Despoiler': { Legion: 'Black Legion' }, 'Commander Farsight': { 'Sept Choice': 'Farsight Enclaves' } };
    for (const detachment of [PATROL, SUPER_HEAVY_AUX]) {
      try {
        const scope = realScope(slug);
        const list = onslaught(...warlords.map((warlord) => ({ detachment, army: army[m.entryName], units: [{ name: m.entryName, warlord }] })));
        return validate(scope, buildFromSpec(scope, realCatalogueId(slug), list), policy).issues;
      } catch (e) {
        if (!String(e).includes('not found')) throw e;
      }
    }
    throw new Error(`${m.entryName} fits no detachment`);
  }

  test('every must-be-Warlord unit can be made the Warlord, and is missing one when it is not', () => {
    for (const m of policy.mustBeWarlord) {
      expect(warlordIssues(alone(m, [true])), m.entryName).toEqual([]);
      expect(warlordIssues(alone(m, [false])).map((i) => [i.rule, i.subject.name]), m.entryName).toEqual([['warlord-missing', m.entryName]]);
    }
  });

  test('every must-be-Warlord unit is one per army (Wahapedia unit composition: "Your army can only include one …")', () => {
    // Two of them, one the Warlord: no longer flagged as a second Warlord now that BSData doesn't add it.
    for (const m of policy.mustBeWarlord) {
      const unique = alone(m, [true, false]).filter((i) => i.rule === 'unique' && i.subject.name.trim() === m.entryName);
      expect(unique.map((i) => [i.limit, i.actual]), m.entryName).toEqual([[1, 2]]);
    }
  });

  test('must-be-warlord.json ships in policy.json and its names are checked at build', () => {
    expect(policy.mustBeWarlord.map((m) => m.entryName)).toEqual(expect.arrayContaining(['Magnus the Red', 'Mortarion', 'Abaddon the Despoiler', 'Angron']));
    const files = realFiles(...catalogues.map((c) => c.slug));
    const withEntries = (entries: unknown) => {
      const dir = mkdtempSync(join(tmpdir(), 'recruit-overrides-'));
      cpSync(join(import.meta.dirname, '..', 'overrides'), dir, { recursive: true });
      writeFileSync(join(dir, 'must-be-warlord.json'), JSON.stringify(entries));
      return () => loadPolicy(dir, files);
    };
    const magnusEntry = entry('Magnus the Red').id;
    expect(withEntries([{ catalogueName: 'No Such Army', entryId: magnusEntry, entryName: 'Magnus the Red', source: 't' }])).toThrow('must-be-warlord.json (Magnus the Red) names unknown catalogue "No Such Army"');
    expect(withEntries([{ catalogueName: 'Chaos - Thousand Sons', entryId: magnusEntry, entryName: 'Mortarion', source: 't' }])).toThrow('must-be-warlord.json (Mortarion): "Mortarion" is not root entry');
  });
});
