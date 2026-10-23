import { livingModels, stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { startRun, type DrillRun } from '../drill/run';
import { gapBetween } from './scenario';
import { psychic } from './l06-psychic';

const smite = { type: 'manifest', by: 'A', unitId: 'A:lib', power: 'Smite' } as Command;
const accept = { type: 'confirmRoll', by: 'A' } as Command;
const warriorsLeft = (run: DrillRun) => livingModels(stateOf(run.record), 'B:war').length;

describe('Lesson 6 drill: Smite', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(psychic, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'psychic', active: 'A' });
    expect(gapBetween(s, 'A:lib', 'B:war')).toBeCloseTo(10, 5);
  });

  test('a passed test: Smite does D3 mortal wounds with no saves', () => {
    // Psychic test 3 + 4 = 7; D3 from a 5 = 3 mortal wounds.
    const run = play(psychic, [smite, { answer: 'yes' }, accept, { answer: 'no' }], diskCtx({ dice: [3, 4, 5] }));
    expect(run.status).toBe('done');
    expect(warriorsLeft(run)).toBe(7);
    expect(run.results.map((r) => r.explain)).toEqual([
      'Psychic test: you rolled 3 and 4, a total of 7.',
      'Yes: 7 is at least the warp charge of 5.',
      'Smite went off. The Warriors, the closest visible enemy unit within 18", suffered 3 mortal wounds (a D3), and 3 Warriors were destroyed.',
      'No: mortal wounds skip the wound roll and every saving throw.',
    ]);
  });

  test('a failed test: nothing happens', () => {
    const run = play(psychic, [smite, { answer: 'no' }, accept], diskCtx({ dice: [1, 3] }));
    expect(run.status).toBe('done');
    expect(warriorsLeft(run)).toBe(10);
    expect(run.results.slice(1).map((r) => r.explain)).toEqual(['No: 4 is less than the warp charge of 5.', 'The Psychic test failed, so the power has no effect.']);
  });

  test('a double 6: Perils of the Warp, and Smite still goes off', () => {
    // 6 + 6 = 12: Perils (a D3 from a 3 = 2 mortal wounds on the Librarian), then Smite on 11+ is D6 (a 4).
    const run = play(psychic, [smite, { answer: 'yes' }, accept, { answer: 'no' }], diskCtx({ dice: [6, 6, 3, 4] }));
    expect(run.status).toBe('done');
    expect(run.results[1].explain).toBe('Yes: 12 is at least the warp charge of 5. But a double 6 means Perils of the Warp!');
    expect(run.results[2].explain).toBe(
      'Perils of the Warp: your Librarian suffered 2 mortal wounds. Smite went off. The Warriors, the closest visible enemy unit within 18", suffered 4 mortal wounds (a D6, because the test was 11 or more), and 4 Warriors were destroyed.',
    );
  });

  test('wrong answers are refused', () => {
    expect(() => play(psychic, [smite, { answer: 'no' }], diskCtx({ dice: [3, 4] }))).toThrow(/wrong answer at goes-off/);
  });
});
