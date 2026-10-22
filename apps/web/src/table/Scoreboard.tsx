import type { PlayerKey } from '@recruit/data/missions';
import type { TablePhase, TableSetup, TableState } from './game';

export const PHASE_NAME: Record<TablePhase, string> = {
  command: 'Command phase', movement: 'Movement phase', psychic: 'Psychic phase', shooting: 'Shooting phase',
  charge: 'Charge phase', fight: 'Fight phase', morale: 'Morale phase',
};

/** "Your turn" for the default "You", "Opponent's turn" otherwise. */
export const turnOf = (name: string) => (name === 'You' ? 'Your turn' : `${name}'s turn`);

/** Both players' CP and VP, and where the game is. Stays at the top of the game screen. */
export function Scoreboard({ setup, state }: { setup: TableSetup; state: TableState }) {
  const order: PlayerKey[] = [setup.firstTurn, setup.firstTurn === 'A' ? 'B' : 'A'];
  return (
    <div className="scoreboard">
      <div className="scoreboard__players">
        {order.map((p) => (
          <div key={p} role="group" aria-label={setup.players[p].name} className={`scoreboard__player${state.active === p ? ' scoreboard__player--active' : ''}`}>
            <span className="scoreboard__name">{setup.players[p].name}</span>
            <span className="scoreboard__vp">{state.players[p].total} VP</span>
            <span className="scoreboard__cp">{state.players[p].cp} CP</span>
          </div>
        ))}
      </div>
      <p className="scoreboard__pos" aria-live="polite">
        {state.ended || !state.pos ? 'Game over' : `Round ${state.pos.round} · ${turnOf(setup.players[state.active!].name)} · ${PHASE_NAME[state.pos.phase]}`}
      </p>
    </div>
  );
}
