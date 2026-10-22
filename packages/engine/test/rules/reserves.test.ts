import { describe, expect, test } from 'vitest';
import { stateOf, type Command, type GameRecord, type Pos } from '../../src';
import { flyer, guardsmen, marines } from '../fixtures/units';
import { at, expectRejected, line, newTestGame, placeAll, play, teleport, toTurn, unitInput } from '../helpers/game';

const R32 = 16 / 25.4;
const R25 = 12.5 / 25.4;
const arrive = (unitId: string, positions: Record<string, Pos>) => ({ type: 'arrive', by: 'A', unitId, positions }) as Command;
/** n models of unit `u` in a column at x from y. */
const column = (x: number, y: number, u: string, n = 5): Record<string, Pos> => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${u}.m${i + 1}`, at(x, y + i * 1.5)]));

/** A: a1 deployed, a2 in Strategic Reserves (or Deep Strike), a3 deployed, a flyer in reserve; B guardsmen at x 30–36, y 50. */
function game(kind: 'strategic' | 'deep-strike' = 'strategic'): GameRecord {
  let g = newTestGame({ a: [unitInput('a1', marines(), 5), unitInput('a2', marines(), 5), unitInput('a3', marines(), 5), unitInput('f', flyer())] });
  g = play(g, { type: 'declareReserves', by: 'A', unitIds: ['a2'], kind } as Command);
  return placeAll(g, { a1: line(30, 5, 'a1'), a3: line(15, 5, 'a3'), b1: line(30, 50, 'b1') });
}
/** The given round's Reinforcements step of A's turn. */
const reinforcements = (g: GameRecord, round: number) =>
  play(toTurn(g, round, 'first'), { type: 'endPhase', by: 'A' } as Command, { type: 'endStep', by: 'A' } as Command);

describe('Strategic Reserves and Reinforcements', () => {
  test('[TS §3.3] no arrivals in battle round 1', () => {
    const g = play(game(), { type: 'endPhase', by: 'A' } as Command, { type: 'endStep', by: 'A' } as Command);
    expectRejected(g, arrive('a2', column(3, 25, 'a2')), 'too-early');
  });

  test('[TS §3.3] round 2: wholly within 6" of an edge that is not the enemy\'s', () => {
    const g = reinforcements(game(), 2);
    play(g, arrive('a2', column(3, 25, 'a2')));
    expectRejected(g, arrive('a2', column(8, 25, 'a2')), 'not-near-edge');
    expectRejected(g, arrive('a2', Object.fromEntries(Object.keys(column(3, 25, 'a2')).map((id, i) => [id, at(18 + i * 1.5, 57)]))), 'not-near-edge');
  });

  test('[TS §3.3] round 2: not in the enemy deployment zone', () => {
    expectRejected(reinforcements(game(), 2), arrive('a2', column(3, 49, 'a2')), 'enemy-zone');
  });

  test('[TS §3.3] round 3: the enemy deployment zone is allowed, still near a non-enemy edge', () => {
    play(reinforcements(game(), 3), arrive('a2', column(3, 49, 'a2')));
  });

  test('[FAQ §2.3] arriving units must be more than 9" horizontally from enemy models; exactly 9" is not enough', () => {
    const g = teleport(reinforcements(game(), 2), { 'b1.m1': at(13, 30) });
    expectRejected(g, arrive('a2', column(13 - 9 - R25 - R32 + 1e-9, 27, 'a2')), 'within-9');
    play(g, arrive('a2', column(13 - 9.1 - R25 - R32, 27, 'a2')));
  });

  test('[TS §1.4] a model on an upper floor still denies arrival in a horizontal circle below it', () => {
    const g = teleport(reinforcements(game(), 2), { 'b1.m1': at(13, 30, 5) });
    expectRejected(g, arrive('a2', column(13 - 8.5 - R25 - R32, 27, 'a2')), 'within-9');
  });

  test('[TS §3.3] arriving within 1" of your own edge, wholly in your zone, may end close to the enemy and counts as having charged', () => {
    const g = teleport(reinforcements(game(), 2), { 'b1.m1': at(20, 2.6) });
    const positions = Object.fromEntries(Object.keys(column(0, 0, 'a2')).map((id, i) => [id, at(17 + i * 1.5, 0.8)]));
    const s = stateOf(play(g, arrive('a2', positions)));
    expect(s.units.a2.turn).toMatchObject({ arrived: true, charged: true, countsAsCharged: true, chargeTargets: ['b1'] });
  });

  test('[TS §3.2] arrived units count as having moved and can not move again this phase', () => {
    const g = play(reinforcements(game('deep-strike'), 2), arrive('a2', column(22, 25, 'a2')));
    expect(stateOf(g).units.a2.turn).toMatchObject({ arrived: true, moved: 'normal' });
  });

  test('[GL §5] Deep Strike: anywhere more than 9" from enemy models', () => {
    const g = reinforcements(game('deep-strike'), 2);
    play(g, arrive('a2', column(22, 25, 'a2')));
    expectRejected(g, arrive('a2', column(32, 38, 'a2')), 'within-9');
  });

  test('[TS §3.5] Aircraft arrive anywhere more than 9" from enemies, can fly off into Strategic Reserves, and return next turn', () => {
    let g = play(reinforcements(game(), 2), arrive('f', { 'f.m1': at(22, 30) }));
    expect(stateOf(g).units.f.location).toBe('battlefield');
    g = play(toTurn(g, 3, 'first'), { type: 'endPhase', by: 'A' } as Command, { type: 'aircraftLeave', by: 'A', unitId: 'f' } as Command, { type: 'endStep', by: 'A' } as Command);
    expect(stateOf(g).units.f.location).toBe('reserves');
    expectRejected(g, arrive('f', { 'f.m1': at(22, 30) }), 'left-this-turn');
    play(reinforcements(g, 4), arrive('f', { 'f.m1': at(22, 30) }));
  });

  test('[R-23] an Aircraft that flew off is not destroyed by the reserves deadline', () => {
    let g = play(reinforcements(game(), 2), arrive('f', { 'f.m1': at(22, 30) }), arrive('a2', column(3, 25, 'a2')));
    g = play(toTurn(g, 3, 'first'), { type: 'endPhase', by: 'A' } as Command, { type: 'aircraftLeave', by: 'A', unitId: 'f' } as Command);
    expect(stateOf(toTurn(g, 4, 'first')).units.f.location).toBe('reserves');
  });
});
