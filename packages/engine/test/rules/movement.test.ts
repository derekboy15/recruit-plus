import { describe, expect, test } from 'vitest';
import { stateOf, TERRAIN_PRESETS, type Command, type GameRecord, type Pos, type TerrainFeature } from '../../src';
import { flyer, guardsmen, knight, marines, model, sheet, weapon } from '../fixtures/units';
import { at, expectRejected, FULL_ZONES, line, newTestGame, placeAll, play, shift, teleport, unitInput, type TestGameOpts } from '../helpers/game';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];
const begin = (unitId: string, kind: 'normal' | 'advance' | 'fall-back', by: 'A' | 'B' = 'A') => ({ type: 'beginMove', by, unitId, kind }) as Command;
const complete = (unitId: string, moves: Record<string, { to: Pos; path?: { x: number; y: number }[] }>, by: 'A' | 'B' = 'A') =>
  ({ type: 'completeMove', by, unitId, moves }) as Command;
const toMovement = (g: GameRecord) => play(g, { type: 'endPhase', by: 'A' } as Command);
const jumpers = () =>
  sheet({ id: 'jump', name: 'Assault Squad', keywords: ['INFANTRY', 'FLY', 'JUMP PACK'], models: [model('Assault Marine', { M: 12, W: 1 })], weapons: [weapon('Chainsword', {})] });

/** A in the south half, B far north; both can be placed anywhere. */
function game(o: TestGameOpts & { at: Parameters<typeof placeAll>[1] }): GameRecord {
  return toMovement(placeAll(newTestGame({ zones: FULL_ZONES(), ...o }), o.at));
}
const basic = (extra: Partial<TestGameOpts> = {}) =>
  game({ a: [unitInput('a1', marines(), 5)], b: [unitInput('b1', guardsmen(), 5)], at: { a1: line(5, 10, 'a1'), b1: line(5, 50, 'b1') }, ...extra });

