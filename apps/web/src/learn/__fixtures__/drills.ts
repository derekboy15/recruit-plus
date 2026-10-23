/** Test-only: drill contexts from the generated data on disk, and a scripted way to play a drill. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MissionsOut } from '@recruit/data/missions';
import type { Command } from '@recruit/engine';
import { toDatasheet } from '@recruit/engine/data';
import { realCatalogue } from '../../play/__fixtures__/game';
import { actRun, answerRun, currentStage, startRun, watchOf, type DrillRun } from '../drill/run';
import type { Drill, DrillCtx } from '../drill/types';

const GENERATED = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'data', 'generated');
let missions: MissionsOut | null = null;

export function diskCtx(o: { seed?: number; dice?: number[] } = {}): DrillCtx {
  missions ??= JSON.parse(readFileSync(join(GENERATED, 'missions.json'), 'utf8')) as MissionsOut;
  return {
    sheet(slug, unitName) {
      const c = realCatalogue(slug);
      const unit = c.units.find((u) => u.name === unitName);
      if (!unit) throw new Error(`${unitName} isn't in ${slug}`);
      return toDatasheet(unit, c.name).datasheet;
    },
    missions,
    seed: o.seed ?? 7,
    dice: o.dice ?? [],
  };
}

export type Step = Command | { answer: string } | ((run: DrillRun) => Command | { answer: string } | null);

/** Plays a script: commands, answers (`'answer'` picks the stage's computed answer) or functions of the run. Throws on any refusal. */
export function play(drill: Drill, script: Step[], ctx: DrillCtx = diskCtx()): DrillRun {
  let run = startRun(drill, ctx);
  for (const s of script) {
    const step = typeof s === 'function' ? s(run) : s;
    if (!step) continue;
    if ('answer' in step) {
      const stage = currentStage(run);
      if (stage?.kind !== 'ask') throw new Error(`expected a question, at ${stage?.id ?? run.status}`);
      run = answerRun(run, step.answer === 'answer' ? stage.answer(watchOf(run)) : step.answer);
      if (run.wrong) throw new Error(`wrong answer at ${stage.id}: ${run.wrong}`);
      continue;
    }
    const r = actRun(run, step);
    if (r.problems) throw new Error(`${step.type} refused: ${r.problems.map((p) => p.message).join(' ')}`);
    run = r.run;
  }
  return run;
}
