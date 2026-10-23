/** Lesson 15: a real Core Book Combat Patrol mission: deploy in turn, roll off for the first turn, begin the battle. */
import { BOARD_SIZES, centroid, currentStep, dispatch, livingModels, sheetOf, type Command, type GameState, type PlayerId } from '@recruit/engine';
import { formation } from '../../play/board/formation';
import { missionLayout } from '../../play/setup/missionAdapter';
import type { Drill } from '../drill/types';
import { intercessors, NECRONS, scenario, ULTRA, warriors } from './scenario';

export const MISSION = 'cb-incisive-attack';
const who = (p: PlayerId | null) => (p === 'A' ? 'you' : 'the Necrons');
const Who = (p: PlayerId | null) => (p === 'A' ? 'You' : 'The Necrons');
const deployed = (s: GameState, unitId: string) => s.units[unitId].location === 'battlefield';

/** The Necrons set up their next unit in rows around the middle of their zone (shifted up or down until the engine accepts it). */
function necronDeploy(s: GameState, record: Parameters<typeof dispatch>[0]): Command | null {
  const unit = Object.values(s.units).find((u) => u.player === 'B' && u.location === 'deploying');
  if (!unit) return null;
  const zone = s.setup.zones.B;
  const c = centroid(zone);
  const base = sheetOf(s, unit.id).base;
  const models = livingModels(s, unit.id).map((m) => ({ id: m.id, base }));
  for (const dy of [0, 7, -7, 11, -11]) {
    const cmd = { type: 'deploy', by: 'B', unitId: unit.id, positions: formation(models, { x: c.x, y: c.y + dy }, zone) } as Command;
    if (dispatch(record, cmd).ok) return cmd;
  }
  throw new Error(`the Necrons couldn't set up ${unit.name}`);
}

export const missionSetup: Drill = {
  id: 'mission-setup',
  title: 'Set up a mission',
  intro: 'Core Book mission "Incisive Attack" for Combat Patrol. You are the Defender; the Necrons are the Attacker. Your deployment zone is shaded.',
  catalogues: [ULTRA, NECRONS],
  needsMissions: true,
  learner: 'A',
  build: (ctx) => {
    const mission = ctx.missions?.missions.find((m) => m.id === MISSION);
    if (!mission) throw new Error(`mission ${MISSION} not found`);
    const layout = missionLayout(mission.map, BOARD_SIZES['combat-patrol']);
    const nowhere = { x: 0, y: 0 };
    return scenario(
      {
        units: [
          { id: 'A:int', player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: nowhere },
          { id: 'A:lib', player: 'A', sheet: [ULTRA, 'Librarian'], models: [{ profile: 'Librarian', weapons: ['Bolt pistol', 'Force sword'], count: 1 }], at: nowhere },
          { id: 'B:war', player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: nowhere },
          { id: 'B:lord', player: 'B', sheet: [NECRONS, 'Overlord'], models: [{ profile: 'Overlord', weapons: ['Staff of Light (Shooting)', 'Staff of Light (Melee)'], count: 1 }], at: nowhere },
        ],
        layout,
        deploy: false,
        attacker: 'B',
        firstTurn: null,
      },
      ctx,
    );
  },
  // The Necrons deploy when it is their turn to, and choose to go first if they win the roll-off.
  auto: (s, w) => {
    const p = s.pending;
    if (p && p.player === 'B') return { type: p.kind === 'roll' ? 'confirmRoll' : 'respond', by: 'B', ...(p.kind === 'roll' ? {} : { choice: 'decline' }) } as Command;
    if (s.phase !== 'pre-battle') return null;
    if (s.step === 'deploy' && currentStep(s).actingPlayer === 'B') return necronDeploy(s, w.record);
    if (s.step === 'first-turn' && s.rollOffWinner === 'B' && !s.firstPlayer) return { type: 'chooseFirstTurn', by: 'B', first: 'B' } as Command;
    return null;
  },
  stages: [
    {
      kind: 'ask',
      id: 'first',
      question: () => 'You are the Defender. Who sets up a unit first?',
      choices: () => [
        { id: 'A', label: 'You (the Defender)' },
        { id: 'B', label: 'The Necrons (the Attacker)' },
      ],
      answer: (w) => currentStep(w.state).actingPlayer,
      explain: () => 'You do: the Defender sets up first, then the players take turns, one unit at a time.',
    },
    {
      kind: 'do',
      id: 'deploy-intercessors',
      prompt: () => 'Tap your Intercessors, tap inside your deployment zone to place them, drag to adjust, then tap Deploy.',
      guard: (cmd) => (cmd.type === 'deploy' && cmd.unitId === 'A:int' ? null : 'In this drill, set up your Intercessors first.'),
      check: (w) => (deployed(w.state, 'A:int') ? { pass: true, explain: 'Your Intercessors are set up wholly within your deployment zone. The Necrons set up a unit in reply.' } : null),
    },
    {
      kind: 'do',
      id: 'deploy-librarian',
      prompt: () => 'Now set up your Librarian the same way.',
      guard: (cmd) => (cmd.type === 'deploy' && cmd.unitId === 'A:lib' ? null : 'Now set up your Librarian.'),
      check: (w) => (w.state.step === 'first-turn' ? { pass: true, explain: 'Both armies are set up.' } : null),
    },
    {
      kind: 'ask',
      id: 'roll-off',
      question: () => 'Next, the players roll off for the first turn. In a Core Book mission, what does the winner get?',
      choices: () => [
        { id: 'choose', label: 'They choose who takes the first turn' },
        { id: 'first', label: 'They take the first turn' },
        { id: 'deploy', label: 'They set up first' },
      ],
      answer: (w) => (w.state.setup.rules.firstTurn === 'winner-chooses' ? 'choose' : 'first'),
      explain: (w) =>
        w.state.setup.rules.firstTurn === 'winner-chooses'
          ? 'They choose who takes the first turn. (In Arks of Omen missions the winner simply goes first.)'
          : 'They take the first turn.',
    },
    {
      kind: 'do',
      id: 'roll',
      prompt: (w) =>
        w.state.firstPlayer
          ? 'Tap Start the battle.'
          : w.state.rollOffWinner === 'A'
            ? 'You won! Choose who goes first.'
            : 'Tap Roll off. The higher roll wins; ties roll again.',
      guard: (cmd) => (cmd.type === 'rollOffFirstTurn' || cmd.type === 'chooseFirstTurn' || cmd.type === 'beginBattle' ? null : 'Roll off for the first turn.'),
      check: (w) =>
        w.state.phase === 'command'
          ? {
              pass: true,
              explain: `${Who(w.state.rollOffWinner)} won the roll-off and chose who goes first: ${who(w.state.firstPlayer)} take the first turn. Battle round 1 begins.`,
            }
          : null,
    },
  ],
};
