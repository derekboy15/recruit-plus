import { objectiveControl, stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play } from '../__fixtures__/drills';
import { actRun, startRun } from '../drill/run';
import { commandPhase } from './l04-command-phase';

const end = { type: 'endPhase', by: 'A' } as Command;

describe('Lesson 4 drill: Command Points', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(commandPhase, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'command', active: 'A', round: 2 });
    expect(s.setup.rules.pack).toBe('core-book');
    expect(s.cp).toEqual({ A: 5, B: 4 });
    const held = Object.values(objectiveControl(s));
    expect(held.filter((p) => p === 'A')).toHaveLength(2);
    expect(held.filter((p) => p === 'B')).toHaveLength(1);
  });

  test('the right answers pass with explanations that give the numbers', () => {
    const run = play(commandPhase, [{ answer: '5' }, { answer: '0' }, end, { answer: '15' }]);
    expect(run.status).toBe('done');
    expect(stateOf(run.record).vp.A.primary).toBe(15);
    expect(run.results.map((r) => r.explain)).toEqual([
      'You have 5 CP: the 3 you started with, plus 1 at the start of each of your Command phases (battle rounds 1 and 2). This is the Battle-forged CP bonus.',
      'The Necrons gained 0 CP: in a Core Book mission, only the player whose turn it is gains the CP. (In Arks of Omen missions both players do.)',
      'Your Command phase is over, and your primary objective was scored at its end.',
      'You scored 15 VP. Take and Hold gives 5 VP each for holding 1 or more objectives, 2 or more, and more than your opponent: you hold 2 and the Necrons hold 1.',
    ]);
  });

  test('wrong answers are refused', () => {
    expect(() => play(commandPhase, [{ answer: '4' }])).toThrow(/wrong answer at cp/);
    expect(() => play(commandPhase, [{ answer: '5' }, { answer: '1' }])).toThrow(/wrong answer at their-cp/);
    expect(() => play(commandPhase, [{ answer: '5' }, { answer: '0' }, end, { answer: '10' }])).toThrow(/wrong answer at vp/);
  });

  test('only ending the phase is allowed in the action step', () => {
    const run = play(commandPhase, [{ answer: '5' }, { answer: '0' }]);
    expect(actRun(run, { type: 'adjustCp', by: 'A', player: 'A', delta: 1 } as unknown as Command).problems?.[0].code).toBe('drill');
  });
});
