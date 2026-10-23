import { livingModels, stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { startRun } from '../drill/run';
import { morale } from './l10-morale';

const test_ = { type: 'moraleTest', by: 'A', unitId: 'A:int' } as Command;

describe('Lesson 10 drill: Morale', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(morale, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'morale', step: 'morale-tests', active: 'B' });
    expect(livingModels(s, 'A:int')).toHaveLength(7);
    expect(s.units['A:int'].turn.lostThisTurn).toBe(3);
  });

  test('a roll of 4 passes', () => {
    const run = play(morale, [{ answer: '6' }, test_], diskCtx({ dice: [4] }));
    expect(run.status).toBe('done');
    expect(run.results.map((r) => r.explain)).toEqual([
      'Only a 6: 6 + 3 = 9 is more than Leadership 8. (A roll of 1 always passes.)',
      'You rolled 4: 4 + 3 = 7, not more than Leadership 8, so the test is passed and nothing happens.',
    ]);
    expect(livingModels(stateOf(run.record), 'A:int')).toHaveLength(7);
  });

  test('a roll of 6 fails: one model flees, then Combat Attrition', () => {
    // 6 + 3 = 9 fails; 6 models left roll attrition: one 1.
    const run = play(morale, [{ answer: '6' }, test_, { answer: '1' }], diskCtx({ dice: [6, 1, 3, 4, 5, 6, 2] }));
    expect(run.status).toBe('done');
    expect(run.results.slice(1).map((r) => r.explain)).toEqual([
      'You rolled 6: 6 + 3 = 9, more than Leadership 8, so the test is failed. One Intercessor flees, then Combat Attrition: a D6 for each of the 6 models left, and each 1 means another flees (1s and 2s if the unit is below Half-strength).',
      '1: the Combat Attrition dice were 1, 3, 4, 5, 6, 2, and each 1 means one more model flees.',
    ]);
    expect(livingModels(stateOf(run.record), 'A:int')).toHaveLength(5);
  });

  test('an unmodified 1 always passes', () => {
    const run = play(morale, [{ answer: '6' }, test_], diskCtx({ dice: [1] }));
    expect(run.results[1].explain).toBe('You rolled a 1: an unmodified 1 always passes.');
  });

  test('wrong answers are refused', () => {
    expect(() => play(morale, [{ answer: '5-6' }])).toThrow(/wrong answer at fails/);
    expect(() => play(morale, [{ answer: '6' }, test_, { answer: '0' }], diskCtx({ dice: [6, 1, 3, 4, 5, 6, 2] }))).toThrow(/wrong answer at attrition/);
  });
});
