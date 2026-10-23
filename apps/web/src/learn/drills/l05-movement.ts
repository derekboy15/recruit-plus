/** Lesson 5: Advance one squad (Move + D6), Fall Back with the one in combat, and the limits that come with each. */
import { inCoherency, sheetOf, unitHas, type BaseShape, type GameState } from '@recruit/engine';
import type { Drill } from '../drill/types';
import { accepted, charsIn, inches, moveOf, openRoll, yesNo } from './helpers';
import { advanceTo, intercessors, NECRONS, scenario, ULTRA, warriors } from './scenario';

const OPEN = 'A:int';
const ENGAGED = 'A:int2';
const ENEMY = 'B:war';
const BASE = 32 / 25.4;
const CHOICES = [1, 2, 3, 6];

const move = (s: GameState) => moveOf(charsIn(s, OPEN, 'Intercessor'));

/** The furthest two of these models can stand apart (base to base) and still be in coherency, found by asking the engine. */
function coherencyGap(base: BaseShape): number {
  const pair = (gap: number) => {
    const d = (base.kind === 'circle' ? base.d : 1) + gap;
    return inCoherency([
      { id: 'a', base, pos: { x: 0, y: 0, z: 0, rot: 0 } },
      { id: 'b', base, pos: { x: d, y: 0, z: 0, rot: 0 } },
    ]);
  };
  return CHOICES.find((g) => pair(g) && !pair(g + 0.1)) ?? NaN;
}

export const movement: Drill = {
  id: 'movement',
  title: 'Advance and Fall Back',
  intro: 'One Intercessor squad (left) is in the open. The other (right) is in combat: it is within Engagement Range of the Necron Warriors.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: OPEN, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 10, y: 6 } },
            { id: ENGAGED, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 32, y: 12 } },
            { id: ENEMY, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 32, y: 12 + 0.5 + BASE } },
          ],
        },
        ctx,
      ),
      { phase: 'movement' },
    ),
  stages: [
    {
      kind: 'do',
      id: 'advance',
      prompt: () => 'Tap the squad on the left and choose Advance.',
      guard: (cmd) => (cmd.type === 'beginMove' && cmd.unitId === OPEN && cmd.kind === 'advance' ? null : 'First, Advance with the squad on the left.'),
      check: (w) => {
        const roll = openRoll(w.state);
        return roll?.kind === 'advance' ? { pass: true, explain: `You rolled ${roll.dice[0].value} for the Advance.` } : null;
      },
    },
    {
      kind: 'ask',
      id: 'how-far',
      question: (w) => `Your Advance roll is ${openRoll(w.state)!.dice[0].value}. How far can each Intercessor move?`,
      choices: () => [6, 7, 8, 9, 10, 11, 12].map((n) => ({ id: `${n}"`, label: `${n}"` })),
      answer: (w) => inches(move(w.state) + openRoll(w.state)!.dice[0].value),
      explain: (w) => {
        const r = openRoll(w.state)!.dice[0].value;
        return `Up to ${inches(move(w.state) + r)}: the Intercessors' Move of ${inches(move(w.state))} plus the Advance roll of ${r}.`;
      },
    },
    {
      kind: 'do',
      id: 'advance-move',
      prompt: () => 'Accept the roll, drag the squad forward, then tap Confirm move.',
      guard: (cmd) =>
        cmd.type === 'confirmRoll' || ((cmd.type === 'completeMove' || cmd.type === 'cancelMove' || cmd.type === 'beginMove') && cmd.unitId === OPEN)
          ? null
          : 'Finish the Advance with the squad on the left first.',
      check: (w) =>
        accepted(w, 'completeMove').length
          ? { pass: true, explain: 'The squad Advanced. For the rest of the turn it can’t charge, and it can only shoot Assault weapons, at -1 to hit.' }
          : null,
    },
    {
      kind: 'do',
      id: 'fall-back',
      prompt: () => 'Now the squad on the right: Fall Back, so that every model ends more than 1" from the Warriors.',
      // Any kind of move may be tried: the engine explains why only Fall Back (or Remain Stationary) works here.
      guard: (cmd) =>
        (cmd.type === 'beginMove' || cmd.type === 'completeMove' || cmd.type === 'cancelMove') && cmd.unitId === ENGAGED ? null : 'In this drill, move the squad on the right.',
      check: (w) => (accepted(w, 'completeMove').length ? { pass: true, explain: 'Every model ended more than 1" from the Warriors: out of Engagement Range.' } : null),
    },
    {
      kind: 'ask',
      id: 'shoot-after',
      question: () => 'Can the squad that Fell Back shoot this turn?',
      choices: yesNo,
      answer: (w) => (w.state.units[ENGAGED].turn.moved === 'fall-back' && !unitHas(w.state, ENGAGED, 'TITANIC') ? 'no' : 'yes'),
      explain: () => 'No: a unit that Falls Back can’t shoot or charge for the rest of the turn.',
    },
    {
      kind: 'ask',
      id: 'coherency',
      question: () => 'Each Intercessor must stay close to the rest of its squad. Within how far of another model from its unit?',
      choices: () => CHOICES.map((n) => ({ id: `${n}"`, label: `${n}"` })),
      answer: (w) => inches(coherencyGap(sheetOf(w.state, OPEN).base)),
      explain: (w) =>
        `${inches(coherencyGap(sheetOf(w.state, OPEN).base))}: every model must stay within ${inches(coherencyGap(sheetOf(w.state, OPEN).base))} of another model from its unit (of two others when the unit has 6 or more models).`,
    },
  ],
};
