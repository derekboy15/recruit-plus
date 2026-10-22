import { describe, expect, test } from 'vitest';
import { effectsFor, stateOf } from '../../src';
import { expectRejected, line, newTestGame, nextPhase, placeAll, play } from '../helpers/game';

const game = () => placeAll(newTestGame({}), { a1: line(5, 5, 'a1'), b1: line(5, 52, 'b1') });
const add = (until: string, effect: object = { kind: 'mod', roll: 'hit', value: 1 }) =>
  ({ type: 'addEffect', by: 'A', effect: { unitId: 'a1', side: 'attacking', effect, until, note: 'test' } }) as never;

describe('one-tap effects', () => {
  test('[R-19] an effect applies to its unit and side', () => {
    const s = stateOf(play(game(), add('turn')));
    expect(effectsFor(s, 'a1', 'attacking')).toEqual([{ kind: 'mod', roll: 'hit', value: 1 }]);
    expect(effectsFor(s, 'a1', 'defending')).toEqual([]);
    expect(effectsFor(s, 'b1', 'attacking')).toEqual([]);
  });

  test('[R-19] a phase effect expires at the end of the phase', () => {
    const g = play(game(), add('phase'));
    expect(effectsFor(stateOf(nextPhase(g)), 'a1', 'attacking')).toEqual([]);
  });

  test('[R-19] a turn effect lasts until the end of the turn', () => {
    let g = play(game(), add('turn'));
    for (let i = 0; i < 6; i++) g = nextPhase(g);
    expect(effectsFor(stateOf(g), 'a1', 'attacking')).toHaveLength(1);
    g = nextPhase(g);
    expect(effectsFor(stateOf(g), 'a1', 'attacking')).toEqual([]);
  });

  test('[R-19] a battle-round effect lasts through the opponent\'s turn', () => {
    let g = play(game(), add('round'));
    for (let i = 0; i < 7; i++) g = nextPhase(g);
    expect(effectsFor(stateOf(g), 'a1', 'attacking')).toHaveLength(1);
    for (let i = 0; i < 7; i++) g = nextPhase(g);
    expect(effectsFor(stateOf(g), 'a1', 'attacking')).toEqual([]);
  });

  test('[R-19] removing an effect', () => {
    const g = play(game(), add('battle'));
    const id = stateOf(g).effects[0].id;
    expect(effectsFor(stateOf(play(g, { type: 'removeEffect', by: 'A', effectId: id } as never)), 'a1', 'attacking')).toEqual([]);
  });

  test('[R-19] an effect needs a real unit', () => {
    expectRejected(game(), { type: 'addEffect', by: 'A', effect: { unitId: 'zz', side: 'attacking', effect: { kind: 'ignore-cover' }, until: 'turn', note: '' } } as never, 'unknown-unit');
  });
});
