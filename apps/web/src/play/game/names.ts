import type { GameState, PlayerId } from '@recruit/engine';
import type { BoardNames } from '../board/BoardSummary';
import { PHASE_NAMES } from '../GamesPage';
import { objectiveLabels } from './objectives';

export const armyName = (s: GameState, p: PlayerId) => s.setup.armies.find((a) => a.player === p)?.name ?? `Player ${p === 'A' ? 1 : 2}`;

const STEP_NAMES: Partial<Record<string, string>> = { reinforcements: 'Reinforcements', 'heroic-interventions': 'Heroic Interventions', coherency: 'Coherency' };

/** "Round 2 · Movement · Reinforcements", or the pre-battle and end steps. */
export function whereText(s: GameState): string {
  if (s.phase === 'pre-battle') return s.step === 'deploy' ? 'Deployment' : 'Who goes first';
  if (s.phase === 'ended') return 'Game over';
  const step = STEP_NAMES[s.step];
  return `Round ${s.round} · ${PHASE_NAMES[s.phase]}${step ? ` · ${step}` : ''}`;
}

export { PHASE_NAMES };

/** Names for the board's screen-reader description. */
export const boardNames = (s: GameState): BoardNames => {
  const labels = objectiveLabels(s.setup.objectives);
  return {
    unit: (id) => s.units[id]?.name ?? id,
    army: (p) => armyName(s, p),
    objective: (id) => labels.get(id) ?? id,
  };
};
