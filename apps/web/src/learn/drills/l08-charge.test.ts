import { livingModels, stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { actRun, startRun, type DrillRun } from '../drill/run';
import { gapBetween } from './scenario';
import { charge } from './l08-charge';

const declare = { type: 'declareCharge', by: 'A', unitId: 'A:int', targetIds: ['B:war'] } as Command;
const accept = { type: 'confirmRoll', by: 'A' } as Command;
const fail = { type: 'failCharge', by: 'A', unitId: 'A:int' } as Command;
const endCharges = { type: 'endStep', by: 'A' } as Command;
/** Every living Intercessor straight north by `dy`. */
const north = (dy: number) => (run: DrillRun) => {
  const s = stateOf(run.record);
  const moves = Object.fromEntries(livingModels(s, 'A:int').map((m) => [m.id, { to: { ...m.pos!, y: m.pos!.y + dy } }]));
  return { type: 'chargeMove', by: 'A', unitId: 'A:int', moves } as Command;
};
const noHits = Array(20).fill(1);

describe('Lesson 8 drill: charge', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(charge, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'charge', step: 'charges', active: 'A' });
    expect(gapBetween(s, 'A:int', 'B:war')).toBeCloseTo(6, 5);
    expect(gapBetween(s, 'B:lord', 'B:war')).toBeCloseTo(2, 5);
  });

  test('a charge roll of 7 makes it, and the Overlord can Heroically Intervene', () => {
    const run = play(charge, [declare, { answer: 'yes' }, accept, north(5.5), endCharges, { answer: 'yes' }], diskCtx({ dice: [...noHits, 3, 4] }));
    expect(run.status).toBe('done');
    expect(run.results.map((r) => r.explain)).toEqual([
      'The Necrons spent 1 CP to fire Overwatch: it only hits on an unmodified 6, so 0 of their 20 shots hit.',
      'Yes: 7" is enough to cover the 5" you need.',
      'Charge made: your Intercessors are in combat, and they will fight first in the Fight phase.',
      'Your charges are done. Now your opponent may Heroically Intervene.',
      'Yes: it is a CHARACTER within 3" of your Intercessors, and not in Engagement Range, so it may move up to 3" into the fight.',
    ]);
  });

  test('a charge roll of 4 falls short: the charge fails', () => {
    const run = play(charge, [declare, { answer: 'no' }, accept, fail, endCharges, { answer: 'no' }], diskCtx({ dice: [...noHits, 2, 2] }));
    expect(run.status).toBe('done');
    expect(run.results[1].explain).toBe('No: 4" isn’t enough to cover the 5" you need.');
    expect(run.results[2].explain).toBe('Not far enough: the charge fails, and your Intercessors stay where they are.');
    expect(run.results[4].explain).toBe('No: a CHARACTER must be within 3" of an enemy unit to Heroically Intervene, and the Overlord isn’t.');
  });

  test('giving up on a charge you could make ends the run as failed', () => {
    const run = play(charge, [declare, { answer: 'yes' }, accept, fail], diskCtx({ dice: [...noHits, 3, 4] }));
    expect(run.status).toBe('failed');
    expect(run.failure).toBe('Your charge roll of 7" was enough to cover the 5" you needed: the charge could have succeeded. Try again!');
  });

  test('Overwatch casualties: the distance needed comes from the live gap', () => {
    // Four 6s to hit, four 6s to wound, four failed saves (1s): two Intercessors fall. Then 3 + 3 = 6.
    const dice = [6, 6, 6, 6, ...Array(16).fill(1), 6, 6, 6, 6, 1, 1, 1, 1, 3, 3];
    const run = play(charge, [declare, accept], diskCtx({ dice }));
    expect(livingModels(stateOf(run.record), 'A:int')).toHaveLength(3);
    expect(run.results[0].explain).toBe('The Necrons spent 1 CP to fire Overwatch: it only hits on an unmodified 6, so 4 of their 20 shots hit, and you lost 2 Intercessors.');
    const gap = gapBetween(stateOf(run.record), 'A:int', 'B:war');
    const ask = charge.stages[1];
    expect(ask.kind === 'ask' && ask.question({ state: stateOf(run.record) } as never)).toContain(`you need ${(Math.round((gap - 1) * 10) / 10).toString()}"`);
  });

  test('a charge move longer than the roll is refused by the engine', () => {
    const run = play(charge, [declare, { answer: 'no' }, accept], diskCtx({ dice: [...noHits, 2, 2] }));
    expect(actRun(run, north(5.5)(run)).problems?.[0].code).not.toBe('drill');
  });

  test('wrong answers are refused', () => {
    expect(() => play(charge, [declare, { answer: 'no' }], diskCtx({ dice: [...noHits, 3, 4] }))).toThrow(/wrong answer at make-it/);
  });
});
