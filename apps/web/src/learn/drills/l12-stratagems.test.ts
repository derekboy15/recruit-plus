import { dispatch, livingModels, stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { startRun, type DrillRun } from '../drill/run';
import { gapBetween } from './scenario';
import { stratagems } from './l12-stratagems';

const declare = { type: 'declareCharge', by: 'A', unitId: 'A:int', targetIds: ['B:war'] } as Command;
const reroll = { type: 'reroll', by: 'A', dice: [0, 1], source: 'command-reroll' } as Command;
const accept = { type: 'confirmRoll', by: 'A' } as Command;
const north = (dy: number) => (run: DrillRun) => {
  const s = stateOf(run.record);
  const moves = Object.fromEntries(livingModels(s, 'A:int').map((m) => [m.id, { to: { ...m.pos!, y: m.pos!.y + dy } }]));
  return { type: 'chargeMove', by: 'A', unitId: 'A:int', moves } as Command;
};

describe('Lesson 12 drill: Command Re-roll', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(stratagems, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'charge', active: 'A' });
    expect(s.cp.A).toBe(4);
    expect(gapBetween(s, 'A:int', 'B:war')).toBeCloseTo(9, 5);
  });

  test('a short roll (3 + 4) re-rolled to 4 + 5: 1 CP spent, both dice re-rolled, the charge made', () => {
    const run = play(stratagems, [declare, reroll, { answer: 'no' }, accept, north(8.5), { answer: 'no' }], diskCtx({ dice: [3, 4, 4, 5] }));
    expect(run.status).toBe('done');
    expect(stateOf(run.record).cp.A).toBe(3);
    expect(run.results.map((r) => r.explain)).toEqual([
      'The Necrons didn’t fire Overwatch. Your charge roll: 3 + 4 = 7, and you need 8".',
      'Command Re-roll: you spent 1 CP (3 left) and re-rolled both dice: 4 + 5 = 9.',
      'No: a charge roll is 2D6 rolled together, so Command Re-roll re-rolls both dice.',
      'Charge made: 9" was enough.',
      'No: each Stratagem can be used only once per phase, and you have used Command Re-roll in this one.',
    ]);
  });

  test('a second Command Re-roll in the same phase is refused by the engine', () => {
    const run = play(stratagems, [declare, reroll], diskCtx({ dice: [3, 4, 1, 1] }));
    expect(dispatch(run.record, reroll).ok).toBe(false);
  });

  test('a roll of 5 + 5 needs no re-roll', () => {
    const run = play(stratagems, [declare, { answer: 'no' }, accept, north(8.5), { answer: 'yes' }], diskCtx({ dice: [5, 5] }));
    expect(run.status).toBe('done');
    expect(run.results[1].explain).toBe('No: a charge roll is 2D6 rolled together, so Command Re-roll re-rolls both dice.');
    expect(run.results.at(-1)?.explain).toBe('Yes: you haven’t used Command Re-roll in this phase, and each Stratagem can be used once per phase.');
    expect(stateOf(run.record).cp.A).toBe(4);
  });

  test('wrong answers are refused', () => {
    expect(() => play(stratagems, [declare, { answer: 'yes' }], diskCtx({ dice: [5, 5] }))).toThrow(/wrong answer at one-die/);
  });
});
