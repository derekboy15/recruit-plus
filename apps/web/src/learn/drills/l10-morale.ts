/** Lesson 10: a Morale test after losses, and Combat Attrition when it fails. */
import { leadership, livingModels, stateOf, type Command, type GameEvent, type GameState } from '@recruit/engine';
import type { Drill, Watch } from '../drill/types';
import { eventsSince, numberChoices } from './helpers';
import { advanceTo, intercessors, must, NECRONS, scenario, ULTRA, warriors } from './scenario';

const SQUAD = 'A:int';
type E<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

const lost = (s: GameState) => s.units[SQUAD].turn.lostThisTurn;
/** The D6 rolls (2–6; a 1 always passes) that fail the test now. */
const failing = (s: GameState) => [2, 3, 4, 5, 6].filter((r) => r + lost(s) > leadership(s, SQUAD));
const failingId = (s: GameState) => (failing(s).length ? `${failing(s)[0]}-6`.replace(/^6-6$/, '6') : 'none');
const tested = (w: Watch) => eventsSince(w.start, w.record).find((e): e is E<'moraleTested'> => e.type === 'moraleTested' && e.unitId === SQUAD);
const attritionDice = (w: Watch) => eventsSince(w.start, w.record).filter((e): e is E<'diceRolled'> => e.type === 'diceRolled' && e.roll.kind === 'attrition').flatMap((e) => e.roll.dice.map((d) => d.value));
const fledToAttrition = (w: Watch) =>
  eventsSince(w.start, w.record)
    .filter((e): e is E<'modelsRemoved'> => e.type === 'modelsRemoved' && e.reason === 'fled (Combat Attrition)')
    .reduce((a, e) => a + e.modelIds.length, 0);

export const morale: Drill = {
  id: 'morale',
  title: 'Hold your nerve',
  intro: 'In the Necrons’ turn, their shooting destroyed 3 of your 10 Intercessors. Now it is the Morale phase.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) => {
    let g = scenario(
      {
        units: [
          { id: SQUAD, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(10), at: { x: 22, y: 8 } },
          { id: 'B:war', player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 26 } },
        ],
      },
      ctx,
    );
    g = advanceTo(g, { active: 'B', phase: 'shooting' });
    // The Necrons' shooting, by hand: three Intercessors (not the Sergeant) are destroyed.
    for (const modelId of stateOf(g).units[SQUAD].modelIds.slice(-3)) g = must(g, { type: 'removeModel', by: 'B', modelId, destroyed: true } as Command);
    return advanceTo(g, { active: 'B', phase: 'morale' });
  },
  stages: [
    {
      kind: 'ask',
      id: 'fails',
      question: (w) =>
        `Your squad lost ${lost(w.state)} models this turn. Its highest Leadership is ${leadership(w.state, SQUAD)} (the Sergeant’s). You roll a D6 and add ${lost(w.state)}. Which rolls fail the test?`,
      choices: () => [
        { id: '6', label: 'Only a 6' },
        { id: '5-6', label: '5 or 6' },
        { id: '4-6', label: '4, 5 or 6' },
        { id: 'none', label: 'None of them' },
      ],
      answer: (w) => failingId(w.state),
      explain: (w) => {
        const f = failing(w.state);
        const ld = leadership(w.state, SQUAD);
        if (!f.length) return `None: even 6 + ${lost(w.state)} isn’t more than Leadership ${ld}.`;
        const lo = f[0];
        return `${f.length === 1 ? 'Only a 6' : `${lo} or more`}: ${lo} + ${lost(w.state)} = ${lo + lost(w.state)} is more than Leadership ${ld}. (A roll of 1 always passes.)`;
      },
    },
    {
      kind: 'do',
      id: 'test',
      prompt: () => 'Take the Morale test for your Intercessors.',
      guard: (cmd) => (cmd.type === 'moraleTest' && cmd.unitId === SQUAD ? null : 'In this drill, take the Morale test for your Intercessors.'),
      check: (w) => {
        const t = tested(w);
        if (!t) return null;
        if (t.insaneBravery) return { pass: true, explain: 'You used Insane Bravery (2 CP): the test is passed automatically, with no dice rolled.' };
        if (t.roll === 1) return { pass: true, explain: 'You rolled a 1: an unmodified 1 always passes.' };
        if (t.passed) return { pass: true, explain: `You rolled ${t.roll}: ${t.roll} + ${lost(stateOf(w.stageStart))} = ${t.result}, not more than Leadership ${t.ld}, so the test is passed and nothing happens.` };
        const left = livingModels(stateOf(w.stageStart), SQUAD).length - 1;
        return {
          pass: true,
          explain: `You rolled ${t.roll}: ${t.roll} + ${lost(stateOf(w.stageStart))} = ${t.result}, more than Leadership ${t.ld}, so the test is failed. One Intercessor flees, then Combat Attrition: a D6 for each of the ${left} models left, and each 1 means another flees (1s and 2s if the unit is below Half-strength).`,
        };
      },
    },
    {
      kind: 'ask',
      id: 'attrition',
      skip: (w) => !attritionDice(w).length,
      question: () => 'How many more Intercessors fled to Combat Attrition?',
      choices: (w) => numberChoices(0, attritionDice(w).length),
      answer: (w) => String(fledToAttrition(w)),
      explain: (w) => `${fledToAttrition(w)}: the Combat Attrition dice were ${attritionDice(w).join(', ')}, and each 1 means one more model flees.`,
    },
  ],
};
