import { describe, expect, test } from 'vitest';
import {
  feelNoPain,
  registerContinuation,
  registerHandler,
  startAttacks,
  stateOf,
  TERRAIN_PRESETS,
  type AttackGroup,
  type Command,
  type GameRecord,
  type TerrainFeature,
  type WeaponProfile,
} from '../../src';
import { boltRifle, guardsmen, marines, model, sheet, tank, weapon } from '../fixtures/units';
import { at, FULL_ZONES, line, newTestGame, placeAll, play, setTurnFlag, unitInput, type TestGameOpts } from '../helpers/game';

// A test-only command that starts an attack sequence directly (shooting and fighting build groups in Tasks 13 and 16).
registerContinuation('test', 'attacksDone', () => {});
registerHandler('testAttack' as never, (ctx, cmd: { groups: AttackGroup[] }) => {
  startAttacks(ctx, cmd.groups, 'shooting', { module: 'test', step: 'attacksDone', data: {} });
});
const attack = (groups: Partial<AttackGroup>[]) =>
  ({
    type: 'testAttack',
    by: 'A',
    groups: groups.map((g) => ({ attackerUnitId: 'a1', modelIds: ['a1.m1'], weapon: boltRifle, targetUnitId: 'b1', melee: false, targetModels: 10, hitMods: [], ...g })),
  }) as unknown as Command;

/** A: 1 shooter (BS3 marine, or `attacker`); B: 10 marines (T4 W2 Sv3) 20" away. */
function game(o: TestGameOpts & { attacker?: Parameters<typeof unitInput>[1] } = {}): GameRecord {
  const g = newTestGame({ zones: FULL_ZONES(), a: [unitInput('a1', o.attacker ?? marines(), 1)], b: [unitInput('b1', marines(), 10)], ...o });
  return placeAll(g, { a1: { 'a1.m1': at(20, 10) }, b1: line(15, 30, 'b1', 10) });
}
const gun = (w: Partial<WeaponProfile>): WeaponProfile => ({ ...boltRifle, name: 'Test gun', ...w });
const alive = (g: GameRecord, unit = 'b1') => stateOf(g).units[unit].modelIds.map((id) => stateOf(g).models[id]).filter((m) => !m.destroyed);
const wounds = (g: GameRecord) => Object.fromEntries(alive(g).map((m) => [m.id, m.woundsLeft]));

