/** Lesson 12: a Stratagem in action: spend 1 CP on Command Re-roll when a charge roll falls short. */
import { usedThisPhase, type GameEvent, type GameState } from '@recruit/engine';
import type { Drill, Watch } from '../drill/types';
import { accepted, eventsSince, inches, openRoll, rollTotal, yesNo } from './helpers';
import { advanceTo, gapBetween, intercessors, NECRONS, scenario, ULTRA, warriors } from './scenario';

const SQUAD = 'A:int';
const ENEMY = 'B:war';
const BASE = 32 / 25.4;
const EPS = 1e-6;
const STRAT = 'Command Re-roll';
type E<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

const need = (s: GameState) => Math.max(0, gapBetween(s, SQUAD, ENEMY) - 1);
const rerolled = (w: Watch) => eventsSince(w.start, w.record).some((e) => e.type === 'diceRerolled' && e.source === 'command-reroll');
/** The engine's final charge distance, from the last time it set the charging unit's roll. */
function chargeDistance(w: Watch): number | null {
  const sets = eventsSince(w.start, w.record).filter((e): e is E<'activationSet'> => e.type === 'activationSet' && e.activation.kind === 'charge');
  const roll = (sets.at(-1)?.activation as { roll?: number | null } | undefined)?.roll;
  return typeof roll === 'number' ? roll : null;
}
const sum = (s: GameState) => {
  const r = openRoll(s)!;
  return `${r.dice.map((d) => d.value).join(' + ')} = ${rollTotal(r)}`;
};

export const stratagems: Drill = {
  id: 'stratagems',
  title: 'Command Re-roll',
  intro: 'Your Intercessors are 9" from the Necron Warriors, so a charge needs 8": a hard roll. You have 4 CP to spend.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: SQUAD, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 22, y: 4 } },
            { id: ENEMY, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 4 + 9 + BASE } },
          ],
        },
        ctx,
      ),
      { phase: 'charge' },
    ),
  stages: [
    {
      kind: 'do',
      id: 'declare',
      prompt: () => 'Tap your Intercessors, tap the Necron Warriors as the target, then Declare charge.',
      guard: (cmd) => (cmd.type === 'declareCharge' && cmd.unitId === SQUAD && cmd.targetIds.join() === ENEMY ? null : 'In this drill, charge the Necron Warriors with your Intercessors.'),
      check: (w) =>
        openRoll(w.state)?.kind === 'charge' ? { pass: true, explain: `The Necrons didn’t fire Overwatch. Your charge roll: ${sum(w.state)}, and you need ${inches(need(w.state))}.` } : null,
    },
    {
      kind: 'do',
      id: 'reroll',
      // Only when the first roll was already enough (checked again after the re-roll, which then counts as done).
      skip: (w) => !rerolled(w) && (!openRoll(w.state) || rollTotal(openRoll(w.state)!) >= need(w.state) - EPS),
      prompt: () => 'Too short! Spend 1 CP on the Command Re-roll Stratagem: tap Re-roll.',
      guard: (cmd) => (cmd.type === 'reroll' && cmd.source === 'command-reroll' ? null : 'In this drill, use Command Re-roll on the charge roll.'),
      check: (w) => (rerolled(w) ? { pass: true, explain: `Command Re-roll: you spent 1 CP (${w.state.cp.A} left) and re-rolled both dice: ${sum(w.state)}.` } : null),
    },
    {
      kind: 'ask',
      id: 'one-die',
      question: () => 'Could you have re-rolled just one of the two dice?',
      choices: yesNo,
      answer: (w) => (openRoll(w.state)?.whole ? 'no' : 'yes'),
      explain: () => 'No: a charge roll is 2D6 rolled together, so Command Re-roll re-rolls both dice.',
    },
    {
      kind: 'do',
      id: 'move',
      prompt: () => 'Accept the roll. If it is enough, drag your Intercessors within 1" of the Warriors and confirm the charge move; if not, tap The charge fails.',
      guard: (cmd) => (cmd.type === 'confirmRoll' || ((cmd.type === 'chargeMove' || cmd.type === 'failCharge') && cmd.unitId === SQUAD) ? null : 'Finish this charge first.'),
      check: (w) => {
        const rolled = chargeDistance(w) ?? 0;
        if (accepted(w, 'chargeMove').length) return { pass: true, explain: `Charge made: ${rolled}" was enough.` };
        if (!accepted(w, 'failCharge').length) return null;
        const needed = need(w.state);
        if (rolled >= needed - EPS) return { pass: false, explain: `Your charge roll of ${rolled}" was enough to cover the ${inches(needed)} you needed: the charge could have succeeded. Try again!` };
        return { pass: true, explain: `Not far enough: ${rolled}" falls short, so the charge fails.` };
      },
    },
    {
      kind: 'ask',
      id: 'again',
      question: () => 'Could you use Command Re-roll again in this phase?',
      choices: yesNo,
      answer: (w) => (usedThisPhase(w.state, 'A', STRAT) ? 'no' : 'yes'),
      explain: (w) =>
        usedThisPhase(w.state, 'A', STRAT)
          ? 'No: each Stratagem can be used only once per phase, and you have used Command Re-roll in this one.'
          : 'Yes: you haven’t used Command Re-roll in this phase, and each Stratagem can be used once per phase.',
    },
  ],
};
