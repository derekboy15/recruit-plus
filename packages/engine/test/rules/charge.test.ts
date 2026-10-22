import { describe, expect, test } from 'vitest';
import { effectsFor, stateOf, TERRAIN_PRESETS, type Command, type GameRecord, type Pos, type TerrainFeature } from '../../src';
import { captain, flyer, guardsmen, marines, model, sheet, weapon } from '../fixtures/units';
import { at, expectRejected, FULL_ZONES, line, newTestGame, placeAll, play, setTurnFlag, shift, teleport, unitInput, type TestGameOpts } from '../helpers/game';

const declare = (unitId: string, targetIds: string[]) => ({ type: 'declareCharge', by: 'A', unitId, targetIds }) as Command;
const move = (unitId: string, moves: Record<string, { to: Pos; path?: { x: number; y: number }[] }>) => ({ type: 'chargeMove', by: 'A', unitId, moves }) as Command;
const respond = (choice: string) => ({ type: 'respond', by: 'B', choice }) as Command;
const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const toCharge = (g: GameRecord) => {
  for (let i = 0; i < 4; i++) g = play(g, { type: 'endPhase', by: 'A' } as Command);
  return g;
};
const flamers = () => sheet({ id: 'fl', name: 'Flamer Team', keywords: ['INFANTRY'], models: [model('Trooper', { W: 1, Sv: 4 })], weapons: [weapon('Flamer', { type: 'Assault', range: 12, shots: '1', s: 4, autoHit: true })] });
const jumpers = () => sheet({ id: 'jump', name: 'Assault Squad', keywords: ['INFANTRY', 'FLY'], models: [model('Assault Marine', { M: 12, W: 1 })], weapons: [weapon('Chainsword', {})] });

/** A: 5 guardsmen (a1) at y 20; B: 1 marine (b1) at (17, 28) unless given. Skips to A's Charge phase. */
function game(o: TestGameOpts & { at?: Record<string, Record<string, Pos>> } = {}): GameRecord {
  const g = newTestGame({ zones: FULL_ZONES(), a: [unitInput('a1', guardsmen(), 5)], b: [unitInput('b1', marines(), 1)], ...o });
  return toCharge(placeAll(g, o.at ?? { a1: line(14, 20, 'a1'), b1: { 'b1.m1': at(17, 28) } }));
}
/** Moves putting a1 next to b1 at (17, 28): models in a row at y 26.83 (the middle one 0.05" from b1). */
const engageB1 = (n = 5): Record<string, { to: Pos }> => Object.fromEntries(Array.from({ length: n }, (_, i) => [`a1.m${i + 1}`, { to: at(14 + i * 1.5, 26.83) }]));

describe('declaring a charge', () => {
  test('[TS §6.1] a unit that Advanced or Fell Back can not charge', () => {
    expectRejected(setTurnFlag(game(), 'a1', 'moved', 'advance'), declare('a1', ['b1']), 'advanced');
    expectRejected(setTurnFlag(game(), 'a1', 'moved', 'fall-back'), declare('a1', ['b1']), 'fell-back');
  });

  test('[TS §6.1] charge targets must be within 12"', () => {
    expectRejected(game({ at: { a1: line(14, 10, 'a1'), b1: { 'b1.m1': at(17, 28) } } }), declare('a1', ['b1']), 'out-of-charge-range');
  });

  test('[TS §6.1] charge targets need not be visible', () => {
    const wall: TerrainFeature = { id: 'r', name: 'Ruin', ...TERRAIN_PRESETS.ruins, footprint: rect(0, 23, 44, 24), height: 6 };
    play(game({ terrain: [wall] }), declare('a1', ['b1']));
  });

  test('[TS §3.4] a unit that got out of a destroyed transport this turn can not charge', () => {
    expectRejected(setTurnFlag(game(), 'a1', 'disembarkedFromDestroyed', true), declare('a1', ['b1']), 'disembarked-from-destroyed');
  });

  test('[TS §3.5] an Aircraft can not charge the turn it arrives', () => {
    let g = placeAll(newTestGame({ zones: FULL_ZONES(), rules: { aircraftStartInReserves: false }, a: [unitInput('f', flyer())], b: [unitInput('b1', marines(), 1)] }), { f: { 'f.m1': at(20, 20) }, b1: { 'b1.m1': at(17, 28) } });
    g = setTurnFlag(setTurnFlag(g, 'f', 'arrived', true), 'f', 'moved', 'normal');
    expectRejected(toCharge(g), declare('f', ['b1']), 'aircraft-arrived');
  });
});

