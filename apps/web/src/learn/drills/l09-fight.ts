/** Lesson 9: the Fight phase after a charge: who fights first, pile in, attack, consolidate, then the enemy hits back. */
import { canFight, fightOrder, livingModels, stateOf, type Command, type GameEvent, type GameState } from '@recruit/engine';
import type { Drill } from '../drill/types';
import { eventsSince } from './helpers';
import { advanceTo, intercessors, must, NECRONS, scenario, ULTRA, warriors } from './scenario';

const SQUAD = 'A:int';
const ENEMY = 'B:war';
const BASE = 32 / 25.4;
const FIGHT_CMDS: Command['type'][] = ['selectFighter', 'pileIn', 'fightAttacks', 'consolidate'];

const name = (id: string) => (id === SQUAD ? 'Your Intercessors' : 'The Necron Warriors');
const allows = (unitId: string, message: string) => (cmd: Command) => {
  if (cmd.type === 'confirmRoll' || cmd.type === 'reroll' || cmd.type === 'respond') return null;
  return FIGHT_CMDS.includes(cmd.type) && (cmd as { unitId: string }).unitId === unitId ? null : message;
};
const lostWounds = (events: GameEvent[], s: GameState, unitId: string) =>
  events.filter((e): e is Extract<GameEvent, { type: 'woundsLost' }> => e.type === 'woundsLost' && s.models[e.modelId]?.unitId === unitId).reduce((a, e) => a + e.wounds, 0);

export const fight: Drill = {
  id: 'fight',
  title: 'Into the fight',
  intro: 'Your Intercessors have just charged the Necron Warriors. It is your Fight phase.',
  catalogues: [ULTRA, NECRONS],
  // The learner plays both sides here: first your Intercessors, then the Necrons fighting back.
  learner: 'both',
  build: (ctx) => {
    let g = scenario(
      {
        units: [
          { id: SQUAD, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 22, y: 10 } },
          { id: ENEMY, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 10 + 3 + BASE } },
        ],
        setupDice: [6, 6],
      },
      ctx,
    );
    g = advanceTo(g, { phase: 'charge' });
    g = must(g, { type: 'declareCharge', by: 'A', unitId: SQUAD, targetIds: [ENEMY] } as Command);
    g = must(g, { type: 'respond', by: 'B', choice: 'decline' } as Command);
    g = must(g, { type: 'confirmRoll', by: 'A' } as Command);
    const s = stateOf(g);
    // 2.6" straight at the Warriors: 0.4" from them, within Engagement Range.
    const moves = Object.fromEntries(livingModels(s, SQUAD).map((m) => [m.id, { to: { ...m.pos!, y: m.pos!.y + 2.6 } }]));
    g = must(g, { type: 'chargeMove', by: 'A', unitId: SQUAD, moves } as Command);
    return advanceTo(g, { phase: 'fight' });
  },
  // Saving throws are rolled for whichever side is being hit, and Counter-offensive is passed on.
  auto: (s) => {
    const p = s.pending;
    if (p?.kind === 'roll' && s.rolls[p.rollId]?.kind === 'save') return { type: 'confirmRoll', by: p.player } as Command;
    if (p?.kind === 'reaction' && p.reaction === 'counter-offensive') return { type: 'respond', by: p.player, choice: 'decline' } as Command;
    return null;
  },
  stages: [
    {
      kind: 'ask',
      id: 'first',
      question: () => 'Who fights first?',
      choices: () => [SQUAD, ENEMY].map((id) => ({ id, label: name(id) })),
      answer: (w) => fightOrder(w.state).selectable[0] ?? '',
      explain: () => 'Your Intercessors: they charged this turn, and units that charged fight first.',
    },
    {
      kind: 'do',
      id: 'fight',
      prompt: () => 'Fight with your Intercessors: select them, pile in (each model can move up to 3", ending closer to the enemy, or stay put), make their attacks, then consolidate up to 3".',
      guard: allows(SQUAD, 'Your Intercessors fight first: fight with them.'),
      check: (w) => {
        if (!w.state.units[SQUAD].turn.fought || w.state.pending) return null;
        const lost = livingModels(stateOf(w.stageStart), ENEMY).length - livingModels(w.state, ENEMY).length;
        return { pass: true, explain: `Your Intercessors fought: ${lost} Warrior${lost === 1 ? '' : 's'} destroyed.` };
      },
    },
    {
      kind: 'ask',
      id: 'next',
      skip: (w) => !canFight(w.state, ENEMY),
      question: () => 'Who picks the next unit to fight?',
      choices: () => [
        { id: 'A', label: 'You' },
        { id: 'B', label: 'The Necrons' },
      ],
      answer: (w) => fightOrder(w.state).picker,
      explain: () => 'The Necrons: once the chargers have fought, the players take turns picking units, starting with the player whose turn it isn’t.',
    },
    {
      kind: 'do',
      id: 'fight-back',
      prompt: () => 'Now play the Necrons: select the Warriors, pile in, make their attacks, then consolidate.',
      guard: allows(ENEMY, 'Now fight back with the Necron Warriors.'),
      check: (w) => {
        const fought = w.state.units[ENEMY].turn.fought;
        if (!fought && canFight(w.state, ENEMY)) return null;
        if (w.state.pending || w.state.activation?.unitId === ENEMY) return null;
        if (!fought) return { pass: true, explain: 'No Warrior is within Engagement Range any more, so the Necrons can’t fight back.' };
        const events = eventsSince(w.stageStart, w.record);
        const wounds = lostWounds(events, w.state, SQUAD);
        const models = livingModels(stateOf(w.stageStart), SQUAD).length - livingModels(w.state, SQUAD).length;
        return { pass: true, explain: `The Warriors fought back: your Intercessors lost ${wounds} wound${wounds === 1 ? '' : 's'} and ${models} model${models === 1 ? '' : 's'}.` };
      },
    },
  ],
};
