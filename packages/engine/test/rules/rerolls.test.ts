import { describe, expect, test } from 'vitest';
import { registerApplier, registerContinuation, registerHandler, rollWindowed, stateOf, type GameEvent, type GameRecord, type RollKind } from '../../src';
import { expectRejected, line, newTestGame, placeAll, play } from '../helpers/game';

// A test-only command that makes one windowed roll and records the final values when the roll is resolved.
type Seen = { testSeen?: number[][] };
registerContinuation('test', 'rolled', (ctx, data: { rollId: string }) => {
  ctx.emit({ type: 'testRollSeen', values: ctx.state.rolls[data.rollId].dice.map((d) => d.value) } as unknown as GameEvent);
});
registerApplier('testRollSeen' as never, (s, e: { values: number[] }) => {
  const st = s as unknown as Seen;
  st.testSeen = [...(st.testSeen ?? []), e.values];
});
registerHandler('testRoll' as never, (ctx, cmd: { n: number; kind: RollKind; whole?: boolean; rerollOnes?: boolean }) => {
  rollWindowed(ctx, cmd.n, 6, cmd.kind, 'A', {
    whole: cmd.whole,
    context: 'test',
    autoReroll: cmd.rerollOnes ? (d) => d.value === 1 : undefined,
    then: { module: 'test', step: 'rolled', data: {} },
  });
});

const seen = (g: GameRecord) => (stateOf(g) as unknown as Seen).testSeen ?? [];
const roll = (n: number, kind: RollKind, extra: object = {}) => ({ type: 'testRoll', by: 'A', n, kind, ...extra }) as never;
const game = (dice: number[], windows = true) =>
  placeAll(newTestGame({ dice, windows }), { a1: line(5, 5, 'a1'), b1: line(5, 52, 'b1') });

describe('roll windows and re-rolls', () => {
  test('[CS §2] Command Re-roll costs 1 CP and re-rolls one hit die', () => {
    let g = play(game([2, 5, 1, 6]), roll(3, 'hit'));
    expect(stateOf(g).pending).toMatchObject({ kind: 'roll', player: 'A' });
    const cp = stateOf(g).cp.A;
    g = play(g, { type: 'reroll', by: 'A', dice: [2], source: 'command-reroll' } as never, { type: 'confirmRoll', by: 'A' } as never);
    expect(seen(g)).toEqual([[2, 5, 6]]);
    expect(stateOf(g).cp.A).toBe(cp - 1);
    expect(stateOf(g).pending).toBeNull();
  });

  test('[CS §2] Command Re-roll re-rolls one die, not several', () => {
    const g = play(game([2, 5, 1, 6, 6]), roll(3, 'hit'));
    expectRejected(g, { type: 'reroll', by: 'A', dice: [0, 2], source: 'command-reroll' } as never, 'one-die');
  });

  test('[CS §2] Command Re-roll re-rolls both dice of a charge roll', () => {
    let g = play(game([1, 2, 5, 6]), roll(2, 'charge', { whole: true }));
    g = play(g, { type: 'reroll', by: 'A', dice: [0], source: 'command-reroll' } as never, { type: 'confirmRoll', by: 'A' } as never);
    expect(seen(g)).toEqual([[5, 6]]);
  });

  test('[TS §1.6] a die can never be re-rolled twice', () => {
    let g = play(game([1, 4, 2, 6]), roll(2, 'hit'));
    g = play(g, { type: 'reroll', by: 'A', dice: [0], source: 'ability' } as never);
    expectRejected(g, { type: 'reroll', by: 'A', dice: [0], source: 'command-reroll' } as never, 'already-rerolled');
  });

  test('[TS §1.6] automatic re-rolls happen when the dice are rolled, once per die', () => {
    const g = play(game([1, 4, 1], false), roll(2, 'hit', { rerollOnes: true }));
    expect(seen(g)).toEqual([[1, 4]]); // the re-rolled 1 came up 1 again and can't be re-rolled a second time
  });

  test('[CS §1] the same stratagem only once per phase', () => {
    let g = play(game([2, 3, 4, 5, 6, 1]), roll(1, 'hit'));
    g = play(g, { type: 'reroll', by: 'A', dice: [0], source: 'command-reroll' } as never, { type: 'confirmRoll', by: 'A' } as never, roll(1, 'hit'));
    expectRejected(g, { type: 'reroll', by: 'A', dice: [0], source: 'command-reroll' } as never, 'stratagem-once-per-phase');
  });

  test('[CS §1] a stratagem can not be used without the CP', () => {
    let g = game([2, 3]);
    g = play(g, { type: 'adjustCpForTest', by: 'A', player: 'A' } as never);
    g = play(g, roll(1, 'hit'));
    expectRejected(g, { type: 'reroll', by: 'A', dice: [0], source: 'command-reroll' } as never, 'not-enough-cp');
  });

  test('[CS §2] Command Re-roll can not be used on a Morale test: it never opens a window', () => {
    const g = play(game([3]), roll(1, 'morale'));
    expect(stateOf(g).pending).toBeNull();
    expect(seen(g)).toEqual([[3]]);
  });

  test('[R-19] with roll windows off, rolls resolve without waiting', () => {
    const g = play(game([4, 4], false), roll(2, 'hit'));
    expect(stateOf(g).pending).toBeNull();
    expect(seen(g)).toEqual([[4, 4]]);
  });

  test('[R-19] other actions wait while a roll is open', () => {
    const g = play(game([4, 4]), roll(2, 'hit'));
    expectRejected(g, { type: 'endPhase', by: 'A' } as never, 'pending-decision');
  });

  test('[R-19] only the player who rolled can re-roll or confirm', () => {
    const g = play(game([4, 4]), roll(2, 'hit'));
    expectRejected(g, { type: 'confirmRoll', by: 'B' } as never, 'not-your-roll');
  });
});

// Drains CP to 0 for the "not enough CP" test.
registerHandler('adjustCpForTest' as never, (ctx, cmd: { player: 'A' | 'B' }) => {
  ctx.emit({ type: 'cpChanged', player: cmd.player, delta: -ctx.state.cp[cmd.player], reason: 'test' } as GameEvent);
});
