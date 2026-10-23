import { stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { actRun, startRun, type DrillRun } from '../drill/run';
import { gapBetween } from './scenario';
import { datasheets } from './l02-datasheets';

const shoot = (weapon: string) => (run: DrillRun) => {
  const s = stateOf(run.record);
  return { type: 'shoot', by: 'A', unitId: 'A:int', assignments: s.units['A:int'].modelIds.map((modelId) => ({ modelId, weapon, targetUnitId: 'B:war' })) } as Command;
};

describe('Lesson 2 drill: read the datasheet', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(datasheets, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'shooting', active: 'A' });
    expect(gapBetween(s, 'A:int', 'B:war')).toBeCloseTo(18, 5);
  });

  test('the right answers and the shot pass, and the explanations give the numbers', () => {
    const run = play(datasheets, [{ answer: '6"' }, { answer: '4+' }, { answer: '1' }, shoot('Bolt rifle')]);
    expect(run.status).toBe('done');
    expect(run.results.map((r) => r.explain)).toEqual([
      'M is 6": an Intercessor moves up to 6" in a Normal Move.',
      'Sv is 4+: a Necron Warrior saves on a roll of 4 or more, before AP.',
      'Each fires 1 shot. Rapid Fire doubles the shots only within half range (15"), and the Warriors are 18" away.',
      '5 Intercessors, 1 shot each: 5 hit rolls, one die for each shot.',
    ]);
    expect(stateOf(run.record).rolls[(stateOf(run.record).pending as { rollId: string }).rollId].dice).toHaveLength(5);
  });

  test('each question shows the datasheet it is about', () => {
    const run = startRun(datasheets, diskCtx());
    const stage = datasheets.stages[0];
    expect(stage.kind === 'ask' && stage.datasheet?.({ ...run, state: stateOf(run.record) } as never)).toBe('A:int');
  });

  test('wrong answers are refused', () => {
    expect(() => play(datasheets, [{ answer: '5"' }])).toThrow(/wrong answer at move/);
    expect(() => play(datasheets, [{ answer: '6"' }, { answer: '3+' }])).toThrow(/wrong answer at save/);
    expect(() => play(datasheets, [{ answer: '6"' }, { answer: '4+' }, { answer: '2' }])).toThrow(/wrong answer at shots/);
  });

  test('shooting anything but the bolt rifles at the Warriors is refused by the drill', () => {
    const run = play(datasheets, [{ answer: '6"' }, { answer: '4+' }, { answer: '1' }]);
    expect(actRun(run, shoot('Bolt pistol')(run)).problems).toEqual([{ code: 'drill', message: 'In this drill, shoot the bolt rifles at the Necron Warriors.', rule: '' }]);
  });
});
