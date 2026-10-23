/** Lesson 4: the Command phase: count your CP, see who gains it in a Core Book mission, and score the primary. */
import { objectiveControl, type GameEvent, type GameState, type PlayerId } from '@recruit/engine';
import type { Drill } from '../drill/types';
import { numberChoices, only } from './helpers';
import { advanceTo, intercessors, NECRONS, scenario, ULTRA, warriors } from './scenario';

/** CP the Battle-forged bonus gave `p` in these events. */
const bonus = (events: GameEvent[], p: PlayerId) =>
  events.filter((e): e is Extract<GameEvent, { type: 'cpChanged' }> => e.type === 'cpChanged' && e.player === p && e.delta > 0).reduce((a, e) => a + e.delta, 0);
const held = (s: GameState, p: PlayerId) => Object.values(objectiveControl(s)).filter((o) => o === p).length;

export const commandPhase: Drill = {
  id: 'command-phase',
  title: 'Command Points and scoring',
  intro: 'It is the start of your Command phase in battle round 2 of a Core Book Combat Patrol mission. Your Intercessors hold two objectives; the Necrons hold one.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: 'A:int', player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 22, y: 4.5 } },
            { id: 'A:int2', player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 11, y: 15 } },
            { id: 'B:war', player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 25.5 } },
          ],
        },
        ctx,
      ),
      { round: 2, active: 'A', phase: 'command' },
    ),
  stages: [
    {
      kind: 'ask',
      id: 'cp',
      question: (w) => `You started the battle with ${w.state.setup.rules.startingCp} CP. How many CP do you have now?`,
      choices: () => numberChoices(3, 7, ' CP'),
      answer: (w) => String(w.state.cp.A),
      explain: (w) => {
        const start = w.state.setup.rules.startingCp;
        return `You have ${w.state.cp.A} CP: the ${start} you started with, plus 1 at the start of each of your Command phases (battle rounds 1 and 2). This is the Battle-forged CP bonus.`;
      },
    },
    {
      kind: 'ask',
      id: 'their-cp',
      question: () => 'How many CP did the Necrons gain at the start of your Command phase?',
      choices: () => numberChoices(0, 2, ' CP'),
      // The last thing that happened before the drill began was the start of this Command phase.
      answer: (w) => String(bonus(w.start.batches.at(-1)!.events, 'B')),
      explain: (w) => {
        const n = bonus(w.start.batches.at(-1)!.events, 'B');
        return w.state.setup.rules.cpEveryCommandPhase === 'both'
          ? `The Necrons gained ${n} CP: in this mission both players gain CP in every Command phase.`
          : `The Necrons gained ${n} CP: in a Core Book mission, only the player whose turn it is gains the CP. (In Arks of Omen missions both players do.)`;
      },
    },
    {
      kind: 'do',
      id: 'end',
      prompt: () => 'End your Command phase. Watch the score at the top.',
      guard: only(['endPhase'], null, 'In this drill, end the Command phase.'),
      check: (w) => (w.state.phase !== 'command' ? { pass: true, explain: 'Your Command phase is over, and your primary objective was scored at its end.' } : null),
    },
    {
      kind: 'ask',
      id: 'vp',
      question: () => 'How many VP did you just score?',
      choices: () => [0, 5, 10, 15].map((n) => ({ id: String(n), label: `${n} VP` })),
      answer: (w) => String(scored(w.record)),
      explain: (w) => {
        const r = w.state.setup.rules.primary;
        return `You scored ${scored(w.record)} VP. Take and Hold gives ${r.vpPerCondition} VP each for holding 1 or more objectives, 2 or more, and more than your opponent: you hold ${held(w.state, 'A')} and the Necrons hold ${held(w.state, 'B')}.`;
      },
    },
  ],
};

/** VP Player A scored in the last thing that happened (ending the Command phase). */
const scored = (record: { batches: { events: GameEvent[] }[] }): number =>
  record.batches
    .at(-1)!
    .events.filter((e): e is Extract<GameEvent, { type: 'vpScored' }> => e.type === 'vpScored' && e.player === 'A')
    .reduce((a, e) => a + e.amount, 0);
