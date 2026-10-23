/** Lesson 11: take an objective, predict your Take and Hold score, and see it scored in the next Command phase. */
import { currentStep, dispatch, objectiveControl, primaryConditions, type Command, type GameEvent, type GameState } from '@recruit/engine';
import type { Drill } from '../drill/types';
import { accepted, eventsSince, gapToMarker, inches, only } from './helpers';
import { advanceTo, intercessors, NECRONS, scenario, ULTRA, warriors } from './scenario';
import { PRACTICE } from '../../play/setup/missions';

const SQUAD = 'A:int';
const OBJECTIVES = PRACTICE.layout({ w: 44, h: 30 }, 'combat-patrol').objectives;
export const OBJ2 = OBJECTIVES.find((o) => o.id === '2')!.pos;

const heldBy = (s: GameState, p: 'A' | 'B') =>
  Object.entries(objectiveControl(s))
    .filter(([, o]) => o === p)
    .map(([id]) => id);
const list = (ids: string[]) => (ids.length > 1 ? `${ids.slice(0, -1).join(', ')} and ${ids.at(-1)}` : (ids[0] ?? 'none'));
const predicted = (s: GameState) => Math.min(s.setup.rules.primary.maxPerTurn, primaryConditions(s, 'A') * s.setup.rules.primary.vpPerCondition);

export const objectives: Drill = {
  id: 'objectives',
  title: 'Take and hold',
  intro: 'Practice layout, Core Book Take and Hold scoring. Your right-hand squad holds objective 1; the Necrons hold objective 4. Your left-hand squad is 7" from objective 2.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: SQUAD, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: OBJ2.x, y: OBJ2.y - 7 } },
            { id: 'A:int2', player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: OBJECTIVES.find((o) => o.id === '1')!.pos },
            { id: 'B:war', player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: OBJECTIVES.find((o) => o.id === '4')!.pos },
          ],
          objectives: OBJECTIVES,
        },
        ctx,
      ),
      { phase: 'movement' },
    ),
  // The Necrons' turn is played for them: they just end each phase (and any step where they must act).
  auto: (s, w) => {
    const p = s.pending;
    if (p) return p.player === 'A' ? null : ({ type: p.kind === 'roll' ? 'confirmRoll' : 'respond', by: p.player, ...(p.kind === 'roll' ? {} : { choice: 'decline' }) } as Command);
    const by = currentStep(s).actingPlayer;
    if (by !== 'B' || s.phase === 'ended') return null;
    const endPhase = { type: 'endPhase', by } as Command;
    return dispatch(w.record, endPhase).ok ? endPhase : ({ type: 'endStep', by } as Command);
  },
  stages: [
    {
      kind: 'do',
      id: 'take',
      prompt: () => 'Make a Normal Move with your left-hand squad so that it ends within 3" of objective 2.',
      guard: only(['beginMove', 'completeMove', 'cancelMove'], SQUAD, 'In this drill, move your left-hand squad onto objective 2.'),
      check: (w) => {
        if (!accepted(w, 'completeMove').length) return null;
        if (objectiveControl(w.state)['2'] !== 'A')
          return { pass: false, explain: `Your closest Intercessor ended ${inches(gapToMarker(w.state, SQUAD, OBJ2))} from objective 2, more than 3" away. Try again and move closer.` };
        return { pass: true, explain: `You hold objectives ${list(heldBy(w.state, 'A'))}; the Necrons hold objective ${list(heldBy(w.state, 'B'))}.` };
      },
    },
    {
      kind: 'ask',
      id: 'predict',
      question: () => 'If nothing changes, how many VP will you score at the end of your next Command phase?',
      choices: () => [0, 5, 10, 15].map((n) => ({ id: String(n), label: `${n} VP` })),
      answer: (w) => String(predicted(w.state)),
      explain: (w) => {
        const vp = w.state.setup.rules.primary.vpPerCondition;
        return `${predicted(w.state)} VP: you hold 1 or more objectives (${vp} VP), 2 or more (${vp} VP) and more than the Necrons (${vp} VP).`;
      },
    },
    {
      kind: 'do',
      id: 'score',
      prompt: (w) =>
        w.state.round >= 2 ? 'End your Command phase to score.' : 'End each phase of your turn. The Necrons’ turn is played for them, then you score at the end of your Command phase in battle round 2.',
      guard: only(['endPhase', 'endStep', 'beginMove', 'completeMove', 'cancelMove', 'remainStationary', 'moraleTest'], null, 'In this drill, end each phase until you score.'),
      check: (w) => {
        const scored = eventsSince(w.stageStart, w.record)
          .filter((e): e is Extract<GameEvent, { type: 'vpScored' }> => e.type === 'vpScored' && e.player === 'A')
          .reduce((a, e) => a + e.amount, 0);
        if (!scored) return null;
        const guess = Number(w.answers.predict);
        return { pass: true, explain: `You scored ${scored} VP at the end of your Command phase, ${scored === guess ? 'as you predicted' : `not the ${guess} VP you predicted: something changed`}.` };
      },
    },
  ],
};
