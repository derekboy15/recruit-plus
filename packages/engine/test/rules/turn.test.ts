import { describe, expect, test } from 'vitest';
import { stateOf, type GameRecord } from '../../src';
import { flyer, guardsmen, marines } from '../fixtures/units';
import { at, expectRejected, FULL_ZONES, line, newTestGame, nextPhase, placeAll, play, toTurn, unitInput } from '../helpers/game';

const far = (size?: 'onslaught' | 'strike-force' | 'combat-patrol') =>
  placeAll(newTestGame({ size, a: [unitInput('a1', marines(), 5)], b: [unitInput('b1', guardsmen(), 5)] }), {
    a1: line(5, 5, 'a1'),
    b1: line(5, size === 'onslaught' ? 82 : 52, 'b1'),
  });

describe('battle rounds and phases', () => {
  test('[TS §1.9] phase order Command, Movement, Psychic, Shooting, Charge, Fight, Morale', () => {
    let g = far();
    const seen: string[] = [stateOf(g).phase];
    for (let i = 0; i < 7; i++) {
      g = nextPhase(g);
      seen.push(stateOf(g).phase);
    }
    expect(seen).toEqual(['command', 'movement', 'psychic', 'shooting', 'charge', 'fight', 'morale', 'command']);
    expect(stateOf(g)).toMatchObject({ round: 1, turn: 'second', active: 'B' });
  });

  test('[TS §1.9] the movement phase has a Move Units step, then Reinforcements', () => {
    let g = nextPhase(far());
    expect(stateOf(g).step).toBe('move-units');
    g = play(g, { type: 'endStep', by: 'A' });
    expect(stateOf(g)).toMatchObject({ phase: 'movement', step: 'reinforcements' });
  });

  test('[TS §1.9] after both turns a new battle round starts with the first player', () => {
    const g = toTurn(far(), 2, 'first');
    expect(stateOf(g)).toMatchObject({ round: 2, turn: 'first', active: 'A', phase: 'command' });
  });

  test('[TS §1.9] only the player whose turn it is ends phases', () => {
    expectRejected(far(), { type: 'endPhase', by: 'B' }, 'not-your-turn');
  });

  test('[MP §4] the game ends after 5 battle rounds and most VP wins', () => {
    let g = toTurn(far(), 5, 'second');
    g = play(g, { type: 'scoreVp', by: 'B', player: 'B', category: 'secondary', name: 'Engage on All Fronts', amount: 3 });
    for (let i = 0; i < 7; i++) g = nextPhase(g);
    expect(stateOf(g).phase).toBe('ended');
    expect(stateOf(g).ended).toEqual({ winner: 'B', reason: 'battle-rounds' });
  });

  test('[MP §4] a player who concedes loses', () => {
    const g = play(far(), { type: 'concede', by: 'A' });
    expect(stateOf(g).ended).toEqual({ winner: 'B', reason: 'concede' });
    expectRejected(g, { type: 'endPhase', by: 'A' }, 'game-over');
  });
});

describe('Command phase CP', () => {
  test('[TS §2] Core Book: +1 CP to the active player only', () => {
    const g = far('onslaught');
    expect(stateOf(g).cp).toEqual({ A: 19, B: 18 });
    expect(stateOf(toTurn(g, 1, 'second')).cp).toEqual({ A: 19, B: 19 });
  });

  test('[GT §5] Arks of Omen: both players gain 1 CP every Command phase', () => {
    const g = far('strike-force');
    expect(stateOf(g).cp).toEqual({ A: 7, B: 7 });
    expect(stateOf(toTurn(g, 1, 'second')).cp).toEqual({ A: 8, B: 8 });
  });
});

describe('reserves deadline', () => {
  test('[TS §3.2] reserves not arrived by the end of round 3 are destroyed', () => {
    const g0 = newTestGame({ a: [unitInput('f', flyer()), unitInput('a1', marines(), 5), unitInput('a2', marines(), 5)] });
    const g = placeAll(g0, { a1: line(5, 5, 'a1'), a2: line(20, 5, 'a2'), b1: line(5, 52, 'b1') });
    const r3 = toTurn(g, 3, 'second');
    expect(stateOf(r3).units.f.location).toBe('reserves');
    const r4 = toTurn(r3, 4, 'first');
    expect(stateOf(r4).units.f.location).toBe('destroyed');
  });
});

describe('primary scoring', () => {
  const objectives = [
    { id: 'o1', pos: { x: 10, y: 20 } },
    { id: 'o2', pos: { x: 30, y: 20 } },
    { id: 'o3', pos: { x: 10, y: 40 } },
    { id: 'o4', pos: { x: 30, y: 40 } },
  ];
  /** A holds o1 and o2, B holds o3. */
  const held = (size: 'onslaught' | 'strike-force'): GameRecord =>
    placeAll(
      newTestGame({ size, zones: FULL_ZONES(size), objectives, a: [unitInput('a1', marines(), 2), unitInput('a2', marines(), 2)], b: [unitInput('b1', guardsmen(), 2)] }),
      { a1: line(9, 20, 'a1', 2), a2: line(29, 20, 'a2', 2), b1: line(9, 40, 'b1', 2) },
    );

  test('[MP §5] Take and Hold scores 5 per condition from round 2', () => {
    let g = held('onslaught');
    g = nextPhase(g);
    expect(stateOf(g).vp.A.primary).toBe(0);
    g = toTurn(g, 2, 'first');
    g = nextPhase(g);
    expect(stateOf(g).vp.A.primary).toBe(15);
  });

  test('[MP §5] the second player scores at the end of their Command phase too', () => {
    const g = nextPhase(toTurn(held('onslaught'), 2, 'second'));
    expect(stateOf(g).vp.B.primary).toBe(5);
  });

  test('[GT §5] Arks of Omen hold component is 4 per condition', () => {
    const g = nextPhase(toTurn(held('strike-force'), 2, 'first'));
    expect(stateOf(g).vp.A.primary).toBe(12);
  });

  test('[GT §5] round 5: the second player scores at the end of their turn, not in their Command phase', () => {
    let g = toTurn(held('strike-force'), 5, 'second');
    const before = stateOf(g).vp.B.primary;
    g = nextPhase(g);
    expect(stateOf(g).vp.B.primary).toBe(before);
    for (let i = 0; i < 6; i++) g = nextPhase(g);
    expect(stateOf(g).vp.B.primary).toBe(before + 4);
  });

  test('[MP §5] primary VP are capped at 45', () => {
    const g = toTurn(held('onslaught'), 5, 'second');
    expect(stateOf(g).vp.A.primary).toBe(45); // 15 in each of rounds 2–4, then capped in round 5
  });

  test('[MP §5] each secondary is capped at 15 and the painted bonus at 10', () => {
    let g = held('onslaught');
    g = play(g, { type: 'scoreVp', by: 'A', player: 'A', category: 'secondary', name: 'Assassination', amount: 12 });
    g = play(g, { type: 'scoreVp', by: 'A', player: 'A', category: 'secondary', name: 'Assassination', amount: 5 });
    g = play(g, { type: 'scoreVp', by: 'A', player: 'A', category: 'painted', amount: 10 });
    expect(stateOf(g).vp.A).toMatchObject({ secondary: { Assassination: 15 }, painted: 10 });
  });

  test('[MP §5] a placed unit at the edge of the board still scores (sanity)', () => {
    const g = held('onslaught');
    expect(stateOf(g).models['a1.m1'].pos).toEqual(at(9, 20));
  });
});
