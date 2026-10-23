import { blastShots, parseDice, stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { actRun, startRun, type DrillRun } from '../drill/run';
import { gapBetween } from './scenario';
import { shooting } from './l07-shooting';

const shootAt = (target: string) => (run: DrillRun) => {
  const s = stateOf(run.record);
  return { type: 'shoot', by: 'A', unitId: 'A:int', assignments: s.units['A:int'].modelIds.map((modelId) => ({ modelId, weapon: 'Bolt rifle', targetUnitId: target })) } as Command;
};
const tryAt = (target: string) => (run: DrillRun) => ({ refused: shootAt(target)(run) });

describe('Lesson 7 drill: choosing targets', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(shooting, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'shooting', active: 'A' });
    expect(gapBetween(s, 'B:lord', 'B:war')).toBeCloseTo(2, 1);
    expect(gapBetween(s, 'A:int', 'B:lord')).toBeGreaterThan(gapBetween(s, 'A:int', 'B:war'));
  });

  test("a shot at the Overlord is refused by the engine's Look Out, Sir rule", () => {
    const run = play(shooting, [{ answer: 'B:war2' }]);
    const r = actRun(run, shootAt('B:lord')(run));
    expect(r.problems?.[0]).toMatchObject({ code: 'look-out-sir', rule: '[TS §5.3]' });
  });

  test('the right answers and actions pass, with the reasons', () => {
    const run = play(shooting, [{ answer: 'B:war2' }, tryAt('B:lord'), { answer: '4+' }, { answer: '3' }, shootAt('B:war')]);
    expect(run.status).toBe('done');
    expect(run.results.map((x) => x.explain)).toEqual([
      'The Warriors behind the ruins: the ruins are Obscuring and 6" tall, and models can’t see through or over Obscuring terrain 5" or taller.',
      'Look Out, Sir: the Overlord is a CHARACTER with 5 Wounds, within 3" of the Necron Warriors (a unit of 3 or more models), and it isn’t the closest enemy unit, so it can’t be shot.',
      '4+: AP -1 makes their 4+ save a 5+, and Light Cover adds 1 back against shooting.',
      '3: against a unit of 6 to 10 models, a Blast weapon always makes at least 3 attacks.',
      'The Warriors in the crater are visible and in range, so the shot goes ahead.',
    ]);
    expect(blastShots(parseDice('D6')!, 2, 10)).toBe(3);
  });

  test('wrong answers are refused', () => {
    expect(() => play(shooting, [{ answer: 'B:war' }])).toThrow(/wrong answer at hidden/);
    expect(() => play(shooting, [{ answer: 'B:war2' }, tryAt('B:lord'), { answer: '5+' }])).toThrow(/wrong answer at cover-save/);
    expect(() => play(shooting, [{ answer: 'B:war2' }, tryAt('B:lord'), { answer: '4+' }, { answer: '2' }])).toThrow(/wrong answer at blast/);
  });

  test('shooting the Warriors before trying the Overlord is refused by the drill', () => {
    const run = play(shooting, [{ answer: 'B:war2' }]);
    expect(actRun(run, shootAt('B:war')(run)).problems?.[0]).toMatchObject({ code: 'drill' });
  });

  test('the Warriors behind the ruins are out of sight: the engine refuses the shot', () => {
    const run = play(shooting, [{ answer: 'B:war2' }, tryAt('B:lord'), { answer: '4+' }, { answer: '3' }]);
    const r = actRun(run, shootAt('B:war2')(run));
    expect(r.problems?.[0].code).not.toBe('drill');
  });
});
