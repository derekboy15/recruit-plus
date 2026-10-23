/** Lesson 8: declare a charge, face Overwatch, roll 2D6 and judge whether you make it; then Heroic Interventions. */
import { eligibleUnits, livingModels, stateOf, type Command, type GameEvent, type GameState } from '@recruit/engine';
import type { Drill } from '../drill/types';
import { accepted, eventsSince, inches, openRoll, rollTotal, yesNo } from './helpers';
import { advanceTo, gapBetween, intercessors, NECRONS, scenario, ULTRA, warriors } from './scenario';

const SQUAD = 'A:int';
const ENEMY = 'B:war';
const LORD = 'B:lord';
const BASE = 32 / 25.4;
const EPS = 1e-6;

type E<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
const need = (s: GameState) => Math.max(0, gapBetween(s, SQUAD, ENEMY) - 1);
/** The engine's final charge distance (after any re-roll), from the last time it set the charging unit's roll. */
function chargeDistance(events: GameEvent[]): number | null {
  const sets = events.filter((e): e is E<'activationSet'> => e.type === 'activationSet' && e.activation.kind === 'charge');
  const roll = (sets.at(-1)?.activation as { roll?: number | null } | undefined)?.roll;
  return typeof roll === 'number' ? roll : null;
}
const canIntervene = (s: GameState) => eligibleUnits(s, 'heroic').includes(LORD) && gapBetween(s, LORD, SQUAD) <= 3 + EPS;

