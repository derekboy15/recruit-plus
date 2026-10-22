import { describe, expect, test } from 'vitest';
import { stateOf, type Command, type GameRecord } from '../../src';
import { flyer, guardsmen, marines } from '../fixtures/units';
import { at, expectRejected, FULL_ZONES, line, newTestGame, placeAll, play, setTurnFlag, shift, teleport, unitInput } from '../helpers/game';

const start = (unitId: string, startPhase: string, completes: 'end-of-turn' | 'end-of-phase' | 'immediately' = 'end-of-turn') =>
  ({ type: 'startAction', by: 'A', unitId, action: { name: 'Raise the Banners High', startPhase, completes } }) as Command;
const events = (g: GameRecord, type: string) => g.batches.flatMap((b) => b.events).filter((e) => e.type === type) as unknown as Record<string, unknown>[];
const endPhase = { type: 'endPhase', by: 'A' } as Command;

/** A: marines (a1) and guardsmen (a2); B: guardsmen far away. Starts in A's Command phase. */
const game = (o: Parameters<typeof newTestGame>[0] = {}) =>
  placeAll(newTestGame({ zones: FULL_ZONES(), a: [unitInput('a1', marines(), 5), unitInput('a2', guardsmen(), 5)], ...o }), { a1: line(5, 10, 'a1'), a2: line(20, 10, 'a2'), b1: line(5, 50, 'b1') });
const to = (g: GameRecord, n: number) => {
  for (let i = 0; i < n; i++) g = play(g, endPhase);
  return g;
};

describe('actions', () => {
  test('[TS §10] a unit can not start an action while within Engagement Range of an enemy', () => {
    expectRejected(teleport(to(game(), 3), { 'b1.m1': at(5, 11.2) }), start('a1', 'shooting'), 'engaged');
  });

  test('[TS §10] a unit that Advanced or Fell Back can not start an action', () => {
    expectRejected(setTurnFlag(to(game(), 3), 'a1', 'moved', 'advance'), start('a1', 'shooting'), 'advanced');
    expectRejected(setTurnFlag(to(game(), 3), 'a1', 'moved', 'fall-back'), start('a1', 'shooting'), 'fell-back');
  });

  test('[TS §10] Aircraft can not perform actions', () => {
    const g = placeAll(newTestGame({ zones: FULL_ZONES(), rules: { aircraftStartInReserves: false }, a: [unitInput('f', flyer()), unitInput('a1', marines(), 5)] }), { f: { 'f.m1': at(30, 20) }, a1: line(5, 10, 'a1'), b1: line(5, 50, 'b1') });
    expectRejected(g, start('f', 'command'), 'aircraft');
  });

  test('[TS §10] an action starts in the phase it says', () => {
    expectRejected(game(), start('a1', 'shooting'), 'wrong-phase');
  });

  test('[TS §10] a unit can only start one action per battle round', () => {
    const g = play(to(game(), 3), start('a1', 'shooting', 'immediately'));
    expectRejected(g, start('a1', 'shooting'), 'one-action-per-round');
  });

  test('[TS §10] shooting fails the action', () => {
    const g = play(teleport(to(game(), 3), { 'b1.m1': at(5, 20) }), start('a1', 'shooting'), { type: 'shoot', by: 'A', unitId: 'a1', assignments: [{ modelId: 'a1.m1', weapon: 'Bolt pistol', targetUnitId: 'b1' }] } as Command);
    expect(events(g, 'actionFailed')).toHaveLength(1);
  });

  test('[TS §10] the unit being destroyed fails the action', () => {
    const g = play(to(game(), 3), start('a1', 'shooting'), { type: 'inflictMortalWounds', by: 'B', unitId: 'a1', count: 10 } as Command);
    expect(events(g, 'actionFailed')).toHaveLength(1);
  });

  test('[TS §10] moving fails the action', () => {
    let g = play(to(game(), 1), start('a2', 'movement'));
    g = play(g, { type: 'beginMove', by: 'A', unitId: 'a2', kind: 'normal' } as Command, { type: 'completeMove', by: 'A', unitId: 'a2', moves: shift(g, 'a2', 0, 2) } as Command);
    expect(events(g, 'actionFailed')).toHaveLength(1);
  });

  test('[TS §10] an end-of-turn action completes at the end of the turn', () => {
    let g = play(to(game(), 3), start('a1', 'shooting'));
    expect(events(g, 'actionCompleted')).toHaveLength(0);
    g = to(g, 4);
    expect(events(g, 'actionCompleted')).toHaveLength(1);
    expect(stateOf(g).actions).toEqual({});
  });

  test('[TS §10] an end-of-phase action completes when the phase ends', () => {
    const g = play(to(game(), 3), start('a1', 'shooting', 'end-of-phase'), endPhase);
    expect(events(g, 'actionCompleted')).toHaveLength(1);
  });
});

export { guardsmen };
