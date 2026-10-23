/**
 * The drill controller, pure (no React): it sends the learner's actions to the engine (which judges every rule),
 * plays the other side's automatic moves, and moves through the drill's stages.
 */
import { dispatch, stateOf, type Command, type GameRecord, type GameState, type PlayerId, type Problem } from '@recruit/engine';
import type { Attempt, Drill, DrillCtx, Stage, Watch } from './types';

export interface DrillRun {
  drill: Drill;
  seed: number;
  start: GameRecord;
  record: GameRecord;
  stage: number;
  stageStart: GameRecord;
  attempts: Attempt[];
  answers: Record<string, string>;
  /** Passed stages' explanations, in order. */
  results: { stageId: string; explain: string }[];
  /** The explanation after a wrong answer, until the question is answered right. */
  wrong: string | null;
  mistakes: number;
  status: 'playing' | 'failed' | 'done';
  failure: string | null;
}

const AUTO_LIMIT = 100;
const drillProblem = (message: string): Problem[] => [{ code: 'drill', message, rule: '' }];

/** Confirms the other side's open rolls and declines its reactions. */
export const defaultAuto =
  (learner: PlayerId | 'both') =>
  (s: GameState): Command | null => {
    const p = s.pending;
    if (!p || learner === 'both' || p.player === learner) return null;
    if (p.kind === 'roll') return { type: 'confirmRoll', by: p.player } as Command;
    if (p.kind === 'reaction') return { type: 'respond', by: p.player, choice: 'decline' } as Command;
    return null;
  };

export const currentStage = (run: DrillRun): Stage | null => (run.status === 'playing' ? (run.drill.stages[run.stage] ?? null) : null);

export function watchOf(run: DrillRun): Watch {
  return { start: run.start, stageStart: run.stageStart, record: run.record, state: stateOf(run.record), attempts: run.attempts, answers: run.answers };
}

function autopilot(run: DrillRun): DrillRun {
  const auto = run.drill.auto ?? defaultAuto(run.drill.learner);
  let record = run.record;
  for (let i = 0; i < AUTO_LIMIT; i++) {
    const cmd = auto(stateOf(record), { ...watchOf(run), record, state: stateOf(record) });
    if (!cmd) break;
    const r = dispatch(record, cmd);
    if (!r.ok) throw new Error(`Drill ${run.drill.id}: the automatic ${cmd.type} was refused: ${r.problems.map((p) => p.message).join(' ')}`);
    record = r.game;
  }
  return record === run.record ? run : { ...run, record };
}

const advance = (run: DrillRun): DrillRun => ({ ...run, stage: run.stage + 1, stageStart: run.record, attempts: [], wrong: null });

/** Passes skipped stages and do stages whose check has passed; stops at a question or an unfinished action. */
function settle(run: DrillRun): DrillRun {
  let r = run;
  while (r.status === 'playing') {
    const stage = currentStage(r);
    if (!stage) return { ...r, status: 'done' };
    const w = watchOf(r);
    if (stage.skip?.(w)) {
      r = advance(r);
      continue;
    }
    if (stage.kind === 'ask') return r;
    const v = stage.check(w);
    if (!v) return r;
    if (!v.pass) return { ...r, status: 'failed', failure: v.explain };
    r = advance({ ...r, results: [...r.results, { stageId: stage.id, explain: v.explain }] });
  }
  return r;
}

export function startRun(drill: Drill, ctx: DrillCtx): DrillRun {
  const start = drill.build(ctx);
  const run: DrillRun = {
    drill,
    seed: ctx.seed,
    start,
    record: start,
    stage: 0,
    stageStart: start,
    attempts: [],
    answers: {},
    results: [],
    wrong: null,
    mistakes: 0,
    status: 'playing',
    failure: null,
  };
  const ready = autopilot(run);
  return settle({ ...ready, start: ready.record, stageStart: ready.record });
}

/** Guard → engine → autopilot → stage check. `problems`: the engine's (or the drill's) refusal, null when accepted. */
export function actRun(run: DrillRun, cmd: Command): { run: DrillRun; problems: Problem[] | null } {
  if (run.status !== 'playing') return { run, problems: drillProblem('This drill is over. Start again to try it once more.') };
  const stage = currentStage(run);
  if (stage?.kind === 'ask') return { run, problems: drillProblem('Answer the question first.') };
  const refusal = stage?.kind === 'do' ? stage.guard?.(cmd, watchOf(run)) : null;
  if (refusal) return { run: { ...run, attempts: [...run.attempts, { cmd, problems: null, drill: refusal }] }, problems: drillProblem(refusal) };
  const r = dispatch(run.record, cmd);
  if (!r.ok) return { run: { ...run, attempts: [...run.attempts, { cmd, problems: r.problems }] }, problems: r.problems };
  const next = autopilot({ ...run, record: r.game, attempts: [...run.attempts, { cmd, problems: null }] });
  return { run: settle(next), problems: null };
}

export function answerRun(run: DrillRun, choiceId: string): DrillRun {
  const stage = currentStage(run);
  if (stage?.kind !== 'ask') return run;
  const w = watchOf(run);
  if (choiceId !== stage.answer(w)) return { ...run, wrong: `Not quite. ${stage.explain(w)}`, mistakes: run.mistakes + 1 };
  const answered = { ...run, answers: { ...run.answers, [stage.id]: choiceId }, results: [...run.results, { stageId: stage.id, explain: stage.explain(w) }] };
  return settle(advance(answered));
}
