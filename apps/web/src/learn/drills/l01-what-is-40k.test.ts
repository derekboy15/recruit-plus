import { dist, stateOf, type Command, type GameRecord } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { actRun, startRun } from '../drill/run';
import type { DrillRun } from '../drill/run';
import { MARKER, whatIs40k } from './l01-what-is-40k';

/** A Normal Move of the whole squad `dy` inches north. */
const moveNorth = (dy: number) => (run: DrillRun) => {
  const s = stateOf(run.record);
  const moves = Object.fromEntries(s.units['A:int'].modelIds.map((id) => [id, { to: { ...s.models[id].pos!, y: s.models[id].pos!.y + dy } }]));
  return { type: 'completeMove', by: 'A', unitId: 'A:int', moves } as Command;
};
const begin = { type: 'beginMove', by: 'A', unitId: 'A:int', kind: 'normal' } as Command;
const centre = (g: GameRecord) => {
  const s = stateOf(g);
  const ps = s.units['A:int'].modelIds.map((id) => s.models[id].pos!);
  return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length };
};

describe('Lesson 1 drill: take the objective', () => {
  test('the scenario starts where the lesson says', () => {
    const run = startRun(whatIs40k, diskCtx());
    const s = stateOf(run.record);
    expect(s).toMatchObject({ phase: 'movement', step: 'move-units', active: 'A', round: 1 });
    // "7" from the middle of the squad to the middle of the marker".
    expect(dist(centre(run.record), MARKER.pos)).toBeCloseTo(7, 5);
  });

  test('the right actions pass with an explanation that states the numbers', () => {
    const run = play(whatIs40k, [begin, moveNorth(4), { answer: 'A' }]);
    expect(run.status).toBe('done');
    expect(run.results[0].explain).toBe('Your Intercessors moved up to their Move of 6". 5 Intercessors are now within 3" of the marker, against no Necron Warriors.');
    expect(run.results[1].explain).toMatch(/you have 5 models within 3" of the marker and the Necrons have 0/);
  });

  test('a move that ends out of range fails with the reason and can be tried again', () => {
    const run = play(whatIs40k, [begin, moveNorth(1)]);
    expect(run.status).toBe('failed');
    expect(run.failure).toMatch(/^Your closest Intercessor ended 4\.6" from the marker, more than 3" away/);
    const again = startRun(whatIs40k, diskCtx({ seed: 99 }));
    expect(again.status).toBe('playing');
  });

  test("wrong answers are refused and the answer is the engine's", () => {
    for (const wrong of ['B', 'none']) expect(() => play(whatIs40k, [begin, moveNorth(4), { answer: wrong }])).toThrow(/wrong answer at control/);
    expect(play(whatIs40k, [begin, moveNorth(4), { answer: 'answer' }]).answers.control).toBe('A');
  });

  test('a move further than 6" is refused by the engine, and an Advance by the drill', () => {
    let run = play(whatIs40k, [begin]);
    const r = actRun(run, moveNorth(6.5)(run));
    expect(r.problems?.[0].code).not.toBe('drill');
    run = startRun(whatIs40k, diskCtx());
    const adv = actRun(run, { type: 'beginMove', by: 'A', unitId: 'A:int', kind: 'advance' } as Command);
    expect(adv.problems).toEqual([{ code: 'drill', message: 'This drill is about the Normal Move: choose Normal Move.', rule: '' }]);
  });
});
