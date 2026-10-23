/** Lesson 13: terrain in play: Difficult Ground slows a move, and Dense Cover makes shots harder. */
import type { GameState } from '@recruit/engine';
import type { Drill } from '../drill/types';
import { accepted, charsIn, inches, moveOf, openRoll, rollChoices } from './helpers';
import { advanceTo, intercessors, NECRONS, scenario, terrainBox, ULTRA, warriors } from './scenario';

const LEFT = 'A:int2';
const RIGHT = 'A:int';
const ENEMY = 'B:war';
const DIFFICULT = 2;
const CRATER = terrainBox('craters', 5, 6.5, 15, 9.5, 0.5, 'Crater');
const WOODS = terrainBox('woods', 25, 11, 35, 13, 4, 'Woods');

/** What the open hit roll's dice need, after modifiers (the engine's own numbers). */
function hitNeeded(s: GameState): number | null {
  const p = s.pending;
  if (p?.kind !== 'roll' || p.then.module !== 'attack' || p.then.step !== 'hitRolled') return null;
  const d = p.then.data as { needed?: number; mod?: number };
  return typeof d.needed === 'number' ? Math.min(6, d.needed - (d.mod ?? 0)) : null;
}

export const terrain: Drill = {
  id: 'terrain',
  title: 'Craters and woods',
  intro: 'Your left-hand squad has a crater in front of it. Your right-hand squad faces the Necron Warriors across a wood.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: RIGHT, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 30, y: 5 } },
            { id: LEFT, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 10, y: 5 } },
            { id: ENEMY, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 30, y: 18 } },
          ],
          terrain: [CRATER, WOODS],
        },
        ctx,
      ),
      { phase: 'movement' },
    ),
  stages: [
    {
      kind: 'ask',
      id: 'difficult',
      question: () => 'The crater is Difficult Ground. How far can the left-hand squad move this turn if it crosses it?',
      choices: () => [2, 4, 6, 8].map((n) => ({ id: `${n}"`, label: `${n}"` })),
      answer: (w) => inches(moveOf(charsIn(w.state, LEFT, 'Intercessor')) - DIFFICULT),
      explain: (w) => {
        const m = moveOf(charsIn(w.state, LEFT, 'Intercessor'));
        return `${inches(m - DIFFICULT)}: the Intercessors’ Move of ${inches(m)}, minus ${inches(DIFFICULT)} for moving over Difficult Ground.`;
      },
    },
    {
      kind: 'do',
      id: 'cross',
      prompt: () => 'Make a Normal Move with the left-hand squad straight across the crater (up to 4"), then confirm it.',
      guard: (cmd) =>
        (cmd.type === 'beginMove' || cmd.type === 'completeMove' || cmd.type === 'cancelMove') && cmd.unitId === LEFT ? null : 'In this drill, move the left-hand squad across the crater.',
      check: (w) => (accepted(w, 'completeMove').length ? { pass: true, explain: 'Your squad crossed the crater.' } : null),
    },
    {
      kind: 'do',
      id: 'to-shooting',
      prompt: () => 'Now go to the Shooting phase: tap End Movement, then end the Movement and Psychic phases.',
      guard: (cmd) => (cmd.type === 'endPhase' || cmd.type === 'endStep' || cmd.type === 'remainStationary' ? null : 'End the phases to reach the Shooting phase.'),
      check: (w) => (w.state.phase === 'shooting' ? { pass: true, explain: 'On to the Shooting phase.' } : null),
    },
    {
      kind: 'do',
      id: 'shoot',
      prompt: () => 'Shoot the right-hand squad’s bolt rifles at the Warriors behind the woods.',
      guard: (cmd) =>
        cmd.type === 'shoot' && cmd.unitId === RIGHT && cmd.assignments.every((a) => a.targetUnitId === ENEMY) ? null : 'In this drill, shoot the right-hand squad at the Warriors.',
      check: (w) => (openRoll(w.state)?.kind === 'hit' ? { pass: true, explain: 'The woods don’t block the view, so the shot goes ahead.' } : null),
    },
    {
      kind: 'ask',
      id: 'dense',
      question: () => 'The woods are Dense Cover, 4" tall. What does each of these dice need to hit?',
      choices: rollChoices,
      answer: (w) => `${hitNeeded(w.state)}+`,
      explain: (w) => {
        const bs = charsIn(w.state, RIGHT, 'Intercessor').BS;
        const n = hitNeeded(w.state);
        return n === bs ? `${n}+: nothing is in the way, so you hit on your Ballistic Skill.` : `${n}+: their Ballistic Skill is ${bs}+, but Dense Cover gives -1 to hit. (A 6 always hits.)`;
      },
    },
  ],
};
