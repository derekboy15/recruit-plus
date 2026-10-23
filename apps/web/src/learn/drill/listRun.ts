/** The list-drill controller (lesson 14): like run.ts, but the learner's actions add units to a real army roster. */
import { addUnit, type Roster } from '@recruit/data/roster';
import type { Problem } from '@recruit/engine';
import type { CardView, ListCtx, ListDrill, ListStage, ListWatch, ListWorld } from './types';

export interface ListRun {
  drill: ListDrill;
  start: ListWorld;
  world: ListWorld;
  stage: number;
  attempts: { entryId: string }[];
  answers: Record<string, string>;
  results: { stageId: string; explain: string }[];
  wrong: string | null;
  mistakes: number;
  status: 'playing' | 'failed' | 'done';
  failure: string | null;
}

const drillProblem = (message: string): Problem[] => [{ code: 'drill', message, rule: '' }];

export const currentListStage = (run: ListRun): ListStage | null => (run.status === 'playing' ? (run.drill.stages[run.stage] ?? null) : null);
export const listWatchOf = (run: ListRun): ListWatch => ({ start: run.start, world: run.world, attempts: run.attempts, answers: run.answers });

const advance = (run: ListRun): ListRun => ({ ...run, stage: run.stage + 1, attempts: [], wrong: null });

function settle(run: ListRun): ListRun {
  let r = run;
  while (r.status === 'playing') {
    const stage = currentListStage(r);
    if (!stage) return { ...r, status: 'done' };
    const w = listWatchOf(r);
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

export function startListRun(drill: ListDrill, ctx: ListCtx): ListRun {
  const world = drill.build(ctx);
  return settle({ drill, start: world, world, stage: 0, attempts: [], answers: {}, results: [], wrong: null, mistakes: 0, status: 'playing', failure: null });
}

/** Adds one of the picker's units to the roster's first detachment. */
export function addUnitRun(run: ListRun, entryId: string): { run: ListRun; problems: Problem[] | null } {
  if (run.status !== 'playing') return { run, problems: drillProblem('This drill is over. Start again to try it once more.') };
  if (currentListStage(run)?.kind === 'ask') return { run, problems: drillProblem('Answer the question first.') };
  if (!run.world.picker.some((p) => p.entryId === entryId)) return { run, problems: drillProblem('In this drill, pick a unit from the list.') };
  const r: Roster = run.world.roster;
  const roster = addUnit(run.world.scope, r, r.forces[0].id, entryId).roster;
  return { run: settle({ ...run, world: { ...run.world, roster }, attempts: [...run.attempts, { entryId }] }), problems: null };
}

export function answerListRun(run: ListRun, choiceId: string): ListRun {
  const stage = currentListStage(run);
  if (stage?.kind !== 'ask') return run;
  const w = listWatchOf(run);
  if (choiceId !== stage.answer(w)) return { ...run, wrong: `Not quite. ${stage.explain(w)}`, mistakes: run.mistakes + 1 };
  return settle(advance({ ...run, answers: { ...run.answers, [stage.id]: choiceId }, results: [...run.results, { stageId: stage.id, explain: stage.explain(w) }] }));
}

export function listCardView(run: ListRun): CardView {
  const stage = currentListStage(run);
  const w = listWatchOf(run);
  return {
    intro: run.drill.intro,
    results: run.results,
    status: run.status,
    failure: run.failure,
    wrong: run.wrong,
    stage: !stage
      ? null
      : stage.kind === 'do'
        ? { kind: 'do', id: stage.id, prompt: stage.prompt(w) }
        : { kind: 'ask', id: stage.id, question: stage.question(w), choices: stage.choices(w) },
  };
}
