/** After deployment: the roll-off for the first turn, the winner's choice (Core Book) and the start of the battle. */
import type { PlayerId } from '@recruit/engine';
import { armyName } from '../game/names';
import type { PanelProps } from './types';
import { PinAction } from '../game/actionBar';

export function FirstTurnPanel({ sb, ui }: PanelProps) {
  const s = sb.state;
  const run = (problems: ReturnType<typeof sb.act>) => ui.setProblems(problems ?? []);
  if (s.firstPlayer)
    return (
      <section>
        <h2>{armyName(s, s.firstPlayer)} goes first</h2>
        <PinAction slot="end">
          <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'beginBattle', by: s.active }))}>
            Start the battle
          </button>
        </PinAction>
      </section>
    );
  if (s.rollOffWinner)
    return (
      <section>
        <h2>Who goes first?</h2>
        <p>{armyName(s, s.rollOffWinner)} won the roll-off: who goes first?</p>
        {(['A', 'B'] as PlayerId[]).map((p) => (
          <button key={p} type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'chooseFirstTurn', by: s.rollOffWinner!, first: p }))}>
            {armyName(s, p)} goes first
          </button>
        ))}
      </section>
    );
  return (
    <section>
      <h2>Who goes first?</h2>
      <p>Both players roll a D6; the higher roll wins (ties roll again).</p>
      <PinAction slot="end">
        <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'rollOffFirstTurn', by: s.active }))}>
          Roll off
        </button>
      </PinAction>
    </section>
  );
}
