/** Chooses what the panel shows: a pause (roll, reaction, placement) first, else the current phase and step. */
import { PHASE_NAMES } from '../game/names';
import { ChargePanel } from './ChargePanel';
import { DeployPanel } from './DeployPanel';
import { FightPanel } from './FightPanel';
import { FirstTurnPanel } from './FirstTurnPanel';
import { HeroicPanel } from './HeroicPanel';
import { MoralePanel } from './MoralePanel';
import { MovementPanel } from './MovementPanel';
import { PlacementPanel } from './PlacementPanel';
import { PsychicPanel } from './PsychicPanel';
import { ReactionPanel } from './ReactionPanel';
import { ReinforcementsPanel } from './ReinforcementsPanel';
import { RollPanel } from './RollPanel';
import { ShootingPanel } from './ShootingPanel';
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

export function PhasePanel(props: PanelProps) {
  const { state } = props.sb;
  if (state.pending?.kind === 'roll') return <RollPanel {...props} />;
  if (state.pending?.kind === 'reaction') return <ReactionPanel {...props} />;
  if (state.placements?.length) return <PlacementPanel {...props} />;
  if (state.phase === 'pre-battle') return state.step === 'deploy' ? <DeployPanel {...props} /> : <FirstTurnPanel {...props} />;
  if (state.phase === 'movement') return state.step === 'move-units' ? <MovementPanel {...props} /> : <ReinforcementsPanel {...props} />;
  if (state.phase === 'psychic') return <PsychicPanel {...props} />;
  if (state.phase === 'shooting') return <ShootingPanel {...props} />;
  if (state.phase === 'charge') return state.step === 'charges' ? <ChargePanel {...props} /> : <HeroicPanel {...props} />;
  if (state.phase === 'fight') return <FightPanel {...props} />;
  if (state.phase === 'morale') return <MoralePanel {...props} />;
  return <PlainPhase {...props} />;
}
