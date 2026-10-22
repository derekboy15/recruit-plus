import { describe, expect, test } from 'vitest';
import { dispatch, newGame, stateOf, type GameRecord } from '../../src';
import { strategicReservesCost } from '../../src/setup/deploy';
import { captain, flyer, guardsmen, marines, rhino, sheet, model } from '../fixtures/units';
import { at, deploy, expectRejected, newTestGame, play, placeAll, testSetup, unitInput, line } from '../helpers/game';

const cpOf = (g: GameRecord) => stateOf(g).cp;
/** A y inside B's deployment zone for the battle size. */
const farY = (size: string) => (size === 'onslaught' ? 82 : 52);

describe('starting the game', () => {
  test('[MP §2] starting CP by battle size: Combat Patrol 3, Onslaught 18', () => {
    expect(cpOf(newTestGame({ size: 'combat-patrol' })).A).toBe(3);
    expect(cpOf(newTestGame({ size: 'onslaught' })).A).toBe(18);
  });
  test('[GT §5] Arks of Omen: 6 CP at Incursion and Strike Force', () => {
    expect(cpOf(newTestGame({ size: 'incursion' }))).toEqual({ A: 6, B: 6 });
    expect(cpOf(newTestGame({ size: 'strike-force' }))).toEqual({ A: 6, B: 6 });
  });
  test('[GT §5] CP spent on Requisitions before the battle comes off the start', () => {
    const s = testSetup();
    s.armies[0].cpSpentPreBattle = 2;
    expect(cpOf(newGame(s))).toEqual({ A: 4, B: 6 });
  });
  test('[R-19] an invalid setup is refused', () => {
    const bad = testSetup();
    bad.armies[0].units[0].models[0].weapons = ['Laser of Doom'];
    expect(() => newGame(bad)).toThrow(/Laser of Doom/);
  });
});

describe('deployment', () => {
  const two = () => newTestGame({ a: [unitInput('a1', marines(), 5), unitInput('a2', marines(), 5)], b: [unitInput('b1', guardsmen(), 5)] });

  test('[MP §4] deployment alternates one unit at a time starting with the Defender', () => {
    const g = newTestGame({ a: [unitInput('a1', marines(), 5)], b: [unitInput('b1', guardsmen(), 5), unitInput('b2', guardsmen(), 5)] });
    expectRejected(g, deploy('A', 'a1', line(5, 5, 'a1')), 'not-your-deployment');
    const g2 = play(g, deploy('B', 'b1', line(5, 52, 'b1')));
    expectRejected(g2, deploy('B', 'b2', line(20, 52, 'b2')), 'not-your-deployment');
    play(g2, deploy('A', 'a1', line(5, 5, 'a1')));
  });

  test('[MP §4] a player who has finished lets the other deploy the rest', () => {
    const g = play(two(), deploy('B', 'b1', line(5, 52, 'b1')), deploy('A', 'a1', line(5, 5, 'a1')), deploy('A', 'a2', line(20, 5, 'a2')));
    expect(stateOf(g).step).toBe('first-turn');
  });

  test('[MP §4] models must be wholly within their deployment zone', () => {
    const g = play(two(), deploy('B', 'b1', line(5, 52, 'b1')));
    expectRejected(g, deploy('A', 'a1', line(5, 11.8, 'a1')), 'outside-deployment-zone');
  });

  test('[TS §1.3] models can not be set up within Engagement Range of enemy models', () => {
    // Zones that touch, so the enemy can be close.
    const g = newTestGame({
      a: [unitInput('a1', marines(), 1)],
      b: [unitInput('b1', guardsmen(), 1)],
      zones: { A: [{ x: 0, y: 0 }, { x: 44, y: 0 }, { x: 44, y: 30 }, { x: 0, y: 30 }], B: [{ x: 0, y: 30 }, { x: 44, y: 30 }, { x: 44, y: 60 }, { x: 0, y: 60 }] },
    });
    const g2 = play(g, deploy('B', 'b1', { 'b1.m1': at(10, 31) }));
    expectRejected(g2, deploy('A', 'a1', { 'a1.m1': at(10, 29.3) }), 'engagement-range');
  });

  test('[TS §1.2] a unit must be set up in coherency', () => {
    const g = play(two(), deploy('B', 'b1', line(5, 52, 'b1')));
    const spread = { ...line(5, 5, 'a1'), 'a1.m5': at(30, 5) };
    expectRejected(g, deploy('A', 'a1', spread), 'coherency');
  });

  test('[TS §3.4] a transport can be set up with a unit embarked', () => {
    const g = newTestGame({ a: [unitInput('t', rhino()), unitInput('m', marines(), 5)], b: [unitInput('b1', guardsmen(), 5)] });
    const g2 = play(g, deploy('B', 'b1', line(5, 52, 'b1')), { type: 'deploy', by: 'A', unitId: 't', positions: { 't.m1': at(10, 5) }, embarked: ['m'] });
    expect(stateOf(g2).units.m).toMatchObject({ location: 'embarked', embarkedIn: 't' });
    expect(stateOf(g2).step).toBe('first-turn');
  });

  test('[TS §3.4] embarking at set-up respects transport capacity', () => {
    const g = newTestGame({ a: [unitInput('t', rhino()), unitInput('m', marines(), 10), unitInput('n', marines(), 5)], b: [unitInput('b1', guardsmen(), 5)] });
    const g2 = play(g, deploy('B', 'b1', line(5, 52, 'b1')));
    expectRejected(g2, { type: 'deploy', by: 'A', unitId: 't', positions: { 't.m1': at(10, 5) }, embarked: ['m', 'n'] }, 'transport-full');
  });
});