describe('Move Units', () => {
  test('[TS §3.1] Normal Move: up to M inches', () => {
    play(basic(), begin('a1', 'normal'), complete('a1', shift(basic(), 'a1', 0, 6)));
    expectRejected(play(basic(), begin('a1', 'normal')), complete('a1', shift(basic(), 'a1', 0, 6.1)), 'too-far');
  });

  test('[TS §3.1] Advance adds a D6 to the Move characteristic', () => {
    const g = play(basic({ dice: [4] }), begin('a1', 'advance'));
    play(g, complete('a1', shift(g, 'a1', 0, 10)));
    expectRejected(g, complete('a1', shift(g, 'a1', 0, 10.1)), 'too-far');
    expect(stateOf(play(g, complete('a1', shift(g, 'a1', 0, 8)))).units.a1.turn.moved).toBe('advance');
  });

  test('[TS §3.1] a Normal Move can not pass within Engagement Range of an enemy', () => {
    const g = game({ a: [unitInput('a1', marines(), 1)], b: [unitInput('b1', guardsmen(), 1)], at: { a1: { 'a1.m1': at(10, 15) }, b1: { 'b1.m1': at(10, 20) } } });
    const g2 = play(g, begin('a1', 'normal'));
    expectRejected(g2, complete('a1', { 'a1.m1': { to: at(12.5, 20), path: [{ x: 10.9, y: 19 }] } }), 'engagement-during-move');
  });

  test('[TS §3.1] a unit that starts within Engagement Range can only Fall Back or remain stationary', () => {
    const g = teleport(basic(), { 'b1.m1': at(5, 11.5) });
    expectRejected(g, begin('a1', 'normal'), 'engaged');
    expectRejected(g, begin('a1', 'advance'), 'engaged');
    play(g, begin('a1', 'fall-back'));
    play(g, { type: 'remainStationary', by: 'A', unitId: 'a1' } as Command);
  });

  test('[TS §3.1] only a unit that starts within Engagement Range can Fall Back', () => {
    expectRejected(basic(), begin('a1', 'fall-back'), 'not-engaged');
  });

  test('[TS §3.1] Fall Back may cross Engagement Range but must end outside it', () => {
    const g = play(teleport(basic(), { 'b1.m1': at(5, 11.5) }), begin('a1', 'fall-back'));
    expectRejected(g, complete('a1', shift(g, 'a1', 0, 0.3)), 'engagement-range');
    play(g, complete('a1', shift(g, 'a1', 0, -4)));
  });

  test('[TS §3.1] models can not move through other models', () => {
    const g = game({ a: [unitInput('a1', marines(), 1), unitInput('a2', marines(), 1)], at: { a1: { 'a1.m1': at(10, 10) }, a2: { 'a2.m1': at(10, 13) }, b1: line(5, 50, 'b1') } });
    expectRejected(play(g, begin('a1', 'normal')), complete('a1', { 'a1.m1': { to: at(10, 16) } }), 'through-models');
  });

  test('[GL §2] FLY models move over other models on a Normal Move', () => {
    const g = game({ a: [unitInput('a1', jumpers(), 1), unitInput('a2', marines(), 1)], at: { a1: { 'a1.m1': at(10, 10) }, a2: { 'a2.m1': at(10, 13) }, b1: line(5, 50, 'b1') } });
    play(g, begin('a1', 'normal'), complete('a1', { 'a1.m1': { to: at(10, 16) } }));
  });

  test('[TS §3.1] each unit can be selected to move once per phase', () => {
    const g = play(basic(), begin('a1', 'normal'), complete('a1', shift(basic(), 'a1', 0, 2)));
    expectRejected(g, begin('a1', 'normal'), 'already-moved');
  });

  test('[TS §3.1] a Normal Move can be called off before it is made; an Advance can not', () => {
    const g = play(basic(), begin('a1', 'normal'), { type: 'cancelMove', by: 'A', unitId: 'a1' } as Command);
    play(g, begin('a1', 'advance'));
    expectRejected(play(basic(), begin('a1', 'advance')), { type: 'cancelMove', by: 'A', unitId: 'a1' } as Command, 'advance-rolled');
  });

  test('[TS §3.1] models can not move off the battlefield', () => {
    expectRejected(play(basic(), begin('a1', 'normal')), complete('a1', shift(basic(), 'a1', -5.5, 0)), 'off-board');
  });

  test('[TS §1.2] a move that breaks coherency is rejected', () => {
    const g = play(basic(), begin('a1', 'normal'));
    expectRejected(g, complete('a1', { 'a1.m5': { to: at(11, 16) } }), 'coherency');
  });

  test('[TS §3.1] a model that starts overlapping may move clear but not stay', () => {
    const g = teleport(game({ a: [unitInput('a1', marines(), 1), unitInput('a2', marines(), 1)], at: { a1: { 'a1.m1': at(10, 10) }, a2: { 'a2.m1': at(20, 10) }, b1: line(5, 50, 'b1') } }), {
      'a1.m1': at(20.5, 10),
    });
    play(g, begin('a1', 'normal'), complete('a1', { 'a1.m1': { to: at(20.5, 14) } }));
    expectRejected(play(g, begin('a1', 'normal')), complete('a1', { 'a1.m1': { to: at(20.6, 10) } }), 'overlap');
  });

  test('[TS §3.1] units not moved by the end of the step Remained Stationary', () => {
    const g = play(basic(), { type: 'endStep', by: 'A' } as Command);
    expect(stateOf(g).units.a1.turn.moved).toBe('stationary');
  });
});

describe('terrain and movement', () => {
  const crater: TerrainFeature = { id: 'c', name: 'Crater', ...TERRAIN_PRESETS.craters, footprint: rect(0, 12, 44, 14), height: 0.5 };

  test('[TR §3.2] Difficult Ground: -2" to the Move characteristic', () => {
    const g = basic({ terrain: [crater] });
    expectRejected(play(g, begin('a1', 'normal')), complete('a1', shift(g, 'a1', 0, 5)), 'too-far');
    play(g, begin('a1', 'normal'), complete('a1', shift(g, 'a1', 0, 4)));
  });

  test('[TR §3.2] Difficult Ground is ignored if every model can FLY', () => {
    const g = game({ a: [unitInput('a1', jumpers(), 3)], terrain: [crater], at: { a1: line(5, 10, 'a1', 3), b1: line(5, 50, 'b1') } });
    play(g, begin('a1', 'normal'), complete('a1', shift(g, 'a1', 0, 12)));
  });

  test('[TR §3.2] TITANIC models ignore Difficult Ground under 3" tall', () => {
    const g = game({ a: [unitInput('k', knight())], terrain: [crater], at: { k: { 'k.m1': at(20, 8) }, b1: line(5, 50, 'b1') } });
    play(g, begin('k', 'normal'), complete('k', shift(g, 'k', 0, 12)));
  });

  test('[R-5] climbing counts vertical distance', () => {
    const box: TerrainFeature = { id: 'box', name: 'Containers', ...TERRAIN_PRESETS.containers, footprint: rect(0, 12, 44, 13), height: 2.5 };
    const g = basic({ terrain: [box] });
    expectRejected(play(g, begin('a1', 'normal')), complete('a1', shift(g, 'a1', 0, 4)), 'too-far'); // 4 + 2 × 2.5 = 9
  });
});

