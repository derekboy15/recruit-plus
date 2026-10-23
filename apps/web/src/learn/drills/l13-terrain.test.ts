import { dispatch, stateOf, type Command, type GameRecord } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { startRun, type DrillRun } from '../drill/run';
import { terrain } from './l13-terrain';

const begin = (unitId: string) => ({ type: 'beginMove', by: 'A', unitId, kind: 'normal' }) as Command;
const northBy = (unitId: string, dy: number) => (run: DrillRun | { record: GameRecord }) => {
  const s = stateOf(run.record);
  const moves = Object.fromEntries(s.units[unitId].modelIds.map((id) => [id, { to: { ...s.models[id].pos!, y: s.models[id].pos!.y + dy } }]));
  return { type: 'completeMove', by: 'A', unitId, moves } as Command;
};
const shoot = (unitId: string) => (run: DrillRun) => {
  const s = stateOf(run.record);
  return { type: 'shoot', by: 'A', unitId, assignments: s.units[unitId].modelIds.map((modelId) => ({ modelId, weapon: 'Bolt rifle', targetUnitId: 'B:war' })) } as Command;
};
const to = (type: 'endPhase' | 'endStep') => ({ type, by: 'A' }) as Command;

describe('Lesson 13 drill: terrain', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(terrain, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'movement', active: 'A' });
    expect(s.setup.terrain.map((f) => f.name)).toEqual(['Crater', 'Woods']);
  });

  test('the engine takes 2" off a move across the crater: 3.9" is fine, 4.2" is refused', () => {
    const run = play(terrain, [{ answer: '4"' }, begin('A:int2')]);
    expect(dispatch(run.record, northBy('A:int2', 4.2)(run)).ok).toBe(false);
    expect(dispatch(run.record, northBy('A:int2', 3.9)(run)).ok).toBe(true);
  });

  test('cross the crater, then shoot through the woods needing 4+', () => {
    const run = play(terrain, [{ answer: '4"' }, begin('A:int2'), northBy('A:int2', 3.9), to('endStep'), to('endPhase'), to('endPhase'), shoot('A:int'), { answer: '4+' }]);
    expect(run.status).toBe('done');
    expect(run.results.map((r) => r.explain)).toEqual([
      '4": the Intercessors’ Move of 6", minus 2" for moving over Difficult Ground.',
      'Your squad crossed the crater.',
      'On to the Shooting phase.',
      'The woods don’t block the view, so the shot goes ahead.',
      '4+: their Ballistic Skill is 3+, but Dense Cover gives -1 to hit. (A 6 always hits.)',
    ]);
  });

  test('shooting at an unobstructed target needs 3+', () => {
    const run = play(terrain, [{ answer: '4"' }, begin('A:int2'), northBy('A:int2', 3.9), to('endStep'), to('endPhase'), to('endPhase')]);
    const r = dispatch(run.record, shoot('A:int2')(run));
    expect(r.ok).toBe(true);
    const ask = terrain.stages[4];
    expect(ask.kind === 'ask' && ask.answer({ state: stateOf((r as { game: GameRecord }).game) } as never)).toBe('3+');
  });

  test('wrong answers are refused', () => {
    expect(() => play(terrain, [{ answer: '6"' }])).toThrow(/wrong answer at difficult/);
  });
});
