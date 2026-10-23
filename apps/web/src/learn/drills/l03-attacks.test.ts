import { stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { startRun, type DrillRun } from '../drill/run';
import { gapBetween } from './scenario';
import { attacks } from './l03-attacks';

const shoot = (run: DrillRun) => {
  const s = stateOf(run.record);
  return { type: 'shoot', by: 'A', unitId: 'A:int', assignments: s.units['A:int'].modelIds.map((modelId) => ({ modelId, weapon: 'Bolt rifle', targetUnitId: 'B:war' })) } as Command;
};
const accept = { type: 'confirmRoll', by: 'A' } as Command;
const destroyed = (run: DrillRun) => {
  const s = stateOf(run.record);
  return s.units['B:war'].modelIds.filter((id) => s.models[id].destroyed).length;
};

describe('Lesson 3 drill: hits and wounds', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(attacks, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'shooting', active: 'A' });
    expect(gapBetween(s, 'A:int', 'B:war')).toBeCloseTo(12, 5);
  });

  test('some hits: the right answers pass, and the explanations count hits, wounds and casualties', () => {
    // Hits 6,6,6,5,4,3 (six 3+), wounds 6,5,4 of six (three 4+), saves 6 (saved), 2, 1 (failed): 2 Warriors destroyed.
    const dice = [6, 6, 6, 5, 4, 3, 2, 1, 1, 2, 6, 5, 4, 3, 2, 1, 6, 2, 1];
    const run = play(attacks, [{ answer: '4+' }, { answer: '5+' }, shoot, { answer: '6' }, accept, { answer: '3' }, accept], diskCtx({ dice }));
    expect(run.status).toBe('done');
    expect(destroyed(run)).toBe(2);
    expect(run.results.map((r) => r.explain)).toEqual([
      'Strength 4 equals Toughness 4, so you need 4+ to wound.',
      'AP -1 takes 1 off each save roll, so a Warrior needs 5+ instead of 4+.',
      '10 shots: the Warriors are within 15" (half the bolt rifle’s range), so Rapid Fire 1 becomes 2 shots for each of your 5 Intercessors.',
      '6 dice hit: every roll of 3 or more.',
      '6 hits go on to the wound roll.',
      '3 dice wound: every roll of 4 or more.',
      'The Necrons rolled 3 saves needing 5+: 1 saved and 2 failed. Each failed save does 1 damage, and a Warrior has 1 Wound, so 2 Warriors were destroyed.',
    ]);
  });

  test('no hits: the wound question is skipped and the run still finishes', () => {
    const dice = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1];
    const run = play(attacks, [{ answer: '4+' }, { answer: '5+' }, shoot, { answer: '0' }, accept], diskCtx({ dice }));
    expect(run.status).toBe('done');
    expect(run.results.at(-1)?.explain).toBe('No hits, so there is nothing to wound this time. Unlucky!');
    expect(destroyed(run)).toBe(0);
  });

  test('wrong answers are refused', () => {
    expect(() => play(attacks, [{ answer: '3+' }])).toThrow(/wrong answer at wound/);
    expect(() => play(attacks, [{ answer: '4+' }, { answer: '4+' }])).toThrow(/wrong answer at save/);
    const dice = [6, 6, 6, 5, 4, 3, 2, 1, 1, 2];
    expect(() => play(attacks, [{ answer: '4+' }, { answer: '5+' }, shoot, { answer: '7' }], diskCtx({ dice }))).toThrow(/wrong answer at hits/);
  });
});