describe('the attack sequence', () => {
  test('[TS §5.6] hit, wound, save and damage with fixed dice', () => {
    // 2 attacks: hits on 3+ (rolls 3, 2), S4 v T4 wounds on 4+ (rolls 4), save 3+ at AP-1 → 4+ (rolls 3: fails), D1.
    const g = play(game({ dice: [3, 2, 4, 3] }), attack([{ weapon: gun({ shots: { n: 0, sides: 6, plus: 2 } }) }]));
    expect(stateOf(g).models['b1.m10'].woundsLeft).toBe(1);
    expect(stateOf(g).attack).toBeNull();
  });

  test('[TS §5.6] an attack must go to the model that has already lost wounds', () => {
    let g = play(game({ dice: [3, 4, 3] }), { type: 'inflictMortalWounds', by: 'A', unitId: 'b1', count: 1 } as Command);
    const hurt = alive(g).find((m) => m.woundsLeft === 1)!.id;
    g = play(g, attack([{ weapon: gun({ d: { n: 0, sides: 6, plus: 1 } }) }]));
    expect(stateOf(g).models[hurt].destroyed).toBe(true);
    expect(alive(g)).toHaveLength(9);
    expect(alive(g).every((m) => m.woundsLeft === 2)).toBe(true);
  });

  test('[TS §5.6] a model that saved an allocated attack keeps receiving attacks', () => {
    // Two attacks hit (5, 6) and wound (5, 5); the first save passes (6), the second fails (2): both went to one model.
    const g = play(game({ dice: [5, 6, 5, 5, 6, 2] }), attack([{ weapon: gun({ shots: { n: 0, sides: 6, plus: 2 } }) }]));
    expect(Object.values(wounds(g)).filter((w) => w === 1)).toHaveLength(1);
  });

  test('[TS §5.6] excess damage from one attack is lost', () => {
    // 1 hit, 1 wound, failed save, D3 rolls 3 (a 6) on a W2 model: one model dies, nobody else is hurt.
    const g = play(game({ dice: [6, 6, 1, 6] }), attack([{ weapon: gun({ d: { n: 1, sides: 3, plus: 0 } }) }]));
    expect(alive(g)).toHaveLength(9);
    expect(alive(g).every((m) => m.woundsLeft === 2)).toBe(true);
  });

  test('[TS §5.8] mortal wounds carry over to the next model', () => {
    const g = play(game(), { type: 'inflictMortalWounds', by: 'A', unitId: 'b1', count: 3 } as Command);
    expect(alive(g)).toHaveLength(9);
    expect(Object.values(wounds(g)).filter((w) => w === 1)).toHaveLength(1);
  });

  test('[FAQ §2.1] mortal wounds inflicted during an attack are applied after its normal damage', () => {
    let g = play(game({ windows: true, dice: [6, 6, 1, 1] }), attack([{ weapon: gun({}) }]));
    // The hit roll is waiting; a rule inflicts 1 mortal wound now.
    g = play(g, { type: 'inflictMortalWounds', by: 'A', unitId: 'b1', count: 1 } as Command);
    expect(Object.values(wounds(g)).every((w) => w === 2)).toBe(true);
    for (let i = 0; i < 3; i++) g = play(g, { type: 'confirmRoll', by: stateOf(g).pending!.player } as Command);
    const events = g.batches[g.batches.length - 1].events.filter((e) => e.type === 'woundsLost') as { mortal: boolean }[];
    expect(events.map((e) => e.mortal)).toEqual([false, true]);
  });

  test('[TS §5.9] only one Feel No Pain per wound: the best one', () => {
    let g = game();
    for (const value of [6, 5])
      g = play(g, { type: 'addEffect', by: 'B', effect: { unitId: 'b1', side: 'defending', effect: { kind: 'fnp', value }, until: 'turn', note: '' } } as Command);
    expect(feelNoPain(stateOf(g), 'b1')).toBe(5);
  });

  test('[TS §5.9] Feel No Pain stops a wound being lost', () => {
    let g = play(game({ dice: [6, 6, 1, 5] }), { type: 'addEffect', by: 'B', effect: { unitId: 'b1', side: 'defending', effect: { kind: 'fnp', value: 5 }, until: 'turn', note: '' } } as Command);
    g = play(g, attack([{ weapon: gun({}) }]));
    expect(Object.values(wounds(g)).every((w) => w === 2)).toBe(true);
  });

  test('[TS §1.1] a vehicle\'s degrading profile: on 5 wounds the tank hits on 4+', () => {
    let g = game({ attacker: tank(), dice: [3] });
    g = play(g, { type: 'inflictMortalWounds', by: 'B', unitId: 'a1', count: 6 } as Command);
    g = play(g, attack([{ weapon: tank().weapons[0] }]));
    expect(Object.values(wounds(g)).every((w) => w === 2)).toBe(true); // a 3 misses at BS4
  });

  test('[CS §2] the save roll belongs to the defender: their Command Re-roll', () => {
    let g = play(game({ windows: true, dice: [6, 6, 2] }), attack([{ weapon: gun({}) }]));
    g = play(g, { type: 'confirmRoll', by: 'A' } as Command, { type: 'confirmRoll', by: 'A' } as Command);
    expect(stateOf(g).pending).toMatchObject({ kind: 'roll', player: 'B' });
    expect(stateOf(g).rolls[(stateOf(g).pending as { rollId: string }).rollId].kind).toBe('save');
  });

  test('[TS §1.6] a re-roll failed wound rolls effect re-rolls the failures once', () => {
    let g = play(game({ dice: [6, 2, 5, 1] }), { type: 'addEffect', by: 'A', effect: { unitId: 'a1', side: 'attacking', effect: { kind: 'reroll', roll: 'wound', which: 'failed' }, until: 'turn', note: '' } } as Command);
    g = play(g, attack([{ weapon: gun({}) }]));
    expect(Object.values(wounds(g)).filter((w) => w === 1)).toHaveLength(1);
  });

  test('[TS §5.6] +1 to hit and -1 to hit from both sides cancel; the net is capped', () => {
    // BS3 with three -1s still needs only a 4.
    const g = play(game({ dice: [4, 6, 1] }), attack([{ weapon: gun({}), hitMods: [{ source: 'a', value: -1 }, { source: 'b', value: -1 }, { source: 'c', value: -1 }] }]));
    expect(Object.values(wounds(g)).filter((w) => w === 1)).toHaveLength(1);
  });

  test('[TR §3.1] Heavy Cover: +1 to armour saves against melee, but not for a model that charged this turn', () => {
    const barricade: TerrainFeature = { id: 'bar', name: 'Barricade', ...TERRAIN_PRESETS.barricades, footprint: [{ x: 14, y: 28 }, { x: 30, y: 28 }, { x: 30, y: 28.5 }, { x: 14, y: 28.5 }], height: 1.5 };
    const melee = weapon('Chainsword', { ap: 0 });
    // save 3+ with Heavy Cover: a 2 passes.
    const g1 = play(game({ terrain: [barricade], dice: [6, 6, 2] }), attack([{ weapon: melee, melee: true, attacksPerModel: { 'a1.m1': 1 } }]));
    expect(Object.values(wounds(g1)).every((w) => w === 2)).toBe(true);
    const g2 = setTurnFlag(game({ terrain: [barricade], dice: [6, 6, 2] }), 'b1', 'charged', true);
    const g3 = play(g2, attack([{ weapon: melee, melee: true, attacksPerModel: { 'a1.m1': 1 } }]));
    expect(Object.values(wounds(g3)).filter((w) => w === 1)).toHaveLength(1);
  });

  test('[R-21] a Daemonic Save ignores AP', () => {
    const daemons = sheet({ id: 'd', name: 'Bloodletters', keywords: ['INFANTRY'], models: [model('Bloodletter', { W: 1, Sv: null, T: 3 })], weapons: [] });
    daemons.models[0].chars.daemonicSave = { melee: 5, ranged: 4 };
    let g = newTestGame({ zones: FULL_ZONES(), a: [unitInput('a1', marines(), 1)], b: [unitInput('b1', daemons, 5)], dice: [6, 6, 4] });
    g = placeAll(g, { a1: { 'a1.m1': at(20, 10) }, b1: line(15, 30, 'b1', 5) });
    g = play(g, attack([{ weapon: gun({ ap: -3 }), targetModels: 5 }]));
    expect(alive(g)).toHaveLength(5);
  });

  test('[TS §5.1] attacks at a unit with no models left are lost', () => {
    let g = play(game(), { type: 'inflictMortalWounds', by: 'A', unitId: 'b1', count: 20 } as Command);
    g = play(g, attack([{ weapon: gun({}) }]));
    expect(stateOf(g).attack).toBeNull();
  });
});
