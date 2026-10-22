/** Chooses what the panel shows: a pause (roll, reaction, placement) first, else the current phase and step. */
import { PHASE_NAMES } from '../game/names';
import { DeployPanel } from './DeployPanel';
import { FirstTurnPanel } from './FirstTurnPanel';
import { MovementPanel } from './MovementPanel';
import { ReinforcementsPanel } from './ReinforcementsPanel';
import type { PanelProps } from './types';

/** Until a phase has its own panel: its name and a button to end it. */
function PlainPhase({ sb, ui }: PanelProps) {
  const { state } = sb;
  const name = PHASE_NAMES[state.phase];
  return (
    <section>
      <h2>{name} phase</h2>
      <button type="button" className="btn btn--primary" onClick={() => ui.setProblems(sb.act({ type: 'endPhase', by: state.active }) ?? [])}>
        End {name} phase
      </button>
    </section>
  );
}

/** Until the roll panel: the roll's dice and Accept. */
function PlainRoll({ sb, ui }: PanelProps) {
  const p = sb.state.pending;
  if (p?.kind !== 'roll') return null;
  const roll = sb.state.rolls[p.rollId];
  return (
    <section>
      <h2>{roll.context}</h2>
      <p>
        {roll.dice.map((d, i) => (
          <span key={i} aria-label={`Die ${i + 1}: ${d.value}`} className="die">
            {d.value}
          </span>
        ))}
      </p>
      <button type="button" className="btn btn--primary" onClick={() => ui.setProblems(sb.act({ type: 'confirmRoll', by: p.player }) ?? [])}>
        Accept
      </button>
    </section>
  );
}

export function PhasePanel(props: PanelProps) {
  const { state } = props.sb;
  if (state.pending?.kind === 'roll') return <PlainRoll {...props} />;
  if (state.phase === 'pre-battle') return state.step === 'deploy' ? <DeployPanel {...props} /> : <FirstTurnPanel {...props} />;
  if (state.phase === 'movement') return state.step === 'move-units' ? <MovementPanel {...props} /> : <ReinforcementsPanel {...props} />;
  return <PlainPhase {...props} />;
}
