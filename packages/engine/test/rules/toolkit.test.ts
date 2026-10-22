import { describe, expect, test } from 'vitest';
import { objectiveControl, stateOf, undo, type Command, type GameRecord } from '../../src';
import { guardsmen, marines } from '../fixtures/units';
import { at, expectRejected, FULL_ZONES, line, newTestGame, nextPhase, placeAll, play, toTurn, unitInput, type TestGameOpts } from '../helpers/game';

const ok = (r: ReturnType<typeof undo>): GameRecord => {
  if (!r.ok) throw new Error(r.problems[0].message);
  return r.game;
};
/** A: 5 marines (a1) at y 10; B: 5 guardsmen (b1) at y 40. Starts in A's Command phase. */
const game = (o: TestGameOpts = {}) => placeAll(newTestGame({ zones: FULL_ZONES(), ...o }), { a1: line(5, 10, 'a1'), b1: line(5, 40, 'b1') });

describe('the manual adjust toolkit', () => {
  test('[R-19] moving a model by hand is logged and can be undone', () => {
    const g = play(game(), { type: 'placeModel', by: 'A', modelId: 'a1.m1', pos: at(5, 12) } as Command);
    expect(stateOf(g).models['a1.m1'].pos).toEqual(at(5, 12));
    expect(g.batches[g.batches.length - 1].command.type).toBe('placeModel');
    expect(stateOf(ok(undo(g))).models['a1.m1'].pos).toEqual(at(5, 10));
  });

  test('[R-19] a model placed by hand must be on the battlefield and not on another model', () => {
    expectRejected(game(), { type: 'placeModel', by: 'A', modelId: 'a1.m1', pos: at(-1, 12) } as Command, 'off-board');
    expectRejected(game(), { type: 'placeModel', by: 'A', modelId: 'a1.m1', pos: at(6.4, 10) } as Command, 'overlap');
  });

  test('[TS §10] repositioning a unit by hand fails its action', () => {
    let g = play(game(), { type: 'startAction', by: 'A', unitId: 'a1', action: { name: 'Hold', startPhase: 'command', completes: 'end-of-turn' } } as Command);
    g = play(g, { type: 'placeModel', by: 'A', modelId: 'a1.m1', pos: at(5, 12) } as Command);
    expect(stateOf(g).actions).toEqual({});
  });

  test('[R-19] add a model, return a destroyed one, remove one, set wounds', () => {
    let g = play(game(), { type: 'addModel', by: 'A', unitId: 'a1', profile: 'Intercessor', weapons: ['Bolt rifle'], pos: at(5, 11.5) } as Command);
    expect(stateOf(g).units.a1.modelIds).toContain('a1.m6');
    g = play(g, { type: 'removeModel', by: 'A', modelId: 'a1.m6', destroyed: true } as Command);
    expect(stateOf(g).models['a1.m6'].destroyed).toBe(true);
    g = play(g, { type: 'returnModel', by: 'A', modelId: 'a1.m6', pos: at(5, 11.5), countsAsDestroyed: true } as Command);
    expect(stateOf(g).models['a1.m6']).toMatchObject({ destroyed: false, woundsLeft: 2 });
    g = play(g, { type: 'setWounds', by: 'A', modelId: 'a1.m6', woundsLeft: 1 } as Command);
    expect(stateOf(g).models['a1.m6'].woundsLeft).toBe(1);
    expectRejected(g, { type: 'setWounds', by: 'A', modelId: 'a1.m6', woundsLeft: 3 } as Command, 'bad-wounds');
  });

  test('[TS §8.1] a model returned without counting as destroyed lowers the Morale test', () => {
    let g = play(game(), { type: 'inflictMortalWounds', by: 'B', unitId: 'a1', count: 4 } as Command);
    expect(stateOf(g).units.a1.turn.lostThisTurn).toBe(2);
    g = play(g, { type: 'returnModel', by: 'A', modelId: 'a1.m5', pos: at(11, 10), countsAsDestroyed: false } as Command);
    expect(stateOf(g).units.a1.turn.lostThisTurn).toBe(1);
  });

  test('[TS §5.8] mortal wounds by hand carry over between models', () => {
    const g = play(game(), { type: 'inflictMortalWounds', by: 'B', unitId: 'a1', count: 3 } as Command);
    const s = stateOf(g);
    expect(s.units.a1.modelIds.map((id) => s.models[id].woundsLeft)).toEqual([2, 2, 2, 1, 0]);
  });

  test('[R-19] replacing a die is only possible on the roll waiting for confirmation', () => {
    expectRejected(game(), { type: 'replaceDie', by: 'A', rollId: 'r1', index: 0, value: 6 } as Command, 'no-roll-window');
    let g = play(nextPhase(game({ windows: true, dice: [2] })), { type: 'beginMove', by: 'A', unitId: 'a1', kind: 'advance' } as Command);
    const rollId = (stateOf(g).pending as { rollId: string }).rollId;
    expectRejected(g, { type: 'replaceDie', by: 'A', rollId, index: 0, value: 7 } as Command, 'bad-value');
    g = play(g, { type: 'replaceDie', by: 'A', rollId, index: 0, value: 6 } as Command, { type: 'confirmRoll', by: 'A' } as Command);
    expect(stateOf(g).activation).toMatchObject({ kind: 'move', bonus: 6 });
  });

  test('[R-19] an extra activation lets a unit shoot again', () => {
    let g = game();
    for (let i = 0; i < 3; i++) g = nextPhase(g);
    g = play(g, { type: 'placeModel', by: 'B', modelId: 'b1.m1', pos: at(5, 25) } as Command);
    const shoot = { type: 'shoot', by: 'A', unitId: 'a1', assignments: [{ modelId: 'a1.m1', weapon: 'Bolt rifle', targetUnitId: 'b1' }] } as Command;
    g = play(g, shoot);
    expectRejected(g, shoot, 'already-shot');
    play(g, { type: 'extraActivation', by: 'A', unitId: 'a1', kind: 'shoot' } as Command, shoot);
  });

  test('[R-19] CP can be gained or spent by hand, never below 0, without the 1 CP limit', () => {
    let g = play(game(), { type: 'adjustCp', by: 'A', player: 'A', delta: 3 } as Command);
    expect(stateOf(g).cp.A).toBe(10);
    g = play(g, { type: 'adjustCp', by: 'A', player: 'A', delta: -20 } as Command);
    expect(stateOf(g).cp.A).toBe(0);
  });

  test('[MP §5] VP adjusted by hand still respect the 45 primary cap', () => {
    const g = play(game(), { type: 'adjustVp', by: 'A', player: 'A', category: 'primary', delta: 50 } as Command);
    expect(stateOf(g).vp.A.primary).toBe(45);
  });

  test('[TS §9] a sticky objective stays yours until the opponent controls it', () => {
    // A lone guardsman (b2) walks on and off the marker.
    let g = placeAll(newTestGame({ zones: FULL_ZONES(), objectives: [{ id: 'o1', pos: { x: 30, y: 25 } }], b: [unitInput('b1', guardsmen(), 5), unitInput('b2', guardsmen(), 1)] }), {
      a1: line(5, 10, 'a1'),
      b1: line(5, 40, 'b1'),
      b2: { 'b2.m1': at(35, 45) },
    });
    const on = { type: 'placeModel', by: 'B', modelId: 'b2.m1', pos: at(30, 26.5) } as Command;
    const off = { type: 'placeModel', by: 'B', modelId: 'b2.m1', pos: at(35, 45) } as Command;
    g = play(g, { type: 'setObjective', by: 'A', objectiveId: 'o1', owner: 'A', sticky: true } as Command);
    expect(objectiveControl(stateOf(g)).o1).toBe('A');
    g = play(g, on);
    expect(objectiveControl(stateOf(g)).o1).toBe('B');
    g = toTurn(play(g, off), 1, 'second');
    expect(objectiveControl(stateOf(g)).o1).toBe('A'); // B never held it at the end of a turn: still A's
    g = toTurn(play(g, on), 2, 'first');
    g = play(g, off);
    expect(objectiveControl(stateOf(g)).o1).toBeNull();
  });

  test('[R-14] the owner sets the order models are removed in, listing every model', () => {
    let g = play(game(), { type: 'setCasualtyOrder', by: 'A', unitId: 'a1', modelIds: ['a1.m1', 'a1.m2', 'a1.m3', 'a1.m4', 'a1.m5'] } as Command);
    g = play(g, { type: 'inflictMortalWounds', by: 'B', unitId: 'a1', count: 2 } as Command);
    expect(stateOf(g).models['a1.m1'].destroyed).toBe(true);
    expectRejected(game(), { type: 'setCasualtyOrder', by: 'A', unitId: 'a1', modelIds: ['a1.m1'] } as Command, 'every-model');
    expectRejected(game(), { type: 'setCasualtyOrder', by: 'B', unitId: 'a1', modelIds: ['a1.m1', 'a1.m2', 'a1.m3', 'a1.m4', 'a1.m5'] } as Command, 'not-your-unit');
  });

  test('[TS §9] a unit\'s Objective Secured can be switched off by hand', () => {
    const g = play(game({ objectives: [{ id: 'o1', pos: { x: 8, y: 12 } }] }), { type: 'setUnitFlag', by: 'A', unitId: 'a1', flag: 'objective-secured', value: false } as Command);
    expect(stateOf(g).units.a1.flags.objectiveSecured).toBe(false);
  });
});

export { guardsmen, marines, unitInput };
