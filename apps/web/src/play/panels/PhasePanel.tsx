/** Chooses what the panel shows: a pause (roll, reaction, placement) first, else the current phase and step. */
import { ChargePanel } from './ChargePanel';
import { CommandPanel } from './CommandPanel';
import { DeployPanel } from './DeployPanel';
import { FightPanel } from './FightPanel';
import { FirstTurnPanel } from './FirstTurnPanel';
import { GameOverPanel } from './GameOverPanel';
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

export function PhasePanel(props: PanelProps) {
  const { state } = props.sb;
  if (state.ended) return <GameOverPanel {...props} />;
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
  return <CommandPanel {...props} />;
}