describe('reserves', () => {
  test('[TS §3.3] Strategic Reserves cost by combined Power Rating', () => {
    expect([1, 9, 10, 19, 20, 25, 40, 41, 55].map(strategicReservesCost)).toEqual([1, 1, 2, 2, 3, 3, 5, 5, 6]);
    expect(strategicReservesCost(0)).toBe(0);
  });

  test('[TS §3.3] Core Book: placing units into Strategic Reserves costs CP', () => {
    const g = newTestGame({ size: 'onslaught', a: ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => unitInput(id, marines(), 5)) });
    const g2 = play(g, { type: 'declareReserves', by: 'A', unitIds: ['a1'], kind: 'strategic' });
    expect(cpOf(g2).A).toBe(17); // PR 5 → 1 CP
    const g3 = play(g2, { type: 'declareReserves', by: 'A', unitIds: ['a2'], kind: 'strategic' });
    expect(cpOf(g3).A).toBe(16); // PR 10 → 2 CP in total
  });

  test('[GT §5] Arks of Omen: Strategic Reserves cost no CP', () => {
    const g = newTestGame({ a: ['a1', 'a2', 'a3'].map((id) => unitInput(id, marines(), 5)) });
    expect(cpOf(play(g, { type: 'declareReserves', by: 'A', unitIds: ['a1'], kind: 'strategic' })).A).toBe(6);
  });

  test('[TS §3.3] Fortifications can never go into Strategic Reserves', () => {
    const bunker = sheet({ id: 'bunker', name: 'Bunker', role: 'Fortification', keywords: ['BUILDING', 'VEHICLE'], models: [model('Bunker', { W: 10 })], weapons: [] });
    const g = newTestGame({ a: [unitInput('f', bunker), unitInput('a1', marines(), 5), unitInput('a2', marines(), 5)] });
    expectRejected(g, { type: 'declareReserves', by: 'A', unitIds: ['f'], kind: 'strategic' }, 'fortification-reserves');
  });

  test('[MP §4] no more than half the units and less than half the points off the table', () => {
    const g = newTestGame({ a: [unitInput('a1', marines(), 5), unitInput('a2', marines(), 5), unitInput('a3', guardsmen(), 5)] });
    // 2 of 3 units is more than half.
    expectRejected(g, { type: 'declareReserves', by: 'A', unitIds: ['a1', 'a2'], kind: 'deep-strike' }, 'too-many-in-reserve');
    // 1 of 3 units but 100 of 255 pts... allowed; the second unit breaks the points limit too.
    const g2 = play(g, { type: 'declareReserves', by: 'A', unitIds: ['a1'], kind: 'deep-strike' });
    expectRejected(g2, { type: 'declareReserves', by: 'A', unitIds: ['a3'], kind: 'deep-strike' }, 'too-many-in-reserve');
  });

  test('[BD §6] Aircraft must start in Strategic Reserves', () => {
    const g = newTestGame({ a: [unitInput('f', flyer()), unitInput('a1', marines(), 5), unitInput('a2', marines(), 5)] });
    expect(stateOf(g).units.f).toMatchObject({ location: 'reserves', reserveKind: 'strategic' });
    expectRejected(play(g, deploy('B', 'b1', line(5, 52, 'b1'))), deploy('A', 'f', { 'f.m1': at(20, 6) }), 'aircraft-in-reserves');
  });
});

