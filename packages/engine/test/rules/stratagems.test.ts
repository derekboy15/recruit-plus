import { describe, expect, test } from 'vitest';
import { stateOf } from '../../src';
import { expectRejected, line, newTestGame, nextPhase, placeAll, play, toTurn } from '../helpers/game';

const game = () => placeAll(newTestGame({}), { a1: line(5, 5, 'a1'), b1: line(5, 52, 'b1') });
const strat = (name: string, cp: number) => ({ type: 'useStratagem', by: 'A', name, cp, unitIds: ['a1'], note: '' }) as never;

describe('stratagems and CP', () => {
  test('[CS §1] a stratagem spends its CP', () => {
    const g = play(game(), strat('Transhuman Physiology', 2));
    expect(stateOf(g).cp.A).toBe(5);
  });

  test('[CS §1] the same stratagem only once per phase, matched by name', () => {
    const g = play(game(), strat('Transhuman Physiology', 1));
    expectRejected(g, strat('transhuman physiology', 1), 'stratagem-once-per-phase');
    play(nextPhase(g), strat('Transhuman Physiology', 1));
  });

  test('[CS §1] a stratagem can not be used without enough CP', () => {
    expectRejected(game(), strat('Big One', 8), 'not-enough-cp');
  });

  test('[TS §2] CP gained from abilities is capped at 1 per battle round', () => {
    let g = play(game(), { type: 'gainCp', by: 'A', amount: 1, source: 'ability' } as never, { type: 'gainCp', by: 'A', amount: 1, source: 'ability' } as never);
    expect(stateOf(g).cp.A).toBe(8); // 7 after the Command phase, +1, then capped
    g = toTurn(g, 2, 'first');
    const before = stateOf(g).cp.A;
    g = play(g, { type: 'gainCp', by: 'A', amount: 1, source: 'ability' } as never);
    expect(stateOf(g).cp.A).toBe(before + 1);
  });

  test('[FAQ §2.1] CP gained from stratagems is not capped', () => {
    const g = play(game(), { type: 'gainCp', by: 'A', amount: 1, source: 'ability' } as never, { type: 'gainCp', by: 'A', amount: 2, source: 'stratagem' } as never);
    expect(stateOf(g).cp.A).toBe(10);
  });
});
