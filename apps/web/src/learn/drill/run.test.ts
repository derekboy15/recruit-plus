import { currentStep, stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { chargePhase, deployedGame, must } from '../../play/__fixtures__/game';
import { diskCtx, play, tiny } from '../__fixtures__/drills';
import { actRun, answerRun, currentStage, startRun, watchOf } from './run';
import type { Drill } from './types';

const end = (by: 'A' | 'B') => ({ type: 'endPhase', by }) as Command;


describe('drill controller', () => {
  test("the autopilot confirms the other side's rolls and declines its reactions", () => {
    // Rolls: the Warriors (A, the learner) shoot; the Intercessors' (B) save roll is confirmed for them.
    const shooting: Drill = {
      ...tiny,
      build: (ctx) => {
        let g = deployedGame({ scriptedDice: ctx.dice });
        for (let i = 0; i < 3; i++) g = must(g, end('A'));
        return g;
      },
      stages: [{ kind: 'do', id: 'shoot', prompt: () => 'Shoot.', check: (w) => (w.state.activation ? null : w.attempts.length ? { pass: true, explain: 'Done.' } : null) }],
    };
    let run = startRun(shooting, diskCtx({ dice: [...Array(10).fill(6), ...Array(10).fill(6)] }));
    const s = stateOf(run.record);
    const assignments = s.units['A:war'].modelIds.map((modelId) => ({ modelId, weapon: 'Gauss Flayer', targetUnitId: 'B:int' }));
    run = actRun(run, { type: 'shoot', by: 'A', unitId: 'A:war', assignments } as Command).run;
    expect(stateOf(run.record).pending).toMatchObject({ kind: 'roll', player: 'A' });
    run = actRun(run, { type: 'confirmRoll', by: 'A' } as Command).run; // hits
    run = actRun(run, { type: 'confirmRoll', by: 'A' } as Command).run; // wounds; B's saves are confirmed by the autopilot
    const after = stateOf(run.record);
    expect(after.pending).toBeNull();
    expect(run.record.batches.some((b) => b.command.type === 'confirmRoll' && b.command.by === 'B')).toBe(true);

    // Reactions: the Warriors charge; the Intercessors' charge reaction is declined for them.
    const charge: Drill = { ...tiny, build: (ctx) => chargePhase(ctx.dice.length ? ctx.dice : [6, 6]), stages: [{ kind: 'do', id: 'c', prompt: () => 'Charge.', check: () => null }] };
    let r2 = startRun(charge, diskCtx());
    r2 = actRun(r2, { type: 'declareCharge', by: 'A', unitId: 'A:war', targetIds: ['B:int'] } as Command).run;
    expect(r2.record.batches.some((b) => b.command.type === 'respond' && b.command.by === 'B')).toBe(true);
    const cs = stateOf(r2.record);
    expect(cs.pending).toBeNull();
    expect(currentStep(cs).actingPlayer).toBe('A');
  });

  test('a do stage passes when its check passes and records why', () => {
    const run = play(tiny, [{ answer: 'answer' }, end('A')]);
    expect(run.status).toBe('done');
    expect(run.results.map((r) => r.stageId)).toEqual(['cp', 'end']);
    expect(run.results[1].explain).toBe('On to the Movement phase.');
  });

  test('an ask stage refuses board actions until answered', () => {
    const run = startRun(tiny, diskCtx());
    const r = actRun(run, end('A'));
    expect(r.problems?.[0]).toMatchObject({ code: 'drill', message: 'Answer the question first.' });
    expect(r.run.record).toBe(run.record);
  });

  test("a wrong answer explains, counts a mistake and can be answered again", () => {
    let run = startRun(tiny, diskCtx());
    const right = (currentStage(run) as Extract<Drill['stages'][number], { kind: 'ask' }>).answer(watchOf(run));
    const wrong = ['3', '4', '5'].find((v) => v !== right)!;
    run = answerRun(run, wrong);
    expect(run.wrong).toBe(`Not quite. You have ${right} CP.`);
    expect(run.mistakes).toBe(1);
    expect(currentStage(run)?.id).toBe('cp');
    run = answerRun(run, right);
    expect(run.wrong).toBeNull();
    expect(currentStage(run)?.id).toBe('end');
  });

  test("a guard refuses an off-path command with the drill's message and nothing changes", () => {
    let run = play(tiny, [{ answer: 'answer' }]);
    const r = actRun(run, { type: 'adjustCp', by: 'A', player: 'A', delta: 1 } as unknown as Command);
    expect(r.problems).toEqual([{ code: 'drill', message: 'In this drill, just end the phase.', rule: '' }]);
    expect(r.run.record).toBe(run.record);
    expect(r.run.attempts).toHaveLength(1);
    run = r.run;
    expect(run.attempts[0].drill).toBe('In this drill, just end the phase.');
  });

  test('a failing check ends the run as failed with the reason', () => {
    const failing: Drill = { ...tiny, stages: [{ kind: 'do', id: 'end', prompt: () => 'End it.', check: (w) => (w.state.phase === 'movement' ? { pass: false, explain: 'Too soon!' } : null) }] };
    const run = play(failing, [end('A')]);
    expect(run.status).toBe('failed');
    expect(run.failure).toBe('Too soon!');
    expect(actRun(run, end('A')).problems?.[0].code).toBe('drill');
  });

  test('a do stage can pass on what the engine refused (e.g. learning why a target is protected)', () => {
    const learnRefusal: Drill = {
      ...tiny,
      stages: [{ kind: 'do', id: 'try', prompt: () => 'Try to end the phase as the wrong player.', check: (w) => (w.attempts.some((a) => a.problems) ? { pass: true, explain: 'Refused, as it should be.' } : null) }],
    };
    const run = startRun(learnRefusal, diskCtx());
    const r = actRun(run, end('B'));
    expect(r.problems?.length).toBeGreaterThan(0);
    expect(r.run.status).toBe('done');
    expect(r.run.results[0].explain).toBe('Refused, as it should be.');
  });

  test('skipped stages are passed over', () => {
    const skipping: Drill = { ...tiny, stages: [{ ...tiny.stages[0], skip: () => true }, tiny.stages[1]] };
    expect(currentStage(startRun(skipping, diskCtx()))?.id).toBe('end');
    const allSkipped: Drill = { ...tiny, stages: [{ ...tiny.stages[0], skip: () => true }] };
    expect(startRun(allSkipped, diskCtx()).status).toBe('done');
  });

  test('the same seed and dice give the same run', () => {
    const a = play(tiny, [{ answer: 'answer' }, end('A')], diskCtx({ seed: 3, dice: [4, 5] }));
    const b = play(tiny, [{ answer: 'answer' }, end('A')], diskCtx({ seed: 3, dice: [4, 5] }));
    expect(JSON.stringify(a.record)).toBe(JSON.stringify(b.record));
  });
});
