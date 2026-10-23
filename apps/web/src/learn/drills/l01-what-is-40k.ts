/** Lesson 1: make a Normal Move onto an objective marker and see who controls it. */
import { livingModels, objectiveControl, inRangeOfObjective } from '@recruit/engine';
import type { Drill } from '../drill/types';
import { accepted, gapToMarker, inches, only, plural } from './helpers';
import { advanceTo, intercessors, NECRONS, scenario, ULTRA, warriors } from './scenario';

export const MARKER = { id: '1', pos: { x: 22, y: 15 } };
const SQUAD = 'A:int';

const inRange = (s: Parameters<typeof objectiveControl>[0], unitId: string) =>
  livingModels(s, unitId).filter((m) => inRangeOfObjective(s, m, MARKER.pos)).length;

export const whatIs40k: Drill = {
  id: 'what-is-40k',
  title: 'Take the objective',
  intro: 'Your five Intercessors (bottom) start 7" from the objective marker in the middle of the battlefield. The Necron Warriors are far away at the top.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: SQUAD, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 22, y: 8 } },
            { id: 'B:war', player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 27 } },
          ],
          objectives: [MARKER],
        },
        ctx,
      ),
      { phase: 'movement' },
    ),
  stages: [
    {
      kind: 'do',
      id: 'move',
      prompt: () => 'Tap your Intercessors, choose Normal Move, drag them towards the objective marker, then tap Confirm move.',
      guard: (cmd) => {
        if (cmd.type === 'beginMove' && cmd.kind !== 'normal') return 'This drill is about the Normal Move: choose Normal Move.';
        return only(['beginMove', 'completeMove', 'cancelMove'], SQUAD, 'In this drill, make a Normal Move with the Intercessors.')(cmd);
      },
      check: (w) => {
        if (!accepted(w, 'completeMove').length) return null;
        const gap = gapToMarker(w.state, SQUAD, MARKER.pos);
        const mine = inRange(w.state, SQUAD);
        if (objectiveControl(w.state)[MARKER.id] !== 'A')
          return {
            pass: false,
            explain: `Your closest Intercessor ended ${inches(gap)} from the marker, more than 3" away, and a unit can only move once in each Movement phase. Try again and move them closer.`,
          };
        return {
          pass: true,
          explain: `Your Intercessors moved up to their Move of 6". ${plural(mine, 'Intercessor is', 'Intercessors are')} now within 3" of the marker, against no Necron Warriors.`,
        };
      },
    },
    {
      kind: 'ask',
      id: 'control',
      question: () => 'Who controls the objective now?',
      choices: () => [
        { id: 'A', label: 'You' },
        { id: 'B', label: 'The Necrons' },
        { id: 'none', label: 'Nobody' },
      ],
      answer: (w) => objectiveControl(w.state)[MARKER.id] ?? 'none',
      explain: (w) =>
        `You do: you have ${plural(inRange(w.state, SQUAD), 'model')} within 3" of the marker and the Necrons have ${inRange(w.state, 'B:war')}. More models in range controls it.`,
    },
  ],
};
