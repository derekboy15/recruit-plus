/** What a saved game's row says on the games list. */
import type { PlayerKey } from '@recruit/data/missions';
import type { TableSetup, TableState } from './game';

/** "You 13 – 0 Opponent": Player A's name and VP, an en dash, then Player B's VP and name (the format Practice uses). */
export function scoreLine(setup: TableSetup, totals: Record<PlayerKey, { total: number }>): string {
  return `${setup.players.A.name} ${totals.A.total} – ${totals.B.total} ${setup.players.B.name}`;
}

/** "Round 2" while the game runs, "Finished" once it has ended, "" when it couldn't be read. */
export function gameStatus(state: TableState | null): string {
  if (!state) return '';
  return state.ended || !state.pos ? 'Finished' : `Round ${state.pos.round}`;
}