describe('Overwatch and Defensible terrain', () => {
  test('[CS §2] Fire Overwatch: 1 CP, and it hits only on unmodified 6s', () => {
    // Rapid Fire bolt rifle within half range: 2 shots, rolls 5 and 6 → 1 hit; wounds (3); the guardsman fails its save (1).
    let g = play(game({ reactions: true, dice: [5, 6, 3, 1, 6, 6] }), declare('a1', ['b1']));
    expect(stateOf(g).pending).toMatchObject({ kind: 'reaction', reaction: 'charge-declared', player: 'B' });
    const cp = stateOf(g).cp.B;
    g = play(g, respond('overwatch:b1'));
    const s = stateOf(g);
    expect(s.cp.B).toBe(cp - 1);
    expect(s.units.a1.modelIds.filter((id) => s.models[id].destroyed)).toHaveLength(1);
    expect(s.activation).toMatchObject({ kind: 'charge', roll: 12 });
  });

  test('[CS §2] auto-hitting weapons hit in Overwatch', () => {
    const g = play(play(game({ reactions: true, b: [unitInput('b1', flamers(), 1)], dice: [3, 1, 6, 6] }), declare('a1', ['b1'])), respond('overwatch:b1'));
    const s = stateOf(g);
    expect(s.units.a1.modelIds.filter((id) => s.models[id].destroyed)).toHaveLength(1);
  });

  test('[TS §6.1] Look Out, Sir does not protect a charging character from Overwatch', () => {
    const g = game({ reactions: true, a: [unitInput('c', captain()), unitInput('a1', guardsmen(), 5)], at: { c: { 'c.m1': at(17, 21) }, a1: line(12, 19, 'a1'), b1: { 'b1.m1': at(17, 28) } } });
    play(play(g, declare('c', ['b1'])), respond('overwatch:b1'));
  });

  test('[WCR] a unit within Engagement Range of an enemy can not fire Overwatch', () => {
    let g = game({ reactions: true, a: [unitInput('a1', guardsmen(), 5), unitInput('a2', guardsmen(), 1)], at: { a1: line(14, 20, 'a1'), a2: { 'a2.m1': at(35, 10) }, b1: { 'b1.m1': at(17, 28) } } });
    g = teleport(g, { 'a2.m1': at(17, 29.2) });
    g = play(g, declare('a1', ['b1']));
    expect(stateOf(g).pending).toBeNull(); // nothing to offer: b1 is engaged
  });

  test('[CS §1] Fire Overwatch can only be used once per phase', () => {
    let g = game({ reactions: true, dice: [1, 1, 1, 1, 1, 1, 1, 1], a: [unitInput('a1', guardsmen(), 5), unitInput('a2', guardsmen(), 5)], at: { a1: line(14, 20, 'a1'), a2: line(24, 20, 'a2'), b1: { 'b1.m1': at(17, 28) } } });
    g = play(g, declare('a1', ['b1']), respond('overwatch:b1'), { type: 'failCharge', by: 'A', unitId: 'a1' } as Command, declare('a2', ['b1']));
    expect(stateOf(g).pending).toBeNull();
  });

  test('[TR §3.3] Hold Steady: Overwatch hits on a 5+', () => {
    const woods: TerrainFeature = { id: 'w', name: 'Woods', ...TERRAIN_PRESETS.woods, footprint: rect(14, 26, 22, 31), height: 4 };
    const g = play(play(game({ reactions: true, terrain: [woods], dice: [5, 1, 3, 1, 6, 6] }), declare('a1', ['b1'])), respond('hold-steady:b1'));
    const s = stateOf(g);
    expect(s.units.a1.modelIds.filter((id) => s.models[id].destroyed)).toHaveLength(1);
  });

  test('[TR §3.3] Set to Defend: no Overwatch, +1 to hit in melee until the end of the next Fight phase', () => {
    const woods: TerrainFeature = { id: 'w', name: 'Woods', ...TERRAIN_PRESETS.woods, footprint: rect(14, 26, 22, 31), height: 4 };
    const g = play(play(game({ reactions: true, terrain: [woods], dice: [6, 6] }), declare('a1', ['b1'])), respond('set-to-defend:b1'));
    const s = stateOf(g);
    expect(effectsFor(s, 'b1', 'attacking')).toEqual([{ kind: 'mod', roll: 'hit', value: 1 }]);
    expect(s.cp.B).toBe(stateOf(game()).cp.B);
  });

  test('[TR §3.3] Hold Steady and Set to Defend need the whole infantry unit in Defensible terrain', () => {
    expectRejected(play(game({ reactions: true }), declare('a1', ['b1'])), respond('hold-steady:b1'), 'bad-choice');
  });
});

