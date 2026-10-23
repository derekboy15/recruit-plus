import { dispatch, isEngaged, stateOf, type Command, type GameRecord } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { actRun, startRun, type DrillRun } from '../drill/run';
import { advanceTo, gapBetween } from './scenario';
import { movement } from './l05-movement';

const by = (unitId: string, dx: number, dy: number) => (run: DrillRun | { record: GameRecord }) => {
  const s = stateOf(run.record);
  const moves = Object.fromEntries(s.units[unitId].modelIds.map((id) => [id, { to: { ...s.models[id].pos!, x: s.models[id].pos!.x + dx, y: s.models[id].pos!.y + dy } }]));
  return { type: 'completeMove', by: 'A', unitId, moves } as Command;
};
const begin = (unitId: string, kind: string) => ({ type: 'beginMove', by: 'A', unitId, kind }) as Command;
const accept = { type: 'confirmRoll', by: 'A' } as Command;

describe('Lesson 5 drill: movement', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(movement, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'movement', step: 'move-units', active: 'A' });
    expect(isEngaged(s, 'A:int2')).toBe(true);
    expect(isEngaged(s, 'A:int')).toBe(false);
    expect(gapBetween(s, 'A:int2', 'B:war')).toBeCloseTo(0.5, 5);
  });

  for (const roll of [1, 6]) {
    test(`an Advance roll of ${roll}: the right actions pass with explanations that give the numbers`, () => {
      const run = play(
        movement,
        [begin('A:int', 'advance'), { answer: `${6 + roll}"` }, accept, by('A:int', 0, 6 + roll - 0.5), begin('A:int2', 'fall-back'), by('A:int2', 0, -3), { answer: 'no' }, { answer: '2"' }],
        diskCtx({ dice: [roll] }),
      );
      expect(run.status).toBe('done');
      expect(run.results.map((r) => r.explain)).toEqual([
        `You rolled ${roll} for the Advance.`,
        `Up to ${6 + roll}": the Intercessors' Move of 6" plus the Advance roll of ${roll}.`,
        'The squad Advanced. For the rest of the turn it can’t charge, and it can only shoot Assault weapons, at -1 to hit.',
        'Every model ended more than 1" from the Warriors: out of Engagement Range.',
        'No: a unit that Falls Back can’t shoot or charge for the rest of the turn.',
        '2": every model must stay within 2" of another model from its unit (of two others when the unit has 6 or more models).',
      ]);
    });
  }

  test('an Advance further than the roll allows is refused by the engine', () => {
    const run = play(movement, [begin('A:int', 'advance'), { answer: '7"' }, accept], diskCtx({ dice: [1] }));
    const r = actRun(run, by('A:int', 0, 7.5)(run));
    expect(r.problems?.[0].code).not.toBe('drill');
  });

  test('the engaged squad can\'t make a Normal Move: the engine says so', () => {
    const run = play(movement, [begin('A:int', 'advance'), { answer: '7"' }, accept, by('A:int', 0, 6)], diskCtx({ dice: [1] }));
    const r = actRun(run, begin('A:int2', 'normal'));
    expect(r.problems?.[0].code).not.toBe('drill');
    expect(r.problems?.[0].message).toBeTruthy();
  });

  test('a Fall Back that ends in Engagement Range is refused by the engine', () => {
    const run = play(movement, [begin('A:int', 'advance'), { answer: '7"' }, accept, by('A:int', 0, 6), begin('A:int2', 'fall-back')], diskCtx({ dice: [1] }));
    expect(actRun(run, by('A:int2', 0.2, 0)(run)).problems?.[0].code).not.toBe('drill');
  });

  test('in the Shooting phase the engine refuses to let the squad that Fell Back shoot', () => {
    const run = play(movement, [begin('A:int', 'advance'), { answer: '7"' }, accept, by('A:int', 0, 6), begin('A:int2', 'fall-back'), by('A:int2', 0, -3)], diskCtx({ dice: [1] }));
    const g = advanceTo(run.record, { phase: 'shooting' });
    const s = stateOf(g);
    const r = dispatch(g, { type: 'shoot', by: 'A', unitId: 'A:int2', assignments: s.units['A:int2'].modelIds.map((modelId) => ({ modelId, weapon: 'Bolt rifle', targetUnitId: 'B:war' })) } as Command);
    expect(r.ok).toBe(false);
  });

  test('wrong answers are refused', () => {
    expect(() => play(movement, [begin('A:int', 'advance'), { answer: '6"' }], diskCtx({ dice: [3] }))).toThrow(/wrong answer at how-far/);
  });
});