describe('first turn', () => {
  const ready = (size: 'onslaught' | 'strike-force') =>
    play(newTestGame({ size, a: [unitInput('a1', marines(), 5)], b: [unitInput('b1', guardsmen(), 5)], firstTurn: null }), deploy('B', 'b1', line(5, farY(size), 'b1')), deploy('A', 'a1', line(5, 5, 'a1')));

  test('[MP §4] Core Book: the roll-off winner chooses who goes first', () => {
    const g = play(ready('onslaught'), { type: 'rollOffFirstTurn', by: 'A' });
    const s = stateOf(g);
    expect(s.firstPlayer).toBeNull();
    const winner = s.rollOffWinner!;
    expectRejected(g, { type: 'chooseFirstTurn', by: winner === 'A' ? 'B' : 'A', first: 'A' }, 'not-roll-off-winner');
    const g2 = play(g, { type: 'chooseFirstTurn', by: winner, first: winner === 'A' ? 'B' : 'A' });
    expect(stateOf(g2).firstPlayer).toBe(winner === 'A' ? 'B' : 'A');
  });

  test('[GT §2] Arks of Omen: the roll-off winner goes first', () => {
    const g = play(ready('strike-force'), { type: 'rollOffFirstTurn', by: 'A' });
    expect(stateOf(g).firstPlayer).toBe(stateOf(g).rollOffWinner);
  });

  test('[TS §1.6] roll-off ties are rolled again', () => {
    const g = play(newTestGame({ a: [unitInput('a1', marines(), 1)], b: [unitInput('b1', guardsmen(), 1)], dice: [4, 4, 2, 5], firstTurn: null }), deploy('B', 'b1', { 'b1.m1': at(5, 52) }), deploy('A', 'a1', { 'a1.m1': at(5, 5) }), { type: 'rollOffFirstTurn', by: 'A' });
    expect(stateOf(g).rollOffWinner).toBe('B');
  });

  test('[TS §1.9] beginBattle starts battle round 1 with the first player\'s Command phase', () => {
    const g = play(ready('strike-force'), { type: 'rollOffFirstTurn', by: 'A' }, { type: 'beginBattle', by: 'A' });
    const s = stateOf(g);
    expect(s).toMatchObject({ round: 1, turn: 'first', phase: 'command', active: s.firstPlayer });
  });

  test('[GT §5] a Dedicated Transport deployed empty counts as destroyed in Arks of Omen, not in Core Book games', () => {
    const run = (size: 'onslaught' | 'strike-force') =>
      stateOf(play(newTestGame({ size, a: [unitInput('t', rhino())], b: [unitInput('b1', guardsmen(), 5)] }), deploy('B', 'b1', line(5, farY(size), 'b1')), deploy('A', 't', { 't.m1': at(10, 5) }))).units.t.location;
    expect(run('strike-force')).toBe('destroyed');
    expect(run('onslaught')).toBe('battlefield');
  });

  test('[MP §4] placeAll deploys everything and starts the battle with A going first', () => {
    const g = placeAll(newTestGame({ a: [unitInput('a1', marines(), 5), unitInput('c', captain())], b: [unitInput('b1', guardsmen(), 10)] }), {
      a1: line(5, 5, 'a1'),
      c: { 'c.m1': at(20, 5) },
      b1: line(5, 52, 'b1', 10),
    });
    expect(stateOf(g)).toMatchObject({ round: 1, phase: 'command', active: 'A' });
    expect(dispatch(g, { type: 'beginBattle', by: 'A' }).ok).toBe(false);
  });
});