export const charge: Drill = {
  id: 'charge',
  title: 'Charge!',
  intro: 'Your Intercessors are 6" from the Necron Warriors. An Overlord stands 2" from the Warriors.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: SQUAD, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 22, y: 8 } },
            { id: ENEMY, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 8 + 6 + BASE } },
            {
              id: LORD,
              player: 'B',
              sheet: [NECRONS, 'Overlord'],
              models: [{ profile: 'Overlord', weapons: ['Staff of Light (Shooting)', 'Staff of Light (Melee)'], count: 1 }],
              // 2" to the right of the Warriors' front row (its last base ends at x = 25 + 0.63); the Overlord's base is 40mm.
              at: { x: 25 + BASE / 2 + 2 + 20 / 25.4, y: 8 + 6 + BASE },
            },
          ],
        },
        ctx,
      ),
      { phase: 'charge' },
    ),
  // The Necrons answer the charge with Fire Overwatch when they can, and confirm their own rolls.
  auto: (s) => {
    const p = s.pending;
    if (!p || p.player === 'A') return null;
    if (p.kind === 'roll') return { type: 'confirmRoll', by: p.player } as Command;
    if (p.kind === 'reaction') {
      const choice = p.reaction === 'charge-declared' && p.options.includes('overwatch') ? `overwatch:${ENEMY}` : 'decline';
      return { type: 'respond', by: p.player, choice } as Command;
    }
    return null;
  },
  stages: [
    {
      kind: 'do',
      id: 'declare',
      prompt: (w) =>
        openRoll(w.state)?.kind === 'save'
          ? 'The Necrons fire Overwatch! Accept your saving throws.'
          : 'Tap your Intercessors, tap the Necron Warriors as the target, then Declare charge.',
      guard: (cmd) => {
        if (cmd.type === 'confirmRoll') return null;
        return cmd.type === 'declareCharge' && cmd.unitId === SQUAD && cmd.targetIds.length === 1 && cmd.targetIds[0] === ENEMY
          ? null
          : 'In this drill, charge the Necron Warriors with your Intercessors.';
      },
      check: (w) => {
        if (openRoll(w.state)?.kind !== 'charge') return null;
        const events = eventsSince(w.stageStart, w.record);
        const overwatch = events.some((e) => e.type === 'stratagemUsed' && e.name === 'Fire Overwatch');
        if (!overwatch) return { pass: true, explain: 'The Necrons didn’t fire Overwatch. Now roll for the charge.' };
        const shots = events.filter((e): e is E<'diceRolled'> => e.type === 'diceRolled' && e.roll.kind === 'hit' && e.roll.player === 'B');
        const dice = shots.flatMap((e) => e.roll.dice);
        const hits = dice.filter((d) => d.value === 6).length;
        const lost = livingModels(stateOf(w.stageStart), SQUAD).length - livingModels(w.state, SQUAD).length;
        return {
          pass: true,
          explain: `The Necrons spent 1 CP to fire Overwatch: it only hits on an unmodified 6, so ${hits} of their ${dice.length} shots hit${lost ? `, and you lost ${lost} Intercessor${lost === 1 ? '' : 's'}` : ''}.`,
        };
      },
    },
    {
      kind: 'ask',
      id: 'make-it',
      question: (w) => {
        const r = openRoll(w.state);
        const roll = r ? ` Your charge roll is ${r.dice.map((d) => d.value).join(' + ')} = ${rollTotal(r)}.` : '';
        return `The Warriors are ${inches(gapBetween(w.state, SQUAD, ENEMY))} away, so you need ${inches(need(w.state))} to get within Engagement Range (1").${roll} Can you make it?`;
      },
      choices: yesNo,
      answer: (w) => (rollTotal(openRoll(w.state)!) >= need(w.state) - EPS ? 'yes' : 'no'),
      explain: (w) => {
        const t = rollTotal(openRoll(w.state)!);
        return t >= need(w.state) - EPS ? `Yes: ${t}" is enough to cover the ${inches(need(w.state))} you need.` : `No: ${t}" isn’t enough to cover the ${inches(need(w.state))} you need.`;
      },
    },
    {
      kind: 'do',
      id: 'move',
      prompt: () => 'Accept the roll. If it is enough, drag your Intercessors into Engagement Range of the Warriors and confirm the charge move; if not, tap The charge fails.',
      guard: (cmd) =>
        cmd.type === 'confirmRoll' || cmd.type === 'reroll' || ((cmd.type === 'chargeMove' || cmd.type === 'failCharge') && cmd.unitId === SQUAD)
          ? null
          : 'Finish this charge first.',
      check: (w) => {
        if (accepted(w, 'chargeMove').length) return { pass: true, explain: 'Charge made: your Intercessors are in combat, and they will fight first in the Fight phase.' };
        if (!accepted(w, 'failCharge').length) return null;
        const rolled = chargeDistance(eventsSince(w.start, w.record)) ?? 0;
        const needed = need(stateOf(w.stageStart));
        if (rolled >= needed - EPS)
          return { pass: false, explain: `Your charge roll of ${rolled}" was enough to cover the ${inches(needed)} you needed: the charge could have succeeded. Try again!` };
        return { pass: true, explain: 'Not far enough: the charge fails, and your Intercessors stay where they are.' };
      },
    },
    {
      kind: 'do',
      id: 'end-charges',
      prompt: () => 'Tap End Charges: you have no more units to charge with.',
      guard: (cmd) => (cmd.type === 'endStep' ? null : 'Tap End Charges to go on.'),
      check: (w) => (w.state.step !== 'charges' ? { pass: true, explain: 'Your charges are done. Now your opponent may Heroically Intervene.' } : null),
    },
    {
      kind: 'ask',
      id: 'heroic',
      skip: (w) => w.state.step !== 'heroic-interventions',
      question: () => 'The Necron Overlord is near the fight. Can it Heroically Intervene?',
      choices: yesNo,
      answer: (w) => (canIntervene(w.state) ? 'yes' : 'no'),
      explain: (w) =>
        canIntervene(w.state)
          ? 'Yes: it is a CHARACTER within 3" of your Intercessors, and not in Engagement Range, so it may move up to 3" into the fight.'
          : 'No: a CHARACTER must be within 3" of an enemy unit to Heroically Intervene, and the Overlord isn’t.',
    },
  ],
};
