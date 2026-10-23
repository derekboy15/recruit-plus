/** Test-only: drill contexts from the generated data on disk, and a scripted way to play a drill. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MissionsOut } from '@recruit/data/missions';
import type { Command } from '@recruit/engine';
import { toDatasheet } from '@recruit/engine/data';
import { deployedGame, realCatalogue } from '../../play/__fixtures__/game';
import { actRun, answerRun, currentStage, startRun, watchOf, type DrillRun } from '../drill/run';
import type { Drill, DrillCtx, ListCtx } from '../drill/types';
import { getIndex, getPolicy, getRosterScope } from '../../factions/dataClient';
import { slugsFor } from '../../lists/useRosterEditor';

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

/** A step: a command, an answer, a command the drill or engine must refuse (the run keeps the attempt), or a function of the run. */
export type Step = Command | { answer: string } | { refused: Command } | ((run: DrillRun) => Command | { answer: string } | { refused: Command } | null);

/** Plays a script: commands, answers (`'answer'` picks the stage's computed answer) or functions of the run. Throws on any refusal. */
export function play(drill: Drill, script: Step[], ctx: DrillCtx = diskCtx()): DrillRun {
  let run = startRun(drill, ctx);
  for (const s of script) {
    const step = typeof s === 'function' ? s(run) : s;
    if (!step) continue;
    if ('refused' in step) {
      const r = actRun(run, step.refused);
      if (!r.problems) throw new Error(`${step.refused.type} was accepted, but should have been refused`);
      run = r.run;
      continue;
    }
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

/** A test drill in A's (the Necrons') Command phase: say how many CP you have, then end the phase. */
export const tiny: Drill = {
  id: 'tiny',
  title: 'End the Command phase',
  intro: 'A test drill.',
  catalogues: ['necrons'],
  learner: 'A',
  build: (ctx) => deployedGame({ scriptedDice: ctx.dice }),
  stages: [
    {
      kind: 'ask',
      id: 'cp',
      question: () => 'How many CP do you have?',
      choices: () => ['3', '4', '5'].map((v) => ({ id: v, label: `${v} CP` })),
      answer: (w) => String(w.state.cp.A),
      explain: (w) => `You have ${w.state.cp.A} CP.`,
    },
    {
      kind: 'do',
      id: 'end',
      prompt: () => 'End your Command phase.',
      guard: (cmd) => (cmd.type === 'endPhase' ? null : 'In this drill, just end the phase.'),
      check: (w) => (w.state.phase === 'movement' ? { pass: true, explain: 'On to the Movement phase.' } : null),
    },
  ],
};

/** A list-drill context for a catalogue, from the generated data (needs stubGeneratedData()). */
export async function listCtx(catalogueSlug: string): Promise<ListCtx> {
  const index = await getIndex();
  const cat = index.catalogues.find((c) => c.slug === catalogueSlug)!;
  const slugs = slugsFor({ schema: 1, name: '', catalogueId: cat.id, battleSize: 'combat-patrol', forces: [] }, index.catalogues, cat.slug);
  const [scope, policy] = await Promise.all([getRosterScope(slugs), getPolicy()]);
  return { scope, policy, catalogueId: cat.id };
}