describe('Aircraft', () => {
  const air = () =>
    game({
      rules: { aircraftStartInReserves: false },
      a: [unitInput('f', flyer()), unitInput('a1', marines(), 5)],
      at: { f: { 'f.m1': at(20, 15) }, a1: line(5, 5, 'a1'), b1: line(5, 50, 'b1') },
    });

  test('[TS §3.5] an Aircraft must move at least its minimum Move', () => {
    const g = play(air(), begin('f', 'normal'));
    expectRejected(g, complete('f', { 'f.m1': { to: at(20, 30) } }), 'aircraft-minimum');
    play(g, complete('f', { 'f.m1': { to: at(20, 36) } }));
  });

  test('[TS §3.5] an Aircraft that has not moved stops the Move Units step ending', () => {
    expectRejected(air(), { type: 'endStep', by: 'A' } as Command, 'aircraft-must-move');
  });

  test('[TS §3.5] other models may move over an Aircraft but not end within its Engagement Range', () => {
    const g = game({
      rules: { aircraftStartInReserves: false },
      b: [unitInput('f', flyer()), unitInput('b1', guardsmen(), 5)],
      a: [unitInput('a1', marines(), 1)],
      at: { a1: { 'a1.m1': at(20, 10) }, f: { 'f.m1': at(20, 30) }, b1: line(5, 50, 'b1') },
    });
    const g2 = teleport(g, { 'f.m1': at(20, 12.8) }); // a1 now starts within the Aircraft's Engagement Range: it can still move
    play(g2, begin('a1', 'normal'), complete('a1', { 'a1.m1': { to: at(20, 16) } }));
    expectRejected(play(g2, begin('a1', 'normal')), complete('a1', { 'a1.m1': { to: at(18.5, 11) } }), 'engagement-range');
  });
});

describe('core stratagems in the Movement phase', () => {
  test('[CS §2] Cut Them Down: a D6 per model in Engagement Range, each 6 is a mortal wound', () => {
    let g = teleport(basic({ reactions: true, dice: [6, 3] }), { 'b1.m1': at(5, 11.4), 'b1.m2': at(6.5, 11.4) });
    g = play(g, begin('a1', 'fall-back'));
    expect(stateOf(g).pending).toMatchObject({ kind: 'reaction', reaction: 'cut-them-down', player: 'B' });
    g = play(g, { type: 'respond', by: 'B', choice: 'cut-them-down' } as Command);
    const s = stateOf(g);
    expect(s.cp.B).toBe(6);
    const wounded = s.units.a1.modelIds.map((id) => s.models[id]).filter((m) => m.woundsLeft === 1);
    expect(wounded).toHaveLength(1);
  });

  test('[CS §2] Desperate Breakout: 1s die, models still engaged at the end die, and the unit does nothing else', () => {
    // a1 (3 marines) surrounded by guardsmen.
    let g = game({
      a: [unitInput('a1', marines(), 3)],
      b: [unitInput('b1', guardsmen(), 10)],
      dice: [1, 4, 5],
      at: { a1: line(20, 30, 'a1', 3), b1: line(5, 50, 'b1', 10) },
    });
    g = teleport(g, {
      'b1.m1': at(19, 31.3), 'b1.m2': at(20.5, 31.3), 'b1.m3': at(22, 31.3), 'b1.m4': at(19, 28.7), 'b1.m5': at(20.5, 28.7), 'b1.m6': at(22, 28.7),
      'b1.m7': at(18.3, 30), 'b1.m8': at(24.6, 30),
    });
    g = play(g, { type: 'desperateBreakout', by: 'A', unitId: 'a1' } as Command);
    let s = stateOf(g);
    expect(s.cp.A).toBe(5);
    expect(s.units.a1.modelIds.filter((id) => s.models[id].destroyed)).toHaveLength(1);
    const alive = s.units.a1.modelIds.filter((id) => !s.models[id].destroyed);
    // One survivor runs clear through the guardsmen; the other stops next to them and is destroyed.
    g = play(g, complete('a1', { [alive[0]]: { to: at(20.5, 24.5) }, [alive[1]]: { to: at(21.5, 27.6) } }));
    s = stateOf(g);
    expect(s.units.a1.modelIds.filter((id) => s.models[id].destroyed)).toHaveLength(2);
    expect(s.units.a1.turn.brokeOut).toBe(true);
  });
});
