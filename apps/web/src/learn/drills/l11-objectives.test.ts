import { dispatch, dist, objectiveControl, stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { startRun, type DrillRun } from '../drill/run';
import { objectives, OBJ2 } from './l11-objectives';

const begin = { type: 'beginMove', by: 'A', unitId: 'A:int', kind: 'normal' } as Command;
const north = (dy: number) => (run: DrillRun) => {
  const s = stateOf(run.record);
  const moves = Object.fromEntries(s.units['A:int'].modelIds.map((id) => [id, { to: { ...s.models[id].pos!, y: s.models[id].pos!.y + dy } }]));
  return { type: 'completeMove', by: 'A', unitId: 'A:int', moves } as Command;
};
const end = (type: 'endPhase' | 'endStep') => ({ type, by: 'A' }) as Command;
/** Ends whatever phase or step you are in (as the Ultramarines), until the drill is over. */
const moveOn = (run: DrillRun) => (run.status !== 'playing' ? null : dispatch(run.record, end('endPhase')).ok ? end('endPhase') : end('endStep'));

describe('Lesson 11 drill: objectives and scoring', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(objectives, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'movement', active: 'A', round: 1 });
    const c = objectiveControl(s);
    expect(c['1']).toBe('A');
    expect(c['4']).toBe('B');
    expect(c['2']).toBeNull();
    const ps = s.units['A:int'].modelIds.map((id) => s.models[id].pos!);
    const centre = { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length };
    expect(dist(centre, OBJ2)).toBeCloseTo(7, 5);
  });

  test('take objective 2, predict 15 VP, and score them in battle round 2', () => {
    const run = play(objectives, [begin, north(4), { answer: '15' }, ...Array(12).fill(moveOn)]);
    expect(run.status).toBe('done');
    expect(stateOf(run.record).vp.A.primary).toBe(15);
    expect(run.results.map((r) => r.explain)).toEqual([
      'You hold objectives 1 and 2; the Necrons hold objective 4.',
      '15 VP: you hold 1 or more objectives (5 VP), 2 or more (5 VP) and more than the Necrons (5 VP).',
      'You scored 15 VP at the end of your Command phase, as you predicted.',
    ]);
  });

  test('a move that ends out of range fails with the reason', () => {
    const run = play(objectives, [begin, north(1)]);
    expect(run.status).toBe('failed');
    expect(run.failure).toMatch(/from objective 2, more than 3" away/);
  });

  test('wrong answers are refused', () => {
    expect(() => play(objectives, [begin, north(4), { answer: '10' }])).toThrow(/wrong answer at predict/);
  });
});