describe('the charge move', () => {
  test('[TS §6.1] a successful charge ends within Engagement Range of every target', () => {
    const g = play(game({ dice: [6, 6] }), declare('a1', ['b1']), move('a1', engageB1()));
    expect(stateOf(g).units.a1.turn).toMatchObject({ charged: true, chargeTargets: ['b1'] });
  });

  test('[TS §6.1] the charge must reach every target', () => {
    const g = game({ dice: [6, 6], b: [unitInput('b1', marines(), 1), unitInput('b2', marines(), 1)], at: { a1: line(14, 20, 'a1'), b1: { 'b1.m1': at(17, 28) }, b2: { 'b2.m1': at(30, 28) } } });
    expectRejected(play(g, declare('a1', ['b1', 'b2'])), move('a1', engageB1()), 'charge-not-reached');
  });

  test('[TS §6.1] a charge can not end within Engagement Range of a unit it did not target', () => {
    const g = game({ dice: [6, 6], b: [unitInput('b1', marines(), 1), unitInput('b2', marines(), 1)], at: { a1: line(14, 20, 'a1'), b1: { 'b1.m1': at(17, 28) }, b2: { 'b2.m1': at(21.5, 28) } } });
    expectRejected(play(g, declare('a1', ['b1'])), move('a1', engageB1()), 'charge-non-target');
  });

  test('[TS §6.1] a charge longer than the charge roll is refused; the player can call it off', () => {
    const g = play(game({ dice: [1, 2] }), declare('a1', ['b1']));
    expectRejected(g, move('a1', engageB1()), 'too-far');
    const failed = play(g, { type: 'failCharge', by: 'A', unitId: 'a1' } as Command);
    expect(stateOf(failed).units.a1.turn.charged).toBe(false);
    expect(stateOf(failed).activation).toBeNull();
  });

  test('[TR §3.2] Difficult Ground: -2 to the charge roll', () => {
    const crater: TerrainFeature = { id: 'c', name: 'Crater', ...TERRAIN_PRESETS.craters, footprint: rect(0, 22, 44, 24), height: 0.5 };
    expectRejected(play(game({ dice: [4, 4], terrain: [crater] }), declare('a1', ['b1'])), move('a1', engageB1()), 'too-far');
    play(game({ dice: [4, 4] }), declare('a1', ['b1']), move('a1', engageB1()));
  });

  test('[GL §2] FLY models charging pass over models but still climb terrain', () => {
    const box: TerrainFeature = { id: 'b', name: 'Containers', ...TERRAIN_PRESETS.containers, footprint: rect(0, 23, 44, 24), height: 3 };
    const g = game({ dice: [5, 5], terrain: [box], a: [unitInput('a1', jumpers(), 5)] });
    expectRejected(play(g, declare('a1', ['b1'])), move('a1', engageB1()), 'too-far'); // 7" + 6" of climbing
  });
});

describe('Heroic Interventions', () => {
  /** After a successful charge on b1, B's captain (c) stands 2.5" from the charger. */
  const charged = (o: TestGameOpts = {}) =>
    play(
      game({ dice: [6, 6], b: [unitInput('b1', marines(), 1), unitInput('c', captain())], at: { a1: line(14, 20, 'a1'), b1: { 'b1.m1': at(17, 28) }, c: { 'c.m1': at(22.8, 29.2) } }, ...o }),
      declare('a1', ['b1']),
      move('a1', engageB1()),
      { type: 'endStep', by: 'A' } as Command,
    );
  const hi = (moves: Record<string, { to: Pos }>, unitId = 'c', by: 'A' | 'B' = 'B') => ({ type: 'heroicIntervention', by, unitId, moves }) as Command;

  test('[TS §6.2] a character within 3" of an enemy moves up to 3", ending closer to the closest enemy model', () => {
    const g = play(charged(), hi({ 'c.m1': { to: at(21.5, 28.1) } }));
    expect(stateOf(g).units.c.turn.heroic).toBe(true);
  });

  test('[TS §6.2] a Heroic Intervention must end closer to the closest enemy model', () => {
    expectRejected(charged(), hi({ 'c.m1': { to: at(25, 30) } }), 'not-closer');
  });

  test('[TS §6.2] only CHARACTERS within 3" of an enemy unit can Heroically Intervene', () => {
    const g = play(game({ dice: [6, 6], b: [unitInput('b1', marines(), 1), unitInput('b2', marines(), 1)], at: { a1: line(14, 20, 'a1'), b1: { 'b1.m1': at(17, 28) }, b2: { 'b2.m1': at(22.8, 29.2) } } }), declare('a1', ['b1']), move('a1', engageB1()), { type: 'endStep', by: 'A' } as Command);
    expectRejected(g, hi({ 'b2.m1': { to: at(22, 28.2) } }, 'b2'), 'not-a-character');
  });

  test('[WCR] no Heroic Intervention in your own Charge phase', () => {
    expectRejected(charged(), hi({ 'a1.m5': { to: at(20, 27) } }, 'a1', 'A'), 'own-charge-phase');
  });

  test('[TS §6.2] a unit that got out of a destroyed transport this turn can not Heroically Intervene', () => {
    expectRejected(setTurnFlag(charged(), 'c', 'disembarkedFromDestroyed', true), hi({ 'c.m1': { to: at(21.5, 28.1) } }), 'disembarked-from-destroyed');
  });
});

export { shift };
